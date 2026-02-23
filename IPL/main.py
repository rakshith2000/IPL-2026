from . import db
from .models import User, Pointstable, Fixture, Squad
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
import random
from datetime import datetime, date, time, timedelta
from collections import defaultdict
import threading

warnings.filterwarnings("ignore")

main = Blueprint('main', __name__)

tz = pytz.timezone('Asia/Kolkata')

SIMULATIONS = 100_000

# IPL: 10 teams, 70 matches (double round-robin)
OVERS = 20
PROB_NR = 0.08     # rain / washout chance (lower than WPL)
MEAN_SCORE = 170
STD_DEV = 18

pofs = {'Q1':'Qualifier 1', 'E':'Eliminator', 'Q2':'Qualifier 2', 'F':'Final'}

liveURL_Prefix = "https://cmc2.sportskeeda.com/live-cricket-score/"
liveURL_Suffix = "/ajax"

statsBaseURL = "https://www.cricbuzz.com/api/cricket-series/series-stats/9237/"

statsList = {
    "batting": {"Most Runs": "mostRuns", "Highest Scores": "highestScore", "Best Batting Average": "highestAvg", "Best Batting Strike Rate":"highestSr", "Most Hundreds": "mostHundreds", "Most Fifties": "mostFifties", "Most Fours": "mostFours", "Most Sixes": "mostSixes", "Most Nineties": "mostNineties"},
    "bowling": {"Most Wickets": "mostWickets", "Best Bowling Average": "lowestAvg", "Best Bowling": "bestBowlingInnings", "Most 5 Wickets Haul": "mostFiveWickets", "Best Economy": "lowestEcon", "Best Bowling Strike Rate": "lowestSr"}
}

champions = {
    'MI':    ['2013', '2015', '2017', '2019', '2020'],
    'KKR':   ['2012', '2014', '2024'],
    'CSK':   ['2010', '2011', '2018', '2021', '2023'],
    'RR':    ['2008'],
    'DC':    [],
    'RCB':   ['2025'],
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
        'LSG':{'c1':'#39A9E0', 'c2':'#4CAD47', 'c3':'#3A5FAC'},
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
        'LSG':'#3a5fac',
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
    'LSG': {'c1': '#FF4C00', 'c2': '#0096FF'}     # Light Blue to Gold
}

def simulate_score():
    runs = int(random.gauss(MEAN_SCORE, STD_DEV))
    return max(80, runs)

def get_top4_playoffs(teams, remaining_matches):
    results = defaultdict(lambda: {"top4": 0, "top2": 0, "top1": 0})
    for _ in range(SIMULATIONS):
        sim = {t: v.copy() for t, v in teams.items()}
        for t1, t2 in remaining_matches:
            if random.random() < PROB_NR:
                sim[t1]["points"] += 1
                sim[t2]["points"] += 1
                continue
            r1 = simulate_score()
            r2 = simulate_score()
            sim[t1]["runs_for"] += r1
            sim[t1]["runs_against"] += r2
            sim[t1]["overs_faced"] += OVERS
            sim[t1]["overs_bowled"] += OVERS
            sim[t2]["runs_for"] += r2
            sim[t2]["runs_against"] += r1
            sim[t2]["overs_faced"] += OVERS
            sim[t2]["overs_bowled"] += OVERS
            if r1 > r2:
                sim[t1]["points"] += 2
            elif r2 > r1:
                sim[t2]["points"] += 2
            else:
                sim[t1]["points"] += 1
                sim[t2]["points"] += 1
        table = []
        for team, v in sim.items():
            nrr = (v["runs_for"] / v["overs_faced"]) - (v["runs_against"] / v["overs_bowled"])
            table.append((team, v["points"], nrr))
        table.sort(key=lambda x: (x[1], x[2]), reverse=True)
        for i, (team, _, _) in enumerate(table):
            if i < 4:
                results[team]["top4"] += 1
            if i < 2:
                results[team]["top2"] += 1
            if i == 0:
                results[team]["top1"] += 1
    top4_predict = {}
    for team in teams:
        top4_predict[team] = {'top4':round(results[team]['top4'] / SIMULATIONS * 100, 2), 'top2':round(results[team]['top2'] / SIMULATIONS * 100, 2)}

    return top4_predict

def refresh_qualification():
    dataPT = Pointstable.query.order_by(Pointstable.Points.desc(),Pointstable.NRR.desc(),Pointstable.id.asc()).all()
    teams_t4 = {tm.team_name : {'points': tm.Points, 'runs_for': tm.For['runs'], 'overs_faced': tm.For['overs'], 'runs_against': tm.Against['runs'], 'overs_bowled': tm.Against['overs']} for tm in dataPT}
    remaining_matches = db.session.query(Fixture.Team_A, Fixture.Team_B).filter(Fixture.Result == None).filter(Fixture.Match_No != 'Eliminator').filter(Fixture.Match_No != 'Qualifier 1').filter(Fixture.Match_No != 'Qualifier 2').filter(Fixture.Match_No != 'Final').order_by(Fixture.id).all()
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
        if int(mn) == 37:
            matchNo = "match-36"
        elif int(mn) == 49:
            matchNo = "match49"
        elif int(mn) == 21:
            matchNo = "match-19"
        elif int(mn) == 19:
            matchNo = "match-20"
        elif int(mn) == 20:
            matchNo = "match-21"
        else:
            matchNo = "match-" + mn
    elif tA != "TBA" and tB != "TBA":
        matchNo = mn.lower().replace(' ','-')
    else:
        matchNo = mn.lower().replace(' ','-') + "-ipl-2025"
    if mn.isdigit() and mn == "21":
        dt = "06-april-2025"
    else:
        dt = dt.strftime("%d-%B-%Y").lower()
    URL = liveURL_Prefix + teamAB + "-" + matchNo + "-" + dt + liveURL_Suffix
    print(URL)
    return URL

@main.route('/')
def index():
    if db.session.execute(text('select count(*) from user')).scalar() == 0:
        users = {'Admin IPL2026 Laptop':{'email':'adminipl2026laptop@gmail.com', 'password':'********'},
                 'Admin IPL2026 Phone':{'email':'adminipl2026phone@gmail.com', 'password':'********'}}
        for username, user_info in users.items():
            user = User(email=user_info['email'], \
                        password=generate_password_hash(user_info['password'], method='pbkdf2:sha256', salt_length=8), \
                        name=username)
            db.session.add(user)
        db.session.commit()
    if db.session.execute(text('select count(*) from pointstable')).scalar() == 0:
        teams = ['CSK', 'DC', 'GT', 'KKR', 'LSG', 'MI', 'PBKS', 'RR', 'RCB', 'SRH']
        inter = os.getcwd()
        for i in teams:
            tm = Pointstable(team_name=i, P=0,W=0,L=0,NR=0,\
                    Points=0, NRR=0.0, Win_List=str({}),\
                logo_path='{}/IPL/static/images/{}.png'.format(inter,i),\
                For={'runs':0, 'overs':0.0}, Against={'runs':0, 'overs':0.0})
            db.session.add(tm)
            db.session.commit()
    if db.session.execute(text('select count(*) from fixture')).scalar() == 0:
        df = open('IPL/IPL2026.csv', 'r')
        df = list(csv.reader(df))
        for i in df[1:]:
            mt = Fixture(Match_No=i[0], Date=(datetime.strptime(i[1],'%d-%m-%Y')).date(),\
                                    Time=(datetime.strptime(i[2],'%H.%M.%S')).time(),\
                                    Team_A=i[3], Team_B=i[4], Venue=i[5],\
                                    A_info={'runs':0, 'overs':0.0, 'wkts':0},\
                                    B_info={'runs':0, 'overs':0.0, 'wkts':0},\
                                    Match_ID=i[6])
            db.session.add(mt)
            db.session.commit()
    if db.session.execute(text('select count(*) from squad')).scalar() == 0:
        df = open('IPL/all teams squad ipl.csv', 'r')
        df = list(csv.reader(df))
        for i in df[1:]:
            pl = Squad(Player_ID=i[0], Name=i[2], Team=i[1], Captain=i[4], Keeper=i[5], Overseas=i[6],\
                       Role=i[7], Batting=i[12], Bowling=i[13], Nationality=i[9], Debut=i[11], Player_URL=i[8],\
                       DOB=(datetime.strptime(i[10],'%d-%m-%Y')).date(), URL_ID=i[3])
            db.session.add(pl)
            db.session.commit()
    PT = Pointstable.query.order_by(Pointstable.Points.desc(),Pointstable.W.desc(),Pointstable.NRR.desc(),Pointstable.id.asc()).all()
    print(PT)
    return render_template('index.html', teams=full_name, clr=clr, pt=PT)

@main.route('/pointstable')
def displayPT():
    dataPT = Pointstable.query.order_by(Pointstable.Points.desc(),Pointstable.W.desc(),Pointstable.NRR.desc(),Pointstable.id.asc()).all()
    dt = [['#', '', 'Teams', 'P', 'W', 'L', 'NR', 'Pts', 'NRR', 'Last 5', 'Next', 'Win %', 'Qual %', 'Top 2'], [i for i in range(1,11)],\
         [], [], [], [], [], [], [], [], [], [], [], [], []]
    teams_ABV = []
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
        dt[1][index] = dt[1][index] if finalsData.Win_T != i.team_name else 'Champions'
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
    return render_template('squad_details.html', sq=sq, clr=clr[team], team=team, age=age, sqclr=sqclr[team])

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

@main.route('/match-<match>/matchInfo')
def matchInfo(match):
    source = request.args.get('source', None)
    team = request.args.get('fteam', None)
    return render_template('info.html', match=match, source=source, fteam=team)

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

@main.route('/match-<match>/Overs')
def matchOvers(match):
    source = request.args.get('source', None)
    team = request.args.get('fteam', None)
    return render_template('overs.html', match=match, source=source, fteam=team)

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

@main.route('/match-<match>/liveScore')
def liveScore(match):
    source = request.args.get('source', None)
    team = request.args.get('fteam', None)
    return render_template('live.html', match=match, source=source, fteam=team)

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

@main.route('/match-<match>/scoreCard')
def scoreCard(match):
    source = request.args.get('source', None)
    team = request.args.get('fteam', None)
    return render_template('scorecard.html', match=match, source=source, fteam=team)

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

@main.route('/match-<match>/liveSquad')
def liveSquad(match):
    source = request.args.get('source', None)
    team = request.args.get('fteam', None)
    return render_template('livesquad.html', match=match, source=source, fteam=team)

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
        return redirect(url_for('main.matchInfo', match=match, source=source, fteam=team))
    elif current_date >= (matchDT - timedelta(minutes=30)) and MatchFR[10] is None:
        return redirect(url_for('main.liveScore', match=match, source=source, fteam=team))
    elif MatchFR[10] is not None:
        return redirect(url_for('main.scoreCard', match=match, source=source, fteam=team))

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

def get_battingstats():
    stats = {}
    for key, value in statsList['batting'].items():
        url = statsBaseURL + value
        if key == 'Highest Scores':
            highest_scores = get_data_from_url(url)
            for hs in highest_scores:
                hs['Vs'] = next(k for k, v in full_name.items() if v == hs['Vs'])
            stats["Highest Scores"] = highest_scores
            continue
        stats[key] = get_data_from_url(url)
    return {'stats': stats}

def get_bowlingstats():
    stats = {}
    for key, value in statsList['bowling'].items():
        url = statsBaseURL + value
        if key == 'Best Bowling':
            best_bowling = get_data_from_url(url)
            for bb in best_bowling:
                bb['Vs'] = next(k for k, v in full_name.items() if v == bb['Vs'])
            stats["Best Bowling"] = best_bowling
            continue
        stats[key] = get_data_from_url(url)
    return {'stats': stats}

@main.route('/battingstats')
def battingstats():
    return render_template('battingStat.html')

@main.route('/bowlingstats')
def bowlingstats():
    return render_template('bowlingStat.html')

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
