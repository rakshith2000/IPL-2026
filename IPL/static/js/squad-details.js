const statLabels = [
    { key: "Matches", label: "MAT" },
    { key: "Innings", label: "INNS" },
    { key: "NotOuts", label: "N/O" },
    { key: "Runs", label: "RUNS" },
    { key: "HighestScore", label: "HS" },
    { key: "BattingAvg", label: "AVG" },
    { key: "StrikeRate", label: "SR" },
    { key: "Hundreds", label: "100S" },
    { key: "Fifties", label: "50S" },
    { key: "Fours", label: "4S" },
    { key: "Sixes", label: "6S" },
    { key: "Catches", label: "CT" },
    { key: "Stumpings", label: "ST" },
    { key: "TeamName", label: "TEAM" }
];
const bowlingStatLabels = [
    { key: "Matches", label: "MAT" },
    { key: "Innings", label: "INNS" },
    { key: "Overs", label: "OVERS" },
    { key: "Runs", label: "RUNS" },
    { key: "Wickets", label: "WKTS" },
    { key: "BBM", label: "BBM" },
    { key: "Average", label: "AVG" },
    { key: "Econ", label: "ECON" },
    { key: "StrikeRate", label: "SR" },
    { key: "FourWkts", label: "4W" },
    { key: "FiveWkts", label: "5W" },
    { key: "TeamName", label: "TEAM"}
];

const teams = {
    "CSK": "Chennai Super Kings",
    "MI": "Mumbai Indians",
    "RCB": "Royal Challengers Bengaluru",
    "KKR": "Kolkata Knight Riders",
    "SRH": "Sunrisers Hyderabad",
    "DC": "Delhi Capitals",
    "PBKS": "Punjab Kings",
    "RR": "Rajasthan Royals",
    "GT": "Gujarat Titans",
    "LSG": "Lucknow Super Giants"
};

        console.log(statsData);

        // Utility: get all years (including Overall if present) for dropdown
        function getAvailableYears(stats) {
            if (!stats || !stats.years || !Array.isArray(stats.years)) return [];
            let years = stats.years.filter(y => stats[y] && (stats[y]["batting"] || stats[y]["bowling"]));
            if (stats['Overall'] && (stats['Overall']["batting"] || stats['Overall']["bowling"])) {
                years.unshift('Overall'); // Ensure 'Overall' is first
            }
            return years;
        }
        // Utility: get all years for horizontal table (original order in data)
        function getYearsForHorizontal(stats) {
            if (!stats || !stats.years || !Array.isArray(stats.years)) return [];
            let years = stats.years.filter(y => stats[y] && (stats[y]["batting"] || stats[y]["bowling"]));
            if (stats['Overall'] && (stats['Overall']["batting"] || stats['Overall']["bowling"])) {
                years.unshift('Overall'); // Ensure 'Overall' is first in horizontal view
            }
            return years;
        }

        // Utility: get headers for a category (batting/bowling) from the first available year
        function getHeaders(stats, category) {
            if (!stats || !stats.years) return [];
            for (const y of stats.years) {
                if (stats[y] && stats[y][category]) {
                    return Object.keys(stats[y][category]);
                }
            }
            return [];
        }

        // Render dropdown dynamically
        function renderDropdown(years, selectedYear) {
            if (!years.length) {
                document.querySelector('.stats-dropdown-container').style.display = 'none';
                return;
            }
            document.querySelector('.stats-dropdown-container').style.display = 'block';
            let menu = years.map(y => `<a href="#" data-value="${y}" class="${y===selectedYear?'activeD':''}" onclick="selectYear(event, '${y}')">${y}</a>`).join('');
            document.getElementById('dropdownMenu').innerHTML = menu;
            document.getElementById('dropdownLabel').textContent = selectedYear;
        }

        // Render vertical table for a category and year (filtered by statLabels)
        function renderVerticalTable(stats, year, category, containerId) {
            const data = stats[year] && stats[year][category];
            if (!data) {
                document.getElementById(containerId).innerHTML = '';
                return;
            }
            const labels = category === 'batting' ? statLabels : bowlingStatLabels;
            let html = `<table><thead><tr><th>${category.toUpperCase()}</th><th>${year.toUpperCase()}</th></tr></thead><tbody>`;
            labels.forEach(({key, label}) => {
                let value = data[key] ?? '-';
                if (key === 'TeamName' && value !== '-') {
                    // Find short name from teams mapping
                    for (const shortName in teams) {
                        if (teams[shortName] === value) {
                            value = shortName;
                            break;
                        }
                    }
                }
                html += `<tr><td>${label}</td><td>${value}</td></tr>`;
            });
            html += '</tbody></table>';
            document.getElementById(containerId).innerHTML = html;
        }

        // Render horizontal table for a category (filtered by statLabels)
        function renderHorizontalTable(stats, years, category, containerId) {
            const labels = category === 'batting' ? statLabels : bowlingStatLabels;
            if (!labels.length) {
                document.getElementById(containerId).innerHTML = '';
                return;
            }
            let html = `<table><thead><tr><th>${category.toUpperCase()}</th>`;
            labels.forEach(({label}) => html += `<th>${label}</th>`);
            html += '</tr></thead><tbody>';
            years.forEach(y => {
                const row = stats[y] && stats[y][category];
                if (row) {
                    html += `<tr><td>${y}</td>`;
                    labels.forEach(({key}) => {
                        let value = row[key] ?? '-';
                        if (key === 'TeamName' && value !== '-') {
                            for (const shortName in teams) {
                                if (teams[shortName] === value) {
                                    value = shortName;
                                    break;
                                }
                            }
                        }
                        html += `<td>${value}</td>`;
                    });
                    html += '</tr>';
                }
            });
            html += '</tbody></table>';
            document.getElementById(containerId).innerHTML = html;
        }

        // Main render function
        function renderStats(selectedYear) {
            const dropdownYears = getAvailableYears(statsData);
            const tableYears = getYearsForHorizontal(statsData);
            const hasBatting = statsData[selectedYear] && statsData[selectedYear]["batting"];
            const hasBowling = statsData[selectedYear] && statsData[selectedYear]["bowling"];
            if (!dropdownYears.length || (!hasBatting && !hasBowling)) {
                document.querySelector('.stats-dropdown-container').style.display = 'none';
                document.getElementById('verticalTable').innerHTML = '';
                document.getElementById('verticalBowlingTable').innerHTML = '';
                document.getElementById('horizontalTable').innerHTML = '';
                document.getElementById('horizontalBowlingTable').innerHTML = '';
                if (!document.querySelector('.no-data')) {
                    document.querySelector('.stats-container').innerHTML += '<div class="no-data">NO DATA AVAILABLE</div>';
                }
                return;
            }
            // Remove any previous no-data message
            const noData = document.querySelector('.no-data');
            if (noData) noData.remove();
            renderDropdown(dropdownYears, selectedYear);
            renderVerticalTable(statsData, selectedYear, 'batting', 'verticalTable');
            renderVerticalTable(statsData, selectedYear, 'bowling', 'verticalBowlingTable');
            renderHorizontalTable(statsData, tableYears, 'batting', 'horizontalTable');
            renderHorizontalTable(statsData, tableYears, 'bowling', 'horizontalBowlingTable');
        }

        // Dropdown logic
        function toggleDropdown() {
            const dropdown = document.getElementById('yearDropdown');
            dropdown.classList.toggle('show');
            document.getElementById('dropdownChevron').classList.toggle('rotate');
        }
        function selectYear(event, year) {
            event.preventDefault();
            renderStats(year);
            // Remove active class from all
            document.querySelectorAll('#dropdownMenu a').forEach(a => a.classList.remove('activeD'));
            // Add active class to selected
            event.target.classList.add('activeD');
            document.getElementById('yearDropdown').classList.remove('show');
            document.getElementById('dropdownChevron').classList.remove('rotate');
        }
        // Initial render
        const defaultYear = getAvailableYears(statsData)[0] || 'Overall';
        renderStats(defaultYear);
        // Close dropdown if clicked outside
        document.addEventListener('click', function(e) {
            const dropdown = document.getElementById('yearDropdown');
            if (!dropdown.contains(e.target)) {
                dropdown.classList.remove('show');
                document.getElementById('dropdownChevron').classList.remove('rotate');
            }
        });