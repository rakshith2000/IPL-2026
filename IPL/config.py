"""Reference data for the season, read from config.json.

The feed URLs, the playoff labels and the per-team name/colour/handle maps all
used to sit as literals at the top of main.py. None of them is code: they change
between seasons - and sometimes mid-season, when a franchise rebrands or a feed
moves - so they live in config.json and the modules that need them import the
names from here.

Keys are exposed under the same names the modules already used, so anything
reading them stays unchanged. The file is read once, at import time; editing
config.json needs a restart to take effect.
"""

import json
from pathlib import Path

CONFIG_PATH = Path(__file__).with_name('config.json')

with CONFIG_PATH.open(encoding='utf-8') as fh:
    CONFIG = json.load(fh)

_urls = CONFIG['urls']
_teams = CONFIG['teams']
_colors = CONFIG['colors']

# Playoff shorthand -> the Match_No the fixture is stored under
pofs = CONFIG['playoffs']

liveURL_Prefix = _urls['live']['prefix']
liveURL_Suffix = _urls['live']['suffix']
statsURL = _urls['stats']
playerStatsURL = _urls['player_stats']
tp_urls = _urls['toppers']

statsList = CONFIG['stats_list']

full_name = _teams['full_name']
champions = _teams['champions']
teams_data = _teams['info']
teams_social = _teams['social']

# JSON object keys are always strings; the feeds hand team ids back as numbers
# and team_abbr() looks them up as ints, so cast on the way in.
teamID = {int(k): v for k, v in _teams['ids'].items()}

clr = _colors['match']
ptclr = _colors['points_table']
sqclr = _colors['squad']
