// Show loading spinner before fetch
const liveContainer = document.getElementById('liveContainer');
let firstLoad = true;
let refreshInterval = null;

function Capitalize(str) {
    return str.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ');
}

function checkCaptain(player) {
    return player.captain ? '<span class="text-muted">(C)</span>' : '';
}

function checkOverseas(player, pos) {
    if (player.overseas && pos === 'L') {
        return `<div class="d-flex align-items-center me-2"><img src="/static/images/overseas2.png" width="11px" height="11px"></div>`;
    }
    if (player.overseas && pos === 'R') {
        return `<div class="d-flex align-items-center ms-2"><img src="/static/images/overseas2.png" width="11px" height="11px"></div>`;
    }
    return '';
}

function fetchAndRender(showSpinner = false) {
    if (showSpinner) {
        liveContainer.innerHTML = `<div id="loadingSpinner" style="text-align:center; padding:40px 0;">
            <span class="spinner-border text-white" role="status"></span><br>
            <span style="color:#ffffff; font-weight:bold;">Loading...</span>
        </div>`;
    }
    fetch(`/api/match-${match}/liveSquad`)
        .then(response => response.json())
        .then(data => {
            // ...existing code to set window.match, window.dt1, etc...
            window.match = data.match;
            window.dt1 = data.dt1;
            window.dt2 = data.dt2;
            window.dt3 = data.dt3;
            window.cd = new Date(data.cd);
            window.dttm = data.dttm ? new Date(data.dttm) : null;
            window.tid = data.tid;
            window.sqd = data.sqd;
            window.dispatchEvent(new Event('statsReady'));

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

// Initial load with spinner
fetchAndRender(true);

window.addEventListener('statsReady', () => {
    // Remove loading spinner only if present
    const spinner = document.getElementById('loadingSpinner');
    if (spinner) spinner.remove();

    console.log(dt3.squad[0]);
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
        <li class="d-inline-block"><a class="d-block" href="/match-${match}/liveScore?source=${source}&fteam=${fteam}">Live</a></li>
        <li class="d-inline-block"><a class="d-block" href="/match-${match}/scoreCard?source=${source}&fteam=${fteam}">Scorecard</a></li>
        <li class="d-inline-block"><a class="d-block" href="/match-${match}/Overs?source=${source}&fteam=${fteam}">Overs</a></li>
        <li class="d-inline-block"><a class="active d-block" href="/match-${match}/liveSquad?source=${source}&fteam=${fteam}">Squad</a></li>
        </ul>`;
	liveHTML += `</div>`;

    // Match Info Session
    if (dt3.squad !== null) {
        liveHTML += `<div class="score_2_inner border rounded_10 bg-white mt-3">
            <div class="bg-blue-grad font_18 d-block px-4 fw-bold text-white pt-2 pb-2 rounded_top cb-teams-hdr">
                             <span><span class="fi fi-${tid[dt3.squad[0].team_id][0].toLowerCase()} me-1"></span>${tid[dt3.squad[0].team_id][0]}</span>
                             <span class="float-end">${tid[dt3.squad[1].team_id][0]}<span class="fi fi-${tid[dt3.squad[1].team_id][0].toLowerCase()} ms-1"></span></span>
                        </div>`;
        if (dt3.squad[0].players === null) {
            liveHTML += `<div class="bg-bluelight font_14 pt-1 pb-1 text-muted fw-bold" style="text-align: center;">
                            Squad
                        </div>`;
            liveHTML += `<div class="d-flex w-100">
                            <div class="d-flex w-50 border-right border-1 ms-2 flex-column">`;
            dt3.squad[0].bench_players.forEach(player => {
                liveHTML += `<div class="d-flex border-bottom border-1">
                                        <div class="d-block w-100 p-1">
                                            <a href="/team-${encodeURIComponent(player.team)}/squad_details/${encodeURIComponent(player.name)}">
                                            <div class="font_12 text-blue fw-bold p-0 m-0">${player.name}&nbsp;${checkCaptain(player)}</div>
                                            </a>
					                        <div class="font_11 m-0 p-0">${Capitalize(player.role.replace('-', ' '))}</div>
                                        </div>
                                        ${checkOverseas(player, 'L')}
                                    </div>`;
            });
            liveHTML += `</div>`;
            liveHTML += `<div class="d-flex w-50 border-left border-1 me-2 flex-column text-end">`;
            dt3.squad[1].bench_players.forEach(player => {
                liveHTML += `<div class="d-flex border-bottom border-1">
                                        ${checkOverseas(player, 'R')}
                                        <div class="d-block w-100 p-1">
                                            <a href="/team-${encodeURIComponent(player.team)}/squad_details/${encodeURIComponent(player.name)}">
                                            <div class="font_12 text-blue fw-bold p-0 m-0">${checkCaptain(player)}&nbsp;${player.name}</div>
                                            </a>
                                            <div class="font_11 m-0 p-0">${Capitalize(player.role.replace('-', ' '))}</div>
                                        </div>
                                    </div>`;
            });
            liveHTML += `</div></div>`;
        }
        else {
            liveHTML += `<div class="bg-bluelight font_14 pt-1 pb-1 text-muted fw-bold" style="text-align: center;">
                            Playing XI
                        </div>`;
            liveHTML += `<div class="d-flex w-100">
                            <div class="d-flex w-50 border-right border-1 ms-2 flex-column">`;
            dt3.squad[0].players.forEach(player => {
                liveHTML += `<div class="d-flex border-bottom border-1" style="background-color: ${('delta' in player) ? (player.delta === 1 ? '#abf7b1' : '#fcc7c3') : '#ffffff'}">
                                        <div class="d-block w-100 p-1">
                                            <a href="/team-${encodeURIComponent(player.team)}/squad_details/${encodeURIComponent(player.name)}">
                                            <div class="font_12 text-blue fw-bold p-0 m-0">${player.name}&nbsp;${checkCaptain(player)}${dt3.squad[0].impact_players[1] ? (player.name === dt3.squad[0].impact_players[1].name ? '<img src="/static/images/out.png" width="8px" height="10px" class="ms-1">' : '') : ''}</div>
                                            </a>
                                            <div class="font_11 m-0 p-0">${Capitalize(player.role.replace('-', ' '))}</div>
                                        </div>
                                        ${checkOverseas(player, 'L')}
                                    </div>`;
            });
            liveHTML += `</div>`;
            liveHTML += `<div class="d-flex w-50 border-left border-1 me-2 flex-column text-end">`;
            dt3.squad[1].players.forEach(player => {
                liveHTML += `<div class="d-flex border-bottom border-1" style="background-color: ${('delta' in player) ? (player.delta === 1 ? '#abf7b1' : '#fcc7c3') : '#ffffff'}">
                                        ${checkOverseas(player, 'R')}
                                        <div class="d-block w-100 p-1">
                                            <a href="/team-${encodeURIComponent(player.team)}/squad_details/${encodeURIComponent(player.name)}">
                                            <div class="font_12 text-blue fw-bold p-0 m-0">${dt3.squad[1].impact_players[1] ? (player.name === dt3.squad[1].impact_players[1].name ? '<img src="/static/images/out.png" width="8px" height="10px" class="me-1">' : '') : ''}${checkCaptain(player)}&nbsp;${player.name}</div>
                                            </a>
                                            <div class="font_11 m-0 p-0">${Capitalize(player.role.replace('-', ' '))}</div>
                                        </div>
                                    </div>`;
            });
            liveHTML += `</div></div>`;

            liveHTML += `<div class="bg-bluelight font_14 pt-1 pb-1 text-muted fw-bold" style="text-align: center;">
                            Substitutes
                        </div>`;
            liveHTML += `<div class="d-flex w-100">
                            <div class="d-flex w-50 border-right border-1 ms-2 flex-column">`;
            dt3.squad[0].substitute_players.forEach(player => {
                liveHTML += `<div class="d-flex border-bottom border-1" style="background-color: ${('delta' in player) ? (player.delta === 1 ? '#abf7b1' : '#fcc7c3') : '#ffffff'}">
                                        <div class="d-block w-100 p-1">
                                            <a href="/team-${encodeURIComponent(player.team)}/squad_details/${encodeURIComponent(player.name)}">
                                            <div class="font_12 text-blue fw-bold p-0 m-0">${player.name}&nbsp;${checkCaptain(player)}${dt3.squad[0].impact_players[0] ? (player.name === dt3.squad[0].impact_players[0].name ? '<img src="/static/images/in.png" width="8px" height="10px" class="ms-1">' : '') : ''}</div>
                                            </a>
                                            <div class="font_11 m-0 p-0">${Capitalize(player.role.replace('-', ' '))}</div>
                                        </div>
                                        ${checkOverseas(player, 'L')}
                                    </div>`;
            });
            liveHTML += `</div>`;
            liveHTML += `<div class="d-flex w-50 border-left border-1 me-2 flex-column text-end">`;
            dt3.squad[1].substitute_players.forEach(player => {
                liveHTML += `<div class="d-flex border-bottom border-1" style="background-color: ${('delta' in player) ? (player.delta === 1 ? '#abf7b1' : '#fcc7c3') : '#ffffff'}">
                                        ${checkOverseas(player, 'R')}
                                        <div class="d-block w-100 p-1">
                                            <a href="/team-${encodeURIComponent(player.team)}/squad_details/${encodeURIComponent(player.name)}">
                                            <div class="font_12 text-blue fw-bold p-0 m-0">${dt3.squad[1].impact_players[0] ? (player.name === dt3.squad[1].impact_players[0].name ? '<img src="/static/images/in.png" width="8px" height="10px" class="me-1">' : '') : ''}${checkCaptain(player)}&nbsp;${player.name}</div>
                                            </a>
                                            <div class="font_11 m-0 p-0">${Capitalize(player.role.replace('-', ' '))}</div>
                                        </div>
                                    </div>`;
            });
            liveHTML += `</div></div>`;

            liveHTML += `<div class="bg-bluelight font_14 pt-1 pb-1 text-muted fw-bold" style="text-align: center;">
                            Bench
                        </div>`;
            liveHTML += `<div class="d-flex w-100">
                            <div class="d-flex w-50 border-right border-1 ms-2 flex-column">`;
            dt3.squad[0].bench_players.forEach(player => {
                liveHTML += `<div class="d-flex border-bottom border-1" style="background-color: ${('delta' in player) ? (player.delta === 1 ? '#abf7b1' : '#fcc7c3') : '#ffffff'}">
                                        <div class="d-block w-100 p-1">
                                            <a href="/team-${encodeURIComponent(player.team)}/squad_details/${encodeURIComponent(player.name)}">
                                            <div class="font_12 text-blue fw-bold p-0 m-0">${player.name}&nbsp;${checkCaptain(player)}</div>
                                            </a>
                                            <div class="font_11 m-0 p-0">${Capitalize(player.role.replace('-', ' '))}</div>
                                        </div>
                                        ${checkOverseas(player, 'L')}
                                    </div>`;
            });
            liveHTML += `</div>`;
            liveHTML += `<div class="d-flex w-50 border-left border-1 me-2 flex-column text-end">`;
            dt3.squad[1].bench_players.forEach(player => {
                liveHTML += `<div class="d-flex border-bottom border-1" style="background-color: ${('delta' in player) ? (player.delta === 1 ? '#abf7b1' : '#fcc7c3') : '#ffffff'}">
                                        ${checkOverseas(player, 'R')}
                                        <div class="d-block w-100 p-1">
                                            <a href="/team-${encodeURIComponent(player.team)}/squad_details/${encodeURIComponent(player.name)}">
                                            <div class="font_12 text-blue fw-bold p-0 m-0">${checkCaptain(player)}&nbsp;${player.name}</div>
                                            </a>
                                            <div class="font_11 m-0 p-0">${Capitalize(player.role.replace('-', ' '))}</div>
                                        </div>
                                    </div>`;
            });
            liveHTML += `</div></div>`;
        }
        liveHTML += `</div>`;
    }

    liveContainer.innerHTML = liveHTML;

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

