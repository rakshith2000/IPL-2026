"""Writing a match result onto its fixture, and taking it off again.

Each up* writes the result line and the two innings onto the Fixture, then
hands off to the points-table half; the del* undoes both. League matches only
touch the points table - playoff fixtures have a non-numeric Match_No, which is
what the isdigit() guards test.
"""
from .. import db
from ..models import Fixture
from ..config import full_name
from .pointstable import (upPTNormal, upPTSuperOver, upPTAbandoned, upPTDLS,
                          delPTNormal, delPTSuperOver, delPTAbandoned, delPTDLS)

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
