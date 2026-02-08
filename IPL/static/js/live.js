// Show loading spinner before fetch
const liveContainer = document.getElementById('liveContainer');
let firstLoad = true;
let refreshInterval = null;

function boldSubstring(value) {
    // Bold everything from the start up to and including the first '!'
    return value.replace(/(\b\w+!)/, '<b>$1</b>');
}

function getBallScore(ball) {
    if (ball.isWicket) {
        if (ball.isByes) return `W${ball.runsByes || 0}`;
        else if (ball.isLegByes) return `W${ball.runsLegByes || 0}`;
        else if (ball.isWide) return `W${ball.runsWide || 0}`;
        else if ((ball.teamRuns || 0) > 0) return `W${ball.teamRuns || 0}`;
        else return "W";
    } else if (ball.isWide) {
        return (ball.runsWide || 0) > 1 ? `Wd${ball.runsWide || 0}` : "Wd";
    } else if (ball.isNoBall) {
        if (ball.isByes) return `NB${ball.runsByes || 0}`;
        else if (ball.isLegByes) return `NL${ball.runsLegByes || 0}`;
        else return `N${(ball.runsScored || 0) > 0 ? ball.runsScored : ""}`;
    } else if (ball.isLegByes) {
        return `L${(ball.runsLegByes || 0) > 0 ? ball.runsLegByes : ""}`;
    } else if (ball.isByes) {
        return `B${(ball.runsByes || 0) > 0 ? ball.runsByes : ""}`;
    } else if (ball.teamRuns === 0) {
        return "0";
    } else {
        return ball.teamRuns || 0;
    }
}

function getBallBgColor(score) {
    score = String(score);
    if (score.startsWith('Wd') || score.startsWith('B') || score.startsWith('L') || score.startsWith('N')) {
        return 'bg-extra';
    } else if (score.includes('4')) {
        return 'bg-four';
    } else if (score.includes('6')) {
        return 'bg-six';
    } else if (score === '0') {
        return 'bg-dot';
    } else if (['1', '2', '3'].includes(score)) {
        return 'bg-normal';
    } else if (score.startsWith('W')) {
        return 'bg-wicket';
    } else {
        return 'bg-normal';
    }
}

function getBatsmen(over) {
    const batsmen = [];
    for (let i = over.balls.length - 1; i >= 0; i--) {
        const ball = over.balls[i];
        const comments = ball.comments;
        if (comments && comments.length > 0) {
            const message = comments[comments.length - 1].message;
            const batsman = message.split(' to ')[1]?.split('.')[0]?.trim();
            if (batsman && !batsmen.includes(batsman)) {
                batsmen.push(batsman);
            }
        }
    }
    return batsmen.join('<span>,</span> ');
}

function getRuns(over) {
    let runs = 0;
    for (const ball of over.balls) {
        if (ball.isWicket) {
            if (ball.isByes) runs += ball.runsByes || 0;
            else if (ball.isLegByes) runs += ball.runsLegByes || 0;
            else if (ball.isWide) runs += ball.runsWide || 0;
            else if ((ball.teamRuns || 0) > 0) runs += ball.teamRuns || 0;
            else runs += 0;
        } else if (ball.isWide) {
            runs += (ball.runsWide || 0) > 1 ? ball.runsWide || 0 : 1;
        } else if (ball.isNoBall) {
            if (ball.isByes) runs += (ball.runsByes || 0) + 1;
            else if (ball.isLegByes) runs += (ball.runsLegByes || 0) + 1;
            else runs += ((ball.runsScored || 0) > 0 ? ball.runsScored : 0) + (ball.extras || 1);
        } else if (ball.isLegByes) {
            runs += (ball.runsLegByes || 0) > 0 ? ball.runsLegByes : 0;
        } else if (ball.isByes) {
            runs += (ball.runsByes || 0) > 0 ? ball.runsByes : 0;
        } else if (ball.teamRuns === 0) {
            runs += 0;
        } else {
            runs += ball.teamRuns || 0;
        }
    }
    return runs;
}

function fetchAndRender(showSpinner = false) {
    if (showSpinner) {
        liveContainer.innerHTML = `<div id="loadingSpinner" style="text-align:center; padding:40px 0;">
            <span class="spinner-border text-white" role="status"></span><br>
            <span style="color:#ffffff; font-weight:bold;">Loading...</span>
        </div>`;
    }
fetch(`/api/match-${match}/liveScore`)
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
        window.clr = data.clr;
        window.clr2 = data.clr2;
        window.inn1 = data.inn1;
        window.inn2 = data.inn2;
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
    let liveHTML = `<div class="live_2 rounded_10 border mt-2" style="background: linear-gradient(145deg, #0056d2, #003c8a)">`;
    liveHTML += `<div class="live_2_inner row px-3 pt-2 pb-2">
		     <div class="col-md-8">
			  <div class="live_2_inner_left">
			    <b class="text-white" style="font-size: 20px">${dt1[0].Team_A} vs ${dt1[0].Team_B}</b>
				<span class="d-block font_14 text-white">${dt2[0]}, ${dt2[1]}, ${dt2[2]}, TATA Indian Premier League 2025</span>
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
    liveHTML += `
        <ul class="mb-0 bg-tab rounded_bottom score_tab d-flex justify-content-evenly flex-wrap">
        <li class="d-inline-block"><a class="d-block" href="/match-${match}/matchInfo?source=${source}&fteam=${fteam}">Info</a></li>
        <li class="d-inline-block"><a class="active d-block" href="/match-${match}/liveScore?source=${source}&fteam=${fteam}">Live</a></li>
        <li class="d-inline-block"><a class="d-block" href="/match-${match}/scoreCard?source=${source}&fteam=${fteam}">Scorecard</a></li>
        <li class="d-inline-block"><a class="d-block" href="/match-${match}/Overs?source=${source}&fteam=${fteam}">Overs</a></li>
        <li class="d-inline-block"><a class="d-block" href="/match-${match}/liveSquad?source=${source}&fteam=${fteam}">Squad</a></li>
        </ul>`;
	liveHTML += `</div>`;

    // --------------- Match Live Section --------------------
    
    // Win Probability Bar
    if (
        !dt3.info.toLowerCase().includes('won') &&
        !dt3.info.toLowerCase().includes('abandoned') &&
        !dt3.info.toLowerCase().includes('no result') &&
        dt3.team_win_probability &&
        Object.keys(dt3.team_win_probability).length !== 0
    ) {
        liveHTML += `
        <div class="live_4 border rounded_10 bg-white mt-3 pt-3 pb-3">
            <div class="container1">
                <div class="label-container">
                    <img src="/static/images/squad_logos/${dt1[0].Team_A}${dt1[0].Team_A === 'RR' ? '1' : ''}.png" width="40px" height="40px">
                    <span><b>Win Probability %</b></span>
                    <img src="/static/images/squad_logos/${dt1[0].Team_B}${dt1[0].Team_B === 'RR' ? '1' : ''}.png" width="40px" height="40px">
                </div>
                <div class="progress-bar">
                    <div class="l-bar" style="--c: ${clr[dt1[0].Team_A]}; width: ${Math.round(parseFloat(dt3.team_win_probability[dt1[0].Team_A]))}%"></div>
                    <div class="r-bar" style="--c: ${clr[dt1[0].Team_B]}; width: ${Math.round(parseFloat(dt3.team_win_probability[dt1[0].Team_B]))}%"></div>
                </div>
                <div class="text-container">
                    <span style="color: ${clr[dt1[0].Team_A]};"><b>${Math.round(parseFloat(dt3.team_win_probability[dt1[0].Team_A]))}%</b></span>
                    <span style="color: ${clr[dt1[0].Team_B]};"><b>${Math.round(parseFloat(dt3.team_win_probability[dt1[0].Team_B]))}%</b></span>
                </div>
            </div>
        </div>`;
    }

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
        } else {
            c1 = clr2[team].c1; c2 = clr2[team].c2;
        }

        liveHTML += `
        <div class="score_2_inner border rounded_10 bg-white mt-3">
            <b class="bg-blue-grad font_18 d-block px-3 text-white text-center pt-2 pb-2 rounded_top">Player of the Match</b>
            <div class="potm-content">
                <a href="/squad_details?team=${team}&name=${name}">
                <div class="potm-image" style="--c1: ${c1}; --c2: ${c2};">
                    <img src="${dt3.player_of_match.player_slug !== "" ? dt3.player_images[dt3.player_of_match.player_slug] : 'https://staticg.sportskeeda.com/skm/assets/player-images/cricket/'+dt3.player_of_match.player_name.toLowerCase().replace(/ /g, '-')+'.png'}" alt="${name}" onerror="this.onerror=null; this.src='/static/images/squads/${team}/${name.replace(/ /g, '-')}.png'">
                </div></a>
                <div class="potm-details">
                    <div class="potm-name"><a href="/team-${encodeURIComponent(team)}/squad_details/${encodeURIComponent(name)}">${name}</a></div>
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
        } else {
            c1 = clr2[team].c1; c2 = clr2[team].c2;
        }

        liveHTML += `
        <div class="score_2_inner border rounded_10 bg-white mt-3 mb-3">
            <b class="bg-blue-grad font_18 d-block px-3 text-white text-center pt-2 pb-2 rounded_top">Player of the Series</b>
            <div class="potm-content">
                <a href="/squad_details?team=${team}&name=${name}">
                <div class="potm-image" style="--c1: ${c1}; --c2: ${c2};">
                    <img src="${dt3.player_of_series.player_slug !== "" ? dt3.player_images[dt3.player_of_series.player_slug] : 'https://staticg.sportskeeda.com/skm/assets/player-images/cricket/'+dt3.player_of_series.player_name.toLowerCase().replace(/ /g, '-')+'.png'}" alt="${name}" onerror="this.onerror=null; this.src='/static/images/squads/${team}/${name.replace(/ /g, '-')}.png'">
                </div></a>
                <div class="potm-details">
                    <div class="potm-name"><a href="/team-${encodeURIComponent(team)}/squad_details/${encodeURIComponent(name)}">${name}</a></div>
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

    //Current Batting and Bowling Section
    if (
        !dt3.info.toLowerCase().includes('won') &&
        !dt3.info.toLowerCase().includes('abandoned') &&
        !dt3.info.toLowerCase().includes('no result') &&
        dt3.innings.length !== 0
    ) {
        liveHTML += `<div class="live_3 border rounded_10 bg-white mt-3" style="overflow: hidden;">
		  <div class="table-responsive">
		    <table class="table font_12 mb-0">
            <thead class="border-0">
                <tr class="bg-bluelight">
                <th class="text-muted" style="width: 55%;">BATTERS</th>
                <th class="px-2 text-muted">R</th>
                <th class="px-2 text-muted">B</th>
                <th class="px-2 text-muted">4s</th>
                <th class="px-2 text-muted">6s</th>
                <th class="px-2 text-muted">SR</th>
                </tr>
            </thead>
            <tbody>`;
        if (dt3.now_batting.b1.name !== '') {
            let name = dt3.now_batting.b1.name;
            let team = dt3.now_batting.b1.team;
            liveHTML += `<tr>
                <td class="text-blue" style="text-wrap: nowrap;"><b><a href="/team-${encodeURIComponent(team)}/squad_details/${encodeURIComponent(name)}">${name}*</a></b></td>
                <td class="px-2">${dt3.now_batting.b1.stats.runs}</td>
                <td class="px-2">${dt3.now_batting.b1.stats.balls}</td>
                <td class="px-2">${dt3.now_batting.b1.stats.fours}</td>
                <td class="px-2">${dt3.now_batting.b1.stats.sixes}</td>
                <td class="px-2">${dt3.now_batting.b1.stats.strike_rate}</td>
                </tr>`;
        }
        if (dt3.now_batting.b2.name !== '') {
            let name = dt3.now_batting.b2.name;
            let team = dt3.now_batting.b2.team;
            liveHTML += `<tr>
                <td class="text-blue" style="text-wrap: nowrap;"><b><a href="/team-${encodeURIComponent(team)}/squad_details/${encodeURIComponent(name)}">${name}</a></b></td>
                <td class="px-2">${dt3.now_batting.b2.stats.runs}</td>
                <td class="px-2">${dt3.now_batting.b2.stats.balls}</td>
                <td class="px-2">${dt3.now_batting.b2.stats.fours}</td>
                <td class="px-2">${dt3.now_batting.b2.stats.sixes}</td>
                <td class="px-2">${dt3.now_batting.b2.stats.strike_rate}</td>
                </tr>`;
        }
        liveHTML += `<tr class="bg-bluelight">
                    <th class="text-muted" style="width: 55%;">BOWLERS</th>
                    <th class="px-2 text-muted">O</th>
                    <th class="px-2 text-muted">M</th>
                    <th class="px-2 text-muted">R</th>
                    <th class="px-2 text-muted">W</th>
                    <th class="px-2 text-muted">ER</th>
                    </tr>`;
        if (dt3.now_bowling.b1.name !== '') {
            let name = dt3.now_bowling.b1.name;
            let team = dt3.now_bowling.b1.team;
            liveHTML += `<tr>
                <td class="text-blue" style="text-wrap: nowrap;"><b><a href="/team-${encodeURIComponent(team)}/squad_details/${encodeURIComponent(name)}">${name}*</a></b></td>
                <td class="px-2">${dt3.now_bowling.b1.stats.overs}</td>
                <td class="px-2">${dt3.now_bowling.b1.stats.maiden_overs}</td>
                <td class="px-2">${dt3.now_bowling.b1.stats.runs}</td>
                <td class="px-2">${dt3.now_bowling.b1.stats.wickets}</td>
                <td class="px-2">${dt3.now_bowling.b1.stats.economy}</td>
                </tr>`;
        }
        if (dt3.now_bowling.b2.name !== '') {
            let name = dt3.now_bowling.b2.name;
            let team = dt3.now_bowling.b2.team;
            liveHTML += `<tr>
                <td class="text-blue" style="text-wrap: nowrap;"><b><a href="/team-${encodeURIComponent(team)}/squad_details/${encodeURIComponent(name)}">${name}</a></b></td>
                <td class="px-2">${dt3.now_bowling.b2.stats.overs}</td>
                <td class="px-2">${dt3.now_bowling.b2.stats.maiden_overs}</td>
                <td class="px-2">${dt3.now_bowling.b2.stats.runs}</td>
                <td class="px-2">${dt3.now_bowling.b2.stats.wickets}</td>
                <td class="px-2">${dt3.now_bowling.b2.stats.economy}</td>
                </tr>`;
        }
        liveHTML += `</tbody></table></div></div>`;
    }

    //Innings Tabs Buttons
    liveHTML += `<div class="score_1 mt-3">
    <ul class="d-flex flex-wrap font_12 fw-bold nav nav-tabs border-0" id="inningsTabs">`;
    for (let idx = 0; idx < Math.min(dt3.innings.length, 2); idx++) {
        const i = dt3.innings[idx];
        const is_active = dt3.score_strip[idx].currently_batting;
        liveHTML += `
        <li class="me-2 mt-1 mb-1">
            <a class="border_orange d-block p-1 px-3 rounded-pill${is_active ? ' active' : ''}" 
            data-bs-toggle="tab" aria-expanded="true" 
            href="#profile${idx + 1}">
            ${tid[i.batting_team_id][1]} Innings <i class="fa fa-chevron-right font_10 ms-1"></i>
            </a>
        </li>
        `;
    }
    liveHTML += `</ul></div>`;

    // Innings Tabs
    // Tab 1
    liveHTML += `<div class="tab-content">`;
    const is_active2 = dt3.score_strip[1].currently_batting;
    liveHTML += `<div class="tab-pane ${is_active2 ? 'active' : ''}" id="profile2">
	<div class="live_4 border rounded_10 overflow-hidden bg-white mt-3">`;
    if (inn2 && inn2.inning) {
        inn2.inning.overs.slice(0, -1).forEach(over => {
            over.balls.forEach(ball => {
                if (ball.comments && ball.comments[0].commentTypeId === 'EndOfOver') {
                    liveHTML += `<div class="d-flex gap-3 px-3 py-2" style="border-bottom: 1px solid #d9d9d9; background: #d9d9d9;">
                    <div class="d-flex flex-column gap-1 align-items-center" style="width: 20%;">
                    <div class="font_14 fw-bold text-center">OVER ${over.overNumber}</div>
                    <div class="font_13 text-center">${tid[dt3.score_strip[1].team_id][0]}<br>${over.totalInningRuns}/${over.totalInningWickets}</div>
                    </div>
                    <div class="d-flex flex-column gap-1" style="width: 80%;">
                    <div class="font_13 border-bottom pb-1">`;
                    over.balls.slice().reverse().forEach(bl => {
                        const score = getBallScore(bl);
                        liveHTML += `${score}&nbsp;`;
                    });
                    liveHTML += `&nbsp;=>&nbsp;<b>${getRuns(over)} Runs</b></div>`;
                    const bowlerMsg = ball.comments[0].message;
                    const bowler = bowlerMsg.split('Bowler: ')[1]?.split('.')[0] || '';
                    liveHTML += `<div class="font_13">Bowler: <b>${bowler}</b></div>`;
                    liveHTML += `<div class="font_13">Batsmen: <b>${getBatsmen(over)}</b></div>`;
                    liveHTML += `</div></div>`;
                }
                liveHTML += `<div class="d-flex gap-3 px-3 py-2" style="border-bottom: 1px solid #d9d9d9;">
                <div class="d-flex flex-column gap-2 align-items-center">
                <div class="font_14 fw-bold text-center">${over.overNumber - 1}.${ball.ballNumber}</div>`;
                const score = getBallScore(ball);
                liveHTML += `<div class="over-right-balls ${getBallBgColor(score)}" style="width: ${20 + (String(score).length * 4)}px;">${score}</div>`;
                liveHTML += `</div><div class="font_14">${boldSubstring(ball.comments[ball.comments.length - 1].message)}</div></div>`;
            });
        });
    }
    liveHTML += `</div></div>`;

    //Tab 2
    const is_active1 = dt3.score_strip[0].currently_batting;
    liveHTML += `<div class="tab-pane ${is_active1 ? 'active' : ''}" id="profile1">
    <div class="live_4 border rounded_10 overflow-hidden bg-white mt-3">`;
    if (inn1 && inn1.inning) {
        inn1.inning.overs.slice(0, -1).forEach(over => {
            over.balls.forEach(ball => {
                if (ball.comments && ball.comments[0].commentTypeId === 'EndOfOver') {
                    liveHTML += `<div class="d-flex gap-3 px-3 py-2" style="border-bottom: 1px solid #d9d9d9; background: #d9d9d9;">
                    <div class="d-flex flex-column gap-1 align-items-center" style="width: 20%;">
                    <div class="font_14 fw-bold text-center">OVER ${over.overNumber}</div>
                    <div class="font_13 text-center">${tid[dt3.score_strip[0].team_id][0]}<br>${over.totalInningRuns}/${over.totalInningWickets}</div>
                    </div>
                    <div class="d-flex flex-column gap-1" style="width: 80%;">
                    <div class="font_13 border-bottom pb-1">`;
                    over.balls.slice().reverse().forEach(bl => {
                        const score = getBallScore(bl);
                        liveHTML += `${score}&nbsp;`;
                    });
                    liveHTML += `&nbsp;=>&nbsp;<b>${getRuns(over)} Runs</b></div>`;
                    const bowlerMsg = ball.comments[0].message;
                    const bowler = bowlerMsg.split('Bowler: ')[1]?.split('.')[0] || '';
                    liveHTML += `<div class="font_13">Bowler: <b>${bowler}</b></div>`;
                    liveHTML += `<div class="font_13">Batsmen: <b>${getBatsmen(over)}</b></div>`;
                    liveHTML += `</div></div>`;
                }
                liveHTML += `<div class="d-flex gap-3 px-3 py-2" style="border-bottom: 1px solid #d9d9d9;">
                <div class="d-flex flex-column gap-2 align-items-center">
                <div class="font_14 fw-bold text-center">${over.overNumber - 1}.${ball.ballNumber}</div>`;
                const score = getBallScore(ball);
                liveHTML += `<div class="over-right-balls ${getBallBgColor(score)}" style="width: ${20 + (String(score).length * 4)}px;">${score}</div>`;
                liveHTML += `</div><div class="font_14">${boldSubstring(ball.comments[ball.comments.length - 1].message)}</div></div>`;
            });
        });
    }
    liveHTML += `</div></div>`;
    liveHTML += `</div>`;
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
