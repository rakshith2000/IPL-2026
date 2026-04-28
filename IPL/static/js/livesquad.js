function Capitalize(str) {
    return str.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ');
}

function checkCaptain(player) {
    return player.position === 'captain' ? '<span class="text-muted">(C)</span>' : '';
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

// Handles rendering for Info tab
function renderTabSquad(data) {
    let dt1 = data.dt1;
    let dt2 = data.dt2;
    let dt3 = data.dt3;
    let cd = new Date(data.cd);
    let dttm = data.dttm ? new Date(data.dttm) : null;
    let tid = data.tid;
    let sqd = data.sqd;

    let tabHTML = '';

    if (dt3.squad !== null) {
        tabHTML += `<div class="score_2_inner box-shadow-4 rounded_10 bg-white mt-3 overflow-hidden">
            <div class="bg-blue-grad font_18 d-block px-4 fw-bold text-white pt-2 pb-2 rounded_top cb-teams-hdr">
                             <span><span class="fi fi-${tid[dt3.squad[0].team_id][0].toLowerCase()} me-1"></span>${tid[dt3.squad[0].team_id][0]}</span>
                             <span class="float-end">${tid[dt3.squad[1].team_id][0]}<span class="fi fi-${tid[dt3.squad[1].team_id][0].toLowerCase()} ms-1"></span></span>
                        </div>`;
        if (dt3.squad[0].players === null || dt3.squad[0].players.length === 0) {
            tabHTML += `<div class="bg-bluelight font_14 pt-1 pb-1 text-muted fw-bold" style="text-align: center;">
                            Squad
                        </div>`;
            tabHTML += `<div class="d-flex w-100">
                            <div class="d-flex w-50 border-right border-1 flex-column">`;
            dt3.squad[0].bench_players.forEach(player => {
                tabHTML += `<div class="d-flex border-bottom border-1">
                                        <div class="d-flex align-items-center ms-1">
                                            <a href="/team-${encodeURIComponent(player.team)}/squad_details/${encodeURIComponent(player.name)}" class="${player.team === 'NA' ? 'disabled' : ''}">
                                            <div class="squad-image">
                                                <img src="/static/images/squads/${player.team}-MICRO/${player.name.replace(/ /g, '-')}.png" alt="${player.name}" onerror="this.onerror=null;this.src='/static/images/Default.png';">
                                            </div>
                                            </a>
                                        </div>
                                        <div class="d-block w-100 p-1">
                                            <a href="/team-${encodeURIComponent(player.team)}/squad_details/${encodeURIComponent(player.name)}" class="${player.team === 'NA' ? 'disabled' : ''}">
                                            <div class="font_12 text-blue fw-bold p-0 m-0">${player.name.length > 20 ? player.name.split(' ')[0][0] + " " + player.name.split(' ').slice(1).join(' ') : player.name}&nbsp;${checkCaptain(player)}</div>
					                        </a>
                                            <div class="font_11 m-0 p-0">${Capitalize(player.role.replace('-', ' '))}</div>
                                        </div>
                                        ${checkOverseas(player, 'L')}
                                    </div>`;
            });
            tabHTML += `</div>`;
            tabHTML += `<div class="d-flex w-50 border-left border-1 flex-column text-end">`;
            dt3.squad[1].bench_players.forEach(player => {
                tabHTML += `<div class="d-flex border-bottom border-1">
                                        ${checkOverseas(player, 'R')}
                                        <div class="d-block w-100 p-1">
                                            <a href="/team-${encodeURIComponent(player.team)}/squad_details/${encodeURIComponent(player.name)}" class="${player.team === 'NA' ? 'disabled' : ''}">
                                            <div class="font_12 text-blue fw-bold p-0 m-0">${checkCaptain(player)}&nbsp;${player.name.length > 20 ? player.name.split(' ')[0][0] + " " + player.name.split(' ').slice(1).join(' ') : player.name}</div>
					                        </a>
                                            <div class="font_11 m-0 p-0">${Capitalize(player.role.replace('-', ' '))}</div>
                                        </div>
                                        <div class="d-flex align-items-center me-1">
                                            <a href="/team-${encodeURIComponent(player.team)}/squad_details/${encodeURIComponent(player.name)}" class="${player.team === 'NA' ? 'disabled' : ''}">
                                            <div class="squad-image">
                                                <img src="/static/images/squads/${player.team}-MICRO/${player.name.replace(/ /g, '-')}.png" alt="${player.name}" onerror="this.onerror=null;this.src='/static/images/Default.png';">
                                            </div>
                                            </a>
                                        </div>
                                    </div>`;
            });
            tabHTML += `</div></div>`;
        }
        else {
            tabHTML += `<div class="bg-bluelight font_14 pt-1 pb-1 text-muted fw-bold" style="text-align: center;">
                            Playing XI
                        </div>`;
            tabHTML += `<div class="d-flex w-100">
                            <div class="d-flex w-50 border-right border-1 flex-column">`;
            dt3.squad[0].players.forEach(player => {
                tabHTML += `<div class="d-flex border-bottom border-1" style="background-color: ${('delta' in player) ? (player.delta === 1 ? '#abf7b1' : '#fcc7c3') : '#ffffff'}">
                                        <div class="d-flex align-items-center ms-1">
                                            <a href="/team-${encodeURIComponent(player.team)}/squad_details/${encodeURIComponent(player.name)}" class="${player.team === 'NA' ? 'disabled' : ''}">
                                            <div class="squad-image">
                                                <img src="/static/images/squads/${player.team}-MICRO/${player.name.replace(/ /g, '-')}.png" alt="${player.name.length}" onerror="this.onerror=null;this.src='/static/images/Default.png';">
                                            </div>
                                            </a>
                                        </div>
                                        <div class="d-block w-100 p-1">
                                            <a href="/team-${encodeURIComponent(player.team)}/squad_details/${encodeURIComponent(player.name)}" class="${player.team === 'NA' ? 'disabled' : ''}">
                                            <div class="font_12 text-blue fw-bold p-0 m-0">${player.name.length > 20 ? player.name.split(' ')[0][0] + " " + player.name.split(' ').slice(1).join(' ') : player.name}&nbsp;${checkCaptain(player)}${dt3.squad[0].impact_players && dt3.squad[0].impact_players.length > 0 ? (player.name === dt3.squad[0].impact_players[1].name ? '<img class="in-out ml-1" src="/static/images/out.png" width="15px" height="15px" class="ms-1">' : '') : ''}</div>
                                            </a>
                                            <div class="font_11 m-0 p-0">${Capitalize(player.role.replace('-', ' '))}</div>
                                        </div>
                                        ${checkOverseas(player, 'L')}
                                    </div>`;
            });
            tabHTML += `</div>`;
            tabHTML += `<div class="d-flex w-50 border-left border-1 flex-column text-end">`;
            dt3.squad[1].players.forEach(player => {
                tabHTML += `<div class="d-flex border-bottom border-1" style="background-color: ${('delta' in player) ? (player.delta === 1 ? '#abf7b1' : '#fcc7c3') : '#ffffff'}">
                                        ${checkOverseas(player, 'R')}
                                        <div class="d-block w-100 p-1">
                                            <a href="/team-${encodeURIComponent(player.team)}/squad_details/${encodeURIComponent(player.name)}" class="${player.team === 'NA' ? 'disabled' : ''}">
                                            <div class="font_12 text-blue fw-bold p-0 m-0">${dt3.squad[1].impact_players && dt3.squad[1].impact_players.length > 0 ? (player.name === dt3.squad[1].impact_players[1].name ? '<img class="in-out mr-1" src="/static/images/out.png" width="15px" height="15px" class="me-1">' : '') : ''}${checkCaptain(player)}&nbsp;${player.name.length > 20 ? player.name.split(' ')[0][0] + " " + player.name.split(' ').slice(1).join(' ') : player.name}</div>
                                            </a>
                                            <div class="font_11 m-0 p-0">${Capitalize(player.role.replace('-', ' '))}</div>
                                        </div>
                                        <div class="d-flex align-items-center me-1">
                                            <a href="/team-${encodeURIComponent(player.team)}/squad_details/${encodeURIComponent(player.name)}" class="${player.team === 'NA' ? 'disabled' : ''}">
                                            <div class="squad-image">
                                                <img src="/static/images/squads/${player.team}-MICRO/${player.name.replace(/ /g, '-')}.png" alt="${player.name}" onerror="this.onerror=null;this.src='/static/images/Default.png';">
                                            </div>
                                            </a>
                                        </div>
                                    </div>`;
            });
            tabHTML += `</div></div>`;

            tabHTML += `<div class="bg-bluelight font_14 pt-1 pb-1 text-muted fw-bold" style="text-align: center;">
                            Substitutes
                        </div>`;
            tabHTML += `<div class="d-flex w-100">
                            <div class="d-flex w-50 border-right border-1 flex-column">`;
            dt3.squad[0].substitute_players.forEach(player => {
                tabHTML += `<div class="d-flex border-bottom border-1" style="background-color: ${('delta' in player) ? (player.delta === 1 ? '#abf7b1' : '#fcc7c3') : '#ffffff'}">
                                        <div class="d-flex align-items-center ms-1">
                                            <a href="/team-${encodeURIComponent(player.team)}/squad_details/${encodeURIComponent(player.name)}" class="${player.team === 'NA' ? 'disabled' : ''}">
                                            <div class="squad-image">
                                                <img src="/static/images/squads/${player.team}-MICRO/${player.name.replace(/ /g, '-')}.png" alt="${player.name.length}" onerror="this.onerror=null;this.src='/static/images/Default.png';">
                                            </div>
                                            </a>
                                        </div>
                                        <div class="d-block w-100 p-1">
                                            <a href="/team-${encodeURIComponent(player.team)}/squad_details/${encodeURIComponent(player.name)}" class="${player.team === 'NA' ? 'disabled' : ''}">
                                            <div class="font_12 text-blue fw-bold p-0 m-0">${player.name.length > 20 ? player.name.split(' ')[0][0] + " " + player.name.split(' ').slice(1).join(' ') : player.name}&nbsp;${checkCaptain(player)}${dt3.squad[0].impact_players && dt3.squad[0].impact_players.length > 0 ? (player.name === dt3.squad[0].impact_players[0].name ? '<img class="in-out ml-1" src="/static/images/in.png" width="15px" height="15px" class="ms-1">' : '') : ''}</div>
                                            </a>
                                            <div class="font_11 m-0 p-0">${Capitalize(player.role.replace('-', ' '))}</div>
                                        </div>
                                        ${checkOverseas(player, 'L')}
                                    </div>`;
            });
            tabHTML += `</div>`;
            tabHTML += `<div class="d-flex w-50 border-left border-1 flex-column text-end">`;
            dt3.squad[1].substitute_players.forEach(player => {
                tabHTML += `<div class="d-flex border-bottom border-1" style="background-color: ${('delta' in player) ? (player.delta === 1 ? '#abf7b1' : '#fcc7c3') : '#ffffff'}">
                                        ${checkOverseas(player, 'R')}
                                        <div class="d-block w-100 p-1">
                                            <a href="/team-${encodeURIComponent(player.team)}/squad_details/${encodeURIComponent(player.name)}" class="${player.team === 'NA' ? 'disabled' : ''}">
                                            <div class="font_12 text-blue fw-bold p-0 m-0">${dt3.squad[1].impact_players && dt3.squad[1].impact_players.length > 0 ? (player.name === dt3.squad[1].impact_players[0].name ? '<img class="in-out mr-1" src="/static/images/in.png" width="15px" height="15px" class="me-1">' : '') : ''}${checkCaptain(player)}&nbsp;${player.name.length > 20 ? player.name.split(' ')[0][0] + " " + player.name.split(' ').slice(1).join(' ') : player.name}</div>
                                            </a>
                                            <div class="font_11 m-0 p-0">${Capitalize(player.role.replace('-', ' '))}</div>
                                        </div>
                                        <div class="d-flex align-items-center me-1">
                                            <a href="/team-${encodeURIComponent(player.team)}/squad_details/${encodeURIComponent(player.name)}" class="${player.team === 'NA' ? 'disabled' : ''}">
                                            <div class="squad-image">
                                                <img src="/static/images/squads/${player.team}-MICRO/${player.name.replace(/ /g, '-')}.png" alt="${player.name}" onerror="this.onerror=null;this.src='/static/images/Default.png';">
                                            </div>
                                            </a>
                                        </div>
                                    </div>`;
            });
            tabHTML += `</div></div>`;

            tabHTML += `<div class="bg-bluelight font_14 pt-1 pb-1 text-muted fw-bold" style="text-align: center;">
                            Bench
                        </div>`;
            tabHTML += `<div class="d-flex w-100">
                            <div class="d-flex w-50 border-right border-1 flex-column">`;
            dt3.squad[0].bench_players.forEach(player => {
                tabHTML += `<div class="d-flex border-bottom border-1" style="background-color: ${('delta' in player) ? (player.delta === 1 ? '#abf7b1' : '#fcc7c3') : '#ffffff'}">
                                        <div class="d-flex align-items-center ms-1">
                                            <a href="/team-${encodeURIComponent(player.team)}/squad_details/${encodeURIComponent(player.name)}" class="${player.team === 'NA' ? 'disabled' : ''}">
                                            <div class="squad-image">
                                                <img src="/static/images/squads/${player.team}-MICRO/${player.name.replace(/ /g, '-')}.png" alt="${player.name}" onerror="this.onerror=null;this.src='/static/images/Default.png';">
                                            </div>
                                            </a>
                                        </div>
                                        <div class="d-block w-100 p-1">
                                            <a href="/team-${encodeURIComponent(player.team)}/squad_details/${encodeURIComponent(player.name)}" class="${player.team === 'NA' ? 'disabled' : ''}">
                                            <div class="font_12 text-blue fw-bold p-0 m-0">${player.name.length > 20 ? player.name.split(' ')[0][0] + " " + player.name.split(' ').slice(1).join(' ') : player.name}&nbsp;${checkCaptain(player)}</div>
                                            </a>
                                            <div class="font_11 m-0 p-0">${Capitalize(player.role.replace('-', ' '))}</div>
                                        </div>
                                        ${checkOverseas(player, 'L')}
                                    </div>`;
            });
            tabHTML += `</div>`;
            tabHTML += `<div class="d-flex w-50 border-left border-1 flex-column text-end">`;
            dt3.squad[1].bench_players.forEach(player => {
                tabHTML += `<div class="d-flex border-bottom border-1" style="background-color: ${('delta' in player) ? (player.delta === 1 ? '#abf7b1' : '#fcc7c3') : '#ffffff'}">
                                        ${checkOverseas(player, 'R')}
                                        <div class="d-block w-100 p-1">
                                            <a href="/team-${encodeURIComponent(player.team)}/squad_details/${encodeURIComponent(player.name)}" class="${player.team === 'NA' ? 'disabled' : ''}">
                                            <div class="font_12 text-blue fw-bold p-0 m-0">${checkCaptain(player)}&nbsp;${player.name.length > 20 ? player.name.split(' ')[0][0] + " " + player.name.split(' ').slice(1).join(' ') : player.name}</div>
                                            </a>
                                            <div class="font_11 m-0 p-0">${Capitalize(player.role.replace('-', ' '))}</div>
                                        </div>
                                        <div class="d-flex align-items-center me-1">
                                            <a href="/team-${encodeURIComponent(player.team)}/squad_details/${encodeURIComponent(player.name)}" class="${player.team === 'NA' ? 'disabled' : ''}">
                                            <div class="squad-image">
                                                <img src="/static/images/squads/${player.team}-MICRO/${player.name.replace(/ /g, '-')}.png" alt="${player.name}" onerror="this.onerror=null;this.src='/static/images/Default.png';">
                                            </div>
                                            </a>
                                        </div>
                                    </div>`;
            });
            tabHTML += `</div></div>`;
        }
        tabHTML += `</div>`;
    }
    
    document.getElementById('tab-content').innerHTML = tabHTML;

}