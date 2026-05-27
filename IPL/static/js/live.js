function boldSubstring(value) {
    // Bold everything from the start up to and including the first '!'
    return value.replace(/(\b\w+!)/, '<b>$1</b>');
}

// --- Overs Bar Scroll and Fade Logic ---
function scrollOversBarToEnd(smooth = true) {
    const oversBar = document.querySelector('.overs-bar');
    if (oversBar) {
        oversBar.scrollTo({ left: oversBar.scrollWidth, behavior: smooth ? 'smooth' : 'auto' });
    }
}

function updateOversBarFade() {
    const oversSection = document.querySelector('.overs-section');
    const oversBar = document.querySelector('.overs-bar');
    if (!oversSection || !oversBar) return;
    const scrollLeft = oversBar.scrollLeft;
    const maxScroll = oversBar.scrollWidth - oversBar.clientWidth;
    if (scrollLeft <= 0) {
        oversSection.classList.add('at-start');
    } else {
        oversSection.classList.remove('at-start');
    }
    if (scrollLeft >= maxScroll - 1) {
        oversSection.classList.add('at-end');
    } else {
        oversSection.classList.remove('at-end');
    }
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

function getScoreStyle(score) {
    if (score.includes('W')) {
        return 'filled wicket';
    } else if (score.includes('4')) {
        return 'filled four';
    } else if (score.includes('6')) {
        return 'filled six';
    } else if (score === 'x') {
        return 'filled empty';
    } else {
        return 'filled';
    }
}

function getLiveOversBallScore(score) {
        if (score.includes('wd') || score.includes('nb')) {
            const match = score.match(/^(\d+)([a-zA-Z]+)$/);
            if (!match) return score;
            let num = parseInt(match[1], 10) - 1;
            let text = match[2];

            return num >= 1 ? `${num}${text}` : text;
        }
        else {
            return score;
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

// Handles rendering for Info tab
function renderTabLive(data) {
    let dt1 = data.dt1;
    let dt2 = data.dt2;
    let dt3 = data.dt3;
    let cd = new Date(data.cd);
    let dttm = data.dttm ? new Date(data.dttm) : null;
    let tid = data.tid;
    let fn = data.fn;
    let clr = data.clr;
    let clr2 = data.clr2;
    let inn1 = data.inn1;
    let inn2 = data.inn2;
    let winprob = data.winprob;

    const activeTab = document.querySelector('#inningsTabs .active');
    const activeTabHref = activeTab ? activeTab.getAttribute('href') : null;

    let tabHTML = '';

    // Live Overs Bar
    if (dt3.overs_timeline_v2 && dt3.overs_timeline_v2.length > 0) {
        tabHTML += `<div class="overs overs-section box-shadow-4 rounded_10 mt-3">
            <div class="overs-bar">`;
            dt3.overs_timeline_v2.reverse().forEach(over => {
                tabHTML += `<div class="over-group">
                    <span class="over-label no-wrap">Over ${over.over.split('.')[0]}</span>
                    <div class="over-balls">`;
                    over.summary.forEach(ball => {
                        let ballScore = getLiveOversBallScore(ball);
                        tabHTML += `<div class="over-ball ${getScoreStyle(ballScore)}" style="${ballScore.length >= 3 ? 'width: 30px;' : ''}">${ballScore !== '0' ? ballScore : '<span class="club-icon">♣</span>'}</div>`;
                    });
                tabHTML += `</div>
                <span class="over-total no-wrap">=&nbsp;${over.runs}</span>
                </div>`;
            });

        tabHTML += `</div>
                    </div>`;
    }

    // Win Probability Bar
    if (
        !dt3.info.toLowerCase().includes('won') &&
        !dt3.info.toLowerCase().includes('abandoned') &&
        !dt3.info.toLowerCase().includes('no result') &&
        dt3.team_win_probability &&
        Object.keys(dt3.team_win_probability).length !== 0
    ) {
        tabHTML += `
        <div class="live_4 border rounded_10 bg-white mt-3 pt-3 pb-3">
            <div class="container1">
                <div class="label-container">
                    <img src="/static/images/squad_logos/${dt1[0].Team_A}${dt1[0].Team_A === 'RR' ? '1' : ''}.png" width="40px" height="40px">
                    <span><b>Win Probability %</b></span>
                    <img src="/static/images/squad_logos/${dt1[0].Team_B}${dt1[0].Team_B === 'RR' ? '1' : ''}.png" width="40px" height="40px">
                </div>
                <div class="progress-bar">
                    <div class="l-bar" style="--c: ${clr[dt1[0].Team_A]}; width: ${parseFloat(dt3.team_win_probability[dt1[0].Team_A]).toFixed(1)}%"></div>
                    <div class="r-bar" style="--c: ${clr[dt1[0].Team_B]}; width: ${parseFloat(dt3.team_win_probability[dt1[0].Team_B]).toFixed(1)}%"></div>
                </div>
                <div class="text-container">
                    <span style="color: ${clr[dt1[0].Team_A]};"><b>${parseFloat(dt3.team_win_probability[dt1[0].Team_A]).toFixed(1)}%</b></span>
                    <span style="color: ${clr[dt1[0].Team_B]};"><b>${parseFloat(dt3.team_win_probability[dt1[0].Team_B]).toFixed(1)}%</b></span>
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
                    <img src="/static/images/squads/${team}-MICRO/${name.replace(/ /g, '-')}.png" alt="${name}" onerror="this.onerror=null; this.src='/static/images/squads/${team}/${name.replace(/ /g, '-')}.png'">
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

    //Current Batting and Bowling Section
    if (
        !dt3.info.toLowerCase().includes('won') &&
        !dt3.info.toLowerCase().includes('abandoned') &&
        !dt3.info.toLowerCase().includes('no result') &&
        dt3.innings.length !== 0
    ) {
        tabHTML += `<div class="live_3 box-shadow-4 rounded_10 bg-white mt-3" style="overflow: hidden;">
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
            tabHTML += `<tr>
                <td class="text-blue pl-2" style="text-wrap: nowrap;"><img src="/static/images/squads/${team}-MICRO/${name.replace(/ /g, '-')}.png" width="20px" height="20px" alt="${name}" onerror="this.onerror=null;this.src='/static/images/Default.png';">&nbsp;<b><a href="/team-${encodeURIComponent(team)}/squad_details/${encodeURIComponent(name)}" class="${team === 'NA' ? 'disabled' : ''}">${name}</a>&nbsp;<img src="/static/images/Bat.svg" width="18px" height="18px"></b></td>
                <td class="px-2 fw-bold">${dt3.now_batting.b1.stats.runs}</td>
                <td class="px-2">${dt3.now_batting.b1.stats.balls}</td>
                <td class="px-2">${dt3.now_batting.b1.stats.fours}</td>
                <td class="px-2">${dt3.now_batting.b1.stats.sixes}</td>
                <td class="px-2">${dt3.now_batting.b1.stats.strike_rate}</td>
                </tr>`;
        }
        if (dt3.now_batting.b2.name !== '') {
            let name = dt3.now_batting.b2.name;
            let team = dt3.now_batting.b2.team;
            tabHTML += `<tr>
                <td class="text-blue pl-2" style="text-wrap: nowrap;"><img src="/static/images/squads/${team}-MICRO/${name.replace(/ /g, '-')}.png" width="20px" height="20px" alt="${name}" onerror="this.onerror=null;this.src='/static/images/Default.png';">&nbsp;<b><a href="/team-${encodeURIComponent(team)}/squad_details/${encodeURIComponent(name)}" class="${team === 'NA' ? 'disabled' : ''}">${name}</a></b></td>
                <td class="px-2 fw-bold">${dt3.now_batting.b2.stats.runs}</td>
                <td class="px-2">${dt3.now_batting.b2.stats.balls}</td>
                <td class="px-2">${dt3.now_batting.b2.stats.fours}</td>
                <td class="px-2">${dt3.now_batting.b2.stats.sixes}</td>
                <td class="px-2">${dt3.now_batting.b2.stats.strike_rate}</td>
                </tr>`;
        }
        tabHTML += `<tr class="bg-bluelight">
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
            tabHTML += `<tr>
                <td class="text-blue pl-2" style="text-wrap: nowrap;"><img src="/static/images/squads/${team}-MICRO/${name.replace(/ /g, '-')}.png" width="20px" height="20px" alt="${name}" onerror="this.onerror=null;this.src='/static/images/Default.png';">&nbsp;<b><a href="/team-${encodeURIComponent(team)}/squad_details/${encodeURIComponent(name)}" class="${team === 'NA' ? 'disabled' : ''}">${name}</a>&nbsp;<img src="/static/images/Ball.svg" width="14px" height="14px" onerror="this.onerror=null; this.src='/static/images/ball.svg'"></b></td>
                <td class="px-2">${dt3.now_bowling.b1.stats.overs}</td>
                <td class="px-2">${dt3.now_bowling.b1.stats.maiden_overs}</td>
                <td class="px-2">${dt3.now_bowling.b1.stats.runs}</td>
                <td class="px-2 fw-bold">${dt3.now_bowling.b1.stats.wickets}</td>
                <td class="px-2">${dt3.now_bowling.b1.stats.economy}</td>
                </tr>`;
        }
        if (dt3.now_bowling.b2.name !== '') {
            let name = dt3.now_bowling.b2.name;
            let team = dt3.now_bowling.b2.team;
            tabHTML += `<tr>
                <td class="text-blue pl-2" style="text-wrap: nowrap;"><img src="/static/images/squads/${team}-MICRO/${name.replace(/ /g, '-')}.png" width="20px" height="20px" alt="${name}" onerror="this.src='/static/images/Default.png';">&nbsp;<b><a href="/team-${encodeURIComponent(team)}/squad_details/${encodeURIComponent(name)}" class="${team === 'NA' ? 'disabled' : ''}">${name}</a></b></td>
                <td class="px-2">${dt3.now_bowling.b2.stats.overs}</td>
                <td class="px-2">${dt3.now_bowling.b2.stats.maiden_overs}</td>
                <td class="px-2">${dt3.now_bowling.b2.stats.runs}</td>
                <td class="px-2 fw-bold">${dt3.now_bowling.b2.stats.wickets}</td>
                <td class="px-2">${dt3.now_bowling.b2.stats.economy}</td>
                </tr>`;
        }
        tabHTML += `</tbody></table></div></div>`;
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
    // Tab 1
    tabHTML += `<div class="tab-content">`;
    const is_active2 = dt3.score_strip[1].currently_batting;
    tabHTML += `<div class="tab-pane ${is_active2 ? 'active' : ''}" id="profile2">
	<div class="live_4 box-shadow-4 rounded_10 overflow-hidden bg-white mt-3">`;
    if (inn2 && inn2.inning) {
        inn2.inning.overs.slice(0, -1).forEach(over => {
            over.balls.forEach(ball => {
                if (ball.comments && ball.comments[0].commentTypeId === 'EndOfOver') {
                    tabHTML += `<div class="d-flex gap-3 px-3 py-2 over-entry">
                    <div class="d-flex flex-column gap-1 align-items-center" style="width: 20%;">
                    <div class="font_14 fw-bold text-center">OVER ${over.overNumber}</div>
                    <div class="font_13 text-center">${tid[dt3.score_strip[1].team_id][0]}<br>${over.totalInningRuns}/${over.totalInningWickets}</div>
                    </div>
                    <div class="d-flex flex-column gap-1" style="width: 80%;">
                    <div class="font_13 border-bottom pb-1">`;
                    over.balls.slice().reverse().forEach(bl => {
                        const score = getBallScore(bl);
                        tabHTML += `${score}&nbsp;`;
                    });
                    tabHTML += `&nbsp;=>&nbsp;<b>${getRuns(over)} Runs</b></div>`;
                    const bowlerMsg = ball.comments[0].message;
                    const bowler = bowlerMsg.split('Bowler: ')[1]?.split('.')[0] || '';
                    tabHTML += `<div class="font_13">Bowler: <b>${bowler}</b></div>`;
                    tabHTML += `<div class="font_13">Batsmen: <b>${getBatsmen(over)}</b></div>`;
                    tabHTML += `</div></div>`;
                }
                tabHTML += `<div class="d-flex gap-3 px-3 py-2 ball-entry">
                <div class="d-flex flex-column gap-2 align-items-center">
                <div class="font_14 fw-bold text-center">${over.overNumber - 1}.${ball.ballNumber}</div>`;
                const score = getBallScore(ball);
                tabHTML += `<div class="over-right-balls ${getBallBgColor(score)}" style="width: ${20 + (String(score).length * 4)}px;">${score !== '0' ? score : '<span class="club-icon">♣</span>'}</div>`;
                tabHTML += `</div><div class="font_14">${boldSubstring(ball.comments[ball.comments.length - 1].message)}</div></div>`;
            });
        });
    }
    tabHTML += `</div></div>`;

    //Tab 2
    const is_active1 = dt3.score_strip[0].currently_batting;
    tabHTML += `<div class="tab-pane ${is_active1 ? 'active' : ''}" id="profile1">
    <div class="live_4 box-shadow-4 rounded_10 overflow-hidden bg-white mt-3">`;
    if (inn1 && inn1.inning) {
        inn1.inning.overs.slice(0, -1).forEach(over => {
            over.balls.forEach(ball => {
                if (ball.comments && ball.comments[0].commentTypeId === 'EndOfOver') {
                    tabHTML += `<div class="d-flex gap-3 px-3 py-2 over-entry">
                    <div class="d-flex flex-column gap-1 align-items-center" style="width: 20%;">
                    <div class="font_14 fw-bold text-center">OVER ${over.overNumber}</div>
                    <div class="font_13 text-center">${tid[dt3.score_strip[0].team_id][0]}<br>${over.totalInningRuns}/${over.totalInningWickets}</div>
                    </div>
                    <div class="d-flex flex-column gap-1" style="width: 80%;">
                    <div class="font_13 border-bottom pb-1">`;
                    over.balls.slice().reverse().forEach(bl => {
                        const score = getBallScore(bl);
                        tabHTML += `${score}&nbsp;`;
                    });
                    tabHTML += `&nbsp;=>&nbsp;<b>${getRuns(over)} Runs</b></div>`;
                    const bowlerMsg = ball.comments[0].message;
                    const bowler = bowlerMsg.split('Bowler: ')[1]?.split('.')[0] || '';
                    tabHTML += `<div class="font_13">Bowler: <b>${bowler}</b></div>`;
                    tabHTML += `<div class="font_13">Batsmen: <b>${getBatsmen(over)}</b></div>`;
                    tabHTML += `</div></div>`;
                }
                tabHTML += `<div class="d-flex gap-3 px-3 py-2 ball-entry">
                <div class="d-flex flex-column gap-2 align-items-center">
                <div class="font_14 fw-bold text-center">${over.overNumber - 1}.${ball.ballNumber}</div>`;
                const score = getBallScore(ball);
                tabHTML += `<div class="over-right-balls ${getBallBgColor(score)}" style="width: ${20 + (String(score).length * 4)}px;">${score !== '0' ? score : '<span class="club-icon">♣</span>'}</div>`;
                tabHTML += `</div><div class="font_14">${boldSubstring(ball.comments[ball.comments.length - 1].message)}</div></div>`;
            });
        });
    }
    tabHTML += `</div></div>`;
    tabHTML += `</div>`;
    
    document.getElementById('tab-content').innerHTML = tabHTML;

    // Restore previously active tab after HTML update
    if (activeTabHref) {
        const tabLink = document.querySelector(`#inningsTabs a[href="${activeTabHref}"]`);
        if (tabLink) {
            new bootstrap.Tab(tabLink).show();
        }
    }

    // --- Overs Bar Scroll and Fade Logic: Attach after DOM update ---
    scrollOversBarToEnd(false); // On initial load or refresh, jump to end
    updateOversBarFade();
    const oversBar = document.querySelector('.overs-bar');
    if (oversBar) {
        oversBar.addEventListener('scroll', updateOversBarFade);
        window.addEventListener('resize', updateOversBarFade);
    }
    // Optionally, dispatch statsReady event for any other listeners
    window.dispatchEvent(new Event('statsReady'));

}