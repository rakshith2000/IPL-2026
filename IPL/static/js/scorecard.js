// Show loading spinner before fetch
const liveContainer = document.getElementById('liveContainer');
let firstLoad = true;
let refreshInterval = null;

function parseOvers(oversStr) {
  // Converts "3.2" to balls: 3*6 + 2 = 20
  const [whole, part] = oversStr.split('.').map(Number);
  return whole * 6 + (isNaN(part) ? 0 : part);
}

function getTopBatters(batting) {
    const allBatting = batting[0].batting.concat(batting[1].batting);
    return allBatting.slice().sort((a, b) => {
        const runsA = Number(a.runs);
        const runsB = Number(b.runs);
        const ballsA = Number(a.balls);
        const ballsB = Number(b.balls);

    if (runsA !== runsB) {
      return runsB - runsA; // Descending runs
    }
    return ballsA - ballsB; // Ascending balls
  });
}

function getTopBowlers(bowling) {
    const allBowling = bowling[0].bowling.concat(bowling[1].bowling);
    return allBowling.slice().sort((a, b) => {
        const wicketsA = Number(a.wickets);
        const wicketsB = Number(b.wickets);
        const runsA = Number(a.runs);
        const runsB = Number(b.runs);
        const ballsA = parseOvers(a.overs);
        const ballsB = parseOvers(b.overs);

    if (wicketsA !== wicketsB) {
      return wicketsB - wicketsA; // Descending wickets
    }
    if (runsA !== runsB) {
      return runsA - runsB; // Ascending runs
    }
    return ballsA - ballsB; // Ascending balls
  });
}

function fetchAndRender(showSpinner = false) {
    if (showSpinner) {
        liveContainer.innerHTML = `<div id="loadingSpinner" style="text-align:center; padding:40px 0;">
            <span class="spinner-border text-white" role="status"></span><br>
            <span style="color:#ffffff; font-weight:bold;">Loading...</span>
        </div>`;
    }
fetch(`/api/match-${match}/scoreCard`)
    .then(response => {
        return response.json();
    })
    .then(data => {
        window.match = data.match;
        window.dt1 = data.dt1;
        window.dt2 = data.dt2;
        window.dt3 = data.dt3;
        window.cd = new Date(data.cd);
        window.dttm = data.dttm ? new Date(data.dttm) : null;
        window.tid = data.tid;
        window.fn = data.fn;
        window.clr2 = data.clr2;
        window.dispatchEvent(new Event('statsReady')); // Notify that data is ready

        // Check condition for auto-refresh
            const info = window.dt3.info;
            const shouldRefresh = info !== "" &&
                !info.toLowerCase().includes("won") &&
                !info.toLowerCase().includes("abandoned") &&
                !info.toLowerCase().includes("no result");
            if (shouldRefresh && !refreshInterval) {
                refreshInterval = setInterval(() => fetchAndRender(false), 8000);
            } else if (!shouldRefresh && refreshInterval) {
                clearInterval(refreshInterval);
                refreshInterval = null;
            } 
    })
    .catch(error => {
        liveContainer.innerHTML = '<div style="color:red; text-align:center; padding:40px 0;">Failed to load data.</div>';
    });
}
fetchAndRender(true); // Initial fetch with spinner

window.addEventListener('statsReady', () => {
    // Remove loading spinner
    const spinner = document.getElementById('loadingSpinner');
    if (spinner) spinner.remove();

    // Save currently active tab before updating HTML
    const activeTab = document.querySelector('#inningsTabs .active');
    const activeTabHref = activeTab ? activeTab.getAttribute('href') : null;

    let fc = '';
    if (dt3.info === "") {
    fc = 'text-orange';
    } else if (dt3.info && dt3.info.includes('won')) {
    fc = 'text-blue';
    } else {
    fc = 'text-danger';
    }
    let liveHTML = `<div class="live_2 rounded_10 box-shadow-4 mt-2" style="background-color: #25478A;">`;
    liveHTML += `<div class="live_2_inner row px-3 pt-2 pb-2">
		     <div class="col-md-8">
			  <div class="live_2_inner_left">
			    <b class="text-white" style="font-size: 20px">${dt1[0].Team_A} vs ${dt1[0].Team_B}</b>
				<span class="d-block font_14 text-white">${dt2[0]}, ${dt2[1]}, ${dt2[2]}</span>
			  </div>
			 </div>
             </div>`;
    liveHTML += `<span class="bg-white px-3 d-block pt-2">
                <span class="fi fi-${tid[dt3.score_strip[0].team_id][0].toLowerCase()} me-1"></span>
                <b>${tid[dt3.score_strip[0].team_id][0]}</b>
                <span class="float-end font_14">${
                    dt3.score_strip[0].score
                    ? (
                        dt3.score_strip[0].score.split(' (')[0].split('/')[1] === "10"
                            ? `<b class="fs-6">${dt3.score_strip[0].score.split(' (')[0].split('/')[0]}</b>`
                            : `<b class="fs-6">${dt3.score_strip[0].score.split(' (')[0]}</b>`
                        ) + ` (${dt3.score_strip[0].score.split(' (')[1].replace(' ov', '')}`
                    : 'Yet to Bat'
                }</span>
                </span>
                <span class="bg-white px-3 d-block pt-2">
                <span class="fi fi-${tid[dt3.score_strip[1].team_id][0].toLowerCase()} me-1"></span>
                <b>${tid[dt3.score_strip[1].team_id][0]}</b>
                <span class="float-end font_14">${
                    dt3.score_strip[1].score
                    ? (
                        dt3.score_strip[1].score.split(' (')[0].split('/')[1] === "10"
                            ? `<b class="fs-6">${dt3.score_strip[1].score.split(' (')[0].split('/')[0]}</b>`
                            : `<b class="fs-6">${dt3.score_strip[1].score.split(' (')[0]}</b>`
                        ) + ` (${dt3.score_strip[1].score.split(' (')[1].replace(' ov', '')}`
                    : 'Yet to Bat'
                }</span>
                </span>`;
    liveHTML += `<span class="bg-white font_14 d-block pt-2 pb-2 px-3">
                ${dt3.info ? `<b class="${fc}">${dt3.info}</b>` : ''}
                ${dttm > cd ? `
                    <div class="clockdiv" data-deadline="${dttm.toISOString()}">
                    <b class="text-orange">
                        <span> Starts in: </span>
                        <span class="days" id="day" style="font-size: 22px;"></span><span style="color: #a6a6a6;"> Days</span>
                        <span class="hours" id="hour" style="font-size: 22px;"></span><span style="color: #a6a6a6;"> Hrs</span>
                        <span class="minutes" id="minute" style="font-size: 22px;"></span><span style="color: #a6a6a6;"> Mins</span>
                        <span class="seconds" id="second" style="font-size: 22px;"></span><span style="color: #a6a6a6;"> Secs</span>
                    </b>
                    </div>
                ` : ''}
                </span>`;
            if (
            dt3.info !== "" &&
            !dt3.info.toLowerCase().includes('won') &&
            !dt3.info.toLowerCase().includes('abandoned') &&
            !dt3.info.toLowerCase().includes('no result')
            ) {
            if (dt3.score_strip[0].currently_batting === true) {
                liveHTML += `
                <span class="d-block pt-2 pt-2 pb-2 px-3 font_12 bg-light">
                    Current RR: <b>${dt3.score_strip[0].run_rate.split(' ')[2]}</b><br>
                    Current Partnership: <b>${dt3.innings[0].current_partnership.runs} (${dt3.innings[0].current_partnership.balls})</b>
                </span>
                `;
            } else if (dt3.score_strip[1].currently_batting === true) {
                liveHTML += `
                <span class="d-block pt-2 pt-2 pb-2 px-3 font_12 bg-light">
                    Target: <b>${parseInt(dt3.score_strip[0].score.split('/')[0], 10) + 1}</b>&nbsp;&nbsp;&bull;&nbsp;&nbsp;
                    Current RR: <b>${dt3.score_strip[1].run_rate.split(' ')[2]}</b>&nbsp;&nbsp;|&nbsp;&nbsp;
                    Required RR: <b>${dt3.score_strip[0].required_run_rate}</b><br>
                    Current Partnership: <b>${dt3.innings[1].current_partnership.runs} (${dt3.innings[1].current_partnership.balls})</b>
                </span>
                `;
            }
            // Insert partnershipHTML into your page as needed
            }
    const ended = ['won','abandoned','no result'].some(s => dt3.info.toLowerCase().includes(s));
    liveHTML += `
        <ul class="mb-0 bg-tab rounded_bottom score_tab d-flex justify-content-evenly flex-wrap">
        <li class="d-inline-block"><a class="d-block" href="/match-${match}/matchInfo?source=${source}&fteam=${fteam}">Info</a></li>
        <li class="d-inline-block"><a class="d-block" href="/match-${match}/liveScore?source=${source}&fteam=${fteam}">${!ended ? 'Live' : 'Commentary'}</a></li>
        <li class="d-inline-block"><a class="active d-block" href="/match-${match}/scoreCard?source=${source}&fteam=${fteam}">Scorecard</a></li>
        <li class="d-inline-block"><a class="d-block" href="/match-${match}/Overs?source=${source}&fteam=${fteam}">Overs</a></li>
        <li class="d-inline-block"><a class="d-block" href="/match-${match}/liveSquad?source=${source}&fteam=${fteam}">Squad</a></li>
        </ul>`;
	liveHTML += `</div>`;

    // --------------- Match Scorecard Section --------------------

    // Player of the Match section
    if (dt3.info && dt3.info.toLowerCase().includes('won')) {
    if (dt3.player_of_match.player_name !== '') {
        let name = dt3.player_of_match.player_name;
        let team = dt3.player_of_match.team_name;
        let c1, c2;
        if (team === 'RCB') {
            c1 = clr2[team].c3; c2 = clr2[team].c1;
        } else if (team === 'GT') {
            c1 = clr2[team].c3; c2 = clr2[team].c2;
        } else if (team === 'MI') {
            c1 = clr2[team].c3; c2 = clr2[team].c2;
        } else if (team === 'PBKS') {
            c1 = clr2[team].c2; c2 = clr2[team].c1;
        } else if (team === 'KKR') {
            c1 = clr2[team].c2; c2 = clr2[team].c3;
	    } else if (team === 'NA') {
            c1 = "#fff"; c2 = "#fff"; 
        } else {
            c1 = clr2[team].c1; c2 = clr2[team].c2;
        }

        liveHTML += `
        <div class="score_2_inner box-shadow-4 rounded_10 bg-white mt-3">
            <b class="bg-blue-grad font_18 d-block px-3 text-white text-center pt-2 pb-2 rounded_top">Player of the Match</b>
            <div class="potm-content">
                <a href="/team-${encodeURIComponent(team)}/squad_details/${encodeURIComponent(name)}" class="${team === 'NA' ? 'disabled' : ''}">
                <div class="potm-image" style="--c1: ${c1}; --c2: ${c2};">
                    <img src="${dt3.player_of_match.player_slug !== "" ? dt3.player_images[dt3.player_of_match.player_slug] : 'https://staticg.sportskeeda.com/skm/assets/player-images/cricket/'+dt3.player_of_match.player_name.toLowerCase().replace(/ /g, '-')+'.png'}" alt="${name}" onerror="this.onerror=null; this.src='/static/images/squads/${team}/${name.replace(/ /g, '-')}.png'">
                </div></a>
                <div class="potm-details">
                    <div class="potm-name"><a href="/team-${encodeURIComponent(team)}/squad_details/${encodeURIComponent(name)}" class="${team === 'NA' ? 'disabled' : ''}">${name}</a></div>
                    <div class="potm-team fw-bold">
                        <img src="/static/images/squad_logos/${team}${team === 'RR' ? '1' : ''}.png" alt="Team Logo" class="team-logo">
                        ${fn[team]}
                    </div>
                    <div class="potm-stats">
                        <div class="stat-item">
                            <div class="stat-label">Bat</div>
                            <div class="stat-value">${dt3.player_of_match.batting_stat === '' ? '-' : dt3.player_of_match.batting_stat}</div>
                        </div>
                        <div class="stat-item">
                            <div class="stat-label">Bowl</div>
                            <div class="stat-value">${dt3.player_of_match.bowling_stat === '' ? '-' : dt3.player_of_match.bowling_stat}</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        `;
       }
    }

    // Player of the Series section
    if (dt3.info && dt3.info.toLowerCase().includes('won')) {
    if (dt3.player_of_series.player_name !== '') {
        let name = dt3.player_of_series.player_name;
        let team = dt3.player_of_series.team_name;
        let c1, c2;
        if (team === 'RCB') {
            c1 = clr2[team].c3; c2 = clr2[team].c1;
        } else if (team === 'GT') {
            c1 = clr2[team].c3; c2 = clr2[team].c2;
        } else if (team === 'MI') {
            c1 = clr2[team].c3; c2 = clr2[team].c2;
        } else if (team === 'PBKS') {
            c1 = clr2[team].c2; c2 = clr2[team].c1;
        } else if (team === 'KKR') {
            c1 = clr2[team].c2; c2 = clr2[team].c3;
	    } else if (team === 'NA') {
            c1 = "#fff"; c2 = "#fff"; 
        } else {
            c1 = clr2[team].c1; c2 = clr2[team].c2;
        }

        liveHTML += `
        <div class="score_2_inner box-shadow-4 rounded_10 bg-white mt-3 mb-3">
            <b class="bg-blue-grad font_18 d-block px-3 text-white text-center pt-2 pb-2 rounded_top">Player of the Series</b>
            <div class="potm-content">
                <a href="/team-${encodeURIComponent(team)}/squad_details/${encodeURIComponent(name)}" class="${team === 'NA' ? 'disabled' : ''}">
                <div class="potm-image text-blue" style="--c1: ${c1}; --c2: ${c2};">
                    <img src="${dt3.player_of_series.player_slug !== "" ? dt3.player_images[dt3.player_of_series.player_slug] : 'https://staticg.sportskeeda.com/skm/assets/player-images/cricket/'+dt3.player_of_series.player_name.toLowerCase().replace(/ /g, '-')+'.png'}" alt="${name}" onerror="this.onerror=null; this.src='/static/images/squads/${team}/${name.replace(/ /g, '-')}.png'">
                </div></a>
                <div class="potm-details">
                    <div class="potm-name"><a href="/team-${encodeURIComponent(team)}/squad_details/${encodeURIComponent(name)}" class="${team === 'NA' ? 'disabled' : ''}">${name}</a></div>
                    <div class="potm-team fw-bold">
                        <img src="/static/images/squad_logos/${team}${team === 'RR' ? '1' : ''}.png" alt="Team Logo" class="team-logo">
                        ${fn[team]}
                    </div>
                </div>
            </div>
        </div>
        `;
       }
    }

    //Top performers section
    if (dt3.info && dt3.info.toLowerCase().includes('won')) {
        let topBatters = getTopBatters(dt3.innings).slice(0, 2);
        let topBowlers = getTopBowlers(dt3.innings).slice(0, 2);

        liveHTML += `
        <div class="score_2_inner box-shadow-4 rounded_10 bg-white mt-3 mb-3">
        <b class="bg-blue-grad font_18 d-block px-3 text-white text-center pt-2 pb-2 rounded_top">Top Performers</b>
            <div class="tp-innings-info">
                <div class="tp-player-details batter">
                    <div class="tp-head">Batters</div>
                    <div class="tp-body">
                        <div class="tp-player-data">
                            ${topBatters.map(b => `
                                <div class="tp-player-info">
                                    <div class="tp-player-thumbnail">
                                        <img src="/static/images/squads/${b.team}/${b.name.replace(/ /g, "-")}.png" alt="${b.name}" class="image">
                                    </div>
                                    <div class="tp-player-info-content">
                                        <div class="tp-player-name"><a href="/team-${encodeURIComponent(b.team)}/squad_details/${encodeURIComponent(b.name)}">${b.name}</a></div>
                                        <div class="tp-player-score"><span class="runs">${b.runs}${b.out_str === 'Not out' ? '*' : ''}</span><span>&nbsp;(${b.balls})</span></div>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                </div>
                <div class="tp-player-details bowler">
                    <div class="tp-head">Bowlers</div>
                    <div class="tp-body">
                        <div class="tp-player-data">
                            ${topBowlers.map(b => `
                                <div class="tp-player-info">
                                    <div class="tp-player-thumbnail">
                                        <img src="/static/images/squads/${b.team}/${b.name.replace(/ /g, "-")}.png" alt="${b.name}" class="image">
                                    </div>
                                    <div class="tp-player-info-content">
                                        <div class="tp-player-name"><a href="/team-${encodeURIComponent(b.team)}/squad_details/${encodeURIComponent(b.name)}">${b.name}</a></div>
                                        <div class="tp-player-score"><span class="runs">${b.wickets}/${b.runs}</span><span>&nbsp;(${b.overs})</span></div>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                </div>
            </div>
        </div>
        `;
    }

    //Innings Tabs Buttons
    liveHTML += `<div class="score_1 mt-3">
    <ul class="d-flex flex-wrap font_12 fw-bold nav nav-tabs border-0" id="inningsTabs">`;
    for (let idx = 0; idx < Math.min(dt3.innings.length, 2); idx++) {
        const i = dt3.innings[idx];
        const is_active = dt3.score_strip[idx].currently_batting;
        liveHTML += `
        <li class="me-2 mt-1 mb-1">
            <a class="d-block p-1 px-3 rounded-pill${is_active ? ' active' : ''}" 
            data-bs-toggle="tab" aria-expanded="true" 
            href="#profile${idx + 1}">
            ${tid[i.batting_team_id][1]} Innings <i class="fa fa-chevron-right font_10 ms-1"></i>
            </a>
        </li>
        `;
    }
    liveHTML += `</ul></div>`;

    // Innings Tabs
    liveHTML += `<div class="score_2"><div class="tab-content">`;

    for (let idx = 0; idx < Math.min(dt3.innings.length, 2); idx++) {
        const i = dt3.innings[idx];
        const is_active = dt3.score_strip[idx].currently_batting;
        liveHTML += `<div class="tab-pane${is_active ? ' active' : ''}" id="profile${idx + 1}">`;
        liveHTML += `<div class="score_2_inner box-shadow-4 rounded_10 bg-white mt-3">
            <b class="bg-blue-grad font_14 d-block px-3 text-white pt-2 pb-2 rounded_top">${tid[i.batting_team_id][1]} <span class="font_12">Innings</span></b>
            <div class="table-responsive">
            <table class="table font_12 mb-0">
            <thead class="border-0">
                <tr class="bg-bluelight">
                    <th class="text-muted" style="width: 55%;">BATTER</th>
                    <th class="px-0 text-muted">R</th>
                    <th class="px-0 text-muted">B</th>
                    <th class="px-0 text-muted">4s</th>
                    <th class="px-0 text-muted">6s</th>
                    <th class="px-0 text-muted">SR</th>
                </tr>
            </thead>
            <tbody>`;

        // Batting rows
        i.batting.forEach(batsmen => {
            const bgcolor = batsmen.out_str === "Not out" ? '#2E7D32db' : '#666666b0';
            const team = batsmen.team;
            const name = batsmen.name;
            let imagePath = dt3.player_images[batsmen.slug];
            liveHTML += `<tr class="border-0">
                <td class="pb-0 text-blue" style="text-wrap: nowrap;">
                    <b><a href="/team-${encodeURIComponent(team)}/squad_details/${encodeURIComponent(name)}" class="${team === 'NA' ? 'disabled' : ''}">${name}</a>${batsmen.is_captain ? '&nbsp;<span class="text-muted">(C)</span>' : ''}</b>
                </td>
                <td class="px-0 pb-0"><b>${batsmen.runs}</b></td>
                <td class="px-0 pb-0">${batsmen.balls}</td>
                <td class="px-0 pb-0">${batsmen.fours}</td>
                <td class="px-0 pb-0">${batsmen.sixes}</td>
                <td class="px-0 pb-0">${batsmen.strike_rate}</td>
            </tr>
            <tr class="border-bottom">
                <td class="pt-0 fw-bold font_11" colspan="6" style="color: ${bgcolor}">${batsmen.out_str}</td>
            </tr>`;
        });

        // Not batted
        liveHTML += `<tr class="border-0">
            <td class="pb-0" colspan="6"><b class="font_13 fw-bold">${
                dt3.match_status === "post" ? "Didn't bat:" :
                dt3.score_strip[idx].currently_batting ? "Yet to bat:" : "Didn't bat:"
            }</b></td>
        </tr>`;

        // Sort not batted by order
        liveHTML += `<tr class="border-bottom"><td class="pt-0 fw-bold" colspan="6">`;
        i.not_batted.forEach((nb, nbIdx) => {
            const name = nb.name;
            const team = nb.team;
            liveHTML += `<a href="/team-${encodeURIComponent(team)}/squad_details/${encodeURIComponent(name)}" class="${team === 'NA' ? 'disabled' : ''}"><span class="text-blue">${name}</span></a>${nbIdx < i.not_batted.length - 1 ? ', ' : ''}`;
        });
        liveHTML += `</td></tr>`;

        liveHTML += `</tbody></table>`;

        // Extras and Total
        liveHTML += `<table class="table font_12 mb-0"><tbody>
            <tr class="border-bottom">
                <td>Extras</td>
                <td colspan="6"><b>${i.extras}</b> (b ${i.bye}, lb ${i.legbye}, w ${i.wide}, nb ${i.noball}, p ${i.penalties})</td>
            </tr>
            <tr class="bg-light">
                <td><b class="font_14">TOTAL</b></td>
                <td colspan="6"><b class="font_14">${i.runs}/${i.wickets} (${i.overs} Ov) CRR: ${i.run_rate}</b></td>
            </tr>
        </tbody></table>`;

        // Bowling
        liveHTML += `<div class="table-responsive"><table class="table font_12 mb-0">
            <thead class="border-0">
                <tr class="bg-bluelight">
                    <th class="text-muted" style="width: 55%;">BOWLER</th>
                    <th class="px-2 text-muted">O</th>
                    <th class="px-2 text-muted">M</th>
                    <th class="px-2 text-muted">R</th>
                    <th class="px-2 text-muted">W</th>
                    <th class="px-2 text-muted">ER</th>
                    <th class="px-2 text-muted">Ext</th>
                </tr>
            </thead>
            <tbody>`;
        i.bowling.forEach(bowler => {
            const team = bowler.team;
            const name = bowler.name;
            liveHTML += `<tr class="border-top">
                <td class="text-blue" style="text-wrap: nowrap;"><b><a href="/team-${encodeURIComponent(team)}/squad_details/${encodeURIComponent(name)}" class="${team === 'NA' ? 'disabled' : ''}">${name}</a></b></td>
                <td class="px-2">${bowler.overs}</td>
                <td class="px-2">${bowler.maiden_overs}</td>
                <td class="px-2">${bowler.runs}</td>
                <td class="px-2"><b>${bowler.wickets}</b></td>
                <td class="px-2">${bowler.economy}</td>
                <td class="px-2">${bowler.extras}</td>
            </tr>`;
        });
        liveHTML += `</tbody></table></div>`;

        // Fall of wickets
        liveHTML += `<div class="table-responsive"><table class="table font_12 mb-0">
            <thead class="border-0">
                <tr class="bg-bluelight">
                    <th class="text-muted" style="width: 55%;">Fall of Wickets</th>
                    <th class="px-0 text-muted">Score</th>
                    <th class="px-0 text-muted">Over</th>
                </tr>
            </thead>
            <tbody>`;
        i.fall_of_wickets.forEach(wicket => {
            const team = wicket.team;
            const name = wicket.name;
            const score = wicket.score;
            const over = wicket.over;
            liveHTML += `<tr class="border-top">
                <td class="text-blue" style="text-wrap: nowrap;"><b><a href="/team-${encodeURIComponent(team)}/squad_details/${encodeURIComponent(name)}" class="${team === 'NA' ? 'disabled' : ''}">${name}</a></b></td>
                <td class="px-0 fw-bold">${score}</td>
                <td class="px-0">${over}</td>
            </tr>`;
        });
        liveHTML += `</tbody></table></div>`;

        liveHTML += `</div></div></div>`;
    }

    liveHTML += `</div></div>`;

    liveContainer.innerHTML = liveHTML;

    // Restore previously active tab after HTML update
    if (activeTabHref) {
        const tabLink = document.querySelector(`#inningsTabs a[href="${activeTabHref}"]`);
        if (tabLink) {
            new bootstrap.Tab(tabLink).show();
        }
    }

    function createTimer(clockElement) {
      const deadline = new Date(clockElement.getAttribute("data-deadline")).getTime();

      const daysSpan = clockElement.querySelector(".days");
      const hoursSpan = clockElement.querySelector(".hours");
      const minutesSpan = clockElement.querySelector(".minutes");
      const secondsSpan = clockElement.querySelector(".seconds");
        if (!daysSpan || !hoursSpan || !minutesSpan || !secondsSpan) return; // or handle gracefully

      const interval = setInterval(function () {
        const Tnow = new Date();
        const timeZone = 'Asia/Kolkata';
        const dateInTimeZone = new Date(Tnow.toLocaleString('en-US', { timeZone }));
        const now = dateInTimeZone.getTime();
        const t = deadline - now;

        if (t < 0) {
          clearInterval(interval);
          daysSpan.textContent = "0";
          hoursSpan.textContent = "0";
          minutesSpan.textContent = "0";
          secondsSpan.textContent = "0";
          return;
        }

        const days = Math.floor(t / (1000 * 60 * 60 * 24));
        const hours = Math.floor((t % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((t % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((t % (1000 * 60)) / 1000);

        daysSpan.textContent = days;
        hoursSpan.textContent = hours;
        minutesSpan.textContent = minutes;
        secondsSpan.textContent = seconds;
      }, 1000);
    }

    // Initialize timers for all clock elements
    document.querySelectorAll(".clockdiv").forEach(function(clockElement) {
  createTimer(clockElement); // This will start the timer instantly
});
});

