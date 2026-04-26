// Handles rendering for Info tab
function renderTabInfo(data) {
    let dt1 = data.dt1;
    let dt2 = data.dt2;
    let dt3 = data.dt3;
    let cd = new Date(data.cd);
    let dttm = data.dttm ? new Date(data.dttm) : null;
    let tid = data.tid;

    let dateObj = new Date(dt1[0].Date);
    let dateTimeStr = dateObj.toISOString().split('T')[0] + 'T' + dt1[0].Time; // "2025-09-20T19:30:00"
    let timeObj = new Date(dateTimeStr);

    tabHTML = `
        <div class="live_5 box-shadow-4 rounded_10 bg-white mt-3 overflow-hidden" style="padding-bottom: 20px">
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
                        <td class="border-start">TATA Indian Premier League 2026</td>
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
                        dt3.umpires ? (dt3.umpires.split(',')[2] ? dt3.umpires.split(',')[2] + ")" : 'TBA') : 'TBA'
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

    document.getElementById('tab-content').innerHTML = tabHTML;
}
