"""Canned player-stats fixtures, used while the live feed is unavailable."""
import random

# ------------------------------------------------------------------ stats stand-in
# The player-stats feed is unavailable, so squad_details has nothing to draw and
# the page cannot be worked on. These fixtures stand in for it in exactly the
# shape get_player_stats() returns: all nine pairings of the three roles with the
# three career shapes the page has to cope with.
#
#   .../squad_details/MS%20Dhoni?stats=bowler-gaps      pick one explicitly
#   STUB_PLAYER_STATS = True                            pick by the player's role
#
# With the flag off and no ?stats= in the URL nothing changes, so this can sit
# here until the feed is back. Values are strings and years run newest-first,
# because that is what the feed does and what the template reads
# (stats['years'][-1] is the debut season).

STUB_PLAYER_STATS = True

_STUB_SEASONS = ('2026', '2025', '2024', '2023', '2022', '2021', '2020', '2019', '2018', '2017', '2016', '2015', '2014', '2013', '2012', '2011', '2010', '2009', '2008')

_STUB_SHAPES = {
    'all':  _STUB_SEASONS,                               # ever-present
    'gaps': ('2026', '2024', '2023', '2020', '2019'),    # in and out of the side
    'none': (),                                          # uncapped, never played
}

# runs per innings, strike rate, wickets per innings, economy. wpi None means
# the player does not bowl at all, which is a shape the page has to render too.
_STUB_PROFILE = {
    'batter':     {'rpi': (30, 48), 'sr': (134, 162), 'wpi': None,       'econ': None},
    'bowler':     {'rpi': (4, 12),  'sr': (92, 128),  'wpi': (1.0, 1.8), 'econ': (7.2, 9.1)},
    'allrounder': {'rpi': (18, 33), 'sr': (126, 154), 'wpi': (0.5, 1.1), 'econ': (7.8, 9.6)},
}

_STUB_ROLE_OF = {'Batter': 'batter', 'Wicket Keeper': 'batter',
                 'Bowler': 'bowler', 'All Rounder': 'allrounder'}

# TeamName comes through as the full name; squad-details.js maps it back to the
# abbreviation, so a fixture that changes team exercises that lookup.
_STUB_TEAMS = ('Chennai Super Kings', 'Mumbai Indians', 'Rajasthan Royals',
               'Gujarat Titans', 'Punjab Kings', 'Delhi Capitals')

_STUB_BAT_SUM = ('Matches', 'Innings', 'NotOuts', 'Runs', 'Balls', 'Hundreds',
                 'Fifties', 'Fours', 'Sixes', 'Catches', 'Stumpings')
_STUB_BOWL_SUM = ('Matches', 'Innings', 'Balls', 'Runs', 'Wickets', 'FourWkts', 'FiveWkts')


def _stub_overs(balls):
    """Balls to the cricket over count: 47 balls is 7.5 overs, not 7.83."""
    return f'{balls // 6}.{balls % 6}'


def _stub_bat_season(rng, role, year, team):
    """One season of batting, held as numbers so Overall can be summed from it."""
    matches = rng.randint(9, 16)
    innings = max(1, matches - rng.randint(0, 2))
    not_outs = min(innings - 1, rng.randint(0, 4 if role == 'bowler' else 2))
    runs = int(innings * rng.uniform(*_STUB_PROFILE[role]['rpi']))
    balls = max(1, int(runs * 100.0 / rng.uniform(*_STUB_PROFILE[role]['sr'])))
    hundreds = 1 if role == 'batter' and runs >= 520 and rng.random() < 0.4 else 0
    best = 100 + rng.randint(1, 22) if hundreds else max(1, int(runs * rng.uniform(0.22, 0.38)))
    return {'Year': year, 'TeamName': team, 'Matches': matches, 'Innings': innings,
            'NotOuts': not_outs, 'Runs': runs, 'Balls': balls,
            'Best': min(best, runs) or 1, 'BestNO': bool(not_outs and rng.random() < 0.4),
            'Hundreds': hundreds, 'Fifties': max(0, runs // 135 - hundreds),
            'Fours': int(runs * rng.uniform(0.085, 0.125)),
            'Sixes': int(runs * rng.uniform(0.035, 0.075)),
            'Catches': rng.randint(1, 9),
            'Stumpings': rng.randint(0, 4) if role == 'batter' else 0}


def _stub_bowl_season(rng, role, year, team, matches):
    """The bowling half of the same season, or None for someone who never bowls."""
    prof = _STUB_PROFILE[role]
    if prof['wpi'] is None:
        return None
    innings = max(1, matches - rng.randint(0, 3))
    balls = innings * rng.randint(18, 24)
    runs = int(balls / 6.0 * rng.uniform(*prof['econ']))
    wickets = max(0, int(innings * rng.uniform(*prof['wpi'])))
    best_w = min(wickets, rng.randint(2, 5))
    return {'Year': year, 'TeamName': team, 'Matches': matches, 'Innings': innings,
            'Balls': balls, 'Runs': runs, 'Wickets': wickets,
            'BestW': best_w, 'BestR': rng.randint(9, 38),
            'FourWkts': 1 if best_w >= 4 else 0, 'FiveWkts': 1 if best_w >= 5 else 0}


def _stub_bat_feed(s):
    """Season numbers -> the string-valued row the feed actually sends."""
    outs = max(1, s['Innings'] - s['NotOuts'])
    return {'Year': s['Year'], 'Matches': str(s['Matches']), 'Innings': str(s['Innings']),
            'NotOuts': str(s['NotOuts']), 'Runs': str(s['Runs']),
            'HighestScore': f"{s['Best']}{'*' if s['BestNO'] else ''}",
            'BattingAvg': f"{s['Runs'] / outs:.2f}",
            'StrikeRate': f"{s['Runs'] * 100.0 / s['Balls']:.2f}",
            'Hundreds': str(s['Hundreds']), 'Fifties': str(s['Fifties']),
            'Fours': str(s['Fours']), 'Sixes': str(s['Sixes']),
            'Catches': str(s['Catches']), 'Stumpings': str(s['Stumpings']),
            'TeamName': s['TeamName']}


def _stub_bowl_feed(s):
    wkts = max(1, s['Wickets'])
    return {'Year': s['Year'], 'Matches': str(s['Matches']), 'Innings': str(s['Innings']),
            'Overs': _stub_overs(s['Balls']), 'Runs': str(s['Runs']),
            'Wickets': str(s['Wickets']), 'BBM': f"{s['BestW']}/{s['BestR']}",
            'Average': f"{s['Runs'] / wkts:.2f}" if s['Wickets'] else '-',
            'Econ': f"{s['Runs'] * 6.0 / s['Balls']:.2f}",
            'StrikeRate': f"{s['Balls'] / wkts:.2f}" if s['Wickets'] else '-',
            'FourWkts': str(s['FourWkts']), 'FiveWkts': str(s['FiveWkts']),
            'TeamName': s['TeamName']}


def _stub_never_bowled(matches, team):
    """What the career row looks like for a batter who has never bowled."""
    return {'Year': 'Overall', 'Matches': str(matches), 'Innings': '0', 'Overs': '0.0',
            'Runs': '0', 'Wickets': '0', 'BBM': '-', 'Average': '-', 'Econ': '-',
            'StrikeRate': '-', 'FourWkts': '0', 'FiveWkts': '0', 'TeamName': team}


def _build_stub(role, shape, seed):
    years = _STUB_SHAPES[shape]
    if not years:
        # Exactly what get_player_stats() returns when the feed has no Batting
        # list: the page has to fall back to "NO DATA AVAILABLE" off this.
        return {'Overall': {'batting': None, 'bowling': None}, 'years': None}

    rng = random.Random(seed)
    current, former = rng.sample(_STUB_TEAMS, 2)
    bat, bowl = [], []
    for i, year in enumerate(years):
        team = current if i < 3 else former      # traded three seasons ago
        season = _stub_bat_season(rng, role, year, team)
        bat.append(season)
        spell = _stub_bowl_season(rng, role, year, team, season['Matches'])
        # On a patchy career, leave one season batted-but-not-bowled: that is
        # the only way to reach the per-year "bowling is None" branch.
        if spell and not (shape == 'gaps' and i == 1):
            bowl.append(spell)

    bat_all = {k: sum(s[k] for s in bat) for k in _STUB_BAT_SUM}
    peak = max(bat, key=lambda s: s['Best'])
    bat_all.update({'Year': 'Overall', 'TeamName': current,
                    'Best': peak['Best'], 'BestNO': peak['BestNO']})

    if bowl:
        bowl_all = {k: sum(s[k] for s in bowl) for k in _STUB_BOWL_SUM}
        haul = max(bowl, key=lambda s: (s['BestW'], -s['BestR']))
        bowl_all.update({'Year': 'Overall', 'TeamName': current,
                         'Matches': bat_all['Matches'],
                         'BestW': haul['BestW'], 'BestR': haul['BestR']})
        career_bowling = _stub_bowl_feed(bowl_all)
    else:
        career_bowling = _stub_never_bowled(bat_all['Matches'], current)

    stats = {'Overall': {'batting': _stub_bat_feed(bat_all), 'bowling': career_bowling},
             'years': [s['Year'] for s in bat]}
    for season in bat:
        spell = next((s for s in bowl if s['Year'] == season['Year']), None)
        stats[season['Year']] = {'batting': _stub_bat_feed(season),
                                 'bowling': _stub_bowl_feed(spell) if spell else None}
    return stats


# Seeded, so a given fixture is the same on every restart and a layout change
# can be compared against the last screenshot.
DUMMY_PLAYER_STATS = {
    f'{role}-{shape}': _build_stub(role, shape, 4200 + i)
    for i, (role, shape) in enumerate((r, s) for r in _STUB_PROFILE for s in _STUB_SHAPES)
}


def stub_player_stats(key=None, role=None, seed=0):
    """Stand-in for get_player_stats() while the feed is down.

    `key` is a ?stats= value such as "bowler-gaps". With no key, and only when
    STUB_PLAYER_STATS is on, a fixture is picked from the player's own role so
    that browsing the squad shows all three career shapes. Returns None when
    neither applies, which tells the caller to go to the live feed.
    """
    if key:
        return DUMMY_PLAYER_STATS.get(key)
    if not STUB_PLAYER_STATS:
        return None
    shape = ('all', 'gaps', 'none')[int(seed or 0) % 3]
    return DUMMY_PLAYER_STATS[f"{_STUB_ROLE_OF.get(role, 'batter')}-{shape}"]
