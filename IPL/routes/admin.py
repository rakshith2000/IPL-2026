"""Admin pages: adding a match result, removing one, and the manual overrides.

Every view here is behind @login_required. The update/delete pair are mirrors
of each other - whatever an up* writes, the matching del* takes back off - and
both re-stamp the standings rank and kick off a qualification refresh in the
background once the table has moved.
"""
import threading
from flask import render_template, request, redirect, url_for, flash
from flask_login import login_required
from sqlalchemy.sql import text

from .. import db
from ..main import main
from ..models import Pointstable, Fixture
from ..config import pofs, full_name, clr
from ..services.playoffs import run_refresh_qualification_bg
from ..services.standings import update_rank_for_fixture, delete_rank_for_fixture
from ..services.results import (upMatchNormal, upMatchSuperOver, upMatchAbandoned, upMatchDLS,
                                delMatchNormal, delMatchSuperOver, delMatchAbandoned, delMatchDLS)

@main.route('/update')
@login_required
def update():
    FR = sorted(
        Fixture.query.all(),
        key=lambda r: (
            int(r.Match_No)
            if str(r.Match_No).isdigit()
            else {
                "Qualifier 1": 71,
                "Eliminator": 72,
                "Qualifier 2": 73,
                "Final": 74
            }[r.Match_No]
        )
    )

    key = request.args.get('key')

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
        return render_template('updatematch.html', FR=FR, fn=full_name, match=match, clr=clr)
    
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

        update_rank_for_fixture(data['match'])
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
        return render_template('deletematch.html', FR=FR, fn=full_name, dmatch=dmatch, clr=clr)
    
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

        delete_rank_for_fixture(dmatch)
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
        return render_template('updatepotm.html', FR=FR, fn=full_name, match=match, sq=sq, clr=clr)
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
        return render_template('playoffsupdate.html', pomatch=pofs[pomatch], teams=full_name, FR=FR, clr=clr)
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
