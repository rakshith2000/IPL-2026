/* ==========================================================================
   IPL 2026 · Season Predictor
   --------------------------------------------------------------------------
   Pick the rest of the season — or rewrite a match that has already been
   played — and watch the table move. Every pick is a local edit: they live in
   this browser, the server is only ever asked to re-run the simulation, and no
   result is written. Reloading keeps your picks; Reset drops them.

   A completed match shows its real result until you override it, at which
   point the card says so and offers the real one back. That is the whole point
   of the thing: "what if RCB had chased that down?"

   Three panels off one payload. /api/predictor/state is fetched once for the
   fixtures and the per-match prices; /api/predictor/simulate is re-run
   (debounced) on every pick for the standings those picks produce plus a fresh
   Monte-Carlo of everything still open.
   ========================================================================== */

(function () {
  'use strict';

  var STORE = 'ipl2026.predictor.picks';
  var DOCK_STORE = 'ipl2026.predictor.dock';
  var REPLAY_STORE = 'ipl2026.predictor.replay';
  var DEBOUNCE_MS = 160;

  var STATE = null;        /* fixtures + team colours, fetched once */
  var LAST = null;         /* the most recent simulate() answer */
  var PICKS = load(STORE, {});
  /* replay mode: the real results are set aside and the whole season is open.
     Opening a played season one match at a time is the thing nobody wants to
     do, so this is the bulk version of the per-match Re-predict button. */
  var REPLAY = load(REPLAY_STORE, false) === true;
  var tab = 'league';
  var filter = 'all';
  var simTimer = null;
  var simToken = 0;
  var openScores = {};     /* which score editors the reader has unfolded */
  var openEdit = {};       /* completed matches the reader has opened for rewriting */
  var impacts = {};        /* impact analysis answers, per match */

  var panel = document.getElementById('prPanel');
  var filters = document.getElementById('prFilters');
  var countEl = document.getElementById('prCount');
  var dock = document.getElementById('prDock');
  var dockStrip = document.getElementById('prDockStrip');
  var dockMeta = document.getElementById('prDockMeta');
  var dockToggle = document.getElementById('prDockToggle');
  var replayBtn = document.getElementById('prReplay');
  var banner = document.getElementById('prBanner');

  /* --------------------------------------------------------------- helpers */

  function esc(v) {
    return String(v === undefined || v === null ? '' : v)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function load(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      return raw === null ? fallback : JSON.parse(raw);
    } catch (e) { return fallback; }
  }

  function store(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); }
    catch (e) { /* private mode: it just will not survive a reload */ }
  }

  function save() { store(STORE, PICKS); }

  function team(abv) { return (STATE && STATE.teams[abv]) || { name: abv, clr: {} }; }

  /* The two brand colours behind a crest — the same per-team picks the
     standings and fixtures pages use, so a card here reads like one there. */
  function pair(abv) {
    var c = team(abv).clr || {};
    if (abv === 'RCB') return [c.c3, c.c1];
    if (abv === 'GT' || abv === 'MI') return [c.c3, c.c2];
    if (abv === 'PBKS') return [c.c2, c.c1];
    if (abv === 'KKR') return [c.c2, c.c3];
    return [c.c1, c.c2];
  }

  function tint(abv) {
    var p = pair(abv);
    return '--c1: ' + esc(p[0] || '#4cc9f0') + '; --c2: ' + esc(p[1] || '#a758ff') + ';';
  }

  /* the 3px stripe across the top of a match card: one side's colour each */
  function stripe(a, b) {
    return '--ha: ' + esc(pair(a)[0] || '#4cc9f0') + '; --hb: ' + esc(pair(b)[0] || '#a758ff') + ';';
  }

  function solid(abv) { return esc(pair(abv)[0] || '#4cc9f0'); }

  function crest(abv, cls) {
    if (!abv) return '<span class="pr-crest ' + (cls || '') + ' is-tba"></span>';
    return '<span class="pr-crest ' + (cls || '') + '" style="' + tint(abv) + '">' +
             '<img src="/static/images/squad_logos/' + encodeURIComponent(abv) + '.png" ' +
                  'alt="" loading="lazy" onerror="this.remove();">' +
           '</span>';
  }

  function pct(v) { return (Math.round(v * 10) / 10).toFixed(1) + '%'; }
  function sign(v) { return (v > 0 ? '+' : '') + v.toFixed(3); }

  function pickOf(no) { return (PICKS[no] || {}).w || null; }

  /* A pick on a match that really happened. Those are the ones the UI has to
     be loud about — the rest are just predictions of the future. */
  function rewritten(m) { return m.played && !!pickOf(m.no); }

  /* A played match whose result is being ignored: replay mode is on and the
     reader has not said what should have happened instead, so it is simulated. */
  function setAside(m) { return m.played && REPLAY && !pickOf(m.no); }

  /* Can this card be picked on? Anything unplayed, anything already rewritten,
     anything the reader opened by hand, and everything at all in replay mode. */
  function editable(m) {
    return !m.played || REPLAY || !!pickOf(m.no) || !!openEdit[m.no];
  }

  function pickCount() {
    return STATE ? STATE.league.filter(function (m) { return pickOf(m.no); }).length : 0;
  }

  /* ======================================================================
     Simulation
     ====================================================================== */

  function queueSim(immediate) {
    clearTimeout(simTimer);
    simTimer = setTimeout(runSim, immediate ? 0 : DEBOUNCE_MS);
  }

  function runSim() {
    var token = ++simToken;
    document.body.classList.add('is-working');
    fetch('/api/predictor/simulate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ picks: PICKS, replay: REPLAY })
    })
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(function (data) {
        if (token !== simToken) return;        /* a newer click already won */
        LAST = data;
        render();
      })
      .catch(function (err) {
        if (token !== simToken) return;
        if (window.console) console.warn('predictor:', err);
        if (!LAST) {
          panel.innerHTML = empty('cloud_off', 'Could not reach the simulator',
                                  'Check your connection and try again.');
        }
      })
      .then(function () {
        if (token === simToken) document.body.classList.remove('is-working');
      });
  }

  function empty(icon, title, body) {
    return '<div class="pr-empty"><span class="material-icons-round">' + icon + '</span>' +
           '<b>' + esc(title) + '</b><p>' + esc(body) + '</p></div>';
  }

  /* ======================================================================
     Panel: League stage
     ====================================================================== */

  function leaguePanel() {
    var games = STATE.league.filter(function (m) {
      if (filter === 'done') return m.played;
      if (filter === 'todo') return !m.played;
      if (filter === 'mine') return !!pickOf(m.no);
      return true;
    });

    var open = STATE.league.filter(function (m) {
      return (REPLAY || !m.played) && !pickOf(m.no);
    }).length;
    var mine = pickCount();
    countEl.innerHTML = '<b>' + open + '</b> still to simulate &middot; <b>' + mine +
                        '</b> picked by you' +
                        (REPLAY ? ' &middot; real results set aside' : '') +
                        (LAST ? ' &middot; ' + LAST.sims.toLocaleString() + ' sims in ' +
                                LAST.ms + 'ms' : '');

    if (!games.length) {
      return empty('event_available', 'Nothing here',
                   filter === 'mine' ? 'You have not changed any match yet.'
                                     : 'No matches match this filter.');
    }
    return games.map(matchCard).join('');
  }

  function matchCard(m) {
    var pick = pickOf(m.no);
    var a = m.a, b = m.b;
    var wpA = Math.round((m.wp || 0.5) * 100);
    var label = /^\d+$/.test(m.no) ? 'Match ' + m.no : m.no;
    var isRewrite = rewritten(m);
    var aside = setAside(m);
    /* a played match is read-only until the reader asks to rewrite it, or until
       replay mode opens the lot */
    var editing = editable(m);

    var tag = isRewrite ? '<span class="pr-tag pr-tag--new">Rewritten</span>'
            : aside ? '<span class="pr-tag pr-tag--off">Set aside</span>'
            : m.played ? '<span class="pr-tag pr-tag--done">Result</span>'
            : pick ? '<span class="pr-tag pr-tag--pick">Your pick</span>' : '';

    var head =
      '<div class="pr-match__meta">' + esc(label) +
        (m.venue ? ' <i>&bull;</i> ' + esc(m.venue) : '') +
        (m.date ? ' <i>&bull;</i> ' + esc(m.date) : '') + tag +
      '</div>' +
      '<div class="pr-match__sides">' +
        '<span class="pr-side">' + crest(a, 'pr-crest--sm') +
          '<span class="pr-side__name">' + esc(team(a).name) + '</span></span>' +
        '<span class="pr-match__vs">vs</span>' +
        '<span class="pr-side pr-side--r">' + crest(b, 'pr-crest--sm') +
          '<span class="pr-side__name">' + esc(team(b).name) + '</span></span>' +
      '</div>';

    /* --- what actually happened, for a match that has been played -------- */
    var actual = '';
    if (m.played) {
      var stale = isRewrite || aside;
      /* Restore only means anything when there is a pick of your own to drop.
         In replay mode the whole season is set aside, so the way back is the
         Replay button rather than a per-card action. */
      var act = isRewrite
        ? '<button type="button" class="pr-match__act" data-restore="' + esc(m.no) + '">Restore</button>'
        : (editing ? '' : '<button type="button" class="pr-match__act" data-edit="' +
           esc(m.no) + '">Re-predict</button>');
      actual = '<div class="pr-match__result' + (stale ? ' is-stale' : '') + '">' +
                 '<span class="material-icons-round">' + (stale ? 'history' : 'verified') + '</span>' +
                 esc(m.result || 'Completed') + act +
               '</div>';
    }

    if (!editing) {
      return '<article class="pr-match is-done" style="' + stripe(a, b) + '">' +
               head + actual + '</article>';
    }

    /* --- the model's price, and what one result would do to the odds ----- */
    var imp = impacts[m.no];
    var impactBlock = '';
    if (imp === 'loading') {
      impactBlock = '<div class="pr-impact is-loading">Working out the swing&hellip;</div>';
    } else if (imp && imp.ok) {
      impactBlock = '<div class="pr-impact">' +
        '<div class="pr-impact__head">Top-four chance after this result</div>' +
        imp.swing.slice(0, 5).map(function (s) {
          return '<div class="pr-impact__row">' +
                   '<span class="pr-impact__team">' + crest(s.team, 'pr-crest--xs') + esc(s.team) + '</span>' +
                   '<span class="pr-impact__v">' + pct(s.a) + '</span>' +
                   '<span class="pr-impact__v">' + pct(s.b) + '</span>' +
                   '<span class="pr-impact__swing ' + (s.swing >= 0 ? 'is-up' : 'is-down') + '">' +
                     (s.swing > 0 ? '+' : '') + s.swing.toFixed(1) + '</span>' +
                 '</div>';
        }).join('') +
        '<div class="pr-impact__key"><span>' + esc(imp.a) + ' win</span><span>' +
          esc(imp.b) + ' win</span><span>swing</span></div>' +
      '</div>';
    }

    var prob =
      '<div class="pr-prob">' +
        '<div class="pr-prob__nums"><b>' + wpA + '%</b><span>Win probability</span>' +
          '<b>' + (100 - wpA) + '%</b></div>' +
        '<div class="pr-prob__bar">' +
          '<span style="width:' + wpA + '%; background:' + solid(a) + '"></span>' +
          '<span style="width:' + (100 - wpA) + '%; background:' + solid(b) + '"></span>' +
        '</div>' +
        '<button type="button" class="pr-impact__btn" data-impact="' + esc(m.no) + '">' +
          '<span class="material-icons-round">show_chart</span>Impact Analysis</button>' +
        impactBlock +
      '</div>';

    /* --- the pick --------------------------------------------------------- */
    var opts = [[a, a], ['NR', 'No Result'], [b, b]].map(function (o) {
      var on = pick === o[0];
      var nr = o[0] === 'NR';
      return '<button type="button" class="pr-pick' + (nr ? ' pr-pick--nr' : '') +
               (on ? ' is-on' : '') + '" style="' + (nr ? '' : tint(o[0])) + '" ' +
               'data-pick="' + esc(m.no) + '" data-who="' + esc(o[0]) + '" ' +
               'aria-pressed="' + (on ? 'true' : 'false') + '">' + esc(o[1]) + '</button>';
    }).join('');

    /* --- optional scores, the only thing that moves net run rate --------- */
    var scoresOpen = !!openScores[m.no];
    var scores = scoresOpen
      ? '<div class="pr-scores">' + scoreCol(m, 'a', a) + scoreCol(m, 'b', b) + '</div>'
      : '';

    /* A pick with no scores says who won but not by how much, so that match
       stops contributing to run rate. Worth saying out loud on a rewrite,
       where it silently drops a margin that used to be there. */
    var note = (isRewrite && !hasScores(m.no))
      ? '<div class="pr-note"><span class="material-icons-round">info</span>' +
        '<span>This match no longer counts towards net run rate &mdash; set the ' +
        'scores below to put a margin back on it.</span></div>'
      : '';

    return '<article class="pr-match' + (pick ? ' is-picked' : '') +
             (isRewrite ? ' is-rewritten' : '') + '" style="' + stripe(a, b) + '">' +
             head + actual + prob +
             '<div class="pr-match__pickrow">' +
               '<span class="pr-match__pickhead">' +
                 (m.played ? 'Rewrite this result' : 'Predict result') + '</span>' +
               '<div class="pr-picks">' + opts + '</div></div>' +
             note +
             '<button type="button" class="pr-fold" data-scores="' + esc(m.no) + '" ' +
               'aria-expanded="' + (scoresOpen ? 'true' : 'false') + '">' +
               '<span class="material-icons-round">' +
                 (scoresOpen ? 'expand_less' : 'expand_more') + '</span>' +
               (scoresOpen ? 'Hide scores' : 'Set scores (for NRR)') +
             '</button>' + scores +
           '</article>';
  }

  var FIELDS = [['runs', 'Runs', 10], ['wkts', 'Wickets', 1],
                ['overs', 'Overs', 1], ['balls', 'Balls', 1]];

  function hasScores(no) {
    var p = PICKS[no] || {};
    return !!(p.a && p.b);
  }

  function scoreCol(m, side, abv) {
    var v = (PICKS[m.no] || {})[side + '_raw'] || {};
    return '<div class="pr-score">' +
             '<div class="pr-score__head">' + crest(abv, 'pr-crest--xs') + esc(abv) + ' innings</div>' +
             '<div class="pr-score__grid">' +
               FIELDS.map(function (f) {
                 return '<div class="pr-step">' +
                          '<span class="pr-step__label">' + f[1] + '</span>' +
                          '<button type="button" data-step="' + esc(m.no) + '" data-side="' + side +
                            '" data-key="' + f[0] + '" data-by="' + f[2] + '">+ ' + f[2] + '</button>' +
                          '<b>' + (v[f[0]] || 0) + '</b>' +
                          '<button type="button" data-step="' + esc(m.no) + '" data-side="' + side +
                            '" data-key="' + f[0] + '" data-by="' + (-f[2]) + '">&minus; ' + f[2] + '</button>' +
                        '</div>';
               }).join('') +
             '</div>' +
           '</div>';
  }

  /* ======================================================================
     Panel: Playoffs
     ====================================================================== */

  function playoffPanel() {
    if (!LAST) return skeleton();
    countEl.innerHTML = '<b>' + LAST.remaining + '</b> league matches still open &middot; ' +
                        'bracket follows the predicted top four';

    var race = LAST.table.slice().sort(function (x, y) { return y.top4 - x.top4; });
    var rows = race.map(function (r) {
      return '<div class="pr-race__row">' +
               '<span class="pr-race__id">' + crest(r.team, 'pr-crest--xs') + esc(r.team) + '</span>' +
               '<span class="pr-race__bars">' +
                 bar('Top 4', r.top4, solid(r.team)) +
                 bar('Top 2', r.top2, '#ffc247') +
                 bar('Title', r.title, '#2ee27a') +
               '</span>' +
             '</div>';
    }).join('');

    var br = LAST.bracket || {};
    var bracketHtml;
    if (!br.seeded) {
      bracketHtml = empty('account_tree', 'No bracket yet',
                          'The four come from the predicted table.');
    } else {
      bracketHtml = br.ties.map(tieCard).join('');
      var champ = br.ties[3] && br.ties[3].winner;
      if (champ) {
        bracketHtml += '<div class="pr-champ" style="' + tint(champ) + '">' +
                         '<span class="material-icons-round">emoji_events</span>' +
                         '<span><small>Predicted champions</small>' +
                         '<b>' + esc(team(champ).name) + '</b></span>' +
                       '</div>';
      }
    }

    return '<section class="pr-card">' +
             '<div class="pr-card__head"><span class="material-icons-round">leaderboard</span>' +
               'Playoff race<small>Top 4 &middot; Top 2 &middot; Title</small></div>' +
             '<div class="pr-race">' + rows + '</div>' +
           '</section>' +
           '<section class="pr-card">' +
             '<div class="pr-card__head"><span class="material-icons-round">account_tree</span>Bracket' +
               (br.provisional ? '<small>Provisional &mdash; the league is not settled</small>'
                               : '<small>Seeded</small>') +
             '</div>' + bracketHtml +
           '</section>';
  }

  function bar(label, v, colour) {
    return '<span class="pr-bar"><i>' + label + '</i>' +
             '<span class="pr-bar__track"><span style="width:' +
               Math.max(0, Math.min(100, v)) + '%; background:' + colour + '"></span></span>' +
             '<b>' + pct(v) + '</b></span>';
  }

  function tieCard(t) {
    var known = t.a && t.b;
    var wpA = Math.round((t.wp || 0.5) * 100);
    var opts = known && !t.played
      ? '<div class="pr-picks">' + [t.a, t.b].map(function (s) {
          var on = t.winner === s;
          return '<button type="button" class="pr-pick' + (on ? ' is-on' : '') +
                 '" style="' + tint(s) + '" data-pick="' + esc(t.no) + '" data-who="' + esc(s) +
                 '" aria-pressed="' + (on ? 'true' : 'false') + '">' + esc(s) + '</button>';
        }).join('') + '</div>'
      : '';

    return '<div class="pr-tie' + (t.winner ? ' is-picked' : '') + '">' +
             '<div class="pr-tie__head">' + esc(t.title) +
               (t.venue ? ' <i>&bull;</i> ' + esc(t.venue) : '') + '</div>' +
             '<div class="pr-tie__sides">' +
               '<span class="pr-side">' + crest(t.a, 'pr-crest--sm') +
                 '<span class="pr-side__name">' + esc(t.a || 'TBD') + '</span></span>' +
               '<span class="pr-match__vs">' +
                 (known ? wpA + '% &middot; ' + (100 - wpA) + '%' : 'vs') + '</span>' +
               '<span class="pr-side pr-side--r">' + crest(t.b, 'pr-crest--sm') +
                 '<span class="pr-side__name">' + esc(t.b || 'TBD') + '</span></span>' +
             '</div>' + opts +
             (t.played ? '<div class="pr-tie__done">Played &mdash; ' + esc(t.winner || '') +
                         '</div>' : '') +
           '</div>';
  }

  /* ======================================================================
     Panel: Points table
     ====================================================================== */

  function tablePanel() {
    if (!LAST) return skeleton();
    countEl.innerHTML = LAST.remaining
      ? '<b>' + LAST.remaining + '</b> matches simulated ' +
        LAST.sims.toLocaleString() + ' times each &middot; ' + LAST.ms + 'ms'
      : 'Season fully decided &mdash; no simulation needed';

    var rows = LAST.table.map(function (r) {
      var nrrCls = r.nrr > 0 ? ' is-pos' : (r.nrr < 0 ? ' is-neg' : '');
      return '<tr class="' + (r.pos <= 4 ? 'is-in' : '') + (r.pos === 4 ? ' is-cut' : '') + '">' +
               '<td class="pr-tbl__pos">' + r.pos + '</td>' +
               '<td class="pr-tbl__team">' + crest(r.team, 'pr-crest--xs') + esc(r.team) + '</td>' +
               '<td>' + r.p + '</td><td>' + r.w + '</td><td>' + r.l + '</td><td>' + r.nr + '</td>' +
               '<td class="pr-tbl__pts">' + r.pts + '</td>' +
               '<td class="pr-tbl__nrr' + nrrCls + '">' + sign(r.nrr) + '</td>' +
             '</tr>';
    }).join('');

    return '<section class="pr-card">' +
             '<div class="pr-card__head"><span class="material-icons-round">table_rows</span>' +
               'Predicted standings<small>' +
               (LAST.remaining ? LAST.remaining + ' left to simulate' : 'every match decided') +
               '</small></div>' +
             '<div class="pr-tblwrap"><table class="pr-tbl">' +
               '<thead><tr><th>#</th><th class="pr-tbl__team">Team</th><th>M</th><th>W</th>' +
               '<th>L</th><th>N/R</th><th>PTS</th><th>NRR</th></tr></thead>' +
               '<tbody>' + rows + '</tbody>' +
             '</table></div>' +
           '</section>' +
           LAST.table.map(scenarioCard).join('');
  }

  function scenarioCard(r) {
    var s = r.scenario || {};
    var need = s.need === null || s.need === undefined
      ? '&mdash;'
      : (s.need === 0 ? 'None &mdash; already there'
                      : esc(s.need) + ' of ' + esc(s.remaining) + ' wins needed');

    return '<section class="pr-card pr-scn" style="' + tint(r.team) + '">' +
             '<div class="pr-scn__head">' + crest(r.team, 'pr-crest--sm') +
               '<b>' + esc(team(r.team).name) + '</b>' +
               '<span class="pr-scn__pos">#' + r.pos + '</span></div>' +
             '<div class="pr-scn__body">' +
               bar('Top 4', r.top4, '#4cc9f0') +
               bar('Top 2', r.top2, '#ffc247') +
               bar('Title', r.title, '#2ee27a') +
               '<dl class="pr-scn__facts">' +
                 '<div><dt>Need wins</dt><dd>' + need + '</dd></div>' +
                 '<div><dt>NRR boost</dt><dd' + (s.nrr_ok ? '' : ' class="is-warn"') + '>' +
                   (s.nrr_ok ? 'Current NRR sufficient' : 'Net run rate will decide') +
                 '</dd></div>' +
               '</dl>' +
               (s.note ? '<p class="pr-scn__note">' + esc(s.note) + '</p>' : '') +
             '</div>' +
           '</section>';
  }

  /* ======================================================================
     The odds dock
     ====================================================================== */

  function renderDock() {
    if (!LAST) return;
    var ranked = LAST.table.slice().sort(function (x, y) { return y.top4 - x.top4; });

    dockStrip.innerHTML = ranked.map(function (r) {
      var cls = r.top4 >= 99.5 ? ' is-safe' : (r.top4 < 0.5 ? ' is-out' : '');
      return '<span class="pr-odds' + cls + '" style="' + tint(r.team) + '">' +
               crest(r.team, 'pr-crest--sm') +
               '<b>' + esc(r.team) + '</b>' +
               '<span class="pr-odds__v">' + pct(r.top4) + '</span>' +
             '</span>';
    }).join('');

    dockMeta.textContent = LAST.remaining
      ? LAST.sims.toLocaleString() + ' sims · ' + LAST.ms + 'ms'
      : 'season decided';
  }

  function setDock(min) {
    dock.classList.toggle('is-min', min);
    dockToggle.setAttribute('aria-expanded', String(!min));
    dockToggle.title = min ? 'Show playoff odds' : 'Minimise';
    store(DOCK_STORE, min);
  }

  /* ======================================================================
     Render
     ====================================================================== */

  function skeleton() {
    return '<div class="pr-skel"></div><div class="pr-skel"></div><div class="pr-skel"></div>';
  }

  function render() {
    filters.hidden = tab !== 'league';
    panel.innerHTML = tab === 'league' ? leaguePanel()
                    : tab === 'playoffs' ? playoffPanel()
                    : tablePanel();
    renderDock();
  }

  /* ======================================================================
     Wiring
     ====================================================================== */

  document.querySelectorAll('.pr-tab').forEach(function (btn) {
    btn.addEventListener('click', function () {
      tab = btn.getAttribute('data-tab');
      document.querySelectorAll('.pr-tab').forEach(function (b) {
        b.setAttribute('aria-selected', String(b === btn));
      });
      render();
    });
  });

  filters.addEventListener('click', function (e) {
    var btn = e.target.closest && e.target.closest('[data-filter]');
    if (!btn) return;
    filter = btn.getAttribute('data-filter');
    filters.querySelectorAll('[data-filter]').forEach(function (b) {
      b.setAttribute('aria-pressed', String(b === btn));
    });
    render();
  });

  panel.addEventListener('click', function (e) {
    if (!e.target.closest) return;

    var pickBtn = e.target.closest('[data-pick]');
    if (pickBtn) {
      var no = pickBtn.getAttribute('data-pick');
      var who = pickBtn.getAttribute('data-who');
      var cur = PICKS[no] || {};
      if (cur.w === who) delete cur.w;            /* clicking the pick again clears it */
      else cur.w = who;
      if (!cur.w && !cur.a_raw && !cur.b_raw) delete PICKS[no];
      else PICKS[no] = cur;
      save();
      render();
      queueSim();
      return;
    }

    var editBtn = e.target.closest('[data-edit]');
    if (editBtn) {
      openEdit[editBtn.getAttribute('data-edit')] = true;
      render();
      return;
    }

    var restoreBtn = e.target.closest('[data-restore]');
    if (restoreBtn) {
      var rno = restoreBtn.getAttribute('data-restore');
      delete PICKS[rno];
      delete openEdit[rno];
      delete openScores[rno];
      save();
      render();
      queueSim();
      return;
    }

    var fold = e.target.closest('[data-scores]');
    if (fold) {
      var fno = fold.getAttribute('data-scores');
      openScores[fno] = !openScores[fno];
      render();
      return;
    }

    var step = e.target.closest('[data-step]');
    if (step) {
      bumpScore(step.getAttribute('data-step'), step.getAttribute('data-side'),
                step.getAttribute('data-key'), parseInt(step.getAttribute('data-by'), 10));
      return;
    }

    var impactBtn = e.target.closest('[data-impact]');
    if (impactBtn) askImpact(impactBtn.getAttribute('data-impact'));
  });

  var LIMITS = { runs: [0, 400], wkts: [0, 10], overs: [0, 20], balls: [0, 5] };

  function bumpScore(no, side, key, by) {
    var pick = PICKS[no] || {};
    var raw = pick[side + '_raw'] || { runs: 0, wkts: 0, overs: 0, balls: 0 };
    var lim = LIMITS[key];
    raw[key] = Math.max(lim[0], Math.min(lim[1], (raw[key] || 0) + by));
    pick[side + '_raw'] = raw;
    /* the server wants decimal overs; x.y in cricket is y balls out of six */
    pick[side] = { runs: raw.runs, wkts: raw.wkts, overs: raw.overs + raw.balls / 6 };
    PICKS[no] = pick;
    save();
    render();
    queueSim();
  }

  function askImpact(no) {
    if (impacts[no] === 'loading') return;
    impacts[no] = 'loading';
    render();
    fetch('/api/predictor/impact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ match: no, picks: PICKS, replay: REPLAY })
    })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) { impacts[no] = d && d.ok ? d : null; render(); })
      .catch(function () { impacts[no] = null; render(); });
  }

  function setReplay(on) {
    REPLAY = !!on;
    store(REPLAY_STORE, REPLAY);
    replayBtn.setAttribute('aria-pressed', String(REPLAY));
    banner.hidden = !REPLAY;
  }

  /* Open the whole season at once. Mid-season there is no sane way to do this
     card by card, so this sets every real result aside in one go; the picks
     already made are kept, because they are the part you did by hand. */
  replayBtn.addEventListener('click', function () {
    setReplay(!REPLAY);
    openEdit = {};
    impacts = {};
    render();
    queueSim(true);
  });

  document.getElementById('prReset').addEventListener('click', function () {
    PICKS = {};
    impacts = {};
    openEdit = {};
    openScores = {};
    setReplay(false);                 /* "actual" means the real results are back */
    save();
    render();
    queueSim(true);
  });

  /* Fill everything undecided straight from the model: each match goes the way
     its own win probability says, so the season it produces is one the
     simulation actually considers likely rather than a coin-flip sweep.

     Outside replay mode the matches that really happened are left alone —
     rewriting those is a deliberate act, not something a sweep should do behind
     your back. Inside it, they are already set aside, so they get filled too. */
  document.getElementById('prSimulate').addEventListener('click', function () {
    STATE.league.forEach(function (m) {
      if ((m.played && !REPLAY) || pickOf(m.no)) return;
      var cur = PICKS[m.no] || {};
      cur.w = Math.random() < (m.wp || 0.5) ? m.a : m.b;
      PICKS[m.no] = cur;
    });
    save();
    render();
    queueSim(true);
  });

  dockToggle.addEventListener('click', function () {
    setDock(!dock.classList.contains('is-min'));
  });

  /* -------------------------------------------------------------- start up */

  setDock(load(DOCK_STORE, false) === true);
  setReplay(REPLAY);                  /* re-apply whatever the last visit left on */

  fetch('/api/predictor/state', { credentials: 'same-origin' })
    .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
    .then(function (data) {
      STATE = data;
      /* drop picks for fixtures that have since disappeared from the season */
      var known = {};
      STATE.league.concat(STATE.playoffs).forEach(function (m) { known[m.no] = true; });
      Object.keys(PICKS).forEach(function (no) { if (!known[no]) delete PICKS[no]; });
      save();
      render();
      runSim();
    })
    .catch(function (err) {
      if (window.console) console.warn('predictor state:', err);
      panel.innerHTML = empty('cloud_off', 'Could not load the fixtures',
                              'The predictor needs the season list to start.');
    });
})();
