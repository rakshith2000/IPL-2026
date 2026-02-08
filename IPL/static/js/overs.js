// Show loading spinner before fetch
const liveContainer = document.getElementById('liveContainer');
let firstLoad = true;
let refreshInterval = null;

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
    fetch(`/api/match-${match}/Overs`)
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
            window.inn1 = data.inn1;
            window.inn2 = data.inn2;
            window.clr = data.clr;
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
        <li class="d-inline-block"><a class="d-block" href="/match-${match}/matchInfo?source=${source}&fteam=${fteam}">Info</a></li>
        <li class="d-inline-block"><a class="d-block" href="/match-${match}/liveScore?source=${source}&fteam=${fteam}">Live</a></li>
        <li class="d-inline-block"><a class="d-block" href="/match-${match}/scoreCard?source=${source}&fteam=${fteam}">Scorecard</a></li>
        <li class="d-inline-block"><a class="active d-block" href="/match-${match}/Overs?source=${source}&fteam=${fteam}">Overs</a></li>
        <li class="d-inline-block"><a class="d-block" href="/match-${match}/liveSquad?source=${source}&fteam=${fteam}">Squad</a></li>
        </ul>`;
	liveHTML += `</div>`;

    // Match Info Session
    if (dt3.innings && dt3.innings.length > 0) {
    liveHTML += `<div class="live_5 border rounded_10 bg-white mt-3 pt-3">
        <div style="border-bottom: 2px solid #ecebeb;"></div>`;
        if (inn2 && inn2.inning) {
            let i = tid[dt3.score_strip[1].team_id][0];
            inn2.inning.overs.slice(0, -1).forEach(function(over) {
                let style = '';
                if (i === 'RCB') {
                    style = `--c1: ${clr[i].c3}; --c2: ${clr[i].c1}; --fc: white;`;
                } else if (i === 'GT') {
                    style = `--c1: ${clr[i].c3}; --c2: ${clr[i].c2}; --fc: white;`;
                } else if (i === 'MI') {
                    style = `--c1: ${clr[i].c3}; --c2: ${clr[i].c2}; --fc: white;`;
                } else if (i === 'PBKS') {
                    style = `--c1: ${clr[i].c1}; --c2: ${clr[i].c2}; --fc: white;`;
                } else if (i === 'KKR') {
                    style = `--c1: ${clr[i].c2}; --c2: ${clr[i].c3}; --fc: white;`;
                } else if (i === 'CSK') {
                    style = `--c1: ${clr[i].c1}; --c2: ${clr[i].c2}; --fc: black;`;
                } else {
                    style = `--c1: ${clr[i].c1}; --c2: ${clr[i].c2}; --fc: white;`;
                }

                liveHTML += `
                <div class="over-container">
                    <div class="over-left" style="${style}">
                        <div class="over-left-items">
                            <div class="over-left-over">Ov ${over.overNumber}</div>
                            <div class="over-left-run">${getRuns(over)} Runs</div>
                        </div>
                        <div class="over-left-items">
                            <div class="over-left-score">${tid[dt3.score_strip[1].team_id][0]}</div>
                            <div class="over-left-score">${over.totalInningRuns}/${over.totalInningWickets}</div>
                        </div>
                    </div>
                    <div class="over-right">
                        <div class="over-right-info">
                            ${
                                over.balls[0].comments[0].commentTypeId === "EndOfOver"
                                ? `<b>${over.balls[0].comments[0].message.split('Bowler: ')[1].split('.')[0]}</b> to ${getBatsmen(over)}`
                                : `<b>${over.balls[0].comments[over.balls[0].comments.length-1].message.split(' to ')[0].split(' ').slice(-2).join(' ')}</b> to ${getBatsmen(over)}`
                            }
                        </div>
                        <div class="over-right-item-balls">
                            ${over.balls.slice().reverse().map(ball => {
                                let score = getBallScore(ball);
                                return `<div class="over-right-balls ${getBallBgColor(score)}" style="width: ${20 + (score.length * 4)}px;">${score}</div>`;
                            }).join('')}
                        </div>
                    </div>
                </div>
                `;
            });
        }

        if (inn1 && inn1.inning) {
            let i = tid[dt3.score_strip[0].team_id][0];
            inn1.inning.overs.slice(0, -1).forEach(function(over) {
                let style = '';
                if (i === 'RCB') {
                    style = `--c1: ${clr[i].c3}; --c2: ${clr[i].c1}; --fc: white;`;
                } else if (i === 'GT') {
                    style = `--c1: ${clr[i].c3}; --c2: ${clr[i].c2}; --fc: white;`;
                } else if (i === 'MI') {
                    style = `--c1: ${clr[i].c3}; --c2: ${clr[i].c2}; --fc: white;`;
                } else if (i === 'PBKS') {
                    style = `--c1: ${clr[i].c1}; --c2: ${clr[i].c2}; --fc: white;`;
                } else if (i === 'KKR') {
                    style = `--c1: ${clr[i].c2}; --c2: ${clr[i].c3}; --fc: white;`;
                } else if (i === 'CSK') {
                    style = `--c1: ${clr[i].c1}; --c2: ${clr[i].c2}; --fc: black;`;
                } else {
                    style = `--c1: ${clr[i].c1}; --c2: ${clr[i].c2}; --fc: white;`;
                }

                liveHTML += `
                <div class="over-container">
                    <div class="over-left" style="${style}">
                        <div class="over-left-items">
                            <div class="over-left-over">Ov ${over.overNumber}</div>
                            <div class="over-left-run">${getRuns(over)} Runs</div>
                        </div>
                        <div class="over-left-items">
                            <div class="over-left-score">${tid[dt3.score_strip[0].team_id][0]}</div>
                            <div class="over-left-score">${over.totalInningRuns}/${over.totalInningWickets}</div>
                        </div>
                    </div>
                    <div class="over-right">
                        <div class="over-right-info">
                            ${
                                over.balls[0].comments[0].commentTypeId === "EndOfOver"
                                ? `<b>${over.balls[0].comments[0].message.split('Bowler: ')[1].split('.')[0]}</b> to ${getBatsmen(over)}`
                                : `<b>${over.balls[0].comments[over.balls[0].comments.length-1].message.split(' to ')[0].split(' ').slice(-2).join(' ')}</b> to ${getBatsmen(over)}`
                            }
                        </div>
                        <div class="over-right-item-balls">
                            ${over.balls.slice().reverse().map(ball => {
                                let score = getBallScore(ball);
                                return `<div class="over-right-balls ${getBallBgColor(score)}" style="width: ${20 + (score.length * 4)}px;">${score}</div>`;
                            }).join('')}
                        </div>
                    </div>
                </div>
                `;
            });
        }
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

