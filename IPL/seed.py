import csv, os
from datetime import datetime
from pathlib import Path

from flask import current_app
from sqlalchemy import text
from werkzeug.security import generate_password_hash

from . import db
from .models import User, Pointstable, Fixture, Squad, Toppers

TEAMS = ['CSK', 'DC', 'GT', 'KKR', 'LSG', 'MI', 'PBKS', 'RR', 'RCB', 'SRH']
LOCK_KEY = 20260911          # arbitrary, must be stable across deploys


def _rows(filename):
    with open(Path(current_app.root_path) / filename, newline='', encoding='utf-8') as fh:
        return list(csv.reader(fh))[1:]


def seed_users():
    wanted = {
        'Admin IPL2026 Laptop': 'adminipl2026laptop@gmail.com',
        'Admin IPL2026 Phone':  'adminipl2026phone@gmail.com',
    }
    have = {e for (e,) in db.session.query(User.email)}
    pwd = os.environ.get('ADMIN_PASSWORD', '********')
    new = [User(name=n, email=e,
                password=generate_password_hash(pwd, method='pbkdf2:sha256', salt_length=8))
           for n, e in wanted.items() if e not in have]
    db.session.add_all(new); db.session.commit()
    return len(new)


def seed_pointstable():
    have = {t for (t,) in db.session.query(Pointstable.team_name)}
    new = [Pointstable(team_name=t, P=0, W=0, L=0, NR=0, Points=0, NRR=0.0,
                       Win_List=str({}), logo_path=f'/static/images/{t}.png',
                       For={'runs': 0, 'overs': 0.0}, Against={'runs': 0, 'overs': 0.0})
           for t in TEAMS if t not in have]
    db.session.add_all(new); db.session.commit()
    return len(new)


def seed_fixtures():
    have = {m for (m,) in db.session.query(Fixture.Match_No)}
    new = [Fixture(Match_No=r[0],
                   Date=datetime.strptime(r[1], '%d-%m-%Y').date(),
                   Time=datetime.strptime(r[2], '%H.%M.%S').time(),
                   Team_A=r[3], Team_B=r[4], Venue=r[5], Match_ID=r[6],
                   A_info={'runs': 0, 'overs': 0.0, 'wkts': 0},
                   B_info={'runs': 0, 'overs': 0.0, 'wkts': 0})
           for r in _rows('IPL2026.csv') if r[0] not in have]
    db.session.add_all(new); db.session.commit()
    return len(new)


def seed_squad():
    have = {p for (p,) in db.session.query(Squad.Name)}
    new = [Squad(Player_ID=r[0], Team=r[1], Name=r[2], URL_ID=r[3], Captain=r[4],
                 Keeper=r[5], Overseas=r[6], Role=r[7], Player_URL=r[8],
                 Nationality=r[9], DOB=datetime.strptime(r[10], '%d-%m-%Y').date(),
                 Debut=r[11], Batting=r[12], Bowling=r[13])
           for r in _rows('all teams squad ipl.csv') if r[2] not in have]
    db.session.add_all(new); db.session.commit()
    return len(new)


def seed_toppers():
    from .main import statsList          # local import avoids a circular import
    wanted = ['Most POTM'] + [name for group in statsList.values() for name in group]
    have = {c for (c,) in db.session.query(Toppers.category)}
    new = [Toppers(category=c, stats=None) for c in wanted if c not in have]
    db.session.add_all(new); db.session.commit()
    return len(new)


SEEDERS = (seed_users, seed_pointstable, seed_fixtures, seed_squad, seed_toppers)


def seed_all():
    for fn in SEEDERS:
        current_app.logger.info('%s -> %d new rows', fn.__name__, fn())


def seed_all_locked():
    """Seed under a Postgres advisory lock so concurrent workers can't double-insert."""
    if db.engine.dialect.name != 'postgresql':
        return seed_all()
    with db.engine.connect() as conn:
        if not conn.exec_driver_sql(f'SELECT pg_try_advisory_lock({LOCK_KEY})').scalar():
            current_app.logger.info('seed: another worker holds the lock, skipping')
            return
        try:
            seed_all()
        finally:
            conn.exec_driver_sql(f'SELECT pg_advisory_unlock({LOCK_KEY})')
