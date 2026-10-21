"""The instant season predictor: play the rest of the IPL out, as often as you like.

Nothing here writes. The page hands back a set of picks - "RCB beat SRH", "match
14 was a no result", "MI 180/5 chasing 176/8" - and this answers with the table
those picks produce and a fresh Monte-Carlo of everything still unpicked. The
admin result path (services/results.py) is the only thing that may touch a
fixture or the points table, and the predictor deliberately shares none of it.

The table is rebuilt from the fixture list every time rather than started from
the stored Pointstable, because a simulator has to let you replay a match that
has already happened - "what if RCB had chased that down?" - and you cannot take
a result back out of a total that has already absorbed it. Each completed match
contributes through pointstable._booked(), the same rule the real table uses, so
with nothing overridden the rebuild reproduces the live standings exactly; there
is a test for that. Overriding one swaps that match's contribution for yours.

Speed is the feature. simulate() is built to answer inside a few hundred
milliseconds so the page can re-run on every click, which it buys by scaling the
simulation count to how much season is left (see SIM_BUDGET) rather than running
the 500k the hourly refresh can afford to.
"""
import time

from .. import db
from ..models import Pointstable, Fixture
from ..config import pofs, full_name, clr, teamID
from ..utils.overs import ovToPer
from .playoffs import calibrate_match_model, simulate_season, match_win_prob
from .pointstable import _booked

# Sims are shared out so the wall clock stays roughly flat however much season
# is left. Measured best-of-five on a laptop, the cost fits
#     ms = 372 * sims * matches / 1e6  +  768 * sims / 1e6
# - nearly all of it per simulated match, plus a fixed per-simulation part (the
# ranking sort, the win-count tables, the bracket) worth about two extra
# matches. So the budget divides by remaining + SIM_OVERHEAD, and the ceiling
# matters: without it a near-finished season asks for far more simulations than
# it needs and spends a second and a half proving a result it already knows.
SIM_BUDGET = 1_100_000        # simulations x (remaining matches + overhead)
SIM_OVERHEAD = 2
SIM_MIN, SIM_MAX = 15_000, 60_000   # standard error 0.40 .. 0.20 percentage points
IMPACT_FRACTION = 0.5         # impact analysis runs two sims, so halve each

PLAYOFF_ORDER = ['Q1', 'E', 'Q2', 'F']
OVERS = 20                    # a side bowled out is deemed to have faced its full allocation

_MODEL_CACHE = {}


def _sim_count(remaining, fraction=1.0):
    if remaining <= 0:
        return 1
    share = SIM_BUDGET / (remaining + SIM_OVERHEAD)
    return int(max(SIM_MIN, min(SIM_MAX, share)) * fraction)


def _model_signature():
    """Cheap fingerprint of everything calibrate_match_model() reads."""
    row = db.session.query(
        db.func.count(Fixture.id), db.func.max(Fixture.id),
        db.func.sum(db.func.length(db.func.coalesce(Fixture.Result, '')))
    ).filter(Fixture.Result != None).one()
    return tuple(int(v or 0) for v in row)


def get_model():
    """The season's scoring model, refitted only when a result has moved.

    The fit is a ridge solve plus a dozen EM sweeps over every innings played,
    which is far too much to repeat on each keystroke, and its inputs only
    change when a match is entered or deleted.
    """
    sig = _model_signature()
    if _MODEL_CACHE.get('sig') != sig:
        _MODEL_CACHE['sig'] = sig
        _MODEL_CACHE['model'] = calibrate_match_model()
    return _MODEL_CACHE['model']


# --------------------------------------------------------------------- state

def _score_of(info):
    info = info if isinstance(info, dict) else {}
    return {'runs': info.get('runs') or 0, 'wkts': info.get('wkts') or 0,
            'overs': info.get('overs') or 0.0}


def _tally(fx):
    """What one completed match puts on the table: the points and the innings.

    'nrr' says whether the two innings count towards net run rate. A no result
    is two different things here - an abandoned match never produced a pair of
    innings to count, while a tie the super over could not settle was played out
    in full and does count - and the result line is what tells them apart.
    """
    if fx.Win_T is None:
        return None
    a_info, b_info = fx.A_info or {}, fx.B_info or {}
    booked = {'a': _booked(a_info), 'b': _booked(b_info)}
    if fx.Win_T == 'NA':
        return dict(booked, w='NR', nrr=(fx.Result or '').startswith('Match tied'))
    return dict(booked, w=fx.Win_T, nrr=True)


def get_state():
    """Everything the page needs once: fixtures, the live table, team colours.

    Win probabilities ride along per fixture so the bars are drawn before the
    first simulation comes back.
    """
    model = get_model()
    playoff_nos = list(pofs.values())
    rows = Fixture.query.order_by(Fixture.id).all()

    league, playoffs = [], []
    for fx in rows:
        decided = fx.Win_T is not None
        entry = {
            'no': fx.Match_No,
            'a': fx.Team_A, 'b': fx.Team_B,
            'venue': (fx.Venue or '').split(', ')[-1],
            'date': fx.Date.strftime('%d %b %Y') if fx.Date else '',
            'played': decided,
            'winner': fx.Win_T,
            'result': fx.Result or '',
            'a_score': _score_of(fx.A_info), 'b_score': _score_of(fx.B_info),
        }
        if fx.Match_No in playoff_nos:
            playoffs.append(entry)
        else:
            entry['wp'] = round(match_win_prob(model, fx.Team_A, fx.Team_B, fx.Venue), 4)
            entry['tally'] = _tally(fx)
            league.append(entry)

    table = Pointstable.query.order_by(
        Pointstable.Points.desc(), Pointstable.W.desc(),
        Pointstable.NRR.desc(), Pointstable.id.asc()).all()
    base = [{'team': t.team_name, 'p': t.P, 'w': t.W, 'l': t.L, 'nr': t.NR,
             'pts': t.Points, 'nrr': t.NRR,
             'for': dict(t.For or {}), 'against': dict(t.Against or {})} for t in table]

    return {
        'teams': {t['team']: {'name': full_name.get(t['team'], t['team']),
                              'clr': clr.get(t['team'], {})} for t in base},
        'order': [t['team'] for t in base],
        'league': league, 'playoffs': playoffs, 'base': base,
        'playoff_labels': pofs,
        'unplayed': sum(1 for m in league if not m['played']),
    }


# ----------------------------------------------------------------- the table

def _blank(team):
    return {'team': team, 'p': 0, 'w': 0, 'l': 0, 'nr': 0, 'pts': 0,
            'rf': 0.0, 'of': 0.0, 'ra': 0.0, 'ob': 0.0}


def _apply_score(row, side, other):
    """Add one predicted innings pair to a team's run-rate totals.

    Only counted when the page sent scores for both sides - a pick on its own
    says who won, not by how much, and inventing a margin would move net run
    rate on no evidence. A side bowled out is credited with its full allocation,
    the same rule the real points table uses.
    """
    if not side or not other:
        return
    faced = OVERS if side.get('wkts') == 10 else min(side.get('overs') or 0.0, OVERS)
    bowled = OVERS if other.get('wkts') == 10 else min(other.get('overs') or 0.0, OVERS)
    if faced <= 0 or bowled <= 0:
        return
    row['rf'] += side.get('runs') or 0
    row['of'] += faced
    row['ra'] += other.get('runs') or 0
    row['ob'] += bowled


def _award(a_row, b_row, choice):
    """Points, wins and losses for one match. Returns nothing; mutates the rows."""
    a_row['p'] += 1
    b_row['p'] += 1
    if choice == 'NR':
        a_row['nr'] += 1
        b_row['nr'] += 1
        a_row['pts'] += 1
        b_row['pts'] += 1
        return
    win, lose = (a_row, b_row) if choice == 'a' else (b_row, a_row)
    win['w'] += 1
    win['pts'] += 2
    lose['l'] += 1


def build_table(picks, state=None, replay=False):
    """The standings a set of picks produces, rebuilt from the fixture list.

    picks is {match_no: {'w': 'RCB' | 'NR', 'a': {runs, wkts, overs}, 'b': {...}}}
    and overrides any match, played or not - replaying a completed one is the
    point of a simulator. A match with no pick falls back to its real result if
    it has one, and otherwise goes into the pile to be simulated.

    replay=True drops the real results altogether, so the season starts from an
    empty table and every match is either picked or simulated. Half a season in,
    that is the difference between one click and thirty-five.
    """
    state = state or get_state()
    rows = {t['team']: _blank(t['team']) for t in state['base']}

    used, remaining = {}, []
    for m in state['league']:
        a_row, b_row = rows.get(m['a']), rows.get(m['b'])
        pick = (picks or {}).get(m['no']) or {}
        choice = pick.get('w')
        mine = choice in (m['a'], m['b'], 'NR')

        if a_row is None or b_row is None:          # a TBA playoff-style fixture
            continue
        if not mine and (replay or not m['played']):
            remaining.append((m['a'], m['b'], m['venue']))
            continue

        if mine:
            used[m['no']] = choice
            _award(a_row, b_row, 'NR' if choice == 'NR' else ('a' if choice == m['a'] else 'b'))
            # scores are optional: a pick says who won, not by how much, and
            # inventing a margin would move net run rate on no evidence
            _apply_score(a_row, pick.get('a'), pick.get('b'))
            _apply_score(b_row, pick.get('b'), pick.get('a'))
            continue

        t = m.get('tally')
        if not t:
            continue
        _award(a_row, b_row, 'NR' if t['w'] == 'NR' else ('a' if t['w'] == m['a'] else 'b'))
        if t['nrr']:
            _book(a_row, t['a'], t['b'])
            _book(b_row, t['b'], t['a'])

    for row in rows.values():
        scored = row['rf'] / row['of'] if row['of'] else 0.0
        conceded = row['ra'] / row['ob'] if row['ob'] else 0.0
        row['nrr'] = round(scored - conceded, 3) if (row['of'] and row['ob']) else 0.0

    ranked = sorted(rows.values(), key=lambda r: (-r['pts'], -r['w'], -r['nrr'], r['team']))
    return ranked, remaining, used


def _book(row, mine, theirs):
    """Add an already-booked (runs, overs) pair straight onto a team's totals."""
    row['rf'] += mine[0]
    row['of'] += ovToPer(mine[1])
    row['ra'] += theirs[0]
    row['ob'] += ovToPer(theirs[1])


# ------------------------------------------------------------------ scenarios

def _scenario(team, odds, row, remaining):
    """Turn a team's by-win-count curve into "x of y wins needed".

    `remaining` is this side's own games left, not the league's - "13 of 14" is
    a thing a supporter can act on, "13 of 90" is not.

    by_wins is (total wins, share of sims, top-4 rate within them). The answer is
    the fewest extra wins whose branch qualifies essentially always; if even
    winning out does not get there the team is relying on other results, and if
    the best branch is short of certain it is relying on net run rate too.
    """
    out = {'need': None, 'remaining': remaining, 'nrr_ok': True, 'note': ''}
    if remaining <= 0:
        out['note'] = 'Season complete.'
        out['nrr_ok'] = odds['top4'] >= 50
        return out

    curve = [(w, share, rate) for w, share, rate in odds.get('by_wins', []) if share >= 0.0015]
    if not curve:
        out['note'] = 'Not enough simulations reached a usable split.'
        return out

    secure = [(w, rate) for w, rate in ((w, r) for w, _s, r in curve) if rate >= 0.995]
    best_w, best_rate = max(curve, key=lambda c: c[0])[0], max(c[2] for c in curve)

    if secure:
        need = min(w for w, _ in secure) - row['w']
        need = max(need, 0)
        out['need'] = need
        out['nrr_ok'] = True
        out['note'] = ('Already through on current form.' if need == 0 else
                       'Winning {} of {} remaining would secure qualification.'.format(need, remaining))
        return out

    # nothing is a lock: report the win count that gets closest
    likely = [(w, rate) for w, _s, rate in curve if rate >= 0.5]
    if likely:
        need = max(min(w for w, _ in likely) - row['w'], 0)
        out['need'] = need
        out['nrr_ok'] = False
        out['note'] = ('Winning {} of {} would make it more likely than not, but net run '
                       'rate and other results still decide.'.format(need, remaining))
    else:
        out['need'] = max(best_w - row['w'], 0)
        out['nrr_ok'] = False
        out['note'] = ('Winning out reaches only {:.0f}% - other results have to '
                       'fall its way.'.format(best_rate * 100))
    return out


# ------------------------------------------------------------------ simulate

def simulate(picks=None, sims=None, detail=True, replay=False):
    """The whole answer for one set of picks: table, odds and scenarios."""
    started = time.perf_counter()
    state = get_state()
    model = get_model()
    ranked, remaining, used = build_table(picks or {}, state, replay)

    teams_in = {r['team']: {'points': r['pts'], 'wins': r['w'], 'runs_for': r['rf'],
                            'overs_faced': r['of'], 'runs_against': r['ra'],
                            'overs_bowled': r['ob']} for r in ranked}
    count = _sim_count(len(remaining)) if sims is None else sims
    odds = simulate_season(teams_in, remaining, model=model, sims=count, detail=detail)

    left = {}
    for a, b, _venue in remaining:
        left[a] = left.get(a, 0) + 1
        left[b] = left.get(b, 0) + 1

    rows = []
    for pos, r in enumerate(ranked, start=1):
        o = odds.get(r['team'], {})
        row = dict(r, pos=pos, top4=o.get('top4', 0.0), top2=o.get('top2', 0.0),
                   top1=o.get('top1', 0.0), title=o.get('title', 0.0),
                   seeds=o.get('seeds', []), left=left.get(r['team'], 0))
        if detail:
            row['scenario'] = _scenario(r['team'], o, r, left.get(r['team'], 0))
        rows.append(row)

    return {
        'table': rows,
        'remaining': len(remaining),
        'picked': used,
        'sims': count if remaining else 0,
        'ms': int((time.perf_counter() - started) * 1000),
        'replay': bool(replay),
        'bracket': bracket(ranked, picks or {}, state, model, len(remaining)),
    }


def bracket(ranked, picks, state, model, open_matches):
    """The playoff bracket for the predicted top four.

    The seeding is only meaningful once every league match has an answer, which
    here means played or picked - until then these are the sides currently in
    the four, not the ones that will be, and the page says so. Each tie carries
    the model's own price, and a pick on a playoff fixture overrides it.
    """
    seeds = [r['team'] for r in ranked[:4]]
    if len(seeds) < 4:
        return {'seeded': False, 'ties': []}

    labels = {v: k for k, v in pofs.items()}
    by_label = {labels.get(m['no']): m for m in state['playoffs'] if labels.get(m['no'])}

    def tie(key, a, b, title):
        m = by_label.get(key) or {}
        no = m.get('no', pofs.get(key, key))
        pick = (picks.get(no) or {}).get('w')
        played = m.get('played')
        winner = m.get('winner') if played else (pick if pick in (a, b) else None)
        return {'key': key, 'no': no, 'title': title, 'a': a, 'b': b,
                'venue': m.get('venue', ''), 'date': m.get('date', ''),
                'played': bool(played), 'winner': winner,
                'wp': round(match_win_prob(model, a, b, neutral=True), 4) if a and b else 0.5}

    q1 = tie('Q1', seeds[0], seeds[1], 'Qualifier 1')
    el = tie('E', seeds[2], seeds[3], 'Eliminator')
    q1_win = q1['winner']
    q1_lose = (seeds[1] if q1_win == seeds[0] else seeds[0]) if q1_win else None
    el_win = el['winner']
    q2 = tie('Q2', q1_lose, el_win, 'Qualifier 2')
    f = tie('F', q1_win, q2['winner'], 'Final')

    return {'seeded': True, 'provisional': open_matches > 0,
            'seeds': seeds, 'ties': [q1, el, q2, f]}


def impact(match_no, picks=None, replay=False):
    """What one result would do to everyone's top-4 odds.

    Run twice with the match forced each way, at half the usual count each so the
    pair costs about what one normal refresh does, and report the gap. A side
    that is not playing can still move several points, which is the whole reason
    the button exists.
    """
    state = get_state()
    model = get_model()
    match = next((m for m in state['league'] if m['no'] == match_no), None)
    if match is None:
        return {'ok': False}

    picks = dict(picks or {})
    out = {}
    for side in (match['a'], match['b']):
        forced = dict(picks)
        forced[match_no] = dict(forced.get(match_no) or {}, w=side)
        ranked, remaining, _ = build_table(forced, state, replay)
        teams_in = {r['team']: {'points': r['pts'], 'wins': r['w'], 'runs_for': r['rf'],
                                'overs_faced': r['of'], 'runs_against': r['ra'],
                                'overs_bowled': r['ob']} for r in ranked}
        odds = simulate_season(teams_in, remaining, model=model,
                               sims=_sim_count(len(remaining), IMPACT_FRACTION))
        out[side] = {t: o['top4'] for t, o in odds.items()}

    a, b = match['a'], match['b']
    swing = sorted(
        ({'team': t, 'a': out[a][t], 'b': out[b][t], 'swing': round(out[a][t] - out[b][t], 1)}
         for t in out[a]),
        key=lambda s: -abs(s['swing']))
    return {'ok': True, 'match': match_no, 'a': a, 'b': b, 'swing': swing}
