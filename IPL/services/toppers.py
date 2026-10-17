"""The stats leaderboards: refreshing them from the feed, and reading them back."""
import requests
from flask import json
from sqlalchemy.sql import text
from sqlalchemy.orm.attributes import flag_modified
from collections import Counter

from .. import db
from ..models import Squad, Toppers
from ..config import statsList, statsURL
from ..utils.formatting import serialize
from .players import find_player
from .player_stats import get_player_stats

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

    try:
        potms = sorted(potms, key=lambda x: (x['potm'], x['runs'], x['wickets']), reverse=True)
    except Exception as e:
        print(f"Error while sorting the toppers for Most POTM: {e}")
    finally:
        potms = sorted(potms, key=lambda x: (x['potm']), reverse=True)
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
                            player = find_player(row[playerKey], SquadFull, team=row.get('TeamCode'))
                            row[playerKey] = player[2] if player is not None else row[playerKey]
                            row['TeamCode'] = player[3] if player is not None else row['TeamCode']
                    tp.stats = data
                else:
                    tp.stats = None
                db.session.commit()
            except Exception as e:
                print(f"Error updating toppers for {stat_name}: {e}")
                print(f"Mapping Player Name for exisiting for {stat_name} if any (Failure case)")
                tp = Toppers.query.filter_by(category=stat_name).first()
                if tp and tp.stats and stat_name != "Fair Play Award":
                    playerKey = ("StrikerName" if stats_type == "batting_stats" else "BowlerName" if stats_type == "bowling_stats" else "PlayerName")
                    for row in tp.stats:
                        player_name = row.get(playerKey)
                        if not player_name:
                            continue
                        player = find_player(player_name, SquadFull, team=row.get("TeamCode"))

                        if player:
                            row[playerKey] = player[2]
                            row["TeamCode"] = player[3]

                    flag_modified(tp, "stats")
                    db.session.commit()

def get_stats():
    tp = db.session.execute(text('SELECT category, stats FROM Toppers ORDER BY id ASC')).fetchall()
    tp = {row[0]: row[1] for row in tp}
    return serialize({'stats': tp})
