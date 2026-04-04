// Show loading spinner before fetch
const tableContainer = document.getElementById('tableContainer');
tableContainer.innerHTML = `<div id="loadingSpinner" style="text-align:center; padding:40px 0;"><span class="spinner-border" style="color: #25478A" role="status"></span><br><span style="color:#25478A; font-weight:bold;">Loading...</span></div>`;

fetch("/api/stats")
    .then(response => {
        return response.json();
    })
    .then(data => {
        const statsData = data.stats;
        console.log("Fetched stats data:", statsData['Best Bowling Figures']); // Debug log to check data structure
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
            mostWicketsTable(statsData['Most Wickets']);
        }
    } else {
        // Initial table render - same approach as battingStat.html
        mostWicketsTable(statsData['Most Wickets']);
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
        case 'Most Wickets':
            mostWicketsTable(tableData);
            break;
        case 'Most Maidens':
            mostMaidensTable(tableData);
            break;
        case 'Most Dot Balls':
            mostDotBallsTable(tableData);
            break;
        case 'Most Dot Balls (Innings)':
            mostDotBallsInningsTable(tableData);
            break;
        case 'Best Bowling Averages':
            bestBowlingAveragesTable(tableData);
            break;
        case 'Best Bowling Economy':
            bestBowlingEconomyTable(tableData);
            break;
        case 'Best Bowling Economy (Innings)':
            bestBowlingEconomyInningsTable(tableData);
            break;
        case 'Best Bowling Strike Rate':
            bestBowlingStrikeRateTable(tableData);
            break;
        case 'Best Bowling Strike Rate (Innings)':
            bestBowlingStrikeRateInningsTable(tableData);
            break;
        case 'Best Bowling Figures':
            bestBowlingFiguresTable(tableData);
            break;
        case 'Most Runs Conceded (Innings)':
            mostRunsConcededInningsTable(tableData);
            break;
        case 'Most Hat-tricks':
            mostHatTricksTable(tableData);
            break;
    }
  }

  function mostWicketsTable(data) {
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
    tableHTML += '<th>W</th>'; // Wickets column
	  tableHTML += '<th>M</th>'; // Match column
    tableHTML += '<th>I</th>'; // Innings column
	  tableHTML += '<th>O</th>'; // Overs column
	  tableHTML += '<th>R</th>'; // Runs column
    tableHTML += '<th>BBI</th>'; // Best Bowling Inning column
	  tableHTML += '<th>Avg</th>'; // Average column
    tableHTML += '<th>Eco</th>'; // Economy column
    tableHTML += '<th>SR</th>'; // SR column
    tableHTML += '<th>4W</th>'; // 4 Wickets column
    tableHTML += '<th>5W</th>'; // 5 Wickets column
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
        tableHTML += `<td class="fw-bold text-blue"><a href="/team-${encodeURIComponent(row['TeamCode'])}/squad_details/${encodeURIComponent(row['BowlerName'])}">${row['BowlerName']}</a></td>`;
        tableHTML += `<td class="fw-bold">${row['Wickets']}</td>`;
        tableHTML += `<td>${row['Matches']}</td>`;
        tableHTML += `<td>${row['Innings']}</td>`;
        tableHTML += `<td>${row['OversBowled']}</td>`;
        tableHTML += `<td>${row['TotalRunsConceded']}</td>`;
        tableHTML += `<td>${row['BBIW']}</td>`;
        tableHTML += `<td>${row['BowlingAverage']}</td>`;
        tableHTML += `<td>${row['EconomyRate']}</td>`;
        tableHTML += `<td>${row['BowlingSR']}</td>`;
        tableHTML += `<td>${row['FourWickets']}</td>`;
        tableHTML += `<td>${row['FiveWickets']}</td>`;

      tableHTML += '</tr>';
    });

    tableHTML += '</tbody></table>';
    container.innerHTML = tableHTML;
  }

  function mostMaidensTable(data) {
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
    tableHTML += '<th>Mdns</th>'; // Maidens column
    tableHTML += '<th>M</th>'; // Match column
    tableHTML += '<th>I</th>'; // Innings column
	  tableHTML += '<th>O</th>'; // Overs column
	  tableHTML += '<th>R</th>'; // Runs column
    tableHTML += '<th>W</th>'; // Best Bowling Inning column
	  tableHTML += '<th>Avg</th>'; // Average column
    tableHTML += '<th>Eco</th>'; // Economy column
    tableHTML += '<th>SR</th>'; // SR column
    tableHTML += '<th>4W</th>'; // 4 Wickets column
    tableHTML += '<th>5W</th>'; // 5 Wickets column
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
        tableHTML += `<td class="fw-bold text-blue"><a href="/team-${encodeURIComponent(row['TeamCode'])}/squad_details/${encodeURIComponent(row['BowlerName'])}">${row['BowlerName']}</a></td>`;
        tableHTML += `<td class="fw-bold">${row['Maidens']}</td>`;
        tableHTML += `<td>${row['Matches']}</td>`;
        tableHTML += `<td>${row['Innings']}</td>`;
        tableHTML += `<td>${row['OversBowled']}</td>`;
        tableHTML += `<td>${row['TotalRunsConceded']}</td>`;
        tableHTML += `<td>${row['Wickets']}</td>`;
        tableHTML += `<td>${row['BowlingAverage']}</td>`;
        tableHTML += `<td>${row['EconomyRate']}</td>`;
        tableHTML += `<td>${row['BowlingSR']}</td>`;
        tableHTML += `<td>${row['FourWickets']}</td>`;
        tableHTML += `<td>${row['FiveWickets']}</td>`;

      tableHTML += '</tr>';
    });

    tableHTML += '</tbody></table>';
    container.innerHTML = tableHTML;
  }

  function mostDotBallsTable(data) {
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
    tableHTML += '<th>Dots</th>'; // Maidens column
    tableHTML += '<th>M</th>'; // Match column
    tableHTML += '<th>I</th>'; // Innings column
	  tableHTML += '<th>O</th>'; // Overs column
	  tableHTML += '<th>R</th>'; // Runs column
    tableHTML += '<th>W</th>'; // Best Bowling Inning column
	  tableHTML += '<th>Avg</th>'; // Average column
    tableHTML += '<th>Eco</th>'; // Economy column
    tableHTML += '<th>SR</th>'; // SR column
    tableHTML += '<th>4W</th>'; // 4 Wickets column
    tableHTML += '<th>5W</th>'; // 5 Wickets column
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
        tableHTML += `<td class="fw-bold text-blue"><a href="/team-${encodeURIComponent(row['TeamCode'])}/squad_details/${encodeURIComponent(row['BowlerName'])}">${row['BowlerName']}</a></td>`;
        tableHTML += `<td class="fw-bold">${row['DotBallsBowled']}</td>`;
        tableHTML += `<td>${row['Matches']}</td>`;
        tableHTML += `<td>${row['Innings']}</td>`;
        tableHTML += `<td>${row['OversBowled']}</td>`;
        tableHTML += `<td>${row['TotalRunsConceded']}</td>`;
        tableHTML += `<td>${row['Wickets']}</td>`;
        tableHTML += `<td>${row['BowlingAverage']}</td>`;
        tableHTML += `<td>${row['EconomyRate']}</td>`;
        tableHTML += `<td>${row['BowlingSR']}</td>`;
        tableHTML += `<td>${row['FourWickets']}</td>`;
        tableHTML += `<td>${row['FiveWickets']}</td>`;

      tableHTML += '</tr>';
    });

    tableHTML += '</tbody></table>';
    container.innerHTML = tableHTML;
  }

  function mostDotBallsInningsTable(data) {
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
    tableHTML += '<th>Dots</th>'; // Maidens column
	  tableHTML += '<th>O</th>'; // Overs column
	  tableHTML += '<th>R</th>'; // Runs column
    tableHTML += '<th>W</th>'; // Best Bowling Inning column
    tableHTML += '<th>SR</th>'; // SR column
    tableHTML += '<th>Vs</th>'; // 4 Wickets column
    tableHTML += '<th>Venue</th>'; // 5 Wickets column
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
        tableHTML += `<td class="fw-bold text-blue"><a href="/team-${encodeURIComponent(row['TeamCode'])}/squad_details/${encodeURIComponent(row['BowlerName'])}">${row['BowlerName']}</a></td>`;
        tableHTML += `<td class="fw-bold">${row['DotBallsBowled']}</td>`;
        tableHTML += `<td>${row['OversBowled']}</td>`;
        tableHTML += `<td>${row['InningsRuns']}</td>`;
        tableHTML += `<td>${row['InningsWickets']}</td>`;
        tableHTML += `<td>${row['BowlingSR']}</td>`;
        tableHTML += `<td>${row['AgaintsTeamCode']}</td>`;
        tableHTML += `<td>${row['VenueName']}</td>`;

      tableHTML += '</tr>';
    });

    tableHTML += '</tbody></table>';
    container.innerHTML = tableHTML;
  }

  function bestBowlingAveragesTable(data) {
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
    tableHTML += '<th>Avg</th>'; // Maidens column
    tableHTML += '<th>M</th>'; // Match column
    tableHTML += '<th>I</th>'; // Innings column
	  tableHTML += '<th>O</th>'; // Overs column
	  tableHTML += '<th>R</th>'; // Runs column
    tableHTML += '<th>W</th>'; // Best Bowling Inning column
	  tableHTML += '<th>BBI</th>'; // Average column
    tableHTML += '<th>Eco</th>'; // Economy column
    tableHTML += '<th>SR</th>'; // SR column
    tableHTML += '<th>4W</th>'; // 4 Wickets column
    tableHTML += '<th>5W</th>'; // 5 Wickets column
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
        tableHTML += `<td class="fw-bold text-blue"><a href="/team-${encodeURIComponent(row['TeamCode'])}/squad_details/${encodeURIComponent(row['BowlerName'])}">${row['BowlerName']}</a></td>`;
        tableHTML += `<td class="fw-bold">${row['BowlingAverage']}</td>`;
        tableHTML += `<td>${row['Matches']}</td>`;
        tableHTML += `<td>${row['Innings']}</td>`;
        tableHTML += `<td>${row['OversBowled']}</td>`;
        tableHTML += `<td>${row['TotalRunsConceded']}</td>`;
        tableHTML += `<td>${row['Wickets']}</td>`;
        tableHTML += `<td>${row['BBIW']}</td>`;
        tableHTML += `<td>${row['EconomyRate']}</td>`;
        tableHTML += `<td>${row['BowlingSR']}</td>`;
        tableHTML += `<td>${row['FourWickets']}</td>`;
        tableHTML += `<td>${row['FiveWickets']}</td>`;

      tableHTML += '</tr>';
    });

    tableHTML += '</tbody></table>';
    container.innerHTML = tableHTML;
  }

  function bestBowlingEconomyTable(data) {
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
    tableHTML += '<th>Eco</th>'; // Maidens column
    tableHTML += '<th>M</th>'; // Match column
    tableHTML += '<th>I</th>'; // Innings column
	  tableHTML += '<th>O</th>'; // Overs column
	  tableHTML += '<th>R</th>'; // Runs column
    tableHTML += '<th>W</th>'; // Best Bowling Inning column
	  tableHTML += '<th>BBI</th>'; // Average column
    tableHTML += '<th>Avg</th>'; // Economy column
    tableHTML += '<th>SR</th>'; // SR column
    tableHTML += '<th>4W</th>'; // 4 Wickets column
    tableHTML += '<th>5W</th>'; // 5 Wickets column
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
        tableHTML += `<td class="fw-bold text-blue"><a href="/team-${encodeURIComponent(row['TeamCode'])}/squad_details/${encodeURIComponent(row['BowlerName'])}">${row['BowlerName']}</a></td>`;
        tableHTML += `<td class="fw-bold">${row['EconomyRate']}</td>`;
        tableHTML += `<td>${row['Matches']}</td>`;
        tableHTML += `<td>${row['Innings']}</td>`;
        tableHTML += `<td>${row['OversBowled']}</td>`;
        tableHTML += `<td>${row['TotalRunsConceded']}</td>`;
        tableHTML += `<td>${row['Wickets']}</td>`;
        tableHTML += `<td>${row['BBIW']}</td>`;
        tableHTML += `<td>${row['BowlingAverage']}</td>`;
        tableHTML += `<td>${row['BowlingSR']}</td>`;
        tableHTML += `<td>${row['FourWickets']}</td>`;
        tableHTML += `<td>${row['FiveWickets']}</td>`;

      tableHTML += '</tr>';
    });

    tableHTML += '</tbody></table>';
    container.innerHTML = tableHTML;
  }

  function bestBowlingEconomyInningsTable(data) {
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
    tableHTML += '<th>Eco</th>'; // Maidens column
	  tableHTML += '<th>O</th>'; // Overs column
	  tableHTML += '<th>R</th>'; // Runs column
    tableHTML += '<th>W</th>'; // Best Bowling Inning column
    tableHTML += '<th>SR</th>'; // SR column
    tableHTML += '<th>Vs</th>'; // 4 Wickets column
    tableHTML += '<th>Venue</th>'; // 5 Wickets column
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
        tableHTML += `<td class="fw-bold text-blue"><a href="/team-${encodeURIComponent(row['TeamCode'])}/squad_details/${encodeURIComponent(row['BowlerName'])}">${row['BowlerName']}</a></td>`;
        tableHTML += `<td class="fw-bold">${row['EconomyRate']}</td>`;
        tableHTML += `<td>${row['OversBowled']}</td>`;
        tableHTML += `<td>${row['InningsRuns']}</td>`;
        tableHTML += `<td>${row['InningsWickets']}</td>`;
        tableHTML += `<td>${row['BowlingSR']}</td>`;
        tableHTML += `<td>${row['AgaintsTeamCode']}</td>`;
        tableHTML += `<td>${row['VenueName']}</td>`;

      tableHTML += '</tr>';
    });

    tableHTML += '</tbody></table>';
    container.innerHTML = tableHTML;
  }


  function bestBowlingStrikeRateTable(data) {
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
    tableHTML += '<th>SR</th>'; // Maidens column
    tableHTML += '<th>M</th>'; // Match column
    tableHTML += '<th>I</th>'; // Innings column
	  tableHTML += '<th>O</th>'; // Overs column
	  tableHTML += '<th>R</th>'; // Runs column
    tableHTML += '<th>W</th>'; // Best Bowling Inning column
	  tableHTML += '<th>BBI</th>'; // Average column
    tableHTML += '<th>Avg</th>'; // Economy column
    tableHTML += '<th>4W</th>'; // 4 Wickets column
    tableHTML += '<th>5W</th>'; // 5 Wickets column
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
        tableHTML += `<td class="fw-bold text-blue"><a href="/team-${encodeURIComponent(row['TeamCode'])}/squad_details/${encodeURIComponent(row['BowlerName'])}">${row['BowlerName']}</a></td>`;
        tableHTML += `<td class="fw-bold">${row['BowlingSR']}</td>`;
        tableHTML += `<td>${row['Matches']}</td>`;
        tableHTML += `<td>${row['Innings']}</td>`;
        tableHTML += `<td>${row['OversBowled']}</td>`;
        tableHTML += `<td>${row['TotalRunsConceded']}</td>`;
        tableHTML += `<td>${row['Wickets']}</td>`;
        tableHTML += `<td>${row['BBIW']}</td>`;
        tableHTML += `<td>${row['BowlingAverage']}</td>`;
        tableHTML += `<td>${row['FourWickets']}</td>`;
        tableHTML += `<td>${row['FiveWickets']}</td>`;

      tableHTML += '</tr>';
    });

    tableHTML += '</tbody></table>';
    container.innerHTML = tableHTML;
  }

  function bestBowlingStrikeRateInningsTable(data) {
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
    tableHTML += '<th>SR</th>'; // Maidens column
	  tableHTML += '<th>O</th>'; // Overs column
	  tableHTML += '<th>R</th>'; // Runs column
    tableHTML += '<th>W</th>'; // Best Bowling Inning column
    tableHTML += '<th>Vs</th>'; // 4 Wickets column
    tableHTML += '<th>Venue</th>'; // 5 Wickets column
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
        tableHTML += `<td class="fw-bold text-blue"><a href="/team-${encodeURIComponent(row['TeamCode'])}/squad_details/${encodeURIComponent(row['BowlerName'])}">${row['BowlerName']}</a></td>`;
        tableHTML += `<td class="fw-bold">${row['BowlingSR']}</td>`;
        tableHTML += `<td>${row['OversBowled']}</td>`;
        tableHTML += `<td>${row['InningsRuns']}</td>`;
        tableHTML += `<td>${row['InningsWickets']}</td>`;
        tableHTML += `<td>${row['AgaintsTeamCode']}</td>`;
        tableHTML += `<td>${row['VenueName']}</td>`;

      tableHTML += '</tr>';
    });

    tableHTML += '</tbody></table>';
    container.innerHTML = tableHTML;
  }

  function bestBowlingFiguresTable(data) {
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
    tableHTML += '<th>BBI</th>'; // Best Bowling Inning column
	  tableHTML += '<th>O</th>'; // Overs column
	  tableHTML += '<th>R</th>'; // Runs column
    tableHTML += '<th>W</th>'; // Best Bowling Inning column
    tableHTML += '<th>SR</th>'; // SR column
    tableHTML += '<th>Vs</th>'; // 4 Wickets column
    tableHTML += '<th>Venue</th>'; // 5 Wickets column
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
        tableHTML += `<td class="fw-bold text-blue"><a href="/team-${encodeURIComponent(row['TeamCode'])}/squad_details/${encodeURIComponent(row['BowlerName'])}">${row['BowlerName']}</a></td>`;
        tableHTML += `<td class="fw-bold">${row['BBIW']}</td>`;
        tableHTML += `<td>${row['OversBowled']}</td>`;
        tableHTML += `<td>${row['InningsRuns']}</td>`;
        tableHTML += `<td>${row['InningsWickets']}</td>`;
        tableHTML += `<td>${row['StrikeRate']}</td>`;
        tableHTML += `<td>${row['AgaintsTeamCode']}</td>`;
        tableHTML += `<td>${row['VenueName']}</td>`;

      tableHTML += '</tr>';
    });

    tableHTML += '</tbody></table>';
    container.innerHTML = tableHTML;
  }

  function mostRunsConcededInningsTable(data) {
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
    tableHTML += '<th>R</th>'; // Best Bowling Inning column
	  tableHTML += '<th>O</th>'; // Overs column
    tableHTML += '<th>W</th>'; // Best Bowling Inning column
    tableHTML += '<th>SR</th>'; // SR column
    tableHTML += '<th>Vs</th>'; // 4 Wickets column
    tableHTML += '<th>Venue</th>'; // 5 Wickets column
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
        tableHTML += `<td class="fw-bold text-blue"><a href="/team-${encodeURIComponent(row['TeamCode'])}/squad_details/${encodeURIComponent(row['BowlerName'])}">${row['BowlerName']}</a></td>`;
        tableHTML += `<td class="fw-bold">${row['InningsRuns']}</td>`;
        tableHTML += `<td>${row['OversBowled']}</td>`;
        tableHTML += `<td>${row['InningsWickets']}</td>`;
        tableHTML += `<td>${row['StrikeRate']}</td>`;
        tableHTML += `<td>${row['AgaintsTeamCode']}</td>`;
        tableHTML += `<td>${row['VenueName']}</td>`;

      tableHTML += '</tr>';
    });

    tableHTML += '</tbody></table>';
    container.innerHTML = tableHTML;
  }

  function mostHatTricksTable(data) {
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
    tableHTML += '<th>Hat-tricks</th>'; // Hat-tricks column
    tableHTML += '<th>M</th>'; // Match column
    tableHTML += '<th>I</th>'; // Innings column
	  tableHTML += '<th>O</th>'; // Overs column
	  tableHTML += '<th>R</th>'; // Runs column
    tableHTML += '<th>W</th>'; // Best Bowling Inning column
	  tableHTML += '<th>Avg</th>'; // Average column
    tableHTML += '<th>Eco</th>'; // Economy column
    tableHTML += '<th>SR</th>'; // SR column
    tableHTML += '<th>4W</th>'; // 4 Wickets column
    tableHTML += '<th>5W</th>'; // 5 Wickets column
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
        tableHTML += `<td class="fw-bold text-blue"><a href="/team-${encodeURIComponent(row['TeamCode'])}/squad_details/${encodeURIComponent(row['BowlerName'])}">${row['BowlerName']}</a></td>`;
        tableHTML += `<td class="fw-bold">${row['Hattricks']}</td>`;
        tableHTML += `<td>${row['Matches']}</td>`;
        tableHTML += `<td>${row['Innings']}</td>`;
        tableHTML += `<td>${row['OversBowled']}</td>`;
        tableHTML += `<td>${row['TotalRunsConceded']}</td>`;
        tableHTML += `<td>${row['Wickets']}</td>`;
        tableHTML += `<td>${row['BowlingAverage']}</td>`;
        tableHTML += `<td>${row['EconomyRate']}</td>`;
        tableHTML += `<td>${row['BowlingSR']}</td>`;
        tableHTML += `<td>${row['FourWickets']}</td>`;
        tableHTML += `<td>${row['FiveWickets']}</td>`;

      tableHTML += '</tr>';
    });

    tableHTML += '</tbody></table>';
    container.innerHTML = tableHTML;
  }