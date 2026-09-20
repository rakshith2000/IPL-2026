/* ==========================================================================
   IPL 2026 · Match centre — Overs panel
   Every over of the match, newest first: who bowled it to whom, the six balls
   and what it cost. Second innings on top, first innings underneath, which is
   the order they are read in.

   Ball maths lives on window.MX (js/match.js), shared with the Live panel.
   ========================================================================== */

function renderTabOvers(data) {
    const MX = window.MX;
    const esc = MX.esc;
    const dt3 = data.dt3 || {};
    const tid = data.tid || {};
    const clr = data.clr || {};          /* the full c1/c2/c3 set on this route */
    const strip = dt3.score_strip || [];

    /* second innings first — the overs feed is keyed the same way as the
       score strip, so inn2 belongs to strip[1] */
    const blocks = [
        { src: data.inn2, team: (tid[(strip[1] || {}).team_id] || [])[0] || '' },
        { src: data.inn1, team: (tid[(strip[0] || {}).team_id] || [])[0] || '' }
    ].filter(b => b.src && b.src.inning && (b.src.inning.overs || []).length);

    if (!blocks.length) {
        document.getElementById('tab-content').innerHTML =
            '<div class="mx-empty"><span class="material-icons-round">av_timer</span>' +
            '<b>No overs yet</b><p>Each over lands here as soon as it is bowled.</p></div>';
        return;
    }

    let html = '';

    blocks.forEach(block => {
        let rows = '';

        block.src.inning.overs.forEach(over => {
            if (over.overNumber === 0) return;

            const balls = over.balls || [];
            const first = balls[0] || {};
            const comments = first.comments || [];

            /* the bowler is named in the end-of-over line when there is one,
               otherwise it has to be read off the last delivery's commentary */
            let bowler = '';
            if (comments[0] && comments[0].commentTypeId === 'EndOfOver') {
                const msg = String(comments[0].message || '');
                bowler = msg.split('Bowler: ')[1] ? msg.split('Bowler: ')[1].split('.')[0] : '';
            } else if (comments.length) {
                const msg = String(comments[comments.length - 1].message || '');
                bowler = msg.split(' to ')[0].split(' ').slice(-2).join(' ');
            }

            let chips = '';
            balls.slice().reverse().forEach(b => { chips += MX.ball(MX.ballScore(b)); });

            const wickets = balls.filter(b => b.isWicket).length;
            const tone = over.totalRuns >= 12 ? ' is-big' : (wickets ? ' is-wkt' : '');

            rows += '<div class="mx-over' + tone + '">' +
                      '<div class="mx-over__left">' +
                        MX.crest(block.team, clr, 'mx-crest--xs') +
                        '<span class="mx-over__no">Ov ' + esc(over.overNumber) + '</span>' +
                        '<span class="mx-over__score">' + esc(over.totalInningRuns) + '-' +
                          esc(over.totalInningWickets) + '</span>' +
                      '</div>' +
                      '<div class="mx-over__mid">' +
                        '<div class="mx-over__who"><b>' + esc(bowler) + '</b> to ' +
                          MX.overBatsmen(over).map(esc).join(', ') + '</div>' +
                        '<div class="mx-over__balls">' + chips + '</div>' +
                      '</div>' +
                      '<div class="mx-over__right">' +
                        '<span class="mx-over__runs">' + esc(over.totalRuns) +
                          '<small>runs</small></span>' +
                      '</div>' +
                    '</div>';
        });

        html += '<div class="mx-card">' +
                  '<div class="mx-card__head mx-card__head--team" style="' + MX.tint(block.team, clr) + '">' +
                    '<span class="material-icons-round">av_timer</span>' +
                    esc(block.team || 'Innings') + ' innings<small>Newest first</small>' +
                  '</div>' + rows +
                '</div>';
    });

    document.getElementById('tab-content').innerHTML = html;
}
