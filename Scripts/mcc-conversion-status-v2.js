const SPREADSHEET_URL = 'https://docs.google.com/spreadsheets/d/1rKg0ChY-_GUlA86AtZnsC73uUd_5ISVk8TBtvKsg2yM/edit?gid=1282076014#gid=1282076014';
const REQUIRED_LABELS = ['CM - Kurt'];

function main() {
  const sheet = getSheet();
  sheet.clear();
  writeHeaders(sheet);

  const labelCondition = `LabelNames CONTAINS_ALL [${REQUIRED_LABELS.map(label => `'${label}'`).join(', ')}]`;

  const accountIterator = AdsManagerApp.accounts()
    .withCondition(labelCondition)
    .get();

  let rowIndex = 2;
  let debugLogDone = false; // Add a flag to ensure the debug log runs only once.

  while (accountIterator.hasNext()) {
    const account = accountIterator.next();
    
    // As per new requirements, get stats for each account individually and check cost.
    const stats = account.getStatsFor('LAST_30_DAYS');
    if (stats.getCost() === 0) {
      continue; // Skip accounts with no cost in the last 30 days.
    }

    MccApp.select(account);

    // According to mega.md, log a sample row for debugging.
    if (!debugLogDone) {
      const sampleQuery = getConversionQuery() + ' LIMIT 1';
      const sampleReport = AdsApp.search(sampleQuery);
      if (sampleReport.hasNext()) {
        const sampleRow = sampleReport.next();
        Logger.log('Sample row structure: ' + JSON.stringify(sampleRow, null, 2));
        if (sampleRow.metrics) {
            Logger.log("Sample metrics object: " + JSON.stringify(sampleRow.metrics, null, 2));
        }
        if (sampleRow.conversionAction) {
            Logger.log("Sample conversionAction object: " + JSON.stringify(sampleRow.conversionAction, null, 2));
        }
        debugLogDone = true;
      } else {
        Logger.log('Query returned no rows for sample check in account ' + account.getCustomerId());
      }
    }

    const report = AdsApp.search(getConversionQuery());
    while (report.hasNext()) {
      const row = report.next();
      // Per mega.md, wrap row processing in a try...catch to handle errors gracefully.
      try {
        const status = row.conversionAction.status || '';
        const conv7d = parseFloat(row.metrics.allConversions || 0);

        // ✅ Filter out REMOVED conversions
        if (status === 'REMOVED') {
          continue;
        }

        const statusLabel = getStatusLabel(status, conv7d);

        sheet.getRange(rowIndex, 1, 1, 10).setValues([[
          account.getName(),
          account.getCustomerId(),
          row.conversionAction.name || '',
          row.conversionAction.type || '',
          statusLabel,
          row.conversionAction.category || '',
          row.conversionAction.countingType || '',
          row.conversionAction.clickThroughLookbackWindowDays || '',
          row.conversionAction.viewThroughLookbackWindowDays || '',
          conv7d
        ]]);
        rowIndex++;
      } catch (e) {
        Logger.log(`Failed to process row for account ${account.getName()} (${account.getCustomerId()}). Error: ${e}. Row: ${JSON.stringify(row)}`);
      }
    }
  }
}

function getConversionQuery() {
  return `
    SELECT
      conversion_action.name,
      conversion_action.type,
      conversion_action.status,
      conversion_action.category,
      conversion_action.counting_type,
      conversion_action.click_through_lookback_window_days,
      conversion_action.view_through_lookback_window_days,
      metrics.all_conversions
    FROM
      conversion_action
    WHERE
      segments.date DURING LAST_7_DAYS
  `;
}

function getSheet() {
  const spreadsheet = SpreadsheetApp.openByUrl(SPREADSHEET_URL);
  return spreadsheet.getSheetByName('MCC Conversion Status');
}

function writeHeaders(sheet) {
  sheet.getRange("A1:J1").setValues([[
    "Account Name",
    "CID",
    "Conversion Action Name",
    "Conversion Source",
    "Tracking Status (Label)",
    "Action Optimization",
    "Count Type",
    "Click-Through Window (Days)",
    "View-Through Window (Days)",
    "Conversions (Last 7d)" // ✅ updated header
  ]]);
}

function getStatusLabel(status, conv7d) {
  if (status === 'ENABLED' && conv7d > 0) {
    return '✅ Active';
  }
  if (status === 'ENABLED' && conv7d === 0) {
    return '⚠️ Needs Attention';
  }
  if (status === 'PAUSED') {
    return '⚠️ Inactive';
  }
  if (status === 'REMOVED') {
    return '❌ Deleted';
  }
  return status || '';
}
