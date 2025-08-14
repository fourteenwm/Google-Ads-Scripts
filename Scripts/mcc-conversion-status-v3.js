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

  let rowIndex = 2; // Start writing from the second row.

  while (accountIterator.hasNext()) {
    const account = accountIterator.next();
    
    // Check for account cost in the last 30 days to filter out inactive accounts.
    const stats = account.getStatsFor('LAST_30_DAYS');
    if (stats.getCost() === 0) {
      continue;
    }

    MccApp.select(account);
    const accountRows = []; // Array to hold data for the current account.

    try {
      const report = AdsApp.search(getConversionQuery());
      while (report.hasNext()) {
        const row = report.next();
        // Wrap row processing in a try...catch to handle errors gracefully.
        try {
          const status = row.conversionAction.status || '';

          // Filter out REMOVED conversions
          if (status === 'REMOVED') {
            continue;
          }

          const statusLabel = getStatusLabel(status);

          accountRows.push([
            account.getName(),
            account.getCustomerId(),
            row.conversionAction.name || '',
            row.conversionAction.type || '',
            statusLabel,
            row.conversionAction.category || '',
            row.conversionAction.countingType || '',
            row.conversionAction.clickThroughLookbackWindowDays || '',
            row.conversionAction.viewThroughLookbackWindowDays || '',
          ]);
        } catch (e) {
          Logger.log(`Failed to process row for account ${account.getName()} (${account.getCustomerId()}). Error: ${e}. Row: ${JSON.stringify(row)}`);
        }
      }
    } catch (e) {
      Logger.log(`Could not retrieve report for account ${account.getName()} (${account.getCustomerId()}). Error: ${e}`);
    }

    // Write the collected rows for the current account to the sheet.
    if (accountRows.length > 0) {
      sheet.getRange(rowIndex, 1, accountRows.length, 9).setValues(accountRows);
      rowIndex += accountRows.length; // Update row index for the next account.
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
      conversion_action.view_through_lookback_window_days
    FROM
      conversion_action
  `;
}

function getSheet() {
  const spreadsheet = SpreadsheetApp.openByUrl(SPREADSHEET_URL);
  return spreadsheet.getSheetByName('MCC Conversion Status');
}

function writeHeaders(sheet) {
  sheet.getRange("A1:I1").setValues([[
    "Account Name",
    "CID",
    "Conversion Action Name",
    "Conversion Source",
    "Tracking Status (Label)",
    "Action Optimization",
    "Count Type",
    "Click-Through Window (Days)",
    "View-Through Window (Days)"
  ]]);
}

function getStatusLabel(status) {
  if (status === 'ENABLED') {
    return '✅ Active';
  }
  if (status === 'PAUSED') {
    return '⚠️ Inactive';
  }
  if (status === 'REMOVED') {
    return '❌ Deleted';
  }
  return status || ''; // Handles 'HIDDEN' and other statuses
}
