function getBallScore(ball) {
    if (ball.isWicket) {
        if (ball.isByes) return `${ball.runsByes || 0}b+W`;
        else if (ball.isLegByes) return `${ball.runsLegByes || 0}lb+W`;
        else if (ball.isWide) return `${ball.runsWide || 0}wd+W`;
        else if ((ball.teamRuns || 0) > 0) return `${ball.teamRuns || 0}W`;
        else return "W";
    } else if (ball.isWide) {
        return (ball.runsWide || 0) > 1 ? `${ball.runsWide - 1 || 0}wd` : "wd";
    } else if (ball.isNoBall) {
        if (ball.isByes) return `${ball.runsByes || 0}b+nb`;
        else if (ball.isLegByes) return `${ball.runsLegByes || 0}lb+nb`;
        else return `${(ball.runsScored || 0) > 0 ? ball.runsScored : ""}nb`;
    } else if (ball.isLegByes) {
        return `${(ball.runsLegByes || 0) > 0 ? ball.runsLegByes : ""}lb`;
    } else if (ball.isByes) {
        return `${(ball.runsByes || 0) > 0 ? ball.runsByes : ""}b`;
    } else if (ball.teamRuns === 0) {
        return "0";
    } else {
        return ball.teamRuns || 0;
    }
}

function getBallBgColor(score) {
    score = String(score);
    if (score.includes('4')) {
        return 'bg-four';
    } else if (score.includes('6')) {
        return 'bg-six';
    } else if (score.includes('wd') || score.includes('b') || score.includes('lb') || score.includes('nb')) {
        return 'bg-extra';
    } else if (score === '0') {
        return 'bg-dot';
    } else if (['1', '2', '3'].includes(score)) {
        return 'bg-normal';
    } else if (score.includes('W')) {
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
function renderTabOvers(data) {
    let dt1 = data.dt1;
    let dt2 = data.dt2;
    let dt3 = data.dt3;
    let cd = new Date(data.cd);
    let dttm = data.dttm ? new Date(data.dttm) : null;
    let tid = data.tid;
    let fn = data.fn;
    let inn1 = data.inn1;
    let inn2 = data.inn2;
    let clr = data.clr;

    let tabHTML = '';

    // Match Info Session
    if (dt3.innings && dt3.innings.length > 0) {
    tabHTML += `<div class="live_5 box-shadow-4 rounded_10 bg-white mt-3 overflow-hidden">`;
        if (inn2 && inn2.inning) {
            let i = tid[dt3.score_strip[1].team_id][0];
            inn2.inning.overs.forEach(function(over) {
                if (over.overNumber === 0) return;
                let style = ``;
                if (i === 'RCB') {
                    style = `--c1: ${clr[i].c3}; --c2: ${clr[i].c1};`;
                } else if (i === 'GT') {
                    style = `--c1: ${clr[i].c3}; --c2: ${clr[i].c2};`;
                } else if (i === 'MI') {
                    style = `--c1: ${clr[i].c3}; --c2: ${clr[i].c2};`;
                } else if (i === 'PBKS') {
                    style = `--c1: ${clr[i].c1}; --c2: ${clr[i].c2};`;
                } else if (i === 'KKR') {
                    style = `--c1: ${clr[i].c2}; --c2: ${clr[i].c3};`;
                } else if (i === 'CSK') {
                    style = `--c1: ${clr[i].c1}; --c2: ${clr[i].c2};`;
                } else {
                    style = `--c1: ${clr[i].c1}; --c2: ${clr[i].c2};`;
                }

                tabHTML += `
                <div class="over-container">
                    <div class="over-left">
                            <div class="over-left-team" style="${style}">
                            <img class="over-left-team-img" src="/static/images/squad_logos/${tid[dt3.score_strip[1].team_id][0]}.png" alt="${tid[dt3.score_strip[1].team_id][0]}">
                            </div>
                            <div class="over-left-over">Ov ${over.overNumber}</div>
                            <div class="over-left-score">${over.totalInningRuns}-${over.totalInningWickets}</div>
                    </div>
                    <div class="over-center">
                        <div class="over-center-info">
                            ${
                                over.balls[0].comments[0].commentTypeId === "EndOfOver"
                                ? `<b>${over.balls[0].comments[0].message.split('Bowler: ')[1].split('.')[0]}</b> to ${getBatsmen(over)}`
                                : `<b>${over.balls[0].comments[over.balls[0].comments.length-1].message.split(' to ')[0].split(' ').slice(-2).join(' ')}</b> to ${getBatsmen(over)}`
                            }
                        </div>
                        <div class="over-center-item-balls">
                            ${over.balls.slice().reverse().map(ball => {
                                let score = getBallScore(ball);
                                return `<div class="over-center-balls ${getBallBgColor(score)}" style="width: ${20 + (score.toString().length * 3)}px;">${score !== '0' ? score : '<span class="club-icon">♣</span>'}</div>`;
                            }).join('')}
                        </div>
                    </div>
                    <div class="over-right">
                        <div class="over-right-runs">${over.totalRuns}</div>
                    </div>
                </div>
                `;
            });
        }

        if (inn1 && inn1.inning) {
            let i = tid[dt3.score_strip[0].team_id][0];
            inn1.inning.overs.forEach(function(over) {
                if (over.overNumber === 0) return;
                let style = '';
                if (i === 'RCB') {
                    style = `--c1: ${clr[i].c3}; --c2: ${clr[i].c1};`;
                } else if (i === 'GT') {
                    style = `--c1: ${clr[i].c3}; --c2: ${clr[i].c2};`;
                } else if (i === 'MI') {
                    style = `--c1: ${clr[i].c3}; --c2: ${clr[i].c2};`;
                } else if (i === 'PBKS') {
                    style = `--c1: ${clr[i].c1}; --c2: ${clr[i].c2};`;
                } else if (i === 'KKR') {
                    style = `--c1: ${clr[i].c2}; --c2: ${clr[i].c3};`;
                } else if (i === 'CSK') {
                    style = `--c1: ${clr[i].c1}; --c2: ${clr[i].c2};`;
                } else {
                    style = `--c1: ${clr[i].c1}; --c2: ${clr[i].c2};`;
                }


                tabHTML += `
                <div class="over-container">
                    <div class="over-left">
                            <div class="over-left-team" style="${style}">
                            <img class="over-left-team-img" src="/static/images/squad_logos/${tid[dt3.score_strip[0].team_id][0]}.png" alt="${tid[dt3.score_strip[1].team_id][0]}">
                            </div>
                            <div class="over-left-over">Ov ${over.overNumber}</div>
                            <div class="over-left-score">${over.totalInningRuns}-${over.totalInningWickets}</div>
                    </div>
                    <div class="over-center">
                        <div class="over-center-info">
                            ${
                                over.balls[0].comments[0].commentTypeId === "EndOfOver"
                                ? `<b>${over.balls[0].comments[0].message.split('Bowler: ')[1].split('.')[0]}</b> to ${getBatsmen(over)}`
                                : `<b>${over.balls[0].comments[over.balls[0].comments.length-1].message.split(' to ')[0].split(' ').slice(-2).join(' ')}</b> to ${getBatsmen(over)}`
                            }
                        </div>
                        <div class="over-center-item-balls">
                            ${over.balls.slice().reverse().map(ball => {
                                let score = getBallScore(ball);
                                return `<div class="over-center-balls ${getBallBgColor(score)}" style="width: ${20 + (score.toString().length * 3)}px;">${score !== '0' ? score : '<span class="club-icon">♣</span>'}</div>`;
                            }).join('')}
                        </div>
                    </div>
                    <div class="over-right">
                        <div class="over-right-runs">${over.totalRuns}</div>
                    </div>
                </div>
                `;
            });
        }
    }

    document.getElementById('tab-content').innerHTML = tabHTML;

}