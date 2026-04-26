const TABS = ['matchInfo', 'liveScore', 'scoreCard', 'Overs', 'liveSquad'];
const StyleTabs = ['liveScore','Overs'];
let currentTab = 'matchInfo';
let refreshInterval = null;

function createMoveTopBtn(tab) {
    const existingBtn = document.getElementById('moveTopBtn');
    if (existingBtn) existingBtn.remove(); // Button already exists

    if (StyleTabs.includes(tab)) {
        // Create the button
        const moveTopBtn = document.createElement('button');
        moveTopBtn.id = 'moveTopBtn';
        moveTopBtn.className = 'floating-move-top-btn';
        moveTopBtn.title = 'Move to Top';
        moveTopBtn.style.display = 'none';
        moveTopBtn.innerHTML = '<i class="fa fa-arrow-up"></i>';
        document.body.appendChild(moveTopBtn);

        // Show/hide button on scroll
        window.addEventListener('scroll', function() {
            if (window.scrollY > 400) {
                moveTopBtn.style.display = 'flex';
            } else {
                moveTopBtn.style.display = 'none';
            }
        });

        // Scroll to top on click
        moveTopBtn.addEventListener('click', function() {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    }

}

function loadTabStyle(tab) {
    // Remove any existing tab style
        const existing = document.getElementById('tab-style');
        if (existing) {
            existing.remove();
        }
        const existingOvers = document.getElementById('overs-style');
        if (existingOvers) {
            existingOvers.remove();
        }
        // Add new style for the selected tab
        const style = document.createElement('link');
        style.rel = 'stylesheet';
        style.id = 'tab-style';
        style.href = `/static/css/tab_${tab}.css`;
        document.head.appendChild(style);

        if (StyleTabs.includes(tab)) {
            // Add new style for the selected tab
            const style = document.createElement('link');
            style.rel = 'stylesheet';
            style.id = 'overs-style';
            style.href = `/static/css/overs.css`;
            document.head.appendChild(style);
        }
}

function setActiveTab(tab) {
    loadTabStyle(tab);
    createMoveTopBtn(tab);
    document.querySelectorAll('.tab').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tab);
    });
    currentTab = tab;
    // Update the URL without reloading the page
    const url = new URL(window.location);
    url.searchParams.set('tab', tab);
    window.history.replaceState({}, '', url);
    showLoading();
    fetchTabData(tab);
}

function showLoading() {
    document.getElementById('tab-content').innerHTML = `<div id="loadingSpinner" style="text-align:center; padding:40px 0;">
            <span class="spinner-border text-white" role="status"></span><br>
            <span style="color:#ffffff; font-weight:bold;">Loading...</span>
        </div>`;
}

function renderScoreboard(data) {
    let dt1 = data.dt1;
    let dt2 = data.dt2;
    let dt3 = data.dt3;
    let dttm = data.dttm ? new Date(data.dttm) : null;
    let cd = new Date(data.cd);
    let tid = data.tid;

    let fc = '';
    if (dt3.info === "") {
    fc = 'text-orange';
    } else if (dt3.info && dt3.info.includes('won')) {
    fc = 'text-blue';
    } else {
    fc = 'text-danger';
    }

    let scoreBoardHTML = `<div class="live_2_inner row px-3 pt-2 pb-2">
		     <div class="col-md-8">
			  <div class="live_2_inner_left">
			    <b class="text-white" style="font-size: 20px">${dt1[0].Team_A} vs ${dt1[0].Team_B}</b>
				<span class="d-block font_14 text-white">${dt2[0]}, ${dt2[1]}, ${dt2[2]}</span>
			  </div>
			 </div>
             </div>`;
        scoreBoardHTML += `<span class="bg-white px-3 d-block pt-2">
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
    scoreBoardHTML += `<span class="bg-white font_14 d-block pt-2 pb-2 px-3">
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
                scoreBoardHTML += `
                <span class="d-block pt-2 pt-2 pb-2 px-3 font_12 bg-light">
                    Current RR: <b>${dt3.score_strip[0].run_rate.split(' ')[2]}</b><br>
                    Current Partnership: <b>${dt3.innings[0].current_partnership.runs} (${dt3.innings[0].current_partnership.balls})</b>
                </span>
                `;
            } else if (dt3.score_strip[1].currently_batting === true) {
                scoreBoardHTML += `
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
    scoreBoardHTML += `
        <ul class="mb-0 bg-tab rounded_bottom score_tab d-flex justify-content-evenly flex-wrap">
        <li class="d-inline-block"><a class="tab d-block" href="#" data-tab="matchInfo">Info</a></li>
        <li class="d-inline-block"><a class="tab d-block" href="#" data-tab="liveScore">${!ended ? 'Live' : 'Commentary'}</a></li>
        <li class="d-inline-block"><a class="tab d-block" href="#" data-tab="scoreCard">Scorecard</a></li>
        <li class="d-inline-block"><a class="tab d-block" href="#" data-tab="Overs">Overs</a></li>
        <li class="d-inline-block"><a class="tab d-block" href="#" data-tab="liveSquad">Squad</a></li>
        </ul>`;

    document.getElementById('scoreboard-root').innerHTML = scoreBoardHTML;
    
    // Re-attach tab event listeners
    document.querySelectorAll('.tab').forEach(btn => {
        btn.addEventListener('click', () => setActiveTab(btn.dataset.tab));
    });
    // Set active tab
    document.querySelectorAll('.tab').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === currentTab);
    });
    // Initialize timers for all clock elements (fix for timer not updating)
    document.querySelectorAll('.clockdiv').forEach(function(clockElement) {
        createTimer(clockElement);
    });
}

function fetchTabData(tab) {
    if (refreshInterval) {
        clearInterval(refreshInterval);
        refreshInterval = null;
    }
    fetch(`/api/match-${match}/${tab}`)
        .then(res => res.json())
        .then(data => {

            // Check condition for auto-refresh
            const info = data.dt3.info;
            const shouldRefresh = info !== "" &&
                !info.toLowerCase().includes("won") &&
                !info.toLowerCase().includes("abandoned") &&
                !info.toLowerCase().includes("no result");

            if (shouldRefresh && !refreshInterval) {
                refreshInterval = setInterval(() => fetchTabData(currentTab), 8000);
            } else if (!shouldRefresh && refreshInterval) {
                clearInterval(refreshInterval);
                refreshInterval = null;
            }

            renderScoreboard(data);
            renderTab(tab, data);

        })
        .catch(() => {
            document.getElementById('tab-content').innerHTML = '<div style="color:red; text-align:center; padding:40px 0;">Failed to load data.</div>';
        });
}

function renderTab(tab, data) {
    // Dynamically load the tab-specific JS and call its render function
    const tabMap = {
        matchInfo: { file: 'info.js', func: 'renderTabInfo' },
        liveScore: { file: 'live.js', func: 'renderTabLive' },
        scoreCard: { file: 'scorecard.js', func: 'renderTabScorecard' },
        Overs: { file: 'overs.js', func: 'renderTabOvers' },
        liveSquad: { file: 'livesquad.js', func: 'renderTabSquad' },
    };
    const tabInfo = tabMap[tab];
    if (!tabInfo) {
        document.getElementById('tab-content').innerHTML = '<div style="color:red; text-align:center; padding:40px 0;">Invalid tab selected.</div>';
        return;
    }
    // Check if the function is already loaded
    if (typeof window[tabInfo.func] === 'function') {
        window[tabInfo.func](data);
    } else {
        // Dynamically load the script
        const script = document.createElement('script');
        script.src = `/static/js/${tabInfo.file}`;
        script.onload = () => {
            if (typeof window[tabInfo.func] === 'function') {
                window[tabInfo.func](data);
            } else {
                document.getElementById('tab-content').innerHTML = data ? '<div style="color:red; text-align:center; padding:40px 0;">Failed to load tab content.</div>' : '<div style="color:red; text-align:center; padding:40px 0;">No data available.</div>';
            }
        };
        script.onerror = () => {
            document.getElementById('tab-content').innerHTML = data ? '<div style="color:red; text-align:center; padding:40px 0;">Failed to load tab content.</div>' : '<div style="color:red; text-align:center; padding:40px 0;">No data available.</div>';
        };
        document.body.appendChild(script);
    }
}

function startAutoFetch() {
    if (fetchInterval) clearInterval(fetchInterval);
    fetchInterval = setInterval(() => fetchTabData(currentTab), 8000);
}

function getTabFromUrl() {
    const params = new URLSearchParams(window.location.search);
    const tab = params.get('tab');
    if (TABS.includes(tab)) {
        return tab;
    }
    return 'matchInfo';
}

document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.tab').forEach(btn => {
        btn.addEventListener('click', () => setActiveTab(btn.dataset.tab));
    });
    setActiveTab(getTabFromUrl());
    //startAutoFetch();
});

function createTimer(clockElement) {
      const deadline = new Date(clockElement.getAttribute("data-deadline")).getTime();

      const daysSpan = clockElement.querySelector(".days");
      const hoursSpan = clockElement.querySelector(".hours");
      const minutesSpan = clockElement.querySelector(".minutes");
      const secondsSpan = clockElement.querySelector(".seconds");
      if (!daysSpan || !hoursSpan || !minutesSpan || !secondsSpan) return; // or handle gracefully

      function updateTimer() {
        const Tnow = new Date();
        const timeZone = 'Asia/Kolkata';
        const dateInTimeZone = new Date(Tnow.toLocaleString('en-US', { timeZone }));
        const now = dateInTimeZone.getTime();
        const t = deadline - now;

        if (t < 0) {
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
      }

      updateTimer(); // Show timer instantly
      const interval = setInterval(updateTimer, 1000);
    }

    // Initialize timers for all clock elements
    document.querySelectorAll(".clockdiv").forEach(function(clockElement) {
  createTimer(clockElement); // This will start the timer instantly
    });
