// Show loading spinner before fetch
const liveContainer = document.getElementById('liveContainer');
let firstLoad = true;
let refreshInterval = null;

function fetchAndRender(showSpinner = false) {
    if (showSpinner) {
        liveContainer.innerHTML = `<div id="loadingSpinner" style="text-align:center; padding:40px 0;">
            <span class="spinner-border text-white" role="status"></span><br>
            <span style="color:#ffffff; font-weight:bold;">Loading...</span>
        </div>`;
    }
    fetch(`/api/match-${match}/matchInfo`)
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
        <li class="d-inline-block"><a class="active d-block" href="/match-${match}/matchInfo?source=${source}&fteam=${fteam}">Info</a></li>
        <li class="d-inline-block"><a class="d-block" href="/match-${match}/liveScore?source=${source}&fteam=${fteam}">Live</a></li>
        <li class="d-inline-block"><a class="d-block" href="/match-${match}/scoreCard?source=${source}&fteam=${fteam}">Scorecard</a></li>
        <li class="d-inline-block"><a class="d-block" href="/match-${match}/Overs?source=${source}&fteam=${fteam}">Overs</a></li>
        <li class="d-inline-block"><a class="d-block" href="/match-${match}/liveSquad?source=${source}&fteam=${fteam}">Squad</a></li>
        </ul>`;
	liveHTML += `</div>`;

    // Match Info Session
    let dateObj = new Date(dt1[0].Date);
    let dateTimeStr = dateObj.toISOString().split('T')[0] + 'T' + dt1[0].Time; // "2025-09-20T19:30:00"
    let timeObj = new Date(dateTimeStr);
    liveHTML += `
        <div class="live_5 border rounded_10 bg-white mt-3 overflow-hidden" style="padding-bottom: 20px">
        <div class="row">
            <div class="col">
            <span class="d-block px-3 pt-1 pb-1 bg-bluelight font_16"><b>Match Details</b></span>
            <center>
                <div class="table-responsive mt-2" style="width: 90%">
                <table class="table font_12 mb-0 align-middle">
                    <tbody>
                    <tr class="border border-end">
                        <td class="bg-light fw-bold">Match</td>
                        <td class="border-start">${dt2[0]}</td>
                    </tr>
                    <tr class="border border-end">
                        <td class="bg-light fw-bold">Series</td>
                        <td class="border-start">TATA Indian Premier League 2025</td>
                    </tr>
                    <tr class="border border-end">
                        <td class="bg-light fw-bold">Date</td>
                        <td class="border-start">${dateObj.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</td>
                    </tr>
                    <tr class="border border-end">
                        <td class="bg-light fw-bold">Time</td>
                        <td class="border-start">${timeObj.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })} IST</td>
                    </tr>
                    <tr class="border border-end">
                        <td class="bg-light fw-bold">Venue</td>
                        <td class="border-start">${dt1[0].Venue}</td>
                    </tr>
                    <tr class="border border-end">
                        <td class="bg-light fw-bold">Toss</td>
                        <td class="border-start">${
                        "toss_won_by" in dt3 ? `${tid[dt3.toss_won_by][1]} elected to ${dt3.toss_decision}` : '-'
                        }</td>
                    </tr>
                    <tr class="border border-end">
                        <td class="bg-light fw-bold">Umpires</td>
                        <td class="border-start">${
                        dt3.umpires ? dt3.umpires.split(',').slice(0, 2).join(',') : 'TBA'
                        }</td>
                    </tr>
                    <tr class="border border-end">
                        <td class="bg-light fw-bold">3rd Umpire</td>
                        <td class="border-start">${
                        dt3.umpires ? (dt3.umpires.split(',')[2] ? dt3.umpires.split(',')[2] : 'TBA') : 'TBA'
                        }</td>
                    </tr>
                    <tr class="border border-end">
                        <td class="bg-light fw-bold">Referee</td>
                        <td class="border-start">${dt3.referee ? dt3.referee : 'TBA'}</td>
                    </tr>
                    <tr class="border border-end">
                        <td class="bg-light fw-bold">TV / Streaming</td>
                        <td class="border-start">Star Sports Network / JioHotstar</td>
                    </tr>
                    </tbody>
                </table>
                </div>
            </center>
            </div>
        </div>
        </div>
        `;
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

