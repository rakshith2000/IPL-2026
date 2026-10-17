"""Standings extras: the rank each result left behind, and who is up next."""
from sqlalchemy.sql import text

from .. import db
from ..models import Pointstable, Fixture

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
    # Rank is only stamped on league matches, so the latest result can carry none
    if len(matches) == 0 or matches[0].Rank is None:
        return {team: 0 for team in teams.keys()}
    elif len(matches) == 1:
        rankdiff = {}
        for team, rank in matches[0].Rank.items():
            prev = teams[team]
            rankdiff[team] = prev - rank
        return rankdiff
    else:
        rankdiff = {}
        for team, rank in matches[0].Rank.items():
            prev = matches[1].Rank[team]
            rankdiff[team] = prev - rank
        return rankdiff

def getNextOpponents(teams):
    """Next unplayed opponent for each team abbreviation ('--' once the season is done)."""
    nextOpp = {}
    for team in teams:
        fixtures = db.session.execute(
            text('SELECT "Team_A", "Team_B", "Result" FROM Fixture WHERE "Team_A" = :team OR "Team_B" = :team order by id'),
            {'team': team}).fetchall()
        opp = '--'
        for j in fixtures:
            if j[2] is not None:
                continue
            opp = j[0] if j[0] != team else j[1]
            break
        nextOpp[team] = opp
    return nextOpp
