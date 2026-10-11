"""Accuracy harness for find_player().

Loads the name-matching block out of IPL/main.py (so Flask is not needed),
builds feed-style spellings of every player in the squad, and reports which
ones resolve back to the right row.

Run:  python tests_find_player.py
"""
import re, sys, unicodedata, sqlite3, random
from collections import defaultdict
from fuzzywuzzy import fuzz

# Pull the matcher out of main.py by source, so the harness does not need Flask,
# a database session or network access.
SRC = open('IPL/main.py', encoding='utf-8').read()
BLOCK = SRC[SRC.index('# --------------------------------------------------'
                      '---------------- player name matching'):
            SRC.index('def get_data_from_url(')]
# get_player_stats() sits in the middle of that span and pulls in requests; drop it
BLOCK = BLOCK.replace(SRC[SRC.index('def get_player_stats('):
                          SRC.index('def _match_in_pool(')], '')
ns = {'re': re, 'unicodedata': unicodedata, 'fuzz': fuzz,
      'defaultdict': defaultdict, 'teamID': {}}
exec(compile(BLOCK, 'namematch', 'exec'), ns)
find_player = ns['find_player']

con = sqlite3.connect('instance/IPL.sqlite')
rows = con.execute('SELECT id, Player_ID, Name, Team FROM Squad ORDER BY id').fetchall()
NAME, TEAM = 2, 3
by_name = {r[NAME]: r for r in rows}


# ---------------------------------------------------------------- feed spellings
def variants(name):
    """Plausible ways a feed writes this player's name."""
    words = name.replace('.', ' ').split()
    out = {name}
    if len(words) >= 2:
        surname = words[-1]
        given = words[:-1]
        out.add(surname)                                            # "Natarajan"
        out.add(' '.join(w[0] for w in given) + ' ' + surname)      # "R Jadeja"
        out.add(''.join(w[0] for w in given) + ' ' + surname)       # "RA Jadeja"
        out.add(' '.join(w[0] + '.' for w in given) + ' ' + surname)
        out.add(given[0] + ' ' + surname)                           # drop middles
        out.add(name.upper())
        out.add(name + ' (c)')
        out.add(name.replace(' ', '  '))
        # the feed carries a name our squad list truncates, and the extra word
        # is on the end: "Rasikh Dar Salam" vs our "Rasikh Dar"
        out.add(name + ' Salam')
    return {v for v in out if v.strip()}


TYPO = {'Mohammed': 'Mohd.', 'Mohammad': 'Mohammed', 'Chakaravarthy': 'Chakravarthy',
        'Ahamad': 'Ahmed', 'Ahmad': 'Ahmed',
        'Matthew': 'Matt', 'Mitchell': 'Mitch', 'Nicholas': 'Nick',
        'Surya Kumar': 'Suryakumar', 'Quinton de Kock': 'Q de Kock'}


def typo_variants(name):
    out = set()
    for a, b in TYPO.items():
        if a in name:
            out.add(name.replace(a, b))
    return out


# ---------------------------------------------------------------- the old matcher
def old_normalize(name):
    name = re.sub(r'[^a-zA-Z ]', '', name.lower()).strip()
    name = name.replace('mohd', 'mohammed').replace('md', 'mohammed')
    return ' '.join(sorted(name.split()))


def old_find_player(full_name, player_data, threshold=80):
    normalized_search = old_normalize(full_name)
    for player in player_data:
        if old_normalize(player[2]) == normalized_search:
            return player
    strategies = [fuzz.token_set_ratio, fuzz.token_sort_ratio,
                  fuzz.partial_ratio, fuzz.WRatio]
    best_match, best_score = None, 0
    for player in player_data:
        for strategy in strategies:
            score = strategy(full_name, player[2])
            if score > best_score:
                best_score, best_match = score, player
                if best_score == 100:
                    return best_match
    if best_score < threshold:
        search_initials = ''.join(w[0] for w in full_name.split() if len(w) > 1)
        for player in player_data:
            db_initials = ''.join(w[0] for w in player[2].split()
                                  if len(w) > 1 and w[0].isupper())
            if db_initials and search_initials == db_initials:
                return player
    return best_match if best_score >= threshold else None


def run(label, cases, use_team, matcher=None):
    ok = miss = wrong = 0
    bad = []
    for query, expected in cases:
        hint = expected[TEAM] if use_team else None
        if matcher is old_find_player:
            got = old_find_player(query, rows)
        else:
            got = find_player(query, rows, team=hint)
        if got is None:
            miss += 1
            bad.append(('MISS', query, expected[NAME], '-'))
        elif got[NAME] == expected[NAME]:
            ok += 1
        else:
            wrong += 1
            bad.append(('WRONG', query, expected[NAME], got[NAME]))
    total = len(cases)
    print(f'{label:<34} {ok:>4}/{total}  ok {100*ok/total:5.1f}%   '
          f'wrong {wrong:>3} ({100*wrong/total:4.1f}%)   unresolved {miss:>3}')
    return bad


cases_exact = [(r[NAME], r) for r in rows]
cases_var = [(v, r) for r in rows for v in variants(r[NAME])]
cases_typo = [(v, r) for r in rows for v in typo_variants(r[NAME])]

print(f'squad: {len(rows)} players\n')
print('OLD')
old_bad = []
old_bad += run('  exact feed name', cases_exact, False, old_find_player)
old_bad += run('  feed variants', cases_var, False, old_find_player)
old_bad += run('  spelling drift', cases_typo, False, old_find_player)

print('\nNEW')
bad = []
bad += run('  exact feed name', cases_exact, False)
bad += run('  feed variants (no team hint)', cases_var, False)
hinted = run('  feed variants (with team hint)', cases_var, True)
bad += run('  spelling drift (no team hint)', cases_typo, False)
run('  spelling drift (with team hint)', cases_typo, True)

old_wrong = [b for b in old_bad if b[0] == 'WRONG']
print(f'\nold: {len(old_wrong)} wrong matches, new: '
      f'{len([b for b in bad if b[0] == "WRONG"])}')
print('\n--- a sample of what the old matcher got wrong')
for kind, q, exp, got in random.Random(7).sample(old_wrong, min(25, len(old_wrong))):
    print(f'  {q!r:<34} expected {exp!r:<28} got {got!r}')

print(f'\n--- still unresolved with a team hint: '
      f'{len([b for b in hinted if b[0] == "MISS"])}')
for kind, q, exp, got in hinted[:45]:
    print(f'  {kind:<5} {q!r:<34} expected {exp!r:<28} got {got!r}')
