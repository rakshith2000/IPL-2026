// Show loading spinner before fetch
const tableContainer = document.getElementById('tableContainer');
tableContainer.innerHTML = `<div id="loadingSpinner" style="text-align:center; padding:40px 0;"><span class="spinner-border" style="color: #25478A" role="status"></span><br><span style="color:#25478A; font-weight:bold;">Loading...</span></div>`;

fetch("/api/stats")
    .then(response => {
        return response.json();
    })
    .then(data => {
        const statsData = data.stats;
        console.log("Stats data fetched successfully:", statsData['Most Sixes (Innings)']); // Log the fetched data for verification
        // Now you can use statsData and fullNames in your JavaScript
        window.statsData = statsData; // Make it globally accessible
        window.dispatchEvent(new Event('statsReady')); // Notify that data is ready
    })
    .catch(error => {
        tableContainer.innerHTML = '<div style="color:red; text-align:center; padding:40px 0;">Failed to load data.</div>';
    });

window.addEventListener('statsReady', () => {
    // Remove loading spinner
    if (document.getElementById('loadingSpinner')) {
        document.getElementById('loadingSpinner').remove();
    }
    // Check for option in URL
    const urlParams = new URLSearchParams(window.location.search);
    const option = urlParams.get('option');
    if (option && statsData[option]) {
        // Find dropdown element matching option
        const dropdownLinks = document.querySelectorAll('.dropdown-menu a');
        let found = false;
        dropdownLinks.forEach(link => {
            if (link.textContent.trim() === option) {
                selectOption(link, option);
                found = true;
            }
        });
        if (!found) {
            // fallback to default
            mostRunsTable(statsData['Most Runs']);
        }
    } else {
        // Initial table render - same approach as battingStat.html
        mostRunsTable(statsData['Most Runs']);
    }
});

function selectOption(element, optionTitle) {
    // Remove active from all
    const items = document.querySelectorAll('.dropdown-menu a');
    items.forEach(item => item.classList.remove('activeD'));

    // Set active to clicked one
    element.classList.add('activeD');

    // Update button text
    document.getElementById('dropdownButton').innerHTML = `${optionTitle} <i class="fa fa-chevron-down font_10 ms-1"></i>`;

    // Close dropdown
    document.querySelector('.dropdown').classList.remove('show');

    const tableData = statsData[optionTitle];

	switch(optionTitle) {
        case 'Most Runs':
            mostRunsTable(tableData);
            break;
        case 'Highest Scores':
            highestScoresTable(tableData);
            break;
        case 'Best Batting Averages':
            bestBattingAveragesTable(tableData);
            break;
        case 'Best Strike Rate':
            bestStrikeRateTable(tableData);
            break;
        case 'Best Strike Rate (Innings)':
            bestStrikeRateInningsTable(tableData);
            break;
        case 'Most 100s':
            most100sTable(tableData);
            break;
        case 'Most 50s':
            most50sTable(tableData);
            break;
        case 'Fastest 100s':
            fastest100sTable(tableData);
            break;
        case 'Fastest 50s':
            fastest50sTable(tableData);
            break;
        case 'Most Fours':
            mostFoursTable(tableData);
            break;
        case 'Most Fours (Innings)':
            mostFoursInningsTable(tableData);
            break;
        case 'Most Sixes':
            mostSixesTable(tableData);
            break;
        case 'Most Sixes (Innings)':
            mostSixesInningsTable(tableData);
            break;
    }
  }

  function mostRunsTable(data) {
    const container = document.getElementById('tableContainer');

    if (!data || data.length === 0) {
      container.innerHTML = '<p>No data available.</p>';
      return;
    }

    // Extract headers from the first dictionary (excluding Team and Batter which we'll handle specially)
    const headers = Object.keys(data[0]).filter(key => !['Team'].includes(key));

    // Build HTML table
    let tableHTML = '<table><thead><tr>';

    // Add custom headers
    tableHTML += '<th class="position"></th>'; // Position column
    tableHTML += '<th class="logo-col"></th>'; // Logo column
    tableHTML += '<th>Player</th>'; // Player name column
	tableHTML += '<th>R</th>'; // Runs column
	tableHTML += '<th>M</th>'; // Match column
	tableHTML += '<th>I</th>'; // Innings column
  tableHTML += '<th>NO</th>'; // Not Out column
  tableHTML += '<th>HS</th>'; // High Score column
	tableHTML += '<th>Avg</th>'; // Average column
	tableHTML += '<th>SR</th>'; // SR column
  tableHTML += '<th>100s</th>'; // 100s column
  tableHTML += '<th>50s</th>'; // 50s column
  tableHTML += '<th>4s</th>'; // 4s column
  tableHTML += '<th>6s</th>'; // 6s column
    tableHTML += '</tr></thead><tbody>';

    // Add rows
    data.forEach((row, index) => {
      tableHTML += '<tr>';

      // Position number (1st column)
      tableHTML += `<td class="position">${index + 1}</td>`;

      // Team logo (2nd column)
      const teamCode = row['TeamCode'];
      const logoUrl = `/static/images/squad_logos/${teamCode === 'RR' ? 'RR1' : teamCode}.png`;
      tableHTML += `<td class="logo-col"><img src="${logoUrl}" class="team-logo" alt="${teamCode}"></td>`;

      // Remaining columns
        tableHTML += `<td class="fw-bold text-blue"><a href="/team-${encodeURIComponent(row['TeamCode'])}/squad_details/${encodeURIComponent(row['StrikerName'])}">${row['StrikerName']}</a></td>`;
        tableHTML += `<td><b>${row['TotalRuns']}</b></td>`;
        tableHTML += `<td>${row['Matches']}</td>`;
        tableHTML += `<td>${row['Innings']}</td>`;
        tableHTML += `<td>${row['NotOuts']}</td>`;
        tableHTML += `<td>${row['HighestScore']}</td>`;
        tableHTML += `<td>${row['BattingAverage']}</td>`;
        tableHTML += `<td>${row['StrikeRate']}</td>`;
        tableHTML += `<td>${row['Centuries']}</td>`;
        tableHTML += `<td>${row['FiftyPlusRuns']}</td>`;
        tableHTML += `<td>${row['Fours']}</td>`;
        tableHTML += `<td>${row['Sixes']}</td>`;

      tableHTML += '</tr>';
    });

    tableHTML += '</tbody></table>';
    container.innerHTML = tableHTML;
  }

  function highestScoresTable(data) {
    const container = document.getElementById('tableContainer');

    if (!data || data.length === 0) {
      container.innerHTML = '<p>No data available.</p>';
      return;
    }

    // Extract headers from the first dictionary (excluding Team and Batter which we'll handle specially)
    const headers = Object.keys(data[0]).filter(key => !['Team'].includes(key));

    // Build HTML table
    let tableHTML = '<table><thead><tr>';

    // Add custom headers
    tableHTML += '<th class="position"></th>'; // Position column
    tableHTML += '<th class="logo-col"></th>'; // Logo column
    tableHTML += '<th>Player</th>'; // Player name column
    tableHTML += '<th>R</th>'; // Runs column
    tableHTML += '<th>BF</th>'; // Balls column
    tableHTML += '<th>SR</th>'; // SR column
    tableHTML += '<th>4s</th>'; // 4s column
    tableHTML += '<th>6s</th>'; // 6s column
    tableHTML += '<th>Vs</th>'; // Against column
    tableHTML += '<th>Venue</th>'; // Venue column
    tableHTML += '</tr></thead><tbody>';

    // Add rows
    data.forEach((row, index) => {
      tableHTML += '<tr>';

      // Position number (1st column)
      tableHTML += `<td class="position">${index + 1}</td>`;

      // Team logo (2nd column)
      const teamCode = row['TeamCode'];
      const logoUrl = `/static/images/squad_logos/${teamCode === 'RR' ? 'RR1' : teamCode}.png`;
      tableHTML += `<td class="logo-col"><img src="${logoUrl}" class="team-logo" alt="${teamCode}"></td>`;

      // Remaining columns
        tableHTML += `<td class="fw-bold text-blue"><a href="/team-${encodeURIComponent(row['TeamCode'])}/squad_details/${encodeURIComponent(row['StrikerName'])}">${row['StrikerName']}</a></td>`;
        tableHTML += `<td class="fw-bold">${row['TotalRuns']}</td>`;
        tableHTML += `<td>${row['Balls']}</td>`;
        tableHTML += `<td>${row['StrikeRate']}</td>`;
        tableHTML += `<td>${row['Fours']}</td>`;
        tableHTML += `<td>${row['Sixes']}</td>`;
        tableHTML += `<td>${row['AgaintsTeamCode']}</td>`;
        tableHTML += `<td>${row['VenueName']}</td>`;

      tableHTML += '</tr>';
    });

    tableHTML += '</tbody></table>';
    container.innerHTML = tableHTML;
  }

  function bestBattingAveragesTable(data) {
    const container = document.getElementById('tableContainer');

    if (!data || data.length === 0) {
      container.innerHTML = '<p>No data available.</p>';
      return;
    }

    // Extract headers from the first dictionary (excluding Team and Batter which we'll handle specially)
    const headers = Object.keys(data[0]).filter(key => !['Team'].includes(key));

    // Build HTML table
    let tableHTML = '<table><thead><tr>';

    // Add custom headers
    tableHTML += '<th class="position"></th>'; // Position column
    tableHTML += '<th class="logo-col"></th>'; // Logo column
    tableHTML += '<th>Player</th>'; // Player name column
    tableHTML += '<th>Avg</th>'; // Average column
    tableHTML += '<th>M</th>'; // Match column
    tableHTML += '<th>I</th>'; // Innings column
    tableHTML += '<th>R</th>'; // Runs column
    tableHTML += '<th>HS</th>'; // High Score column
    tableHTML += '<th>SR</th>'; // SR column
    tableHTML += '<th>100s</th>'; // 100s column
    tableHTML += '<th>50s</th>'; // 50s column
    tableHTML += '<th>4s</th>'; // 4s column
    tableHTML += '<th>6s</th>'; // 6s column
    tableHTML += '</tr></thead><tbody>';

    // Add rows
    data.forEach((row, index) => {
      tableHTML += '<tr>';

      // Position number (1st column)
      tableHTML += `<td class="position">${index + 1}</td>`;

      // Team logo (2nd column)
      const teamCode = row['TeamCode'];
      const logoUrl = `/static/images/squad_logos/${teamCode === 'RR' ? 'RR1' : teamCode}.png`;
      tableHTML += `<td class="logo-col"><img src="${logoUrl}" class="team-logo" alt="${teamCode}"></td>`;

      // Remaining columns
        tableHTML += `<td class="fw-bold text-blue"><a href="/team-${encodeURIComponent(row['TeamCode'])}/squad_details/${encodeURIComponent(row['StrikerName'])}">${row['StrikerName']}</a></td>`;
        tableHTML += `<td class="fw-bold">${row['BattingAverage']}</td>`;
        tableHTML += `<td>${row['Matches']}</td>`;
        tableHTML += `<td>${row['Innings']}</td>`;
        tableHTML += `<td>${row['TotalRuns']}</td>`;
        tableHTML += `<td>${row['HighestScore']}</td>`;
        tableHTML += `<td>${row['StrikeRate']}</td>`;
        tableHTML += `<td>${row['Centuries']}</td>`;
        tableHTML += `<td>${row['FiftyPlusRuns']}</td>`;
        tableHTML += `<td>${row['Fours']}</td>`;
        tableHTML += `<td>${row['Sixes']}</td>`;

      tableHTML += '</tr>';
    });

    tableHTML += '</tbody></table>';
    container.innerHTML = tableHTML;
  }

  function bestStrikeRateTable(data) {
    const container = document.getElementById('tableContainer');

    if (!data || data.length === 0) {
      container.innerHTML = '<p>No data available.</p>';
      return;
    }

    // Extract headers from the first dictionary (excluding Team and Batter which we'll handle specially)
    const headers = Object.keys(data[0]).filter(key => !['Team'].includes(key));

    // Build HTML table
    let tableHTML = '<table><thead><tr>';

    // Add custom headers
    tableHTML += '<th class="position"></th>'; // Position column
    tableHTML += '<th class="logo-col"></th>'; // Logo column
    tableHTML += '<th>Player</th>'; // Player name column
    tableHTML += '<th>SR</th>'; // SR column
    tableHTML += '<th>M</th>'; // Match column
    tableHTML += '<th>I</th>'; // Innings column
    tableHTML += '<th>R</th>'; // Runs column
    tableHTML += '<th>HS</th>'; // High Score column
    tableHTML += '<th>Avg</th>'; // Average column
    tableHTML += '<th>100s</th>'; // 100s column
    tableHTML += '<th>50s</th>'; // 50s column
    tableHTML += '<th>4s</th>'; // 4s column
    tableHTML += '<th>6s</th>'; // 6s column
    tableHTML += '</tr></thead><tbody>';

    // Add rows
    data.forEach((row, index) => {
      tableHTML += '<tr>';

      // Position number (1st column)
      tableHTML += `<td class="position">${index + 1}</td>`;

      // Team logo (2nd column)
      const teamCode = row['TeamCode'];
      const logoUrl = `/static/images/squad_logos/${teamCode === 'RR' ? 'RR1' : teamCode}.png`;
      tableHTML += `<td class="logo-col"><img src="${logoUrl}" class="team-logo" alt="${teamCode}"></td>`;

      // Remaining columns
        tableHTML += `<td class="fw-bold text-blue"><a href="/team-${encodeURIComponent(row['TeamCode'])}/squad_details/${encodeURIComponent(row['StrikerName'])}">${row['StrikerName']}</a></td>`;
        tableHTML += `<td class="fw-bold">${row['StrikeRate']}</td>`;
        tableHTML += `<td>${row['Matches']}</td>`;
        tableHTML += `<td>${row['Innings']}</td>`;
        tableHTML += `<td>${row['TotalRuns']}</td>`;
        tableHTML += `<td>${row['HighestScore']}</td>`;
        tableHTML += `<td>${row['BattingAverage']}</td>`;
        tableHTML += `<td>${row['Centuries']}</td>`;
        tableHTML += `<td>${row['FiftyPlusRuns']}</td>`;
        tableHTML += `<td>${row['Fours']}</td>`;
        tableHTML += `<td>${row['Sixes']}</td>`;

      tableHTML += '</tr>';
    });

    tableHTML += '</tbody></table>';
    container.innerHTML = tableHTML;
  }

  function bestStrikeRateInningsTable(data) {
    const container = document.getElementById('tableContainer');

    if (!data || data.length === 0) {
      container.innerHTML = '<p>No data available.</p>';
      return;
    }

    // Extract headers from the first dictionary (excluding Team and Batter which we'll handle specially)
    const headers = Object.keys(data[0]).filter(key => !['Team'].includes(key));

    // Build HTML table
    let tableHTML = '<table><thead><tr>';

    // Add custom headers
    tableHTML += '<th class="position"></th>'; // Position column
    tableHTML += '<th class="logo-col"></th>'; // Logo column
    tableHTML += '<th>Player</th>'; // Player name column
    tableHTML += '<th>SR</th>'; // SR column
    tableHTML += '<th>R</th>'; // Runs column
    tableHTML += '<th>BF</th>'; // Balls column
    tableHTML += '<th>4s</th>'; // 4s column
    tableHTML += '<th>6s</th>'; // 6s column
    tableHTML += '<th>Vs</th>'; // Against column
    tableHTML += '<th>Venue</th>'; // Venue column
    tableHTML += '</tr></thead><tbody>';

    // Add rows
    data.forEach((row, index) => {
      tableHTML += '<tr>';

      // Position number (1st column)
      tableHTML += `<td class="position">${index + 1}</td>`;

      // Team logo (2nd column)
      const teamCode = row['TeamCode'];
      const logoUrl = `/static/images/squad_logos/${teamCode === 'RR' ? 'RR1' : teamCode}.png`;
      tableHTML += `<td class="logo-col"><img src="${logoUrl}" class="team-logo" alt="${teamCode}"></td>`;

      // Remaining columns
        tableHTML += `<td class="fw-bold text-blue"><a href="/team-${encodeURIComponent(row['TeamCode'])}/squad_details/${encodeURIComponent(row['StrikerName'])}">${row['StrikerName']}</a></td>`;
        tableHTML += `<td class="fw-bold">${row['StrikeRate']}</td>`;
        tableHTML += `<td>${row['TotalRuns']}</td>`;
        tableHTML += `<td>${row['Balls']}</td>`;
        tableHTML += `<td>${row['Fours']}</td>`;
        tableHTML += `<td>${row['Sixes']}</td>`;
        tableHTML += `<td>${row['AgaintsTeamCode']}</td>`;
        tableHTML += `<td>${row['VenueName']}</td>`;

      tableHTML += '</tr>';
    });

    tableHTML += '</tbody></table>';
    container.innerHTML = tableHTML;
  }

  function most100sTable(data) {
    const container = document.getElementById('tableContainer');

    if (!data || data.length === 0) {
      container.innerHTML = '<p>No data available.</p>';
      return;
    }

    // Extract headers from the first dictionary (excluding Team and Batter which we'll handle specially)
    const headers = Object.keys(data[0]).filter(key => !['Team'].includes(key));

    // Build HTML table
    let tableHTML = '<table><thead><tr>';

    // Add custom headers
    tableHTML += '<th class="position"></th>'; // Position column
    tableHTML += '<th class="logo-col"></th>'; // Logo column
    tableHTML += '<th>Player</th>'; // Player name column
  tableHTML += '<th>100s</th>'; // 100s column
	tableHTML += '<th>R</th>'; // Runs column
	tableHTML += '<th>M</th>'; // Match column
	tableHTML += '<th>I</th>'; // Innings column
  tableHTML += '<th>NO</th>'; // Not Out column
  tableHTML += '<th>HS</th>'; // High Score column
	tableHTML += '<th>Avg</th>'; // Average column
	tableHTML += '<th>SR</th>'; // SR column
  tableHTML += '<th>50s</th>'; // 50s column
  tableHTML += '<th>4s</th>'; // 4s column
  tableHTML += '<th>6s</th>'; // 6s column
    tableHTML += '</tr></thead><tbody>';

    // Add rows
    data.forEach((row, index) => {
      tableHTML += '<tr>';

      // Position number (1st column)
      tableHTML += `<td class="position">${index + 1}</td>`;

      // Team logo (2nd column)
      const teamCode = row['TeamCode'];
      const logoUrl = `/static/images/squad_logos/${teamCode === 'RR' ? 'RR1' : teamCode}.png`;
      tableHTML += `<td class="logo-col"><img src="${logoUrl}" class="team-logo" alt="${teamCode}"></td>`;

      // Remaining columns
        tableHTML += `<td class="fw-bold text-blue"><a href="/team-${encodeURIComponent(row['TeamCode'])}/squad_details/${encodeURIComponent(row['StrikerName'])}">${row['StrikerName']}</a></td>`;
        tableHTML += `<td class="fw-bold">${row['Centuries']}</td>`;
        tableHTML += `<td>${row['TotalRuns']}</td>`;
        tableHTML += `<td>${row['Matches']}</td>`;
        tableHTML += `<td>${row['Innings']}</td>`;
        tableHTML += `<td>${row['NotOuts']}</td>`;
        tableHTML += `<td>${row['HighestScore']}</td>`;
        tableHTML += `<td>${row['BattingAverage']}</td>`;
        tableHTML += `<td>${row['StrikeRate']}</td>`;
        tableHTML += `<td>${row['FiftyPlusRuns']}</td>`;
        tableHTML += `<td>${row['Fours']}</td>`;
        tableHTML += `<td>${row['Sixes']}</td>`;

      tableHTML += '</tr>';
    });

    tableHTML += '</tbody></table>';
    container.innerHTML = tableHTML;
  }

  function most50sTable(data) {
    const container = document.getElementById('tableContainer');

    if (!data || data.length === 0) {
      container.innerHTML = '<p>No data available.</p>';
      return;
    }

    // Extract headers from the first dictionary (excluding Team and Batter which we'll handle specially)
    const headers = Object.keys(data[0]).filter(key => !['Team'].includes(key));

    // Build HTML table
    let tableHTML = '<table><thead><tr>';

    // Add custom headers
    tableHTML += '<th class="position"></th>'; // Position column
    tableHTML += '<th class="logo-col"></th>'; // Logo column
    tableHTML += '<th>Player</th>'; // Player name column
  tableHTML += '<th>50s</th>'; // 50s column
	tableHTML += '<th>R</th>'; // Runs column
	tableHTML += '<th>M</th>'; // Match column
	tableHTML += '<th>I</th>'; // Innings column
  tableHTML += '<th>NO</th>'; // Not Out column
  tableHTML += '<th>HS</th>'; // High Score column
	tableHTML += '<th>Avg</th>'; // Average column
	tableHTML += '<th>SR</th>'; // SR column
  tableHTML += '<th>100s</th>'; // 100s column
  tableHTML += '<th>4s</th>'; // 4s column
  tableHTML += '<th>6s</th>'; // 6s column
    tableHTML += '</tr></thead><tbody>';

    // Add rows
    data.forEach((row, index) => {
      tableHTML += '<tr>';

      // Position number (1st column)
      tableHTML += `<td class="position">${index + 1}</td>`;

      // Team logo (2nd column)
      const teamCode = row['TeamCode'];
      const logoUrl = `/static/images/squad_logos/${teamCode === 'RR' ? 'RR1' : teamCode}.png`;
      tableHTML += `<td class="logo-col"><img src="${logoUrl}" class="team-logo" alt="${teamCode}"></td>`;

      // Remaining columns
        tableHTML += `<td class="fw-bold text-blue"><a href="/team-${encodeURIComponent(row['TeamCode'])}/squad_details/${encodeURIComponent(row['StrikerName'])}">${row['StrikerName']}</a></td>`;
        tableHTML += `<td class="fw-bold">${row['FiftyPlusRuns']}</td>`;
        tableHTML += `<td>${row['TotalRuns']}</td>`;
        tableHTML += `<td>${row['Matches']}</td>`;
        tableHTML += `<td>${row['Innings']}</td>`;
        tableHTML += `<td>${row['NotOuts']}</td>`;
        tableHTML += `<td>${row['HighestScore']}</td>`;
        tableHTML += `<td>${row['BattingAverage']}</td>`;
        tableHTML += `<td>${row['StrikeRate']}</td>`;
        tableHTML += `<td>${row['Centuries']}</td>`;
        tableHTML += `<td>${row['Fours']}</td>`;
        tableHTML += `<td>${row['Sixes']}</td>`;

      tableHTML += '</tr>';
    });

    tableHTML += '</tbody></table>';
    container.innerHTML = tableHTML;
  }

  function fastest50sTable(data) {
    const container = document.getElementById('tableContainer');

    if (!data || data.length === 0) {
      container.innerHTML = '<p>No data available.</p>';
      return;
    }

    // Extract headers from the first dictionary (excluding Team and Batter which we'll handle specially)
    const headers = Object.keys(data[0]).filter(key => !['Team'].includes(key));

    // Build HTML table
    let tableHTML = '<table><thead><tr>';

    // Add custom headers
    tableHTML += '<th class="position"></th>'; // Position column
    tableHTML += '<th class="logo-col"></th>'; // Logo column
    tableHTML += '<th>Player</th>'; // Player name column
    tableHTML += '<th>BF</th>'; // Balls Faced column
    tableHTML += '<th>SR</th>'; // SR column
    tableHTML += '<th>Vs</th>'; // Against column
    tableHTML += '<th>Venue</th>'; // Venue column
    tableHTML += '</tr></thead><tbody>';

    // Add rows
    data.forEach((row, index) => {
      tableHTML += '<tr>';

      // Position number (1st column)
      tableHTML += `<td class="position">${index + 1}</td>`;

      // Team logo (2nd column)
      const teamCode = row['TeamCode'];
      const logoUrl = `/static/images/squad_logos/${teamCode === 'RR' ? 'RR1' : teamCode}.png`;
      tableHTML += `<td class="logo-col"><img src="${logoUrl}" class="team-logo" alt="${teamCode}"></td>`;

      // Remaining columns
        tableHTML += `<td class="fw-bold text-blue"><a href="/team-${encodeURIComponent(row['TeamCode'])}/squad_details/${encodeURIComponent(row['StrikerName'])}">${row['StrikerName']}</a></td>`;
        tableHTML += `<td class="fw-bold">${row['Balls']}</td>`;
        tableHTML += `<td>${row['StrikeRate']}</td>`;
        tableHTML += `<td>${row['AgaintsTeamCode']}</td>`;
        tableHTML += `<td>${row['VenueName']}</td>`;

      tableHTML += '</tr>';
    });

    tableHTML += '</tbody></table>';
    container.innerHTML = tableHTML;
  }

  function fastest100sTable(data) {
    const container = document.getElementById('tableContainer');

    if (!data || data.length === 0) {
      container.innerHTML = '<p>No data available.</p>';
      return;
    }

    // Extract headers from the first dictionary (excluding Team and Batter which we'll handle specially)
    const headers = Object.keys(data[0]).filter(key => !['Team'].includes(key));

    // Build HTML table
    let tableHTML = '<table><thead><tr>';

    // Add custom headers
    tableHTML += '<th class="position"></th>'; // Position column
    tableHTML += '<th class="logo-col"></th>'; // Logo column
    tableHTML += '<th>Player</th>'; // Player name column
    tableHTML += '<th>BF</th>'; // Balls Faced column
    tableHTML += '<th>SR</th>'; // SR column
    tableHTML += '<th>Vs</th>'; // Against column
    tableHTML += '<th>Venue</th>'; // Venue column
    tableHTML += '</tr></thead><tbody>';

    // Add rows
    data.forEach((row, index) => {
      tableHTML += '<tr>';

      // Position number (1st column)
      tableHTML += `<td class="position">${index + 1}</td>`;

      // Team logo (2nd column)
      const teamCode = row['TeamCode'];
      const logoUrl = `/static/images/squad_logos/${teamCode === 'RR' ? 'RR1' : teamCode}.png`;
      tableHTML += `<td class="logo-col"><img src="${logoUrl}" class="team-logo" alt="${teamCode}"></td>`;

      // Remaining columns
        tableHTML += `<td class="fw-bold text-blue"><a href="/team-${encodeURIComponent(row['TeamCode'])}/squad_details/${encodeURIComponent(row['StrikerName'])}">${row['StrikerName']}</a></td>`;
        tableHTML += `<td class="fw-bold">${row['Balls']}</td>`;
        tableHTML += `<td>${row['StrikeRate']}</td>`;
        tableHTML += `<td>${row['AgaintsTeamCode']}</td>`;
        tableHTML += `<td>${row['VenueName']}</td>`;

      tableHTML += '</tr>';
    });

    tableHTML += '</tbody></table>';
    container.innerHTML = tableHTML;
  }

  function mostFoursTable(data) {
    const container = document.getElementById('tableContainer');

    if (!data || data.length === 0) {
      container.innerHTML = '<p>No data available.</p>';
      return;
    }

    // Extract headers from the first dictionary (excluding Team and Batter which we'll handle specially)
    const headers = Object.keys(data[0]).filter(key => !['Team'].includes(key));

    // Build HTML table
    let tableHTML = '<table><thead><tr>';

    // Add custom headers
    tableHTML += '<th class="position"></th>'; // Position column
    tableHTML += '<th class="logo-col"></th>'; // Logo column
    tableHTML += '<th>Player</th>'; // Player name column
    tableHTML += '<th>4s</th>'; // Sixes column
    tableHTML += '<th>M</th>'; // Match column
    tableHTML += '<th>I</th>'; // Innings column
    tableHTML += '<th>R</th>'; // Runs column
    tableHTML += '<th>HS</th>'; // High Score column
    tableHTML += '<th>Avg</th>'; // Average column
    tableHTML += '<th>SR</th>'; // SR column
    tableHTML += '<th>100s</th>'; // 100s column
    tableHTML += '<th>50s</th>'; // 50s column
    tableHTML += '<th>6s</th>'; // 4s column
    tableHTML += '</tr></thead><tbody>';

    // Add rows
    data.forEach((row, index) => {
      tableHTML += '<tr>';

      // Position number (1st column)
      tableHTML += `<td class="position">${index + 1}</td>`;

      // Team logo (2nd column)
      const teamCode = row['TeamCode'];
      const logoUrl = `/static/images/squad_logos/${teamCode === 'RR' ? 'RR1' : teamCode}.png`;
      tableHTML += `<td class="logo-col"><img src="${logoUrl}" class="team-logo" alt="${teamCode}"></td>`;

      // Remaining columns
        tableHTML += `<td class="fw-bold text-blue"><a href="/team-${encodeURIComponent(row['TeamCode'])}/squad_details/${encodeURIComponent(row['StrikerName'])}">${row['StrikerName']}</a></td>`;
        tableHTML += `<td class="fw-bold">${row['Fours']}</td>`;
        tableHTML += `<td>${row['Matches']}</td>`;
        tableHTML += `<td>${row['Innings']}</td>`;
        tableHTML += `<td>${row['TotalRuns']}</td>`;
        tableHTML += `<td>${row['HighestScore']}</td>`;
        tableHTML += `<td>${row['BattingAverage']}</td>`;
        tableHTML += `<td>${row['StrikeRate']}</td>`;
        tableHTML += `<td>${row['Centuries']}</td>`;
        tableHTML += `<td>${row['FiftyPlusRuns']}</td>`;
        tableHTML += `<td>${row['Sixes']}</td>`;

      tableHTML += '</tr>';
    });

    tableHTML += '</tbody></table>';
    container.innerHTML = tableHTML;
  }

  function mostFoursInningsTable(data) {
    const container = document.getElementById('tableContainer');

    if (!data || data.length === 0) {
      container.innerHTML = '<p>No data available.</p>';
      return;
    }

    // Extract headers from the first dictionary (excluding Team and Batter which we'll handle specially)
    const headers = Object.keys(data[0]).filter(key => !['Team'].includes(key));

    // Build HTML table
    let tableHTML = '<table><thead><tr>';

    // Add custom headers
    tableHTML += '<th class="position"></th>'; // Position column
    tableHTML += '<th class="logo-col"></th>'; // Logo column
    tableHTML += '<th>Player</th>'; // Player name column
    tableHTML += '<th>4s</th>'; // Sixes column
    tableHTML += '<th>R</th>'; // Runs column
    tableHTML += '<th>BF</th>'; // Balls column
    tableHTML += '<th>SR</th>'; // SR column
    tableHTML += '<th>6s</th>'; // 4s column
    tableHTML += '<th>Vs</th>'; // Against column
    tableHTML += '<th>Venue</th>'; // Venue column
    tableHTML += '</tr></thead><tbody>';

    // Add rows
    data.forEach((row, index) => {
      tableHTML += '<tr>';

      // Position number (1st column)
      tableHTML += `<td class="position">${index + 1}</td>`;

      // Team logo (2nd column)
      const teamCode = row['TeamCode'];
      const logoUrl = `/static/images/squad_logos/${teamCode === 'RR' ? 'RR1' : teamCode}.png`;
      tableHTML += `<td class="logo-col"><img src="${logoUrl}" class="team-logo" alt="${teamCode}"></td>`;

      // Remaining columns
        tableHTML += `<td class="fw-bold text-blue"><a href="/team-${encodeURIComponent(row['TeamCode'])}/squad_details/${encodeURIComponent(row['StrikerName'])}">${row['StrikerName']}</a></td>`;
        tableHTML += `<td class="fw-bold">${row['Fours']}</td>`;
        tableHTML += `<td>${row['TotalRuns']}</td>`;
        tableHTML += `<td>${row['Balls']}</td>`;
        tableHTML += `<td>${row['StrikeRate']}</td>`;
        tableHTML += `<td>${row['Sixes']}</td>`;
        tableHTML += `<td>${row['AgaintsTeamCode']}</td>`;
        tableHTML += `<td>${row['VenueName']}</td>`;

      tableHTML += '</tr>';
    });

    tableHTML += '</tbody></table>';
    container.innerHTML = tableHTML;
  }

  function mostSixesTable(data) {
    const container = document.getElementById('tableContainer');

    if (!data || data.length === 0) {
      container.innerHTML = '<p>No data available.</p>';
      return;
    }

    // Extract headers from the first dictionary (excluding Team and Batter which we'll handle specially)
    const headers = Object.keys(data[0]).filter(key => !['Team'].includes(key));

    // Build HTML table
    let tableHTML = '<table><thead><tr>';

    // Add custom headers
    tableHTML += '<th class="position"></th>'; // Position column
    tableHTML += '<th class="logo-col"></th>'; // Logo column
    tableHTML += '<th>Player</th>'; // Player name column
    tableHTML += '<th>6s</th>'; // Sixes column
    tableHTML += '<th>M</th>'; // Match column
    tableHTML += '<th>I</th>'; // Innings column
    tableHTML += '<th>R</th>'; // Runs column
    tableHTML += '<th>HS</th>'; // High Score column
    tableHTML += '<th>Avg</th>'; // Average column
    tableHTML += '<th>SR</th>'; // SR column
    tableHTML += '<th>100s</th>'; // 100s column
    tableHTML += '<th>50s</th>'; // 50s column
    tableHTML += '<th>4s</th>'; // 4s column
    tableHTML += '</tr></thead><tbody>';

    // Add rows
    data.forEach((row, index) => {
      tableHTML += '<tr>';

      // Position number (1st column)
      tableHTML += `<td class="position">${index + 1}</td>`;

      // Team logo (2nd column)
      const teamCode = row['TeamCode'];
      const logoUrl = `/static/images/squad_logos/${teamCode === 'RR' ? 'RR1' : teamCode}.png`;
      tableHTML += `<td class="logo-col"><img src="${logoUrl}" class="team-logo" alt="${teamCode}"></td>`;

      // Remaining columns
        tableHTML += `<td class="fw-bold text-blue"><a href="/team-${encodeURIComponent(row['TeamCode'])}/squad_details/${encodeURIComponent(row['StrikerName'])}">${row['StrikerName']}</a></td>`;
        tableHTML += `<td class="fw-bold">${row['Sixes']}</td>`;
        tableHTML += `<td>${row['Matches']}</td>`;
        tableHTML += `<td>${row['Innings']}</td>`;
        tableHTML += `<td>${row['TotalRuns']}</td>`;
        tableHTML += `<td>${row['HighestScore']}</td>`;
        tableHTML += `<td>${row['BattingAverage']}</td>`;
        tableHTML += `<td>${row['StrikeRate']}</td>`;
        tableHTML += `<td>${row['Centuries']}</td>`;
        tableHTML += `<td>${row['FiftyPlusRuns']}</td>`;
        tableHTML += `<td>${row['Fours']}</td>`;

      tableHTML += '</tr>';
    });

    tableHTML += '</tbody></table>';
    container.innerHTML = tableHTML;
  }

  function mostSixesInningsTable(data) {
    const container = document.getElementById('tableContainer');

    if (!data || data.length === 0) {
      container.innerHTML = '<p>No data available.</p>';
      return;
    }

    // Extract headers from the first dictionary (excluding Team and Batter which we'll handle specially)
    const headers = Object.keys(data[0]).filter(key => !['Team'].includes(key));

    // Build HTML table
    let tableHTML = '<table><thead><tr>';

    // Add custom headers
    tableHTML += '<th class="position"></th>'; // Position column
    tableHTML += '<th class="logo-col"></th>'; // Logo column
    tableHTML += '<th>Player</th>'; // Player name column
    tableHTML += '<th>6s</th>'; // Sixes column
    tableHTML += '<th>R</th>'; // Runs column
    tableHTML += '<th>BF</th>'; // Balls column
    tableHTML += '<th>SR</th>'; // SR column
    tableHTML += '<th>4s</th>'; // 4s column
    tableHTML += '<th>Vs</th>'; // Against column
    tableHTML += '<th>Venue</th>'; // Venue column
    tableHTML += '</tr></thead><tbody>';

    // Add rows
    data.forEach((row, index) => {
      tableHTML += '<tr>';

      // Position number (1st column)
      tableHTML += `<td class="position">${index + 1}</td>`;

      // Team logo (2nd column)
      const teamCode = row['TeamCode'];
      const logoUrl = `/static/images/squad_logos/${teamCode === 'RR' ? 'RR1' : teamCode}.png`;
      tableHTML += `<td class="logo-col"><img src="${logoUrl}" class="team-logo" alt="${teamCode}"></td>`;

      // Remaining columns
        tableHTML += `<td class="fw-bold text-blue"><a href="/team-${encodeURIComponent(row['TeamCode'])}/squad_details/${encodeURIComponent(row['StrikerName'])}">${row['StrikerName']}</a></td>`;
        tableHTML += `<td class="fw-bold">${row['Sixes']}</td>`;
        tableHTML += `<td>${row['TotalRuns']}</td>`;
        tableHTML += `<td>${row['Balls']}</td>`;
        tableHTML += `<td>${row['StrikeRate']}</td>`;
        tableHTML += `<td>${row['Fours']}</td>`;
        tableHTML += `<td>${row['AgaintsTeamCode']}</td>`;
        tableHTML += `<td>${row['VenueName']}</td>`;

      tableHTML += '</tr>';
    });

    tableHTML += '</tbody></table>';
    container.innerHTML = tableHTML;
  }