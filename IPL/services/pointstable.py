"""Applying and reversing one match's effect on the points table.

Four match endings, each with an up* that adds the result and a del* that takes
it back off again, so deleting a result returns the table to exactly where it
was. Net run rate is recomputed from the running For/Against totals each time.
"""
from sqlalchemy.sql import text

from .. import db
from ..models import Pointstable
from ..utils.overs import oversAdd, oversSub, ovToPer

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
