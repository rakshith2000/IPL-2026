from . import db
from .models import User, Pointstable, Fixture, Squad, Toppers
import os, csv, re, pytz, requests, time
from werkzeug.security import generate_password_hash, check_password_hash
from flask import Blueprint, jsonify, render_template, url_for, redirect, request, flash, Response, json, stream_with_context, current_app
from flask_login import login_required, current_user
from sqlalchemy import and_, or_
from sqlalchemy.sql import text
import requests, warnings
from bs4 import BeautifulSoup
from fuzzywuzzy import fuzz, process
from urllib.request import Request, urlopen
import math, random, cloudscraper, cloudscraper.exceptions
import numpy as np
from datetime import datetime, date, time, timedelta
from collections import defaultdict, Counter
import threading, lxml.etree

warnings.filterwarnings("ignore")

scraper = cloudscraper.create_scraper()

main = Blueprint('main', __name__)

tz = pytz.timezone('Asia/Kolkata')

# ------------------------------------------------------------------ playoff simulation
# IPL: 10 teams, 70 league matches (double round-robin), top 4 into the playoffs.
SIMULATIONS = 500_000   # numpy-vectorised, so this is cheap: SE <= 0.07 percentage points
SIM_CHUNK = 5_000       # sims per batch: keeps the working set in cache, and caps
                        # peak memory whatever SIMULATIONS is set to
SIM_SEED = 20260328     # fixed seed => an unchanged points table always gives the same %

OVERS = 20              # a side bowled out is still deemed to have faced its full 20
PROB_NR = 0.022         # washout rate: IPL averages ~0-3 no-results in 70 matches

# Priors for the scoring model. calibrate_match_model() moves these toward whatever
# this season's completed matches say; with no matches played it returns them unchanged.
PRIOR_MEAN_SCORE = 172.0   # runs per innings
PRIOR_STD_DEV = 30.0       # real IPL per-innings SD is ~30-35
PRIOR_HOME_ADV = 6.0       # runs, i.e. roughly a 55% home win rate
RIDGE_MEAN = 4.0           # shrinkage weights, in "pseudo-innings" of prior evidence
RIDGE_TEAM = 8.0           # keeps team ratings near the league mean early in the season
RIDGE_HOME = 25.0
RIDGE_CHASE = 25.0
SIGMA_PRIOR_WEIGHT = 25.0
EM_ITERS = 12              # EM sweeps for the censored-chase likelihood
SCORE_FLOOR, SCORE_CEIL = 60, 300
RATING_CAP = 25.0          # runs, hard cap on a team's attack/defence rating
CHASE_PACING = 0.64        # a chasing side paces itself, so only part of its spare capacity
                           # turns into spare balls: tuned so won chases finish with ~13 to
                           # spare, as they do in the IPL. Straight line would give ~20.

pofs = {'Q1':'Qualifier 1', 'E':'Eliminator', 'Q2':'Qualifier 2', 'F':'Final'}

liveURL_Prefix = "https://cmc2.sportskeeda.com/live-cricket-score/"
liveURL_Suffix = "/ajax"

statsURL = "https://ipl-stats-sports-mechanic.s3.ap-south-1.amazonaws.com/ipl/feeds/stats/"

playerStatsURL = "https://ipl-stats-sports-mechanic.s3.ap-south-1.amazonaws.com/ipl/feeds/stats/player/"

#statsBaseURL = "https://www.cricbuzz.com/api/cricket-series/series-stats/9241/"

tp_urls = {
    "orange": "https://www.sportskeeda.com/go/ipl/orange-cap",
    "purple": "https://www.sportskeeda.com/go/ipl/purple-cap",
    "sr": "https://www.sportskeeda.com/go/ipl/best-strike-rate",
    "6s": "https://www.sportskeeda.com/go/ipl/most-sixes",
    "hs": "https://www.sportskeeda.com/go/ipl/highest-scores",
    "bbi": "https://www.sportskeeda.com/go/ipl/best-bowling-average"
}

statsList = {
    "batting_stats" : {"Most Runs": "toprunsscorers", "Most Sixes": "mostsixes", "Most Sixes (Innings)": "mostsixesinnings", "Most Fours": "mostfours", "Most Fours (Innings)": "mostfoursinnings", "Most 50s": "mostfifties", "Most 100s": "mostcenturies", "Fastest 50s": "fastestfifties", "Fastest 100s": "fastestcenturies", "Highest Scores": "highestindividualscorers", "Best Strike Rate": "higheststrikeratetournament", "Best Strike Rate (Innings)": "higheststrikerateinnings", "Best Batting Averages": "highestaverages"},
    "bowling_stats" : {"Most Wickets": "mostwickets", "Most Maidens": "mostmaidenoversbowledtournament", "Most Dot Balls": "mostdotballsbowledtournament", "Most Dot Balls (Innings)": "mostdotballsbowledinnings", "Best Bowling Averages": "bestaverages", "Best Bowling Economy": "besteconomyrates", "Best Bowling Economy (Innings)": "besteconomyratesinnings", "Best Bowling Strike Rate": "beststrikeratestournament", "Best Bowling Strike Rate (Innings)": "beststrikeratesinnings", "Best Bowling Figures": "bestbowlingfigures", "Most Runs Conceded (Innings)": "mostrunsconceededinnings", "Most Hat-tricks": "mosthattricks"},
    "awards" : {"Most Valuable Players": "mvpPlayersList", "Fair Play Award": "fairplayList"}
}

champions = {
    'MI':    ['2013', '2015', '2017', '2019', '2020'],
    'KKR':   ['2012', '2014', '2024'],
    'CSK':   ['2010', '2011', '2018', '2021', '2023'],
    'RR':    ['2008'],
    'DC':    [],
    'RCB':   ['2025', '2026'],
    'SRH':   ['2016'],
    'GT':    ['2022'],
    'PBKS':  [],
    'LSG':   [],
}

teams_data = {
    'CSK': {'Captain': 'Ruturaj Gaikwad', 'Coach': 'Stephen Fleming', 'Owner': 'Chennai Super Kings Cricket Ltd', 'Venue': 'M. A. Chidambaram Stadium'},
    'DC': {'Captain': 'Axar Patel', 'Coach': 'Hemang Badani', 'Owner': 'JSW GMR Cricket Pvt Ltd', 'Venue': 'Arun Jaitley Stadium'},
    'GT': {'Captain': 'Shubman Gill', 'Coach': 'Ashish Nehra', 'Owner': 'Irelia Sports India Pvt Ltd', 'Venue': 'Narendra Modi Stadium'},
    'KKR': {'Captain': 'Ajinkya Rahane', 'Coach': 'Abhishek Nayar', 'Owner': 'Knight Riders Sports Pvt Ltd', 'Venue': 'Eden Gardens'},
    'LSG': {'Captain': 'Rishabh Pant', 'Coach': 'Justin Langer', 'Owner': 'RPSG Sports Pvt Ltd', 'Venue': 'BRSABV Ekana Cricket Stadium'},
    'MI': {'Captain': 'Hardik Pandya', 'Coach': 'Mahela Jayawardene', 'Owner': 'Indiawin Sports Pvt Ltd', 'Venue': 'Wankhede Stadium'},
    'PBKS': {'Captain': 'Shreyas Iyer', 'Coach': 'Ricky Ponting', 'Owner': 'KPH Dream Cricket Pvt Ltd', 'Venue': 'Punjab Cricket Association Stadium'},
    'RR': {'Captain': 'Riyan Parag', 'Coach': 'Kumar Sangakkara', 'Owner': 'Royal Multisport Pvt Ltd', 'Venue': 'Sawai Mansingh Stadium'},
    'RCB': {'Captain': 'Rajat Patidar', 'Coach': 'Andy Flower', 'Owner': 'Royal Challengers Sports Pvt Ltd', 'Venue': 'M. Chinnaswamy Stadium'},
    'SRH': {'Captain': 'Pat Cummins', 'Coach': 'Daniel Vettori', 'Owner': 'Sun TV Network Ltd', 'Venue': 'Rajiv Gandhi Intl. Cricket Stadium'}
}

full_name = {'CSK':'Chennai Super Kings',
             'DC':'Delhi Capitals',
             'KKR':'Kolkata Knight Riders',
             'GT':'Gujarat Titans',
             'LSG':'Lucknow Super Giants',
             'MI':'Mumbai Indians',
             'PBKS':'Punjab Kings',
             'RR':'Rajasthan Royals',
             'RCB':'Royal Challengers Bengaluru',
             'SRH':'Sunrisers Hyderabad',
             'TBA':'TBA'}

teamID = {610:['CSK','Chennai Super Kings'],
             612:['DC','Delhi Capitals'],
             123216:['GT','Gujarat Titans'],
             591:['KKR','Kolkata Knight Riders'],
             123214:['LSG','Lucknow Super Giants'],
             593:['MI','Mumbai Indians'],
             627:['PBKS','Punjab Kings'],
             629:['RR','Rajasthan Royals'],
             646:['RCB','Royal Challengers Bengaluru'],
             658:['SRH','Sunrisers Hyderabad'],
             127770:['TBA','TBA'],
             127775:['TBA','TBA']}

clr = {'CSK':{'c1':'#ffff3c', 'c2':'#fdcd05', 'c3':'#00adef'},  #fdcd05 f15c19,
        'DC':{'c1':'#d71921', 'c2':'#2561ae', 'c3':'#282968'},
        'GT':{'c1':'#dbbe6e', 'c2':'#242b64', 'c3':'#1b2133'},
        'KKR':{'c1':'#F9E278', 'c2':'#64517C', 'c3':'#3a225d'},
        'LSG':{'c1':'#002554', 'c2':'#aa003b', 'c3':'#3A5FAC'},
        'MI':{'c1':'#d1ab3e', 'c2':'#0077b6', 'c3':'#004ba0'},
        'PBKS':{'c1':'#ed1d24', 'c2':'#f2d1a0', 'c3':'#4960b6'},
        'RR':{'c1':'#ff69b4', 'c2':'#074ea2', 'c3':'#cba92b'},
        'RCB':{'c1':'#20285d', 'c2':'#444444', 'c3':'hsl(356, 99%, 45%)'},
        'SRH':{'c1':'#f26522', 'c2':'#ed1a37', 'c3':'#221f21'},
        'TBA':{'c1':'#ffffff', 'c2':'#ffffff', 'c3':'#ffffff'}}

ptclr = {'CSK':'#f9cd05',
        'DC':'#282968',
        'GT':"#1d2247",
        'KKR':'#3a225d',
        'LSG':'#aa003b',
        'MI':'#004ba0',
        'PBKS':'#ed1b24',
        'RR':'#e60693',
        'RCB':'#ec1c24',
        'SRH':'#ff822a'}

sqclr = {
    'CSK': {'c1': '#fcee21', 'c2': '#0b67b2'},  # Yellow to Navy Blue
    'MI': {'c1': 'hsl(32 24% 56%)', 'c2': 'hsl(208 100% 31%)'},    # Blue to Gold
    'RCB': {'c1': 'hsl(356, 99%, 45%)', 'c2': '#20285d'},       # Red to Black
    'KKR': {'c1': '#3a225d', 'c2': '#f1c025'},   # Purple to Gold
    'SRH': {'c1': '#f26332', 'c2': '#ffcc06'},       # Orange to Black
    'DC': {'c1': 'hsl(346 100% 44%)', 'c2': 'hsl(213 100% 25%)'},    # Blue to Red
    'PBKS': {'c1': '#eb222d', 'c2': '#ffdead'},    # Red to Gold
    'RR': {'c1': '#df238f', 'c2': '#294096'},   # Pink to Blue
    'GT': {'c1': '#0b1c31', 'c2': '#e3ca7c'},   # Navy to Gold
    'LSG': {'c1': '#aa003b', 'c2': '#002554'}     # Light Blue to Gold
}

def _mills_ratio(a):
    """phi(a) / (1 - Phi(a)) - the expected overshoot of a normal draw above a.

    Used to fill in the scores of successful chases, which are only ever observed
    as ">= the target". Arrays here are at most a few hundred long, so the
    per-element loop costs nothing and saves a scipy dependency.
    """
    out = np.empty(len(a), dtype=float)
    for k, v in enumerate(a):
        tail = 0.5 * math.erfc(v / math.sqrt(2.0))
        out[k] = (v + 1.0 / v) if tail < 1e-12 else (
            math.exp(-0.5 * v * v) / math.sqrt(2.0 * math.pi) / tail)
    return out

def home_venue_map():
    """{venue: home team}, derived from the fixture list rather than hard-coded.

    In the fixture CSV the host is always listed as Team_A, so the home side for a
    venue is whichever team is listed first there most often. That keeps secondary
    home grounds (Guwahati, Dharamsala, Raipur...) right, and handles the odd
    relocated match where the visitor is listed first.
    """
    rows = db.session.query(Fixture.Venue, Fixture.Team_A).filter(
        Fixture.Match_No.notin_(list(pofs.values()))).all()
    hosts = defaultdict(Counter)
    for venue, team_a in rows:
        if venue and team_a:
            hosts[venue][team_a] += 1
    return {venue: counter.most_common(1)[0][0] for venue, counter in hosts.items()}

def innings_observations(home_of):
    """One row per completed league innings, as
    (batting, bowling, is_home, is_chase, runs, censor_at).

    censor_at is None when the innings was seen in full, or the target when the
    chase succeeded - the side stopped batting on reaching it, so all we know is
    that its notional 20-over total was at least that high. Modelling that
    censoring is what lets every innings inform the ratings without the sample
    being skewed by winning chases stopping early.

    Super overs, DLS and abandoned matches are skipped: for those the innings
    total either isn't attributable to a batting order or isn't a 20-over score.
    """
    fixtures = Fixture.query.filter(Fixture.Result != None).filter(
        Fixture.Match_No.notin_(list(pofs.values()))).order_by(Fixture.id).all()
    rows = []
    for fx in fixtures:
        res = fx.Result or ''
        if fx.Win_T in (None, 'NA') or 'Super over' in res or 'DLS' in res or 'abandoned' in res:
            continue
        if 'wicket' in res:        # the winner chased, so it batted second
            first, second = (fx.Team_B, fx.Team_A) if fx.Win_T == fx.Team_A else (fx.Team_A, fx.Team_B)
        elif 'run' in res:         # the winner defended, so it batted first
            first, second = (fx.Team_A, fx.Team_B) if fx.Win_T == fx.Team_A else (fx.Team_B, fx.Team_A)
        else:
            continue
        info = {fx.Team_A: fx.A_info or {}, fx.Team_B: fx.B_info or {}}
        r1, r2 = info[first].get('runs'), info[second].get('runs')
        if not r1 or not r2:
            continue
        home = home_of.get(fx.Venue, fx.Team_A)
        rows.append((first, second, first == home, False, r1, None))
        rows.append((second, first, second == home, True, r2, r1 + 1 if r2 > r1 else None))
    return rows

def calibrate_match_model(observations=None, home_of=None):
    """Fit this season's scoring model: innings runs ~ mean + attack + defence + home + chase.

    A ridge penalty pulls every coefficient toward its prior, weighted in
    pseudo-innings, so the fit degrades gracefully: no matches played returns the
    priors exactly, and team ratings only move as far as the results justify.
    Successful chases enter as right-censored observations, handled by EM.
    """
    home_of = home_venue_map() if home_of is None else home_of
    obs = innings_observations(home_of) if observations is None else observations

    names = list(teams_data)
    idx = {t: k for k, t in enumerate(names)}
    obs = [o for o in obs if o[0] in idx and o[1] in idx]
    n_t = len(names)
    n_col = 3 + 2 * n_t                      # mean | attack(10) | defence(10) | home | chase

    X = np.zeros((len(obs), n_col))
    y = np.zeros(len(obs))
    cens = np.full(len(obs), np.nan)
    for k, (bat, bowl, is_home, is_chase, runs, censor_at) in enumerate(obs):
        X[k, 0] = 1.0
        X[k, 1 + idx[bat]] = 1.0
        X[k, 1 + n_t + idx[bowl]] = 1.0
        X[k, -2] = 1.0 if is_home else 0.0
        X[k, -1] = 1.0 if is_chase else 0.0
        y[k] = runs
        if censor_at is not None:
            cens[k] = censor_at

    penalty = np.concatenate(([RIDGE_MEAN], np.full(2 * n_t, RIDGE_TEAM), [RIDGE_HOME, RIDGE_CHASE]))
    prior = np.concatenate(([PRIOR_MEAN_SCORE], np.zeros(2 * n_t), [PRIOR_HOME_ADV, 0.0]))
    normal_eq = X.T @ X + np.diag(penalty)   # ridge diagonal keeps this solvable at n = 0
    target = penalty * prior

    beta = np.linalg.solve(normal_eq, X.T @ y + target)
    sigma = PRIOR_STD_DEV
    censored = ~np.isnan(cens)
    for _ in range(EM_ITERS):
        fit = X @ beta
        work = y.copy()
        sq = np.empty(len(obs))
        sq[~censored] = (y[~censored] - fit[~censored]) ** 2
        if censored.any():
            a = (cens[censored] - fit[censored]) / sigma
            ratio = _mills_ratio(a)
            work[censored] = fit[censored] + sigma * ratio      # E[runs | runs >= target]
            sq[censored] = sigma ** 2 * (1.0 + a * ratio)       # and its second moment
        sigma = math.sqrt((sq.sum() + SIGMA_PRIOR_WEIGHT * PRIOR_STD_DEV ** 2)
                          / (len(obs) + SIGMA_PRIOR_WEIGHT))
        beta = np.linalg.solve(normal_eq, X.T @ work + target)

    return {
        'mean': float(beta[0]),
        'sigma': float(np.clip(sigma, 18.0, 45.0)),
        'attack': {t: float(np.clip(beta[1 + k], -RATING_CAP, RATING_CAP)) for t, k in idx.items()},
        'defence': {t: float(np.clip(beta[1 + n_t + k], -RATING_CAP, RATING_CAP)) for t, k in idx.items()},
        'home_adv': float(np.clip(beta[-2], -15.0, 25.0)),
        'chase_adj': float(np.clip(beta[-1], -20.0, 20.0)),
        'home_of': home_of,
        'innings': len(obs),
    }

def _pct(count, total):
    """Percentage, keeping 'impossible' and 'merely unlikely' visibly different.

    Returns a plain float - a numpy scalar would reach psycopg2 unadaptable.
    """
    if count <= 0:
        return 0.0
    if count >= total:
        return 100.0
    return float(min(99.9, max(0.1, round(count / total * 100.0, 1))))

def get_top4_playoffs(teams, remaining_matches, model=None):
    """Monte-Carlo playoff probabilities for every team.

    teams:             {team: {points, wins, runs_for, overs_faced, runs_against, overs_bowled}}
                       with overs as DECIMAL overs (run ovToPer() on the stored x.y values).
                       Iteration order breaks exact ties, so pass it ranked.
    remaining_matches: (team_a, team_b) or (team_a, team_b, venue) rows, league matches only.

    Each simulated match plays out as a real one: a first innings of 20 overs, then
    a chase that either falls short over the full 20 or gets there early - which is
    what moves net run rate, and net run rate is what settles most top-4 cut-offs.
    Teams are ranked on points, then wins, then NRR, matching both the IPL playing
    conditions and the table this feeds.
    """
    names = list(teams)
    n_t = len(names)
    idx = {t: k for k, t in enumerate(names)}
    if model is None:
        model = calibrate_match_model()
    mu, sigma = model['mean'], model['sigma']
    attack, defence = model['attack'], model['defence']
    home_adv, chase_adj = model['home_adv'], model['chase_adj']
    home_of = model.get('home_of', {})

    # Resolve each fixture's expected scores once, outside the simulation loop.
    fixtures = []
    for m in remaining_matches:
        a, b, venue = m[0], m[1], (m[2] if len(m) > 2 else None)
        if a not in idx or b not in idx:
            continue
        home = home_of.get(venue, a)
        exp_a = mu + attack.get(a, 0.0) + defence.get(b, 0.0) + (home_adv if home == a else 0.0)
        exp_b = mu + attack.get(b, 0.0) + defence.get(a, 0.0) + (home_adv if home == b else 0.0)
        fixtures.append((idx[a], idx[b], exp_a, exp_b))

    base = {k: np.array([float(teams[t].get(k, 0) or 0) for t in names])
            for k in ('points', 'wins', 'runs_for', 'overs_faced', 'runs_against', 'overs_bowled')}

    total = SIMULATIONS if fixtures else 1     # nothing left to play => one deterministic pass
    rng = np.random.default_rng(SIM_SEED + len(fixtures))
    counts = np.zeros((n_t, 3))
    done = 0
    while done < total:
        n = min(SIM_CHUNK, total - done)
        # Accumulators are (team, sim): one team's row is contiguous, so the eight
        # updates each match needs stay cache-friendly.
        pts, wins, runs_for, overs_faced, runs_against, overs_bowled = (
            np.repeat(base[k][:, None], n, axis=1) for k in
            ('points', 'wins', 'runs_for', 'overs_faced', 'runs_against', 'overs_bowled'))

        for i, j, exp_a, exp_b in fixtures:
            a_first = rng.random(n) < 0.5           # who bats first is close to a coin toss
            no_res = rng.random(n) < PROB_NR
            exp_1 = np.where(a_first, exp_a, exp_b)
            exp_2 = np.where(a_first, exp_b, exp_a) + chase_adj

            first = rng.standard_normal(n)
            first *= sigma
            first += exp_1
            np.rint(first, out=first)
            np.clip(first, SCORE_FLOOR, SCORE_CEIL, out=first)
            # What the chasing side would make in a full 20 overs; it only bats on
            # until the target, so this decides the result and how early it finishes.
            second = rng.standard_normal(n)
            second *= sigma
            second += exp_2
            np.rint(second, out=second)
            np.clip(second, SCORE_FLOOR - 20, SCORE_CEIL + 20, out=second)

            target = first + 1.0
            chased = second >= target
            over_hit = np.minimum(rng.integers(0, 5, n), np.maximum(second - target, 0.0))
            pace = np.clip(rng.standard_normal(n) * 0.07 + 1.0, 0.7, 1.15)
            spare = 1.0 - CHASE_PACING * (1.0 - target / np.maximum(second, 1.0))
            balls = np.clip(np.ceil(120.0 * spare * pace), 24, 120)
            runs_2 = np.where(chased, target + over_hit, second)
            # An innings that ends in defeat counts as the full 20 whether the side
            # was bowled out or simply ran out of overs.
            overs_2 = np.where(chased, balls / 6.0, float(OVERS))

            tied = (~chased) & (second == first)    # a tie goes to a super over, not shared points
            super_over = rng.random(n) < 0.5
            first_won = (~chased & ~tied) | (tied & super_over)
            a_won = np.where(a_first, first_won, chased | (tied & ~super_over)) & ~no_res
            b_won = (~no_res) & ~a_won

            pts[i] += np.where(no_res, 1.0, np.where(a_won, 2.0, 0.0))
            pts[j] += np.where(no_res, 1.0, np.where(b_won, 2.0, 0.0))
            wins[i] += a_won
            wins[j] += b_won

            live = ~no_res                          # a no-result leaves run rates untouched
            a_runs = np.where(a_first, first, runs_2) * live
            a_overs = np.where(a_first, float(OVERS), overs_2) * live
            b_runs = np.where(a_first, runs_2, first) * live
            b_overs = np.where(a_first, overs_2, float(OVERS)) * live
            runs_for[i] += a_runs
            overs_faced[i] += a_overs
            runs_against[i] += b_runs
            overs_bowled[i] += b_overs
            runs_for[j] += b_runs
            overs_faced[j] += b_overs
            runs_against[j] += a_runs
            overs_bowled[j] += a_overs

        scored = np.divide(runs_for, overs_faced, out=np.zeros_like(runs_for), where=overs_faced > 0)
        conceded = np.divide(runs_against, overs_bowled, out=np.zeros_like(runs_against), where=overs_bowled > 0)
        # One sort key for points > wins > NRR; the gaps are wide enough that the
        # lower-priority terms can never bleed into the higher ones.
        key = pts * -1e6 - wins * 1e3 - np.clip(scored - conceded, -400.0, 400.0)
        order = np.argsort(np.ascontiguousarray(key.T), axis=1, kind='stable')
        counts[:, 0] += np.bincount(order[:, :4].ravel(), minlength=n_t)
        counts[:, 1] += np.bincount(order[:, :2].ravel(), minlength=n_t)
        counts[:, 2] += np.bincount(order[:, 0], minlength=n_t)
        done += n

    return {t: {'top4': _pct(counts[k, 0], total),
                'top2': _pct(counts[k, 1], total),
                'top1': _pct(counts[k, 2], total)} for t, k in idx.items()}

def refresh_qualification():
    dataPT = Pointstable.query.order_by(Pointstable.Points.desc(),Pointstable.W.desc(),Pointstable.NRR.desc(),Pointstable.id.asc()).all()
    teams_t4 = {tm.team_name : {'points': tm.Points, 'wins': tm.W, 'runs_for': tm.For['runs'], 'overs_faced': ovToPer(tm.For['overs']), 'runs_against': tm.Against['runs'], 'overs_bowled': ovToPer(tm.Against['overs'])} for tm in dataPT}
    remaining_matches = db.session.query(Fixture.Team_A, Fixture.Team_B, Fixture.Venue).filter(Fixture.Result == None).filter(Fixture.Match_No.notin_(list(pofs.values()))).order_by(Fixture.id).all()
    top_4 = get_top4_playoffs(teams_t4, remaining_matches)
    for tm in dataPT:
        tm.Qual = top_4[tm.team_name]['top4']
        tm.Top2 = top_4[tm.team_name]['top2']
    db.session.commit()

def run_refresh_qualification_bg(app):
    with app.app_context():
        try:
            refresh_qualification()
            print("Qualification percentages updated.")
        except Exception as e:
            print(f"Error updating qualifications: {e}")

def serialize(obj):
    if isinstance(obj, dict):
        return {k: serialize(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [serialize(i) for i in obj]
    elif isinstance(obj, (time, datetime, date)):
        return obj.isoformat()
    else:
        return obj

def normalize_name(name):
    """Normalize names for better matching"""
    # Remove special characters and extra spaces
    name = re.sub(r'[^a-zA-Z ]', '', name.lower()).strip()
    # Handle common name variations
    name = name.replace('mohd', 'mohammed').replace('md', 'mohammed')
    return ' '.join(sorted(name.split()))  # Sort name parts for order-independent matching

def get_player_stats(URL_ID):
    URL = playerStatsURL + f"{URL_ID}-playerstats.js"
    try:
        response = requests.get(URL, verify=False)
        data = response.text
        data = data.split('(', 1)[1].strip(');')
        try:
            data = json.loads(data)
        except json.JSONDecodeError:
            data = data.replace("'", '"')
            data = json.loads(data)
    except Exception as e:
        print(f"Error fetching player stats for {URL_ID}: {e}")
        return None
    
    stats = {'Overall': {}}
    if data and isinstance(data['Batting'], list) and len(data['Batting']) > 0:
        stats['Overall']['batting'] = data['Batting'][0]
        stats['Overall']['bowling'] = data['Bowling'][0]
        stats['years'] = [entry.get('Year') for entry in data['Batting'][1:]]
    else:
        stats['Overall']['batting'] = None
        stats['Overall']['bowling'] = None
        stats['years'] = None

    if stats['years'] is not None:
        for year in stats['years']:
            stats[year] = {}
            stats[year]['batting'] = next((entry for entry in data['Batting'][1:] if entry.get('Year') == year), None)
            stats[year]['bowling'] = next((entry for entry in data['Bowling'][1:] if entry.get('Year') == year), None)
    return stats

def find_player(full_name, player_data, threshold=80):
    """
    Find the best matching player in the database

    Args:
        full_name (str): Name to search for (e.g., "Akash Naman Singh")
        player_data (list): List of player tuples from database
        threshold (int): Minimum match score (0-100)

    Returns:
        tuple: Best matching player record or None
    """
    # Extract just the names from player data (3rd element in each tuple)
    player_names = [player[2] for player in player_data]

    # First try exact match
    normalized_search = normalize_name(full_name)
    for i, player in enumerate(player_data):
        if normalize_name(player[2]) == normalized_search:
            return player

    # Then try fuzzy matching with multiple strategies
    strategies = [
        (fuzz.token_set_ratio, "token set ratio"),
        (fuzz.token_sort_ratio, "token sort ratio"),
        (fuzz.partial_ratio, "partial ratio"),
        (fuzz.WRatio, "weighted ratio")
    ]

    best_match = None
    best_score = 0

    for player in player_data:
        db_name = player[2]
        for strategy, _ in strategies:
            score = strategy(full_name, db_name)
            if score > best_score:
                best_score = score
                best_match = player
                if best_score == 100:  # Perfect match
                    return best_match

    # Also check initials match (e.g., "A. N. Singh" vs "Akash Naman Singh")
    if best_score < threshold:
        search_initials = ''.join([word[0] for word in full_name.split() if len(word) > 1])
        for player in player_data:
            db_name = player[2]
            db_initials = ''.join([word[0] for word in db_name.split() if len(word) > 1 and word[0].isupper()])
            if db_initials and search_initials == db_initials:
                return player

    return best_match if best_score >= threshold else None

def get_data_from_url(url):
    response = requests.get(url, verify=False)
    res = response.json()
    SquadDT = (db.session.execute(text('SELECT * FROM Squad')).fetchall())
    if response.status_code == 200:
        try:
            headers = res['t20StatsList']['headers']
            data = []
            for row in res['t20StatsList']['values']:
                d = {}
                for value, head in zip(row['values'][1:], headers):
                    if 'Team' not in d:
                        match = find_player(value, SquadDT)
                        d['Team'] = match[3] if match else "NA"
                        d[head.capitalize()] = match[2] if match else value
                    else:
                        d[head.capitalize()] = value
                data.append(d)
            return data
        except Exception:
            return None
    else:
        return None

def update_potm():
    potms = (db.session.execute(text('SELECT "POTM" FROM Fixture WHERE "POTM" IS NOT NULL')).fetchall())
    counts = Counter([(p[0]['name'], p[0]['team']) for p in potms])
    potms = [{"name": name, "team": team, "potm": count} for (name, team), count in counts.items()]

    for potm in potms:
        sq = Squad.query.filter_by(Name=potm['name']).first()
        stats = get_player_stats(sq.URL_ID) if sq else None
        if stats and stats['2026']:
            potm['matches'] = int(stats['2026']['batting']['Matches']) if stats['2026']['batting']['Matches'] else 0
            potm['innings'] = int(stats['2026']['batting']['Innings']) if stats['2026']['batting']['Innings'] else 0
            potm['runs'] = int(stats['2026']['batting']['Runs']) if stats['2026']['batting']['Runs'] else 0
            potm['wickets'] = int(stats['2026']['bowling']['Wickets']) if stats['2026']['bowling']['Wickets'] else 0

    potms = sorted(
        potms,
        key=lambda x: (x['potm'], x['runs'], x['wickets']),
        reverse=True
    )

    toppers = Toppers.query.filter_by(category="Most POTM").first()
    toppers.stats = potms
    db.session.commit()

def update_toppers():
    """
    Fetches the given URL, extracts the first row of the table with class 'keeda-data-table' inside div.left,
    and returns it as a dictionary with headers as keys. Returns empty dict on failure.
    """
    SquadFull = (db.session.execute(text('SELECT * FROM Squad')).fetchall())
    update_potm()
    for stats_type, stats in statsList.items():
        for stat_name, token in stats.items():
            try:
                """
                headers = {
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
                    "Accept-Language": "en-US,en;q=0.5",
                    "Referer": "https://www.google.com/",
                    "Connection": "keep-alive",
                }
                """
                url = statsURL + f"2026-{token}.js" if stats_type == "awards" else statsURL + f"284-{token}.js"
                response = requests.get(url, verify=False)
                data = response.text
                data = data.split('(', 1)[1].strip(');')
                data = next(iter((json.loads(data)).values()))
                tp = Toppers.query.filter_by(category=stat_name).first()
                if data and isinstance(data, list) and len(data) > 0:
                    if stat_name not in ["Fair Play Award"]:
                        for row in data:
                            playerKey = 'StrikerName' if stats_type == "batting_stats" else 'BowlerName' if stats_type == "bowling_stats" else 'PlayerName'
                            player = find_player(row[playerKey], SquadFull)
                            row[playerKey] = player[2] if player is not None else row[playerKey]
                            row['TeamCode'] = player[3] if player is not None else row['TeamCode']
                    tp.stats = data
                else:
                    tp.stats = None
                db.session.commit()
            except Exception as e:
                print(f"Error updating toppers for {stat_name}: {e}")
                return
    
def get_innings_data(matID):
    inn1 = requests.get(f"https://apiv2.cricket.com.au/web/views/comments?fixtureId={matID}&inningNumber=1&commentType=&overLimit=21&jsconfig=eccn%3Atrue&format=json", verify=False).json()
    inn2 = requests.get(f"https://apiv2.cricket.com.au/web/views/comments?fixtureId={matID}&inningNumber=2&commentType=&overLimit=21&jsconfig=eccn%3Atrue&format=json", verify=False).json()
    return inn1, inn2

def calculate_age(dob, current_date):
    # Calculate the number of full years
    years = current_date.year - dob.year
    has_birthday_passed = (current_date.month, current_date.day) >= (dob.month, dob.day)

    # Adjust the years if the birthday has not yet occurred this year
    if not has_birthday_passed:
        years -= 1

    # Calculate the last birthday date
    last_birthday = dob.replace(year=current_date.year) if has_birthday_passed else dob.replace(
        year=current_date.year - 1)

    current_date = current_date.date()

    # Calculate the number of days since the last birthday
    days = (current_date - last_birthday).days
    return str(years) + " years " + str(days) + " days"

def oversAdd(a, b):
    A, B = round(int(a)*6 + (a-int(a))*10, 0), round(int(b)*6 + (b-int(b))*10, 2)
    S = int(A) + int(B)
    s = S//6 + (S%6)/10
    return s

def oversSub(a, b):
    A, B = round(int(a) * 6 + (a - int(a)) * 10, 0), round(int(b) * 6 + (b - int(b)) * 10, 2)
    S = int(A) - int(B)
    s = S // 6 + (S % 6) / 10
    return s

def ovToPer(n):
    return (int(n)+((n-int(n))*10)/6)

def upPTNormal(team, teamScore, teamScoreOpp, match, win_team):
    teamScore['overs'] = 20 if teamScore['wkts'] == 10 else teamScore['overs']
    teamScoreOpp['overs'] = 20 if teamScoreOpp['wkts'] == 10 else teamScoreOpp['overs']
    teamPT = db.session.execute(text('SELECT team_name, "P", "W", "L", "Points", "For", "Against", "Win_List" FROM pointstable WHERE team_name = :team_name'),{'team_name': str(team)}).fetchall()
    for i in teamPT:
        if i[0] == win_team:
            P, W, L, Points = 1 + i[1], 1 + i[2], 0 + i[3], 2 + i[4]
            wl = eval(i[7])
            wl[int(match)] = 'W'
            wl = dict(sorted(wl.items()))
        else:
            P, W, L, Points = 1 + i[1], 0 + i[2], 1 + i[3], 0 + i[4]
            wl = eval(i[7])
            wl[int(match)] = 'L'
            wl = dict(sorted(wl.items()))
        For = {'runs': i[5]['runs'] + teamScore['runs'], 'overs': oversAdd(i[5]['overs'], teamScore['overs'])}
        Against = {'runs': i[6]['runs'] + teamScoreOpp['runs'], 'overs': oversAdd(i[6]['overs'], teamScoreOpp['overs'])}
        NRR = round((For['runs'] / ovToPer(For['overs']) - Against['runs'] / ovToPer(Against['overs'])), 3)
        PT = Pointstable.query.filter_by(team_name=str(i[0])).first()
        PT.P, PT.W, PT.L, PT.Points, PT.NRR, PT.Win_List, PT.For, PT.Against = P, W, L, Points, NRR, str(wl), For, Against
    db.session.commit()

def upPTSuperOver(team, teamScore, teamScoreOpp, match, so_win_team):
    teamScore['overs'] = 20 if teamScore['wkts'] == 10 else teamScore['overs']
    teamScoreOpp['overs'] = 20 if teamScoreOpp['wkts'] == 10 else teamScoreOpp['overs']
    teamPT = db.session.execute(text('SELECT team_name, "P", "W", "L", "Points", "For", "Against", "Win_List" FROM pointstable WHERE team_name = :team_name'),{'team_name': str(team)}).fetchall()
    for i in teamPT:
        if i[0] == so_win_team:
            P, W, L, Points = 1 + i[1], 1 + i[2], 0 + i[3], 2 + i[4]
            wl = eval(i[7])
            wl[int(match)] = 'W'
            wl = dict(sorted(wl.items()))
        else:
            P, W, L, Points = 1 + i[1], 0 + i[2], 1 + i[3], 0 + i[4]
            wl = eval(i[7])
            wl[int(match)] = 'L'
            wl = dict(sorted(wl.items()))
        For = {'runs': i[5]['runs'] + teamScore['runs'], 'overs': oversAdd(i[5]['overs'], teamScore['overs'])}
        Against = {'runs': i[6]['runs'] + teamScoreOpp['runs'], 'overs': oversAdd(i[6]['overs'], teamScoreOpp['overs'])}
        NRR = round((For['runs'] / ovToPer(For['overs']) - Against['runs'] / ovToPer(Against['overs'])), 3)
        PT = Pointstable.query.filter_by(team_name=str(i[0])).first()
        PT.P, PT.W, PT.L, PT.Points, PT.NRR, PT.Win_List, PT.For, PT.Against = P, W, L, Points, NRR, str(wl), For, Against
    db.session.commit()

def upPTAbandoned(team, match, toss_status):
    teamPT = db.session.execute(text('SELECT team_name, "P", "NR", "Points", "Win_List" FROM pointstable WHERE team_name = :team_name'),{'team_name': str(team)}).fetchall()
    for i in teamPT:
        P, NR, Points = 1 + i[1], 1 + i[2], 1 + i[3]
        wl = eval(i[4])
        wl[int(match)] = 'D'
        wl = dict(sorted(wl.items()))
        PT = Pointstable.query.filter_by(team_name=str(i[0])).first()
        PT.P, PT.NR, PT.Points, PT.Win_List = P, NR, Points, str(wl)
    db.session.commit()

def upPTDLS(team, teamScore, teamScoreOpp, match, win_team):
    teamScore['oversDLS'] = teamScore['revOvers'] if teamScore['wkts'] == 10 else teamScore['oversDLS']
    teamScoreOpp['oversDLS'] = teamScoreOpp['revOvers'] if teamScoreOpp['wkts'] == 10 else teamScoreOpp['oversDLS']
    teamPT = db.session.execute(text('SELECT team_name, "P", "W", "L", "Points", "For", "Against", "Win_List" FROM pointstable WHERE team_name = :team_name'),{'team_name': str(team)}).fetchall()
    for i in teamPT:
        if i[0] == win_team:
            P, W, L, Points = 1 + i[1], 1 + i[2], 0 + i[3], 2 + i[4]
            wl = eval(i[7])
            wl[int(match)] = 'W'
            wl = dict(sorted(wl.items()))
        else:
            P, W, L, Points = 1 + i[1], 0 + i[2], 1 + i[3], 0 + i[4]
            wl = eval(i[7])
            wl[int(match)] = 'L'
            wl = dict(sorted(wl.items()))
        For = {'runs': i[5]['runs'] + teamScore['runsDLS'], 'overs': oversAdd(i[5]['overs'], teamScore['oversDLS'])}
        Against = {'runs': i[6]['runs'] + teamScoreOpp['runsDLS'], 'overs': oversAdd(i[6]['overs'], teamScoreOpp['oversDLS'])}
        NRR = round((For['runs'] / ovToPer(For['overs']) - Against['runs'] / ovToPer(Against['overs'])), 3)
        PT = Pointstable.query.filter_by(team_name=str(i[0])).first()
        PT.P, PT.W, PT.L, PT.Points, PT.NRR, PT.Win_List, PT.For, PT.Against = P, W, L, Points, NRR, str(wl), For, Against
    db.session.commit()

def delPTNormal(team, teamScore, teamScoreOpp, match, win_team):
    teamScore['overs'] = 20 if teamScore['wkts'] == 10 else teamScore['overs']
    teamScoreOpp['overs'] = 20 if teamScoreOpp['wkts'] == 10 else teamScoreOpp['overs']
    teamPT = db.session.execute(text('SELECT team_name, "P", "W", "L", "Points", "For", "Against", "Win_List" FROM pointstable WHERE team_name = :team_name'),{'team_name': str(team)}).fetchall()
    for i in teamPT:
        if i[0] == win_team:
            P, W, L, Points = -1 + i[1], -1 + i[2], 0 + i[3], -2 + i[4]
            wl = eval(i[7])
            del wl[int(match)]
            wl = dict(sorted(wl.items()))
        else:
            P, W, L, Points = -1 + i[1], 0 + i[2], -1 + i[3], 0 + i[4]
            wl = eval(i[7])
            del wl[int(match)]
            wl = dict(sorted(wl.items()))
        For = {'runs': i[5]['runs'] - teamScore['runs'], 'overs': oversSub(i[5]['overs'], teamScore['overs'])}
        Against = {'runs': i[6]['runs'] - teamScoreOpp['runs'], 'overs': oversSub(i[6]['overs'], teamScoreOpp['overs'])}
        if ovToPer(For['overs']) == 0 or ovToPer(Against['overs']) == 0:
            NRR = 0.0
        else:
            NRR = round((For['runs'] / ovToPer(For['overs']) - Against['runs'] / ovToPer(Against['overs'])), 3)
        PT = Pointstable.query.filter_by(team_name=str(i[0])).first()
        PT.P, PT.W, PT.L, PT.Points, PT.NRR, PT.Win_List, PT.For, PT.Against = P, W, L, Points, NRR, str(wl), For, Against
    db.session.commit()

def delPTSuperOver(team, teamScore, teamScoreOpp, match, so_win_team):
    teamScore['overs'] = 20 if teamScore['wkts'] == 10 else teamScore['overs']
    teamScoreOpp['overs'] = 20 if teamScoreOpp['wkts'] == 10 else teamScoreOpp['overs']
    teamPT = db.session.execute(text('SELECT team_name, "P", "W", "L", "Points", "For", "Against", "Win_List" FROM pointstable WHERE team_name = :team_name'),{'team_name': str(team)}).fetchall()
    for i in teamPT:
        if i[0] == so_win_team:
            P, W, L, Points = -1 + i[1], -1 + i[2], 0 + i[3], -2 + i[4]
            wl = eval(i[7])
            del wl[int(match)]
            wl = dict(sorted(wl.items()))
        else:
            P, W, L, Points = -1 + i[1], 0 + i[2], -1 + i[3], 0 + i[4]
            wl = eval(i[7])
            del wl[int(match)]
            wl = dict(sorted(wl.items()))
        For = {'runs': i[5]['runs'] - teamScore['runs'], 'overs': oversSub(i[5]['overs'], teamScore['overs'])}
        Against = {'runs': i[6]['runs'] - teamScoreOpp['runs'], 'overs': oversSub(i[6]['overs'], teamScoreOpp['overs'])}
        if ovToPer(For['overs']) == 0 or ovToPer(Against['overs']) == 0:
            NRR = 0.0
        else:
            NRR = round((For['runs'] / ovToPer(For['overs']) - Against['runs'] / ovToPer(Against['overs'])), 3)
        PT = Pointstable.query.filter_by(team_name=str(i[0])).first()
        PT.P, PT.W, PT.L, PT.Points, PT.NRR, PT.Win_List, PT.For, PT.Against = P, W, L, Points, NRR, str(wl), For, Against
    db.session.commit()

def delPTAbandoned(team, match):
    teamPT = db.session.execute(text('SELECT team_name, "P", "NR", "Points", "Win_List" FROM pointstable WHERE team_name = :team_name'),{'team_name': str(team)}).fetchall()
    for i in teamPT:
        P, NR, Points = -1 + i[1], -1 + i[2], -1 + i[3]
        wl = eval(i[4])
        del wl[int(match)]
        wl = dict(sorted(wl.items()))
        PT = Pointstable.query.filter_by(team_name=str(i[0])).first()
        PT.P, PT.NR, PT.Points, PT.Win_List = P, NR, Points, str(wl)
    db.session.commit()

def delPTDLS(team, teamScore, teamScoreOpp, match, win_team):
    teamScore['oversDLS'] = teamScore['revOvers'] if teamScore['wkts'] == 10 else teamScore['oversDLS']
    teamScoreOpp['oversDLS'] = teamScoreOpp['revOvers'] if teamScoreOpp['wkts'] == 10 else teamScoreOpp['oversDLS']
    teamPT = db.session.execute(text('SELECT team_name, "P", "W", "L", "Points", "For", "Against", "Win_List" FROM pointstable WHERE team_name = :team_name'),{'team_name': str(team)}).fetchall()
    for i in teamPT:
        if i[0] == win_team:
            P, W, L, Points = -1 + i[1], -1 + i[2], 0 + i[3], -2 + i[4]
            wl = eval(i[7])
            del wl[int(match)]
            wl = dict(sorted(wl.items()))
        else:
            P, W, L, Points = -1 + i[1], 0 + i[2], -1 + i[3], 0 + i[4]
            wl = eval(i[7])
            del wl[int(match)]
            wl = dict(sorted(wl.items()))
        For = {'runs': i[5]['runs'] - teamScore['runsDLS'], 'overs': oversSub(i[5]['overs'], teamScore['oversDLS'])}
        Against = {'runs': i[6]['runs'] - teamScoreOpp['runsDLS'], 'overs': oversSub(i[6]['overs'], teamScoreOpp['oversDLS'])}
        if ovToPer(For['overs']) == 0 or ovToPer(Against['overs']) == 0:
            NRR = 0.0
        else:
            NRR = round((For['runs'] / ovToPer(For['overs']) - Against['runs'] / ovToPer(Against['overs'])), 3)
        PT = Pointstable.query.filter_by(team_name=str(i[0])).first()
        PT.P, PT.W, PT.L, PT.Points, PT.NRR, PT.Win_List, PT.For, PT.Against = P, W, L, Points, NRR, str(wl), For, Against
    db.session.commit()
    
def upMatchNormal(data):
    FR = Fixture.query.filter_by(Match_No=str(data['match'])).first()
    a, b = FR.Team_A, FR.Team_B
    FR.Result = '{} won by {} {}'.format(full_name[data['result']['win_team']], data['result']['win_by'], data['result']['win_type'])
    FR.Win_T = data['result']['win_team']
    FR.A_info, FR.B_info = {'runs':data['team_A']['runs'], 'overs':data['team_A']['overs'], 'wkts':data['team_A']['wkts']}, {'runs':data['team_B']['runs'], 'overs':data['team_B']['overs'], 'wkts':data['team_B']['wkts']}
    db.session.commit()
    if data['match'].isdigit():
        upPTNormal(a, data['team_A'], data['team_B'], data['match'], data['result']['win_team'])
        upPTNormal(b, data['team_B'], data['team_A'], data['match'], data['result']['win_team'])

def upMatchSuperOver(data):
    FR = Fixture.query.filter_by(Match_No=str(data['match'])).first()
    a, b = FR.Team_A, FR.Team_B
    FR.Result = '{} won Super over by {} {}'.format(full_name[data['result']['so_win_team']], data['result']['so_win_by'], data['result']['so_win_type'])
    FR.Win_T = data['result']['so_win_team']
    FR.A_info, FR.B_info = {'runs':data['team_A']['runs'], 'overs':data['team_A']['overs'], 'wkts':data['team_A']['wkts'], 'runsSO':data['team_A']['runsSO'], 'oversSO':data['team_A']['oversSO'], 'wktsSO':data['team_A']['wktsSO']}, {'runs':data['team_B']['runs'], 'overs':data['team_B']['overs'], 'wkts':data['team_B']['wkts'], 'runsSO':data['team_B']['runsSO'], 'oversSO':data['team_B']['oversSO'], 'wktsSO':data['team_B']['wktsSO']}
    db.session.commit()
    if data['match'].isdigit():
        upPTSuperOver(a, data['team_A'], data['team_B'], data['match'], data['result']['so_win_team'])
        upPTSuperOver(b, data['team_B'], data['team_A'], data['match'], data['result']['so_win_team'])

def upMatchAbandoned(data):
    FR = Fixture.query.filter_by(Match_No=str(data['match'])).first()
    a, b = FR.Team_A, FR.Team_B
    FR.Result = 'No result (Match abandoned due to {} - without toss)'.format(data['reason']) if data['toss_status'] == 'without_toss' else 'No result (Match abandoned due to {})'.format(data['reason'])
    FR.Win_T = "NA"
    FR.A_info = {'runs':0, 'overs':0.0, 'wkts':0} if data['toss_status'] == 'without_toss' else data['team_A']
    FR.B_info = {'runs':0, 'overs':0.0, 'wkts':0} if data['toss_status'] == 'without_toss' else data['team_B']
    db.session.commit()
    if data['match'].isdigit():
        upPTAbandoned(a, data['match'], data['toss_status'])
        upPTAbandoned(b, data['match'], data['toss_status'])

def upMatchDLS(data):
    FR = Fixture.query.filter_by(Match_No=str(data['match'])).first()
    a, b = FR.Team_A, FR.Team_B
    FR.Result = '{} won by {} {} (DLS method - Target {} in {} Ovrs)'.format(full_name[data['result']['win_team']], data['result']['win_by'], data['result']['win_type'], data['result']['dls_target'], data['result']['dls_overs'])
    FR.Win_T = data['result']['win_team']
    FR.A_info, FR.B_info = data['team_A'], data['team_B']
    db.session.commit()
    if data['match'].isdigit():
        upPTDLS(a, data['team_A'], data['team_B'], data['match'], data['result']['win_team'])
        upPTDLS(b, data['team_B'], data['team_A'], data['match'], data['result']['win_team'])

def delMatchNormal(data):
    FR = Fixture.query.filter_by(Match_No=str(data['match'])).first()
    if data['match'].isdigit():
        a, b = FR.Team_A, FR.Team_B
        delPTNormal(a, FR.A_info, FR.B_info, data['match'], FR.Win_T)
        delPTNormal(b, FR.B_info, FR.A_info, data['match'], FR.Win_T)
    FR.Result = None
    FR.Win_T = None
    FR.A_info = {'runs':0, 'overs':0.0, 'wkts':0}
    FR.B_info = {'runs':0, 'overs':0.0, 'wkts':0}
    db.session.commit()

def delMatchSuperOver(data):
    FR = Fixture.query.filter_by(Match_No=str(data['match'])).first()
    if data['match'].isdigit():
        a, b = FR.Team_A, FR.Team_B
        delPTSuperOver(a, FR.A_info, FR.B_info, data['match'], FR.Win_T)
        delPTSuperOver(b, FR.B_info, FR.A_info, data['match'], FR.Win_T)
    FR.Result = None
    FR.Win_T = None
    FR.A_info = {'runs':0, 'overs':0.0, 'wkts':0}
    FR.B_info = {'runs':0, 'overs':0.0, 'wkts':0}
    db.session.commit()

def delMatchAbandoned(data):
    FR = Fixture.query.filter_by(Match_No=str(data['match'])).first()
    if data['match'].isdigit():
        a, b = FR.Team_A, FR.Team_B
        delPTAbandoned(a, data['match'])
        delPTAbandoned(b, data['match'])
    FR.Result = None
    FR.Win_T = None
    FR.A_info = {'runs':0, 'overs':0.0, 'wkts':0}
    FR.B_info = {'runs':0, 'overs':0.0, 'wkts':0}
    db.session.commit()

def delMatchDLS(data):
    FR = Fixture.query.filter_by(Match_No=str(data['match'])).first()
    if data['match'].isdigit():
        a, b = FR.Team_A, FR.Team_B
        delPTDLS(a, FR.A_info, FR.B_info, data['match'], FR.Win_T)
        delPTDLS(b, FR.B_info, FR.A_info, data['match'], FR.Win_T)
    FR.Result = None
    FR.Win_T = None
    FR.A_info = {'runs':0, 'overs':0.0, 'wkts':0}
    FR.B_info = {'runs':0, 'overs':0.0, 'wkts':0}
    db.session.commit()

def concat_DT(D, T):
    dttm = D.strftime('%Y-%m-%d')+' '+ \
                     T.strftime('%H:%M:%S')
    return datetime.strptime(dttm, '%Y-%m-%d %H:%M:%S')

def num_suffix(num):
    if num % 100 in [11, 12, 13]:
        return str(num) + "th"
    elif (num % 10) == 1:
        return str(num) + "st"
    elif (num % 10) == 2:
        return str(num) + "nd"
    elif (num % 10) == 3:
        return str(num) + "rd"
    else:
        return str(num) + "th"

def render_live_URL(tA, tB, mn, dt):
    teamAB = full_name[tA].replace(" ", "-").lower() + "-vs-" + full_name[tB].replace(" ", "-").lower()
    if mn.isdigit():
        matchNo = "match-" + mn
    elif tA != "TBA" and tB != "TBA":
        matchNo = mn.lower().replace(' ','-')
    else:
        matchNo = mn.lower().replace(' ','-') + "-ipl-2026t20"
    dt = dt.strftime("%d-%B-%Y").lower()
    URL = liveURL_Prefix + teamAB + "-" + matchNo + "-" + dt + liveURL_Suffix
    print(URL)
    return URL

def update_rank_for_fixture(match):
    dataPT = Pointstable.query.order_by(Pointstable.Points.desc(),Pointstable.W.desc(),Pointstable.NRR.desc(),Pointstable.id.asc()).all()
    rank_json = {team.team_name: index for index, team in enumerate(dataPT, start=1)}
    FR = Fixture.query.filter_by(Match_No=str(match)).first()
    if FR and match.isdigit():
        FR.Rank = rank_json
    db.session.commit()

def delete_rank_for_fixture(match):
    FR = Fixture.query.filter_by(Match_No=str(match)).first()
    if FR and match.isdigit():
        FR.Rank = None
    db.session.commit()

def getRanksForPT():
    teams = {'CSK': 1, 'DC': 2, 'GT': 3, 'KKR': 4, 'LSG': 5, 'MI': 6, 'PBKS': 7, 'RR': 8, 'RCB': 9, 'SRH': 10}
    matches = Fixture.query.filter(Fixture.Win_T != None).order_by(Fixture.id.desc()).limit(2).all()
    if len(matches) == 0:
        return {team: 0 for team in teams.keys()}
    elif len(matches) == 1:
        rankdiff = {}
        for team, rank in matches[0].Rank.items():
            prev = teams[team]
            rankdiff[team] = prev - rank
        return rankdiff
    elif len(matches) == 2 and matches[0].Rank is None:
         rankdiff = {'CSK': 0, 'DC': 0, 'GT': 0, 'KKR': 0, 'LSG': 0, 'MI': 0, 'PBKS': 0, 'RR': 0, 'RCB': 0, 'SRH': 0}
         return rankdiff
    else:
        rankdiff = {}
        for team, rank in matches[0].Rank.items():
            prev = matches[1].Rank[team]
            rankdiff[team] = prev - rank
        return rankdiff

@main.route('/')
def index():
    PT = Pointstable.query.order_by(Pointstable.Points.desc(), Pointstable.W.desc(),
                                    Pointstable.NRR.desc(), Pointstable.id.asc()).all()
    TP = {t.category: t.stats for t in Toppers.query.order_by(Toppers.id.asc())}
    return render_template('index.html', teams=full_name, clr=clr, pt=PT, tp=TP)

@main.route('/pointstable')
def displayPT():
    dataPT = Pointstable.query.order_by(Pointstable.Points.desc(),Pointstable.W.desc(),Pointstable.NRR.desc(),Pointstable.id.asc()).all()
    dt = [['#', '', 'Team', 'P', 'W', 'L', 'NR', 'Pts', 'NRR', 'Last 5', 'Next', 'Win %', 'Qual %', 'Top 2'], [i for i in range(1,11)],\
         [], [], [], [], [], [], [], [], [], [], [], [], [], []]
    teams_ABV = []
    rankChanges = getRanksForPT()
    finalsData = Fixture.query.filter(Fixture.Match_No == 'Final').first()
    for index, i in enumerate(dataPT):
        img = "/static/images/{}.png".format(i.team_name)
        dataFR = db.session.execute(
    text('SELECT "Team_A", "Team_B", "Result" FROM Fixture WHERE "Team_A" = :team OR "Team_B" = :team order by id'),
                                                {'team': i.team_name}).fetchall()
        nm = '--'
        for j in dataFR:
            if j[2] != None:
                continue
            nm = j[0] if j[0] != i.team_name else j[1]
            nm = 'vs ' + nm
            break
        dt[1][index] = dt[1][index] if not finalsData else dt[1][index] if finalsData.Win_T != i.team_name else 'Champions'
        dt[2].append(img)
        teams_ABV.append(i.team_name)
        dt[3].append(full_name[i.team_name])
        dt[4].append(i.P)
        dt[5].append(i.W)
        dt[6].append(i.L)
        dt[7].append(i.NR)
        dt[8].append(i.Points)
        I = '{0:+}'.format(i.NRR)
        dt[9].append(I)
        wl = list(eval(i.Win_List).values())
        wl = wl if len(wl)<5 else wl[-5:]
        wl = list(wl)
        wl = ''.join(wl)
        dt[10].append(wl)
        dt[11].append(nm)
        dt[12].append(i.qed)
        dt[13].append(i.Qual)
        dt[14].append(i.Top2)
        dt[15].append(rankChanges[i.team_name] if i.P != 0 else 0)
    return render_template('displayPT.html', PT=dt, TABV=teams_ABV, clr=clr)

@main.route('/fixtures')
def displayFR():
    team = request.args.get('fteam','All',type=str)
    if team == 'All':
        dataFR = db.session.execute(text('select * from Fixture order by id'))\
            #Fixture.query.all()
        hint = 'All'
    else:
        dataFR = db.session.execute(text('SELECT * FROM Fixture WHERE "Team_A" = :team OR "Team_B" = :team order by id'),{'team': team}).fetchall()
            #Fixture.query.filter_by(or_(Fixture.Team_A == team, Fixture.Team_B == team)).all()
        hint = team
    dt = [['Match No', 'Date', 'Venue', 'Team-A', 'Team-B', 'TA-Score', 'TB-Score', 'WT', 'WType', 'WBy', 'Result']]
    for i in dataFR:
        dtt = []
        dtt.append(i[1]) #Match No
        dttm = i[2].strftime('%Y-%m-%d')+' '+ \
                     i[3].strftime('%H:%M:%S')
        dtt.append(datetime.strptime(dttm, '%Y-%m-%d %H:%M:%S'))  #DateTime
        dtt.append(i[6])  #Venue
        dtt.append(i[4])  #Team A
        dtt.append(i[5])  #Team B
        A, B = i[8], i[9]
        dtt.append(A) #TA_Scr
        dtt.append(B) #TB_Scr
        if i[10] is None:
            dtt.append('TBA') #Win-Team
            dtt.append('TBA')
            dtt.append('TBA')
            dtt.append(['TBA','TBA'])
        elif i[10] == 'NA':
            dtt.append('NA')
            dtt.append('NA')
            dtt.append('NA')
            dtt.append(i[7])
            dtt.append(['NA','NA'])
        else:
            dtt.append(i[10])
            WType = 'wickets' if 'wickets' in i[7] else 'runs'
            dtt.append(WType)
            WBy = re.findall(r'\d+', i[7])[0]
            dtt.append(str(WBy))
            dtt.append(i[7][i[7].index('won'):])
            if i[12] is not None:
                dtt.append([i[12]['name'], i[12]['team']])
            else:
                dtt.append(['NA','NA'])
        dt.append(dtt)
    current_date = datetime.now(tz)
    current_date = current_date.replace(tzinfo=None)
    return render_template('displayFR.html', FR=dt, hint=hint, fn=full_name, current_date=current_date, clr=clr)

@main.route('/teams')
def teams():
    return render_template('teams.html', fn=full_name, champions=champions, clr=ptclr, sqclr=sqclr, mclr=clr)

@main.route('/teams/<team>')
def squad(team):
    sq = Squad.query.filter_by(Team=team).order_by(Squad.Name).all()
    return render_template('squad.html', team=team, sq=sq, fn=full_name[team], clr=clr[team], sqclr=sqclr[team], team_dt=teams_data[team], champions=champions)

@main.route('/team-<team>/squad_details/<name>')
def squad_details(team, name):
    sq = Squad.query.filter_by(Name=name).first()
    current_date = datetime.now(tz)
    current_date = current_date.replace(tzinfo=None)
    age = calculate_age(sq.DOB, current_date)
    stats = get_player_stats(sq.URL_ID)
    print(json.dumps(stats, indent=4))
    return render_template('squad_details.html', sq=sq, clr=clr[team], team=team, age=age, sqclr=sqclr[team], stats=stats)

def get_matchInfo(match):
    MatchDT = db.session.execute(text('SELECT * FROM Fixture WHERE "Match_No" = :matchno'), {'matchno': match}).fetchall()
    MatchURL = render_live_URL(MatchDT[0][4], MatchDT[0][5], match, MatchDT[0][2])
    dttm = concat_DT(MatchDT[0][2], MatchDT[0][3])
    response = requests.get(MatchURL, verify=False)
    MatchLDT = response.json()
    MatchDT2 = []
    MatchDT2.append(num_suffix(int(MatchDT[0][1]))+" Match" if MatchDT[0][1].isdigit() else MatchDT[0][1])
    MatchDT2.append(MatchDT[0][6].split(", ")[1])
    MatchDT2.append(num_suffix(MatchDT[0][2].day)+" "+MatchDT[0][2].strftime("%B %Y"))
    current_date = datetime.now(tz)
    current_date = current_date.replace(tzinfo=None)
    MatchDT = [dict(row._mapping) for row in MatchDT]
    return serialize({'match': match, 'cd': current_date, 'dt1': MatchDT, 'dt2': MatchDT2, 'dt3': MatchLDT, 'tid': teamID, 'dttm': dttm})

def get_matchOvers(match):
    MatchDT = db.session.execute(text('SELECT * FROM Fixture WHERE "Match_No" = :matchno'), {'matchno': match}).fetchall()
    MatchURL = render_live_URL(MatchDT[0][4], MatchDT[0][5], match, MatchDT[0][2])
    Inn1, Inn2 = get_innings_data(MatchDT[0][11])
    dttm = concat_DT(MatchDT[0][2], MatchDT[0][3])
    response = requests.get(MatchURL, verify=False)
    MatchLDT = response.json()
    MatchDT2 = []
    MatchDT2.append(num_suffix(int(MatchDT[0][1]))+" Match" if MatchDT[0][1].isdigit() else MatchDT[0][1])
    MatchDT2.append(MatchDT[0][6].split(", ")[1])
    MatchDT2.append(num_suffix(MatchDT[0][2].day)+" "+MatchDT[0][2].strftime("%B %Y"))
    current_date = datetime.now(tz)
    current_date = current_date.replace(tzinfo=None)
    MatchDT = [dict(row._mapping) for row in MatchDT]
    return serialize({'match':match, 'cd':current_date, 'dt1':MatchDT, 'dt2':MatchDT2, 'dt3':MatchLDT, 'tid':teamID, 'dttm':dttm, 'inn1':Inn1, 'inn2':Inn2, 'clr':clr})

def get_liveScore(match):
    MatchDT = db.session.execute(text('SELECT * FROM Fixture WHERE "Match_No" = :matchno'),{'matchno': match}).fetchall()
    SquadFull = (db.session.execute(text('SELECT * FROM Squad')).fetchall())
    MatchURL = render_live_URL(MatchDT[0][4], MatchDT[0][5], match, MatchDT[0][2])
    Inn1, Inn2 = get_innings_data(MatchDT[0][11])
    dttm = concat_DT(MatchDT[0][2], MatchDT[0][3])
    response = requests.get(MatchURL, verify=False)
    MatchLDT = response.json()
    if "player_of_match" in MatchLDT and MatchLDT["player_of_match"]["player_name"] != "":
        pom = find_player(MatchLDT["player_of_match"]["player_name"], SquadFull)
        MatchLDT["player_of_match"]["player_name"] = pom[2] if pom is not None else MatchLDT["player_of_match"]["player_name"]
        MatchLDT["player_of_match"]["team_name"] = pom[3] if pom is not None else "NA"
    if "player_of_series" in MatchLDT and MatchLDT["player_of_series"]["player_name"] != "":
        pos = find_player(MatchLDT["player_of_series"]["player_name"], SquadFull)
        MatchLDT["player_of_series"]["player_name"] = pos[2] if pos is not None else MatchLDT["player_of_series"]["player_name"]
        MatchLDT["player_of_series"]["team_name"] = pos[3] if pos is not None else "NA"
    for key, batsman in MatchLDT["now_batting"].items():
        if batsman["name"] != "":
            player = find_player(batsman["name"], SquadFull)
            batsman["name"] = player[2] if player is not None else batsman["name"]
            batsman["team"] = player[3] if player is not None else "NA"
    for key, bowler in MatchLDT["now_bowling"].items():
        if bowler["name"] != "":
            player = find_player(bowler["name"], SquadFull)
            bowler["name"] = player[2] if player is not None else bowler["name"]
            bowler["team"] = player[3] if player is not None else "NA"
    MatchDT2 = []
    MatchDT2.append(num_suffix(int(MatchDT[0][1])) + " Match" if MatchDT[0][1].isdigit() else MatchDT[0][1])
    MatchDT2.append(MatchDT[0][6].split(", ")[1])
    MatchDT2.append(num_suffix(MatchDT[0][2].day) + " " + MatchDT[0][2].strftime("%B %Y"))
    current_date = datetime.now(tz)
    current_date = current_date.replace(tzinfo=None)
    MatchDT = [dict(row._mapping) for row in MatchDT]
    return serialize({'match': match, 'cd': current_date, 'dt1': MatchDT, 'dt2': MatchDT2, 'dt3': MatchLDT, 'tid': teamID, 'dttm': dttm, 'clr': ptclr, 'clr2': clr, 'inn1': Inn1, 'inn2': Inn2, 'fn': full_name})

def get_scoreCard(match):
    MatchDT = db.session.execute(text('SELECT * FROM Fixture WHERE "Match_No" = :matchno'), {'matchno': match}).fetchall()
    SquadFull = (db.session.execute(text('SELECT * FROM Squad')).fetchall())
    MatchURL = render_live_URL(MatchDT[0][4], MatchDT[0][5], match, MatchDT[0][2])
    dttm = concat_DT(MatchDT[0][2], MatchDT[0][3])
    response = requests.get(MatchURL, verify=False)
    MatchLDT = response.json()
    if "player_of_match" in MatchLDT and MatchLDT["player_of_match"]["player_name"] != "":
        pom = find_player(MatchLDT["player_of_match"]["player_name"], SquadFull)
        MatchLDT["player_of_match"]["player_name"] = pom[2] if pom is not None else MatchLDT["player_of_match"]["player_name"]
        MatchLDT["player_of_match"]["team_name"] = pom[3] if pom is not None else "NA"
    if "player_of_series" in MatchLDT and MatchLDT["player_of_series"]["player_name"] != "":
        pos = find_player(MatchLDT["player_of_series"]["player_name"], SquadFull)
        MatchLDT["player_of_series"]["player_name"] = pos[2] if pos is not None else MatchLDT["player_of_series"]["player_name"]
        MatchLDT["player_of_series"]["team_name"] = pos[3] if pos is not None else "NA"
    for inn in MatchLDT.get("innings", [])[:2]:
        if "batting" in inn:
            for batsman in inn["batting"]:
                player = find_player(batsman["name"], SquadFull)
                batsman["name"] = player[2] if player is not None else batsman["name"]
                batsman["team"] = player[3] if player is not None else "NA"
        if "bowling" in inn:
            for bowler in inn["bowling"]:
                player = find_player(bowler["name"], SquadFull)
                bowler["name"] = player[2] if player is not None else bowler["name"]
                bowler["team"] = player[3] if player is not None else "NA"
        if "not_batted" in inn:
            nb = sorted(inn['not_batted'].values(), key=lambda x: x['order'])
            for nbb in nb:
                nbd = find_player(nbb["name"], SquadFull)
                nbb["name"] = nbd[2] if nbd is not None else nbb["name"]
                nbb["team"] = nbd[3] if nbd is not None else "NA"
            inn['not_batted'] = nb
        if inn["fall_of_wickets"] is not None:
            fow = []
            if inn["fall_of_wickets"] != "":
                for bt in inn["fall_of_wickets"].split('),'):
                    btd = find_player(bt.split(' (')[1].split(',')[0], SquadFull)
                    n = btd[2] if btd is not None else bt.split(' (')[1].split(',')[0]
                    t = btd[3] if btd is not None else "NA"
                    score = bt.split(' (')[0]
                    over = bt.split(' (')[1].split(', ')[1].strip('()')
                    fow.append({"name": n, "team": t, "score": score, "over": over})
            inn["fall_of_wickets"] = fow
    MatchDT2 = []
    MatchDT2.append(num_suffix(int(MatchDT[0][1])) + " Match" if MatchDT[0][1].isdigit() else MatchDT[0][1])
    MatchDT2.append(MatchDT[0][6].split(", ")[1])
    MatchDT2.append(num_suffix(MatchDT[0][2].day) + " " + MatchDT[0][2].strftime("%B %Y"))
    current_date = datetime.now(tz)
    current_date = current_date.replace(tzinfo=None)
    MatchDT = [dict(row._mapping) for row in MatchDT]
    return serialize({'match': match, 'cd': current_date, 'dt1': MatchDT, 'dt2': MatchDT2, 'dt3': MatchLDT, 'tid': teamID, 'dttm': dttm, 'clr2': clr, 'fn': full_name})

def get_liveSquad(match):
    MatchDT = db.session.execute(text('SELECT * FROM Fixture WHERE "Match_No" = :matchno'), {'matchno': match}).fetchall()
    SquadFull = (db.session.execute(text('SELECT * FROM Squad')).fetchall())
    SquadDT = db.session.execute(text('SELECT * FROM Squad WHERE "Captain" = :captain OR "Overseas" = :overseas'), {'captain': 'Y', 'overseas': 'Y'}).fetchall()
    MatchURL = render_live_URL(MatchDT[0][4], MatchDT[0][5], match, MatchDT[0][2])
    dttm = concat_DT(MatchDT[0][2], MatchDT[0][3])
    response = requests.get(MatchURL, verify=False)
    MatchLDT = response.json()
    for sqd in MatchLDT.get("squad", []):
        if sqd['players'] is not None:
            for player in sqd['players']:
                p = find_player(player['name'], SquadFull)
                player['name'] = p[2] if p is not None else player['name']
                player['team'] = p[3] if p is not None else "NA"
                player['captain'] = (True if p[4] == 'Y' else False) if p is not None else False
                player['overseas'] = (True if p[6] == 'Y' else False) if p is not None else False
        if sqd['substitute_players'] is not None:
            for sub in sqd['substitute_players']:
                p = find_player(sub['name'], SquadFull)
                sub['name'] = p[2] if p is not None else sub['name']
                sub['team'] = p[3] if p is not None else "NA"
                sub['captain'] = (True if p[4] == 'Y' else False) if p is not None else False
                sub['overseas'] = (True if p[6] == 'Y' else False) if p is not None else False
        if sqd['bench_players'] is not None:
            for bench in sqd['bench_players']:
                p = find_player(bench['name'], SquadFull)
                bench['name'] = p[2] if p is not None else bench['name']
                bench['team'] = p[3] if p is not None else "NA"
                bench['captain'] = (True if p[4] == 'Y' else False) if p is not None else False
                bench['overseas'] = (True if p[6] == 'Y' else False) if p is not None else False
    MatchDT2 = []
    MatchDT2.append(num_suffix(int(MatchDT[0][1])) + " Match" if MatchDT[0][1].isdigit() else MatchDT[0][1])
    MatchDT2.append(MatchDT[0][6].split(", ")[1])
    MatchDT2.append(num_suffix(MatchDT[0][2].day) + " " + MatchDT[0][2].strftime("%B %Y"))
    current_date = datetime.now(tz)
    current_date = current_date.replace(tzinfo=None)
    MatchDT = [dict(row._mapping) for row in MatchDT]
    SquadDT = [dict(row._mapping) for row in SquadDT]
    return serialize({'match': match, 'cd':current_date, 'dt1':MatchDT, 'dt2':MatchDT2, 'dt3':MatchLDT, 'tid':teamID, 'dttm':dttm, 'sqd':SquadDT})

@main.route('/match-<match>')
def match(match):
    MatchDT = db.session.execute(text('SELECT * FROM Fixture WHERE "Match_No" = :matchno'),
                                 {'matchno': match}).fetchall()
    MatchDT = MatchDT[0]
    source = request.args.get('source', None)
    team = request.args.get('fteam', None)
    return render_template('match.html', match=match, source=source, fteam=team, matchDT=MatchDT)

@main.route('/match-<match>/FRScore')
def FRScore(match):
    MatchFR = db.session.execute(text('SELECT * FROM Fixture WHERE "Match_No" = :matchno'),
                                 {'matchno': match}).fetchall()
    MatchFR = MatchFR[0]
    matchDT = datetime.combine(MatchFR.Date, MatchFR.Time)
    current_date = datetime.now(tz)
    current_date = current_date.replace(tzinfo=None)
    source = request.args.get('source', None)
    team = request.args.get('fteam', None)
    if current_date < (matchDT - timedelta(minutes=30)):
        return redirect(url_for('main.match', tab='matchInfo', match=match, source=source, fteam=team))
    elif current_date >= (matchDT - timedelta(minutes=30)) and MatchFR[10] is None:
        return redirect(url_for('main.match', tab='liveScore', match=match, source=source, fteam=team))
    elif MatchFR[10] is not None:
        return redirect(url_for('main.match', tab='scoreCard', match=match, source=source, fteam=team))

@main.route('/todayMatch')
def todayMatch():
    current_date = datetime.now(tz).replace(tzinfo=None).date()
    TodayFR = db.session.execute(text('SELECT * FROM Fixture WHERE "Date" = :current_date order by id'),{'current_date': current_date}).fetchall()
    if len(TodayFR) == 0:
        return render_template('no_live_match.html')
    else:
        dt = [['Match No', 'Date', 'Venue', 'Team-A', 'Team-B', 'TA-Score', 'TB-Score', 'WT', 'WType', 'WBy', 'Result']]
        for i in TodayFR:
            dtt = []
            dtt.append(i[1])  # Match No
            dttm = i[2].strftime('%Y-%m-%d') + ' ' + \
                   i[3].strftime('%H:%M:%S')
            dtt.append(datetime.strptime(dttm, '%Y-%m-%d %H:%M:%S'))  # DateTime
            dtt.append(i[6])  # Venue
            dtt.append(i[4])  # Team A
            dtt.append(i[5])  # Team B
            A, B = i[8], i[9]
            dtt.append(A)  # TA_Scr
            dtt.append(B)  # TB_Scr
            if i[10] is None:
                dtt.append('TBA')  # Win-Team
                dtt.append('TBA')
                dtt.append('TBA')
            elif i[10] == 'NA':
                dtt.append('NA')
                dtt.append('NA')
                dtt.append('NA')
                dtt.append(i[7])
                dtt.append(['NA', 'NA'])
            else:
                dtt.append(i[10])
                WType = 'wickets' if 'wickets' in i[7] else 'runs'
                dtt.append(WType)
                WBy = re.findall(r'\d+', i[7])[0]
                dtt.append(str(WBy))
                dtt.append(i[7][i[7].index('won'):])
                if i[12] is not None:
                    dtt.append([i[12]['name'], i[12]['team']])
                else:
                    dtt.append(['NA','NA'])
            dt.append(dtt)
        current_date = datetime.now(tz)
        current_date = current_date.replace(tzinfo=None)
        return render_template('liveMatches.html', FR=dt, fn=full_name, current_date=current_date, clr=clr)

def get_stats():
    tp = db.session.execute(text('SELECT category, stats FROM Toppers ORDER BY id ASC')).fetchall()
    tp = {row[0]: row[1] for row in tp}
    return serialize({'stats': tp})

@main.route('/battingstats')
def battingstats():
    return render_template('battingStat.html')

@main.route('/bowlingstats')
def bowlingstats():
    return render_template('bowlingStat.html')

@main.route('/awards')
def awards():
    return render_template('awards.html')

@main.route('/update')
@login_required
def update():
    FR = Fixture.query.all()
    if request.args.get('key'):
        key = request.args.get('key')
    else:
        key = None
    return render_template('update.html', key=key, FR=FR)

@main.route('/updatematch', methods=['POST'])
@login_required
def updatematch():
    hint = request.form.get('hint')
    key = 1
    # Before: To render Update Input Web page
    if request.method == "POST" and hint == 'before':
        match = str(request.form.get('match')).upper()
        match = int(match) if match.isdigit() else pofs[match]
        FR = Fixture.query.filter_by(Match_No=str(match)).first()
        if match not in [i for i in range(1, 71)]+list(pofs.values()):
            flash('Invalid Match number to update', category='error')
            return redirect(url_for('main.update', key=key))
        if FR.Win_T != None:
            flash('Result for Match {} already updated, delete to update it again'.format(match), category='warning')
            return redirect(url_for('main.update', key=key))
        if FR.Team_A == 'TBA' or FR.Team_B == 'TBA':
            flash('Teams are not updated for Playoff Match {} to update its result'.format(match), category='warning')
            return redirect(url_for('main.update', key=key))
        return render_template('updatematch.html', FR=FR, fn=full_name, match=match)
    
    # After: To update Match Result to Database
    if request.method == 'POST' and hint == 'after':
        matchStatus = request.form.get('match_status')
        if matchStatus == 'completed':
            data = {}
            data['team_A'] = {'runs': int(request.form['runsA']), 'overs': float(request.form['oversA']), 'wkts': int(request.form['wktsA'])}
            data['team_B'] = {'runs': int(request.form['runsB']), 'overs': float(request.form['oversB']), 'wkts': int(request.form['wktsB'])}
            data['match'] = request.form['match']
            data['result'] = {'win_team': request.form['wt'], 'win_type': request.form['win_type'], 'win_by': request.form['win_by']}
            upMatchNormal(data)
        elif matchStatus == 'tied':
            data = {}
            data['team_A'] = {'runs': int(request.form['tied_runsA']), 'overs': float(request.form['tied_oversA']), 'wkts': int(request.form['tied_wktsA']), 'runsSO': int(request.form['superover_runsA']), 'oversSO': float(request.form['superover_oversA']), 'wktsSO': int(request.form['superover_wktsA'])}
            data['team_B'] = {'runs': int(request.form['tied_runsB']), 'overs': float(request.form['tied_oversB']), 'wkts': int(request.form['tied_wktsB']), 'runsSO': int(request.form['superover_runsB']), 'oversSO': float(request.form['superover_oversB']), 'wktsSO': int(request.form['superover_wktsB'])}
            data['match'] = request.form['match']
            data['result'] = {'so_win_team': request.form['superover_winner'], 'so_win_type': request.form['superover_win_type'], 'so_win_by': request.form['superover_win_by']}
            upMatchSuperOver(data)
        elif matchStatus == 'abandoned':
            data = {}
            data['match'] = request.form['match']
            data['toss_status'] = request.form['abandon_toss_status']
            data['reason'] = request.form['abandon_reason']
            if data['toss_status'] == 'with_toss':
                data['team_A'] = {'runs': int(request.form['abandon_runsA']), 'overs': float(request.form['abandon_oversA']), 'wkts': int(request.form['abandon_wktsA'])}
                data['team_B'] = {'runs': int(request.form['abandon_runsB']), 'overs': float(request.form['abandon_oversB']), 'wkts': int(request.form['abandon_wktsB'])}
            upMatchAbandoned(data)
        elif matchStatus == 'interrupted_dls':
            data = {}
            data['team_A'] = {'runs': int(request.form['runsA']), 'overs': float(request.form['oversA']), 'wkts': int(request.form['wktsA']), 'runsDLS': int(request.form['dls_runsA']), 'oversDLS': float(request.form['dls_oversA']), 'revTarget': int(request.form['dls_target']), 'revOvers': float(request.form['dls_overs'])}
            data['team_B'] = {'runs': int(request.form['runsB']), 'overs': float(request.form['oversB']), 'wkts': int(request.form['wktsB']), 'runsDLS': int(request.form['dls_runsB']), 'oversDLS': float(request.form['dls_oversB']), 'revTarget': int(request.form['dls_target']), 'revOvers': float(request.form['dls_overs'])}
            data['dls_reason'] = request.form['dls_reason']
            data['match'] = request.form['match']
            data['result'] = {'win_team': request.form['wt'], 'win_type': request.form['win_type'], 'win_by': request.form['win_by'], 'dls_target': int(request.form['dls_target']), 'dls_overs': float(request.form['dls_overs'])}
            upMatchDLS(data)

        update_rank_for_fixture(data['match'])
        flash('Match {} result updated successfully'.format(data['match']), category='success')
        from run import app as flask_app
        threading.Thread(target=run_refresh_qualification_bg, args=(flask_app,)).start()
        return redirect(url_for('main.update', key=key))

@main.route('/deletematch', methods=['POST'])
@login_required
def deletematch():
    hint = request.form.get('hint')
    key = 2
    # Before: To render Delete Input Web page
    if request.method == "POST" and hint == 'before':
        dmatch = str(request.form.get('dmatch')).upper()
        dmatch = int(dmatch) if dmatch.isdigit() else pofs[dmatch]
        FR = Fixture.query.filter_by(Match_No=str(dmatch)).first()
        if dmatch not in [i for i in range(1, 71)] + list(pofs.values()):
            flash('Invalid Match number to delete', category='error')
            return redirect(url_for('main.update', key=key))
        if FR.Win_T == None:
            flash('Result for Match {} is not yet updated to delete'.format(dmatch), category='warning')
            return redirect(url_for('main.update', key=key))
        return render_template('deletematch.html', FR=FR, fn=full_name, dmatch=dmatch)
    
    # After: To delete Match Result from Database
    if request.method == "POST" and hint == 'after':
        dmatch = request.form.get('dmatch')
        result = db.session.execute(text('SELECT "Result" FROM fixture WHERE "Match_No" = :match_no'),{'match_no': dmatch}).fetchall()
        if "Super over" not in result[0][0] and "Match abandoned" not in result[0][0] and "DLS" not in result[0][0]:
            data = {}
            data['match'] = dmatch
            delMatchNormal(data)
        elif "Super over" in result[0][0]:
            data = {}
            data['match'] = dmatch
            delMatchSuperOver(data)
        elif "Match abandoned" in result[0][0]:
            data = {}
            data['match'] = dmatch
            delMatchAbandoned(data)
        elif "DLS" in result[0][0]:
            data = {}
            data['match'] = dmatch
            delMatchDLS(data)

        delete_rank_for_fixture(dmatch)
        flash('Match {} result deleted successfully'.format(dmatch), category='success')
        from run import app as flask_app
        threading.Thread(target=run_refresh_qualification_bg, args=(flask_app,)).start()
        return redirect(url_for('main.update', key=key))

@main.route('/updatepotm', methods=['POST'])
@login_required
def updatepotm():
    hint = request.form.get('hint')
    key = 6
    if request.method == "POST" and hint == 'before':
        match = str(request.form.get('potmmatch')).upper()
        match = int(match) if match.isdigit() else pofs[match]
        FR = Fixture.query.filter_by(Match_No=str(match)).first()
        sq = db.session.execute(text('SELECT * FROM squad WHERE "Team" = :team_a OR "Team" = :team_b ORDER BY "Name"'),{'team_a': FR.Team_A, 'team_b': FR.Team_B}).fetchall()
        sq = [dict(row._mapping) for row in sq]
        if match not in [i for i in range(1, 71)]+list(pofs.values()):
            flash('Invalid Match number to update potm', category='error')
            return redirect(url_for('main.update', key=key))
        return render_template('updatepotm.html', FR=FR, fn=full_name, match=match, sq=sq)
    if request.method == 'POST' and hint == 'after':
        match_no = request.form.get('match')
        potm = request.form.get('potm')
        potmteam = request.form.get('team')
        FR = Fixture.query.filter_by(Match_No=match_no).first()
        FR.POTM = {'name': potm, 'team': potmteam}
        db.session.commit()

        flash('POTM for match {} updated successfully'.format(match_no), category='success')
        return redirect(url_for('main.update', key=key))

@main.route('/updateplayoffs', methods=['POST'])
@login_required
def updateplayoffs():
    hint = request.form.get('hint')
    key = 3
    if request.method == "POST" and hint == 'before':
        pomatch = request.form.get('pomatch').upper()
        if pomatch not in [str(i) for i in range(1, 71)] + ['Q1', 'E', 'Q2', 'F']:
            flash('Invalid match, Select a valid Playoff Match', category='error')
            return redirect(url_for('main.update', key=key))
        FR = Fixture.query.filter_by(Match_No=pofs[pomatch]).first()
        return render_template('playoffsupdate.html', pomatch=pofs[pomatch], teams=full_name, FR=FR)
    if request.method == 'POST' and hint == 'after':
        pomatch = request.form.get('pomatch')
        FR = Fixture.query.filter_by(Match_No=pomatch).first()
        if request.form.get('checkA') == 'YES':
            FR.Team_A = request.form.get('teamA')
        if request.form.get('checkB') == 'YES':
            FR.Team_B = request.form.get('teamB')
        if request.form.get('checkV') == 'YES':
            FR.Venue = request.form.get('venue')
        db.session.commit()
        flash('{} Playoff teams updated successfully'.format(pomatch), category='success')
        return redirect(url_for('main.update', key=key))

@main.route('/updatequalification', methods=['POST'])
@login_required
def updatequalification():
    key = 4
    qteam = request.form.get('qteam')
    PT = Pointstable.query.filter_by(team_name=qteam).first()
    PT.qed = "Q"
    db.session.commit()
    flash('Updated Qualification status for {} successfully'.format(qteam), category='success')
    return redirect(url_for('main.update', key=key))

@main.route('/updateelimination', methods=['POST'])
@login_required
def updateelimination():
    key = 5
    eteam = request.form.get('eteam')
    PT = Pointstable.query.filter_by(team_name=eteam).first()
    PT.qed = "E"
    db.session.commit()
    flash('Updated Elimination status for {} successfully'.format(eteam), category='success')
    return redirect(url_for('main.update', key=key))
