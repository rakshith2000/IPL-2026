/* ==========================================================================
   IPL 2026 · Live Match Centre — shell controller
   --------------------------------------------------------------------------
   Owns everything outside the panels: the scoreboard, the tab strip, the
   polling loop and the freshness indicator. Each panel is rendered by its own
   script (info.js, live.js, scorecard.js, overs.js, livesquad.js), which this
   file loads on demand and calls with the payload it already fetched.

   Everything the feed sends is third-party text, so it is escaped on the way
   into the DOM. window.MX carries the handful of helpers the panels share.
   ========================================================================== */

(function () {
  'use strict';

  /* ------------------------------------------------------------- constants */

  var TABS = ['matchInfo', 'liveScore', 'scoreCard', 'Overs', 'liveSquad'];

  var PANEL = {
    matchInfo: { file: 'info.js', fn: 'renderTabInfo' },
    liveScore: { file: 'live.js', fn: 'renderTabLive' },
    scoreCard: { file: 'scorecard.js', fn: 'renderTabScorecard' },
    Overs: { file: 'overs.js', fn: 'renderTabOvers' },
    liveSquad: { file: 'livesquad.js', fn: 'renderTabSquad' }
  };

  var POLL_MS = 8000;          /* the feed itself updates about this often */
  var WARMUP_MS = 60000;       /* before the first ball: toss and XI only */
  var DEFAULT_TAB = 'matchInfo';
  var ENDED = /\b(won|abandoned|no result|tied|drawn)\b/i;

  /* ----------------------------------------------------------------- state */

  var currentTab = DEFAULT_TAB;
  var pollTimer = null;
  var ageTimer = null;
  var clockTimer = null;
  var pending = 0;             /* requests in flight */
  var reqToken = 0;            /* only the newest request may paint */
  var startFired = false;      /* the countdown has already asked for a reload */
  var paused = false;
  var lastAt = 0;              /* when the last successful poll landed */
  var stale = false;           /* the last poll failed — say so, keep the data */
  var liveNow = false;         /* the match is in progress, so keep polling */
  var nearStart = false;       /* start time is close — poll slowly for a toss */
  var baseTitle = document.title;

  var boardEl = document.getElementById('scoreboard-root');
  var panelEl = document.getElementById('tab-content');
  var barEl = document.getElementById('mxTabs');
  var refreshEl = document.getElementById('mxRefresh');
  var ageEl = document.getElementById('mxAge');
  var toggleEl = document.getElementById('mxToggle');
  var toastEl = document.getElementById('mxToast');

  /* --------------------------------------------------------------- helpers */

  function esc(v) {
    return String(v === undefined || v === null ? '' : v)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  /* The two brand colours behind a crest — the same per-team picks the
     fixtures list and the points table use. `map` is the feed payload's
     colour dictionary, which a few panels do not carry at all. */
  function tint(team, map) {
    var c = map && map[team];
    if (!c || typeof c !== 'object') return '--c1: #4f8cff; --c2: #a758ff;';
    var a, b;
    if (team === 'RCB') { a = c.c3; b = c.c1; }
    else if (team === 'GT' || team === 'MI') { a = c.c3; b = c.c2; }
    else if (team === 'PBKS') { a = c.c2; b = c.c1; }
    else if (team === 'KKR') { a = c.c2; b = c.c3; }
    else { a = c.c1; b = c.c2; }
    return '--c1: ' + esc(a || '#4f8cff') + '; --c2: ' + esc(b || '#a758ff') + ';';
  }

  /* Crest badge. The abbreviation sits under the logo, so teams with no
     squad_logos file (women's internationals, TBA) still render as a badge. */
  function crest(team, map, cls) {
    return '<span class="mx-crest ' + (cls || '') + '" style="' + tint(team, map) + '">' +
             '<img src="/static/images/squad_logos/' + encodeURIComponent(team) + '.png" alt="" ' +
                  'loading="lazy" onerror="this.remove();">' +
           '</span>';
  }

  function playerHref(team, name) {
    return '/team-' + encodeURIComponent(team) + '/squad_details/' + encodeURIComponent(name);
  }

  /* MICRO is the small headshot set; the full-size one is the fallback, then
     the shared silhouette. */
  function playerImg(team, name, micro) {
    return '/static/images/squads/' + encodeURIComponent(team) + (micro ? '-MICRO' : '') +
           '/' + encodeURIComponent(String(name).replace(/ /g, '-')) + '.png';
  }

  function playerPic(team, name, cls, micro) {
    var alt = esc(name);
    var fallback = micro ? playerImg(team, name, false) : '/static/images/Default.png';
    return '<img class="' + (cls || '') + '" src="' + playerImg(team, name, micro !== false) + '" ' +
           'alt="' + alt + '" loading="lazy" ' +
           'onerror="this.onerror=null;this.src=\'' + fallback + '\';">';
  }

  /* A ball's colour is decided by what it did, not by who bowled it. */
  function ballClass(score) {
    var s = String(score);
    if (/w/i.test(s) && !/wd/i.test(s)) return 'mx-ball--wicket';
    if (s.indexOf('4') > -1) return 'mx-ball--four';
    if (s.indexOf('6') > -1) return 'mx-ball--six';
    if (/wd|nb|lb|b/i.test(s)) return 'mx-ball--extra';
    if (s === '0') return 'mx-ball--dot';
    if (s === 'x') return 'mx-ball--miss';
    return '';
  }

  function ball(score) {
    var s = String(score);
    return '<span class="mx-ball ' + ballClass(s) + '">' + esc(s === '0' ? '•' : s === 'x' ? '' : s) + '</span>';
  }

  function toast(msg) {
    if (!toastEl) return;
    toastEl.textContent = msg;
    toastEl.classList.add('is-on');
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { toastEl.classList.remove('is-on'); }, 2200);
  }

  /* Deadlines come off the feed as IST wall-clock strings, so "now" has to be
     re-expressed in IST for the comparison to hold in any timezone. */
  function istNow() {
    return new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' })).getTime();
  }

  /* ------------------------------------------------------------ ball maths
     What a delivery scored, what the over came to, and who faced it. The
     live and overs panels both read the same ball-by-ball feed, so this lives
     here rather than being copied into each of them. */

  function ballScore(b) {
    if (b.isWicket) {
      if (b.isByes) return (b.runsByes || 0) + 'b+W';
      if (b.isLegByes) return (b.runsLegByes || 0) + 'lb+W';
      if (b.isWide) return (b.runsWide || 0) + 'wd+W';
      if ((b.teamRuns || 0) > 0) return (b.teamRuns || 0) + 'W';
      return 'W';
    }
    if (b.isWide) return (b.runsWide || 0) > 1 ? ((b.runsWide - 1) || 0) + 'wd' : 'wd';
    if (b.isNoBall) {
      if (b.isByes) return (b.runsByes || 0) + 'b+nb';
      if (b.isLegByes) return (b.runsLegByes || 0) + 'lb+nb';
      return ((b.runsScored || 0) > 0 ? b.runsScored : '') + 'nb';
    }
    if (b.isLegByes) return ((b.runsLegByes || 0) > 0 ? b.runsLegByes : '') + 'lb';
    if (b.isByes) return ((b.runsByes || 0) > 0 ? b.runsByes : '') + 'b';
    if (b.teamRuns === 0) return '0';
    return String(b.teamRuns || 0);
  }

  function overRuns(over) {
    var runs = 0;
    (over.balls || []).forEach(function (b) {
      if (b.isWicket) {
        if (b.isByes) runs += b.runsByes || 0;
        else if (b.isLegByes) runs += b.runsLegByes || 0;
        else if (b.isWide) runs += b.runsWide || 0;
        else if ((b.teamRuns || 0) > 0) runs += b.teamRuns || 0;
      } else if (b.isWide) {
        runs += (b.runsWide || 0) > 1 ? (b.runsWide || 0) : 1;
      } else if (b.isNoBall) {
        if (b.isByes) runs += (b.runsByes || 0) + 1;
        else if (b.isLegByes) runs += (b.runsLegByes || 0) + 1;
        else runs += ((b.runsScored || 0) > 0 ? b.runsScored : 0) + (b.extras || 1);
      } else if (b.isLegByes) {
        runs += (b.runsLegByes || 0) > 0 ? b.runsLegByes : 0;
      } else if (b.isByes) {
        runs += (b.runsByes || 0) > 0 ? b.runsByes : 0;
      } else {
        runs += b.teamRuns || 0;
      }
    });
    return runs;
  }

  /* The striker is only named in the commentary line, so the list of batters
     for an over has to be read back out of the text. Newest ball first. */
  function overBatsmen(over) {
    var out = [];
    var balls = over.balls || [];
    for (var i = balls.length - 1; i >= 0; i--) {
      var c = balls[i].comments;
      if (!c || !c.length) continue;
      var msg = String(c[c.length - 1].message || '');
      var name = msg.split(' to ')[1] ? msg.split(' to ')[1].split('.')[0].trim() : '';
      if (name && out.indexOf(name) < 0) out.push(name);
    }
    return out;
  }

  /* The timeline strip counts a wide as the runs actually run, so "2wd" there
     means two byes off a wide rather than the full three-run extra. */
  function stripBallScore(score) {
    var s = String(score);
    if (s.indexOf('wd') < 0 && s.indexOf('nb') < 0) return s;
    var m = s.match(/^(\d+)([a-zA-Z]+)$/);
    if (!m) return s;
    var n = parseInt(m[1], 10) - 1;
    return n >= 1 ? n + m[2] : m[2];
  }

  /* -------------------------------------------------- shared panel pieces
     The live and scorecard panels both show player links, the awards and a
     pair of innings tabs, so those live here rather than in one of them. */

  /* A named player, linked to their profile. Players the squad table could
     not match come through as team "NA" — still shown, just not clickable. */
  function playerLink(player, markSrc) {
    var team = player.team || 'NA';
    var off = team === 'NA';
    var mark = markSrc ? '<img class="mx-plr__mark" src="' + markSrc + '" alt="">' : '';
    return '<a class="mx-plr' + (off ? ' is-off' : '') + '" href="' + playerHref(team, player.name) + '">' +
             playerPic(team, player.name, 'mx-plr__pic', true) +
             '<span class="mx-plr__name">' + esc(player.name) + mark + '</span>' +
           '</a>';
  }

  function awardCard(award, title, icon, names, colours, withStats) {
    if (!award || !award.player_name) return '';
    var name = award.player_name;
    var team = award.team_name || 'NA';
    var off = team === 'NA';
    var fn = names || {};

    var stats = withStats
      ? '<dl class="mx-potm__stats">' +
          '<div class="mx-potm__stat"><dt>Batting</dt><dd>' + esc(award.batting_stat || '—') + '</dd></div>' +
          '<div class="mx-potm__stat"><dt>Bowling</dt><dd>' + esc(award.bowling_stat || '—') + '</dd></div>' +
        '</dl>'
      : '';

    return '<div class="mx-card mx-card--award">' +
             '<div class="mx-card__head"><span class="material-icons-round">' + icon + '</span>' + esc(title) + '</div>' +
             '<div class="mx-potm">' +
               '<a class="mx-potm__pic' + (off ? ' is-off' : '') + '" href="' + playerHref(team, name) + '" ' +
                 'style="' + tint(team, colours) + '">' + playerPic(team, name, '', true) + '</a>' +
               '<div class="mx-potm__id">' +
                 '<a class="' + (off ? 'is-off' : '') + '" href="' + playerHref(team, name) + '">' +
                   '<div class="mx-potm__name">' + esc(name) + '</div></a>' +
                 '<div class="mx-potm__team">' +
                   '<img src="/static/images/squad_logos/' + encodeURIComponent(team) + '.png" alt="" ' +
                     'onerror="this.remove();">' + esc(fn[team] || team) +
                 '</div>' + stats +
               '</div>' +
             '</div>' +
           '</div>';
  }

  /* One button per innings, one pane each. */
  function subtab(pane, active, colours) {
    return '<button type="button" class="mx-subtab" role="tab" data-inn="' + esc(pane.key) + '" ' +
             'aria-selected="' + (active ? 'true' : 'false') + '" style="' + tint(pane.abv, colours) + '">' +
             '<img class="mx-subtab__crest" src="/static/images/squad_logos/' + encodeURIComponent(pane.abv) +
               '.png" alt="" onerror="this.remove();">' + esc(pane.label) +
             (pane.live ? '' : '') +
           '</button>';
  }

  function wireSubtabs(root) {
    var tabs = root.querySelectorAll('.mx-subtab');
    tabs.forEach(function (btn) {
      btn.addEventListener('click', function () {
        var inn = btn.getAttribute('data-inn');
        tabs.forEach(function (b) { b.setAttribute('aria-selected', String(b === btn)); });
        root.querySelectorAll('.mx-pane').forEach(function (p) {
          p.hidden = p.getAttribute('data-inn') !== inn;
        });
      });
    });
  }

  /* Which innings should open: the one the reader was already on, else the one
     in progress, else the latest played. */
  function activePane(panes, root) {
    var open = (root || document).querySelector('.mx-subtab[aria-selected="true"]');
    var key = open ? open.getAttribute('data-inn') : null;
    return panes.filter(function (p) { return p.key === key; })[0] ||
           panes.filter(function (p) { return p.live; })[0] ||
           panes[panes.length - 1];
  }

  window.MX = {
    esc: esc, tint: tint, crest: crest, ball: ball, ballClass: ballClass,
    playerHref: playerHref, playerImg: playerImg, playerPic: playerPic,
    toast: toast, istNow: istNow,
    ballScore: ballScore, overRuns: overRuns, overBatsmen: overBatsmen,
    stripBallScore: stripBallScore,
    playerLink: playerLink, awardCard: awardCard,
    subtab: subtab, wireSubtabs: wireSubtabs, activePane: activePane
  };

  /* ==================================================================== board
     Everything on the scoreboard is derived from one payload, so the whole
     thing is rebuilt as a string and only written when it actually changed.
     ======================================================================= */

  /* "174/8 (20 ov)" -> {runs: '174/8', overs: '20'}; a super over arrives as
     two innings joined by "&". All out prints as the runs alone. */
  function parseScore(raw) {
    var text = String(raw || '').replace(/^\*/, '').trim();
    if (!text) return [];
    return text.split('&').map(function (half) {
      var m = half.trim().match(/^([^(]*)(?:\(([^)]*)\))?\s*$/);
      var runs = ((m && m[1]) || half).trim().replace(/\/10$/, '');
      var overs = ((m && m[2]) || '').replace(/\s*ov\.?/i, '').trim();
      return { runs: runs, overs: overs };
    });
  }

  function scoreHTML(raw) {
    var parts = parseScore(raw);
    if (!parts.length) return '<span class="mx-wait">Yet to bat</span>';
    if (parts.length === 1) {
      return '<b>' + esc(parts[0].runs) + '</b>' +
             (parts[0].overs ? '<i>(' + esc(parts[0].overs) + ')</i>' : '');
    }
    return '<span class="mx-side__prior">' + esc(parts[0].runs) +
             (parts[0].overs ? ' (' + esc(parts[0].overs) + ')' : '') + '</span>' +
           '<span class="mx-side__so"><span class="mx-so-tag">SO</span><b>' + esc(parts[1].runs) + '</b>' +
             (parts[1].overs ? '<i>(' + esc(parts[1].overs) + ')</i>' : '') + '</span>';
  }

  /* The first number in "Run Rate: 8.70" — the feed has shipped a few
     different labels for this field over the years. */
  function rate(v) {
    var hit = String(v === undefined || v === null ? '' : v).match(/[\d.]+/g);
    return hit && hit.length ? hit[hit.length - 1] : null;
  }

  function requiredRate(strip, info) {
    var given = rate(strip && strip.required_run_rate);
    if (given) return given;
    /* "need 45 runs in 30 balls" / "... in 5 overs" — both forms show up */
    var m = String(info || '').match(/need\s+(\d+)\s+runs?\s+(?:in|from)\s+(\d+(?:\.\d+)?)\s*(balls?|overs?)/i);
    if (!m) return null;
    var overs = /ball/i.test(m[3]) ? (+m[2]) / 6 : (+m[2]);
    return overs > 0 ? (+m[1] / overs).toFixed(2) : null;
  }

  function sidesOf(data) {
    var tid = data.tid || {};
    return (data.dt3.score_strip || []).slice(0, 2).map(function (s) {
      var id = tid[s.team_id] || [];
      return {
        abv: id[0] || s.short_name || '',
        full: id[1] || s.name || '',
        score: s.score || '',
        batting: !!s.currently_batting,
        strip: s
      };
    });
  }

  function winnerOf(info, sides) {
    var low = String(info || '').toLowerCase();
    var at = low.indexOf(' won');
    if (at < 0) return null;
    var head = low.slice(0, at);
    for (var i = 0; i < sides.length; i++) {
      var s = sides[i];
      if ((s.full && head.indexOf(s.full.toLowerCase()) > -1) ||
          (s.abv && head.indexOf(s.abv.toLowerCase()) > -1)) return s.abv;
    }
    return null;
  }

  function matchState(data) {
    var info = String(data.dt3.info || '');
    if (!info) return data.dt3.match_status === 'post' ? 'done' : 'pre';
    if (ENDED.test(info)) return 'done';
    return 'live';
  }

  function stateChip(state, info) {
    if (state === 'live') return { cls: 'mx-state--live', text: 'Live' };
    if (state === 'done') {
      return /abandoned|no result/i.test(info || '')
        ? { cls: 'mx-state--off', text: 'No result' }
        : { cls: 'mx-state--done', text: 'Result' };
    }
    return { cls: 'mx-state--soon', text: 'Upcoming' };
  }

  function boardHTML(data) {
    var dt3 = data.dt3 || {};
    var tid = data.tid || {};
    var info = String(dt3.info || '');
    var state = matchState(data);
    var chip = stateChip(state, info);
    var sides = sidesOf(data);
    var winner = state === 'done' ? winnerOf(info, sides) : null;
    var colours = data.clr2 && typeof data.clr2 === 'object' ? data.clr2 : data.clr;
    var html = '';

    /* --- header: what the match is doing, and what the toss decided ------ */
    var toss = '';
    if (dt3.toss_won_by && tid[dt3.toss_won_by]) {
      toss = '<span class="mx-board__toss"><b>' + esc(tid[dt3.toss_won_by][0]) + '</b> won the toss' +
             (dt3.toss_decision ? ' &amp; chose to ' + esc(dt3.toss_decision) : '') + '</span>';
    }

    html += '<div class="mx-board__top">' +
              '<span class="mx-state ' + chip.cls + '"><span class="mx-state__dot"></span>' + chip.text + '</span>' +
              toss +
            '</div>';

    /* --- the two innings lines ------------------------------------------ */
    html += '<div class="mx-sides">';
    sides.forEach(function (s) {
      var cls = '';
      if (state === 'live' && s.batting) cls = 'is-batting';
      else if (winner && s.abv === winner) cls = 'is-won';
      else if (winner) cls = 'is-lost';

      var stack = String(s.score || '').indexOf('&') > -1 ? ' mx-side__score--stack' : '';

      html += '<div class="mx-side ' + cls + '" data-team="' + esc(s.abv) + '">' +
                crest(s.abv, colours, '') +
                '<span class="mx-side__id">' +
                  '<span class="mx-side__abv">' + esc(s.abv) + '</span>' +
                  '<span class="mx-side__full">' + esc(s.full) + '</span>' +
                '</span>' +
                (state === 'live' && s.batting
                  ? '<span class="mx-side__bat"><span class="material-icons-round" style="font-size:13px">sports_cricket</span>Batting</span>'
                  : '') +
                '<span class="mx-side__score' + stack + '" data-score="' + esc(s.abv) + '">' +
                  scoreHTML(s.score) +
                '</span>' +
              '</div>';
    });
    html += '</div>';

    /* --- status line ----------------------------------------------------- */
    if (info) {
      var tone = state === 'live' ? 'mx-board__info--live'
               : (/abandoned|no result/i.test(info) ? 'mx-board__info--na' : 'mx-board__info--done');
      html += '<p class="mx-board__info ' + tone + '">' + esc(info) + '</p>';
    }

    /* --- run-rate tiles, only while there is a game to describe ---------- */
    if (state === 'live') {
      var battingIdx = sides.reduce(function (at, s, i) { return s.batting ? i : at; }, -1);
      var inns = dt3.innings || [];
      var pship = battingIdx > -1 && inns[battingIdx] ? inns[battingIdx].current_partnership : null;
      var tiles = '';

      if (battingIdx === 1) {
        var chased = parseScore(sides[0].score)[0];
        var target = chased ? parseInt(String(chased.runs).split('/')[0], 10) + 1 : null;
        if (target) tiles += tile('Target', target, '', 'mx-tile--target');
      }

      var crr = battingIdx > -1 ? rate(sides[battingIdx].strip.run_rate) : null;
      if (crr) tiles += tile('CRR', crr);

      if (battingIdx === 1) {
        var rrr = requiredRate(sides[0].strip, info) || requiredRate(sides[1].strip, info);
        if (rrr) tiles += tile('RRR', rrr, '', 'mx-tile--rrr');
      }

      if (pship) tiles += tile('Partnership', pship.runs, '(' + pship.balls + ')');

      if (tiles) html += '<dl class="mx-tiles">' + tiles + '</dl>';
    }

    /* --- countdown, while the start time is still ahead of us ------------ */
    var start = data.dttm ? new Date(data.dttm) : null;
    var now = data.cd ? new Date(data.cd) : null;
    if (state === 'pre' && start && now && start > now) {
      html += '<div class="mx-clock" data-deadline="' + esc(data.dttm) + '">' +
                clockUnit('d', 'Days') + clockUnit('h', 'Hrs') +
                clockUnit('m', 'Min') + clockUnit('s', 'Sec') +
              '</div>';
    }

    return html;
  }

  function tile(label, value, sub, cls) {
    return '<div class="mx-tile ' + (cls || '') + '">' +
             '<dt>' + esc(label) + '</dt>' +
             '<dd>' + esc(value) + (sub ? ' <small>' + esc(sub) + '</small>' : '') + '</dd>' +
           '</div>';
  }

  function clockUnit(key, label) {
    return '<div class="mx-clock__unit">' +
             '<span class="mx-clock__n" data-u="' + key + '">0</span>' +
             '<span class="mx-clock__u">' + label + '</span>' +
           '</div>';
  }

  function renderBoard(data) {
    if (!boardEl || !data || !data.dt3) return;

    var html = boardHTML(data);
    if (boardEl.getAttribute('data-sig') === html) return;   /* nothing moved */

    /* remember what each side showed, so only a real change flashes */
    var before = {};
    boardEl.querySelectorAll('[data-score]').forEach(function (el) {
      before[el.getAttribute('data-score')] = el.textContent.trim();
    });
    var first = !boardEl.getAttribute('data-sig');

    boardEl.setAttribute('data-sig', html);
    boardEl.innerHTML = html;

    if (!first) {
      boardEl.querySelectorAll('[data-score]').forEach(function (el) {
        var key = el.getAttribute('data-score');
        if (before[key] === undefined || before[key] === el.textContent.trim()) return;
        var n = el.querySelector('b');
        if (!n) return;
        n.classList.remove('is-bump');
        void n.offsetWidth;                                  /* restart it */
        n.classList.add('is-bump');
      });
    }

    startClock();
    syncTitle(data);
  }

  /* The browser tab is a scoreboard too when the page is in the background. */
  function syncTitle(data) {
    var sides = sidesOf(data);
    var batting = sides.filter(function (s) { return s.batting; })[0];
    var p = batting && batting.score ? parseScore(batting.score)[0] : null;
    if (matchState(data) === 'live' && p) {
      document.title = batting.abv + ' ' + p.runs + (p.overs ? ' (' + p.overs + ')' : '') +
                       ' · ' + sides.map(function (s) { return s.abv; }).join(' v ');
    } else {
      document.title = baseTitle;
    }
  }

  /* ------------------------------------------------------------- countdown */

  function startClock() {
    clearInterval(clockTimer);
    var el = boardEl.querySelector('.mx-clock');
    if (!el) return;

    var end = new Date(el.getAttribute('data-deadline')).getTime();
    var out = {
      d: el.querySelector('[data-u="d"]'), h: el.querySelector('[data-u="h"]'),
      m: el.querySelector('[data-u="m"]'), s: el.querySelector('[data-u="s"]')
    };
    if (!out.d || !out.h || !out.m || !out.s) return;

    function tick() {
      var t = end - istNow();
      if (t < 0) t = 0;
      out.d.textContent = Math.floor(t / 86400000);
      out.h.textContent = Math.floor((t % 86400000) / 3600000);
      out.m.textContent = Math.floor((t % 3600000) / 60000);
      out.s.textContent = Math.floor((t % 60000) / 1000);
      el.classList.toggle('is-soon', t > 0 && t < 3600000);
      el.classList.toggle('is-over', t === 0);
      /* the toss is usually up within a few minutes of the start time, so ask
         the feed once the clock runs out rather than leaving a dead page */
      if (t === 0 && !startFired) {
        startFired = true;
        load(currentTab, { silent: true });
      }
    }

    tick();
    clockTimer = setInterval(tick, 1000);
  }

  /* ==================================================================== tabs */

  function panelSkeleton() {
    panelEl.innerHTML =
      '<div class="mx-card mx-skel--pad">' +
        '<div class="mx-skel mx-skel--row"></div>' +
        '<div class="mx-skel mx-skel--line" style="width: 70%"></div>' +
        '<div class="mx-skel mx-skel--line" style="width: 45%"></div>' +
        '<div class="mx-skel mx-skel--row"></div>' +
      '</div>';
  }

  function panelError(msg, retry) {
    panelEl.innerHTML =
      '<div class="mx-empty mx-empty--error">' +
        '<span class="material-icons-round">cloud_off</span>' +
        '<b>' + esc(msg || 'Could not load this tab') + '</b>' +
        '<p>The score feed did not answer. Your connection may be offline.</p>' +
        (retry === false ? '' : '<button type="button" class="mx-btn" id="mxRetry">' +
          '<span class="material-icons-round">refresh</span>Try again</button>') +
      '</div>';
    var btn = document.getElementById('mxRetry');
    if (btn) btn.addEventListener('click', function () { load(currentTab); });
  }

  function syncTabs() {
    barEl.querySelectorAll('.mx-tab').forEach(function (btn) {
      var on = btn.getAttribute('data-tab') === currentTab;
      btn.setAttribute('aria-selected', String(on));
      btn.tabIndex = on ? 0 : -1;
      if (on) panelEl.setAttribute('aria-labelledby', btn.id);
    });
  }

  /* The Live tab is called Commentary once the match is done, and carries a
     pulse while it is on. */
  function syncLiveTab(state) {
    var btn = barEl.querySelector('.mx-tab[data-tab="liveScore"]');
    if (!btn) return;
    var label = state === 'done' ? 'Commentary' : 'Live';
    var dot = state === 'live' ? '<span class="mx-tab__dot"></span>' : '';
    var html = dot + label;
    if (btn.innerHTML !== html) btn.innerHTML = html;
  }

  function setTab(tab, opts) {
    if (TABS.indexOf(tab) < 0) tab = DEFAULT_TAB;
    currentTab = tab;
    syncTabs();

    try {
      var url = new URL(window.location.href);
      url.searchParams.set('tab', tab);
      window.history.replaceState(null, '', url.toString());
    } catch (e) { /* older browsers just keep the URL they had */ }

    panelSkeleton();
    load(tab, opts);
  }

  /* Is there something worth keeping on screen, or just a skeleton? */
  function panelHasContent() {
    return !!panelEl.children.length &&
           !panelEl.querySelector('.mx-skel') &&
           !panelEl.querySelector('.mx-empty--error');
  }

  /* Panels live in their own files; load once, then call on every refresh. */
  function renderPanel(tab, data, silent) {
    var spec = PANEL[tab];
    if (!spec) return panelError('Unknown tab');

    if (typeof window[spec.fn] === 'function') {
      try {
        window[spec.fn](data);
      } catch (err) {
        if (window.console) console.error(err);
        /* a background refresh that trips over an odd payload leaves the last
           good panel up rather than blanking a working page */
        if (!silent || !panelHasContent()) panelError('This tab could not be drawn');
      }
      return;
    }

    var script = document.createElement('script');
    script.src = '/static/js/' + spec.file;
    script.onload = function () {
      if (typeof window[spec.fn] === 'function') renderPanel(tab, data, silent);
      else panelError('This tab could not be drawn');
    };
    script.onerror = function () { panelError('This tab could not be loaded'); };
    document.body.appendChild(script);
  }

  /* ================================================================ polling */

  function load(tab, opts) {
    opts = opts || {};
    /* background polls never stack; a tab switch always wins and the token
       below makes sure the answer to an abandoned request is dropped */
    if (opts.silent && pending) return;
    var token = ++reqToken;
    pending++;
    if (!opts.silent && toggleEl) toggleEl.classList.add('is-spinning');

    fetch('/api/match-' + encodeURIComponent(window.match) + '/' + encodeURIComponent(tab),
          { credentials: 'same-origin' })
      .then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      })
      .then(function (data) {
        if (token !== reqToken) return;              /* a newer request won */
        if (!data || !data.dt3) throw new Error('empty payload');
        lastAt = Date.now();
        stale = false;

        var state = matchState(data);
        liveNow = state === 'live';

        /* Nothing is moving yet, but a match about to start is worth keeping
           an eye on — the toss and the XI land before the first ball. */
        var start = data.dttm ? new Date(data.dttm).getTime() : 0;
        var now = data.cd ? new Date(data.cd).getTime() : 0;
        nearStart = !!(state === 'pre' && start && now && (start - now) < 2700000);

        renderBoard(data);
        syncLiveTab(state);
        if (tab === currentTab) renderPanel(tab, data, opts.silent);
        syncRefresh();
        schedule();
      })
      .catch(function (err) {
        if (token !== reqToken) return;
        stale = true;
        syncRefresh();
        /* a failed background poll keeps whatever is on screen */
        if (!opts.silent) panelError('Could not load this tab');
        schedule();
        if (window.console) console.warn('match feed:', err);
      })
      .then(function () {
        pending = Math.max(0, pending - 1);
        if (toggleEl) toggleEl.classList.remove('is-spinning');
      });
  }

  function schedule() {
    clearTimeout(pollTimer);
    if (paused) return;
    var wait = liveNow ? POLL_MS : (nearStart ? WARMUP_MS : 0);
    if (!wait) return;                             /* finished or far off */
    pollTimer = setTimeout(function () {
      if (document.hidden) return schedule();      /* idle while backgrounded */
      load(currentTab, { silent: true });
    }, wait);
  }

  function ageText() {
    if (stale) return 'reconnecting…';
    if (!lastAt) return '';
    var s = Math.round((Date.now() - lastAt) / 1000);
    if (s < 5) return 'just now';
    if (s < 60) return s + 's ago';
    return Math.floor(s / 60) + 'm ago';
  }

  function syncRefresh() {
    if (!refreshEl) return;
    refreshEl.hidden = !(liveNow || nearStart);
    if (refreshEl.hidden) {
      clearInterval(ageTimer);
      ageTimer = null;
      return;
    }
    if (ageEl) ageEl.textContent = ageText();
    if (!ageTimer) {
      ageTimer = setInterval(function () {
        if (ageEl) ageEl.textContent = ageText();
      }, 1000);
    }
  }

  /* ------------------------------------------------------------------ wiring */

  barEl.querySelectorAll('.mx-tab').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var tab = btn.getAttribute('data-tab');
      if (tab === currentTab) return;
      setTab(tab);
      /* on a phone the strip is sticky — keep the panel top in view */
      var y = barEl.getBoundingClientRect().top + window.pageYOffset -
              (parseInt(getComputedStyle(document.documentElement)
                .getPropertyValue('--mx-stick'), 10) || 80);
      if (window.pageYOffset > y) window.scrollTo({ top: y, behavior: 'smooth' });
    });
  });

  /* Left / right walk the tab strip, the way a tablist is expected to work. */
  barEl.addEventListener('keydown', function (e) {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    var at = TABS.indexOf(currentTab);
    var next = TABS[(at + (e.key === 'ArrowRight' ? 1 : TABS.length - 1)) % TABS.length];
    setTab(next);
    var btn = barEl.querySelector('.mx-tab[data-tab="' + next + '"]');
    if (btn) btn.focus();
    e.preventDefault();
  });

  if (toggleEl) {
    toggleEl.addEventListener('click', function () {
      paused = !paused;
      toggleEl.setAttribute('aria-pressed', String(!paused));
      toggleEl.title = paused ? 'Resume auto-refresh' : 'Pause auto-refresh';
      toggleEl.innerHTML = '<span class="material-icons-round">' +
                           (paused ? 'play_arrow' : 'pause') + '</span>';
      if (paused) {
        clearTimeout(pollTimer);
        toast('Auto-refresh paused');
      } else {
        load(currentTab, { silent: true });
        toast('Auto-refresh on');
      }
    });
  }

  var shareBtn = document.getElementById('mxShare');
  if (shareBtn) {
    shareBtn.addEventListener('click', function () {
      var url = window.location.href;
      var title = shareBtn.getAttribute('data-title') || document.title;
      if (navigator.share) {
        navigator.share({ title: title, url: url }).catch(function () { /* dismissed */ });
      } else if (navigator.clipboard) {
        navigator.clipboard.writeText(url).then(function () {
          shareBtn.classList.add('is-done');
          toast('Match link copied');
        });
      } else {
        window.prompt('Copy this link', url);
      }
    });
  }

  /* Catch up the moment the tab comes back to the foreground. */
  document.addEventListener('visibilitychange', function () {
    if (document.hidden || paused || !(liveNow || nearStart)) return;
    load(currentTab, { silent: true });
  });

  /* Back to top, and elevation on the sticky strip once it bites. */
  var toTop = document.createElement('button');
  toTop.type = 'button';
  toTop.className = 'floating-move-top-btn';
  toTop.title = 'Back to top';
  toTop.setAttribute('aria-label', 'Back to top');
  toTop.innerHTML = '<span class="material-icons-round">arrow_upward</span>';
  document.body.appendChild(toTop);
  toTop.addEventListener('click', function () {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  var ticking = false;
  window.addEventListener('scroll', function () {
    if (ticking) return;
    ticking = true;
    window.requestAnimationFrame(function () {
      toTop.classList.toggle('is-on', window.pageYOffset > 500);
      barEl.classList.toggle('is-stuck',
        barEl.getBoundingClientRect().top <= (parseFloat(getComputedStyle(barEl).top) || 80) + 1);
      ticking = false;
    });
  }, { passive: true });

  /* The navbar is fixed and its height moves with the viewport, so the sticky
     strip is positioned from a measurement rather than a constant. */
  function syncStick() {
    var nav = document.querySelector('nav.navbar');
    var h = nav ? nav.getBoundingClientRect().height : 72;
    document.documentElement.style.setProperty('--mx-stick', (h + 8) + 'px');
  }
  syncStick();
  window.addEventListener('resize', syncStick);

  /* -------------------------------------------------------------- start up */

  function initialTab() {
    var asked = null;
    try { asked = new URLSearchParams(window.location.search).get('tab'); } catch (e) { /* ignore */ }
    return TABS.indexOf(asked) > -1 ? asked : DEFAULT_TAB;
  }

  setTab(initialTab());
})();
