// Show loading spinner before fetch
const tableContainer = document.getElementById('tableContainer');
tableContainer.innerHTML = `<div id="loadingSpinner" style="text-align:center; padding:40px 0;"><span class="spinner-border" style="color: #25478A" role="status"></span><br><span style="color:#25478A; font-weight:bold;">Loading...</span></div>`;

fetch("/api/stats")
    .then(response => {
        return response.json();
    })
    .then(data => {
        const statsData = data.stats;
        console.log("Fetched stats data:", statsData['Fair Play Award']); // Debug log to check data structure
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
            mostValuablePlayersTable(statsData['Most Valuable Players']);
        }
    } else {
        // Initial table render - same approach as battingStat.html
        mostValuablePlayersTable(statsData['Most Valuable Players']);
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
        case 'Most Valuable Players':
            mostValuablePlayersTable(tableData);
            break;
        case 'Fair Play Award':
            fairPlayAwardTable(tableData);
            break;
    }
  }

  function mostValuablePlayersTable(data) {
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
    tableHTML += '<th>Pts</th>'; // Points column
	tableHTML += '<th>M</th>'; // Match column
    tableHTML += '<th>W</th>'; // Innings column
	tableHTML += '<th>Dots</th>'; // Overs column
	tableHTML += '<th>4s</th>'; // Runs column
    tableHTML += '<th>6s</th>'; // Best Bowling Inning column
	tableHTML += '<th>Catches</th>'; // Average column
    tableHTML += '<th>Run Outs</th>'; // Economy column
    tableHTML += '<th>Stumpings</th>'; // SR column
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
        tableHTML += `<td class="fw-bold text-blue"><a href="/team-${encodeURIComponent(row['TeamCode'])}/squad_details/${encodeURIComponent(row['PlayerName'])}">${row['PlayerName']}</a></td>`;
        tableHTML += `<td class="fw-bold">${row['IndexValue']}</td>`;
        tableHTML += `<td>${row['Matches']}</td>`;
        tableHTML += `<td>${row['Wickets']}</td>`;
        tableHTML += `<td>${row['DotBalls']}</td>`;
        tableHTML += `<td>${row['Fours']}</td>`;
        tableHTML += `<td>${row['Sixes']}</td>`;
        tableHTML += `<td>${row['caught']}</td>`;
        tableHTML += `<td>${row['RunOut']}</td>`;
        tableHTML += `<td>${row['Stumping']}</td>`;

      tableHTML += '</tr>';
    });

    tableHTML += '</tbody></table>';
    container.innerHTML = tableHTML;
  }

  function fairPlayAwardTable(data) {
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
    tableHTML += '<th>Team</th>'; // Team column
    tableHTML += '<th>Matches</th>'; // Match column
    tableHTML += '<th>Average</th>'; // Innings column
    tableHTML += '<th>Points</th>'; // SR column
    tableHTML += '</tr></thead><tbody>';

    // Add rows
    data.forEach((row, index) => {
      tableHTML += '<tr>';

      // Position number (1st column)
      tableHTML += `<td class="position">${index + 1}</td>`;

      // Team logo (2nd column)
      const teamCode = row['TeamName'];
      const logoUrl = `/static/images/squad_logos/${teamCode === 'RR' ? 'RR1' : teamCode}.png`;
      tableHTML += `<td class="logo-col"><img src="${logoUrl}" class="team-logo" alt="${teamCode}"></td>`;

      // Remaining columns
        tableHTML += `<td class="fw-bold text-blue">${row['TeamFullName']}</td>`;
        tableHTML += `<td>${row['No']}</td>`;
        tableHTML += `<td>${row['AvePoints']}</td>`;
        tableHTML += `<td>${row['Points']}</td>`;

      tableHTML += '</tr>';
    });

    tableHTML += '</tbody></table>';
    container.innerHTML = tableHTML;
  }