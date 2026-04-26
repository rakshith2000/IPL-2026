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

// Handles rendering for Info tab
function renderTabScorecard(data) {
    let dt1 = data.dt1;
    let dt2 = data.dt2;
    let dt3 = data.dt3;
    let cd = new Date(data.cd);
    let dttm = data.dttm ? new Date(data.dttm) : null;
    let tid = data.tid;
    let fn = data.fn;
    let clr2 = data.clr2;

    const activeTab = document.querySelector('#inningsTabs .active');
    const activeTabHref = activeTab ? activeTab.getAttribute('href') : null;

    let tabHTML = '';

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

        tabHTML += `
        <div class="score_2_inner box-shadow-4 rounded_10 bg-white mt-3">
            <b class="bg-blue-grad font_18 d-block px-3 text-white text-center pt-2 pb-2 rounded_top">Player of the Match</b>
            <div class="potm-content">
                <a href="/team-${encodeURIComponent(team)}/squad_details/${encodeURIComponent(name)}" class="${team === 'NA' ? 'disabled' : ''}">
                <div class="potm-image" style="--c1: ${c1}; --c2: ${c2};">
                    <img src="/static/images/squads/${team}-MICRO/${dt3.player_of_match.player_name.replace(/ /g, '-')}.png" alt="${name}" onerror="this.onerror=null; this.src='/static/images/squads/${team}/${name.replace(/ /g, '-')}.png'">
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

        tabHTML += `
        <div class="score_2_inner box-shadow-4 rounded_10 bg-white mt-3 mb-3">
            <b class="bg-blue-grad font_18 d-block px-3 text-white text-center pt-2 pb-2 rounded_top">Player of the Series</b>
            <div class="potm-content">
                <a href="/team-${encodeURIComponent(team)}/squad_details/${encodeURIComponent(name)}" class="${team === 'NA' ? 'disabled' : ''}">
                <div class="potm-image text-blue" style="--c1: ${c1}; --c2: ${c2};">
                    <img src="/static/images/squads/${team}-MICRO/${dt3.player_of_series.player_name.replace(/ /g, '-')}.png" alt="${name}" onerror="this.onerror=null; this.src='/static/images/squads/${team}/${name.replace(/ /g, '-')}.png'">
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

        tabHTML += `
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
    tabHTML += `<div class="score_1 mt-3">
    <ul class="d-flex flex-wrap font_12 fw-bold nav nav-tabs border-0" id="inningsTabs">`;
    for (let idx = 0; idx < Math.min(dt3.innings.length, 2); idx++) {
        const i = dt3.innings[idx];
        const is_active = dt3.score_strip[idx].currently_batting;
        tabHTML += `
        <li class="me-2 mt-1 mb-1">
            <a class="d-block p-1 px-3 rounded-pill${is_active ? ' active' : ''}" 
            data-bs-toggle="tab" aria-expanded="true" 
            href="#profile${idx + 1}">
            ${tid[i.batting_team_id][1]} Innings <i class="fa fa-chevron-right font_10 ms-1"></i>
            </a>
        </li>
        `;
    }
    tabHTML += `</ul></div>`;

    // Innings Tabs
    tabHTML += `<div class="score_2"><div class="tab-content">`;

    for (let idx = 0; idx < Math.min(dt3.innings.length, 2); idx++) {
        const i = dt3.innings[idx];
        const is_active = dt3.score_strip[idx].currently_batting;
        tabHTML += `<div class="tab-pane${is_active ? ' active' : ''}" id="profile${idx + 1}">`;
        tabHTML += `<div class="score_2_inner box-shadow-4 rounded_10 bg-white mt-3">
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
            tabHTML += `<tr class="border-0">
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
        tabHTML += `<tr class="border-0">
            <td class="pb-0" colspan="6"><b class="font_13 fw-bold">${
                dt3.match_status === "post" ? "Didn't bat:" :
                dt3.score_strip[idx].currently_batting ? "Yet to bat:" : "Didn't bat:"
            }</b></td>
        </tr>`;

        // Sort not batted by order
        tabHTML += `<tr class="border-bottom"><td class="pt-0 fw-bold" colspan="6">`;
        i.not_batted.forEach((nb, nbIdx) => {
            const name = nb.name;
            const team = nb.team;
            tabHTML += `<a href="/team-${encodeURIComponent(team)}/squad_details/${encodeURIComponent(name)}" class="${team === 'NA' ? 'disabled' : ''}"><span class="text-blue">${name}</span></a>${nbIdx < i.not_batted.length - 1 ? ', ' : ''}`;
        });
        tabHTML += `</td></tr>`;

        tabHTML += `</tbody></table>`;

        // Extras and Total
        tabHTML += `<table class="table font_12 mb-0"><tbody>
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
        tabHTML += `<div class="table-responsive"><table class="table font_12 mb-0">
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
            tabHTML += `<tr class="border-top">
                <td class="text-blue" style="text-wrap: nowrap;"><b><a href="/team-${encodeURIComponent(team)}/squad_details/${encodeURIComponent(name)}" class="${team === 'NA' ? 'disabled' : ''}">${name}</a></b></td>
                <td class="px-2">${bowler.overs}</td>
                <td class="px-2">${bowler.maiden_overs}</td>
                <td class="px-2">${bowler.runs}</td>
                <td class="px-2"><b>${bowler.wickets}</b></td>
                <td class="px-2">${bowler.economy}</td>
                <td class="px-2">${bowler.extras}</td>
            </tr>`;
        });
        tabHTML += `</tbody></table></div>`;

        // Fall of wickets
        tabHTML += `<div class="table-responsive"><table class="table font_12 mb-0">
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
            tabHTML += `<tr class="border-top">
                <td class="text-blue" style="text-wrap: nowrap;"><b><a href="/team-${encodeURIComponent(team)}/squad_details/${encodeURIComponent(name)}" class="${team === 'NA' ? 'disabled' : ''}">${name}</a></b></td>
                <td class="px-0 fw-bold">${score}</td>
                <td class="px-0">${over}</td>
            </tr>`;
        });
        tabHTML += `</tbody></table></div>`;

        tabHTML += `</div></div></div>`;
    }

    tabHTML += `</div></div>`;
    
    document.getElementById('tab-content').innerHTML = tabHTML;

    // Restore previously active tab after HTML update
    if (activeTabHref) {
        const tabLink = document.querySelector(`#inningsTabs a[href="${activeTabHref}"]`);
        if (tabLink) {
            new bootstrap.Tab(tabLink).show();
        }
    }
   
}