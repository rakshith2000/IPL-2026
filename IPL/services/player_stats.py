"""One player's career record, from the IPL stats feed.

`json` here is flask.json, as it was when this lived in main.py - keep it that
way, the error handling below depends on which module the name comes from.
"""
import requests
from flask import json

from ..config import playerStatsURL

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
