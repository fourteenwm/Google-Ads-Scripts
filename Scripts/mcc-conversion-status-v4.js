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
    
    const stats = account.getStatsFor('LAST_30_DAYS');
    if (stats.getCost() === 0) {
      continue;
    }

    MccApp.select(account);
    const conversionActions = {}; // Object to store aggregated conversion data.

    try {
      const report = AdsApp.search(getConversionQuery());
      while (report.hasNext()) {
        const row = report.next();
        const resourceName = row.conversionAction.resourceName;
        const conversions = row.metrics.allConversions || 0;

        if (!conversionActions[resourceName]) {
          // First time seeing this conversion action, store its details.
          conversionActions[resourceName] = {
            details: row.conversionAction,
            totalConversions: 0
          };
        }
        // Add conversions from the current day's segment.
        conversionActions[resourceName].totalConversions += conversions;
      }
    } catch (e) {
      Logger.log(`Could not retrieve report for account ${account.getName()} (${account.getCustomerId()}). Error: ${e}`);
    }

    const accountRows = [];
    for (const resourceName in conversionActions) {
      const actionData = conversionActions[resourceName];
      const details = actionData.details;
      const totalConversions = actionData.totalConversions;
      const status = details.status || '';

      if (status === 'REMOVED') {
        continue;
      }
      
      const statusLabel = getStatusLabel(status, totalConversions);

      accountRows.push([
        account.getName(),
        account.getCustomerId(),
        details.name || '',
        details.type || '',
        statusLabel,
        details.category || '',
        details.countingType || '',
        details.clickThroughLookbackWindowDays || '',
        details.viewThroughLookbackWindowDays || '',
        totalConversions
      ]);
    }

    if (accountRows.length > 0) {
      sheet.getRange(rowIndex, 1, accountRows.length, 10).setValues(accountRows);
      rowIndex += accountRows.length;
    }
  }
}

function getConversionQuery() {
  return `
    SELECT
      conversion_action.resource_name,
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
      segments.date DURING LAST_14_DAYS
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
    "Conversions (Last 14d)"
  ]]);
}

function getStatusLabel(status, conv14d) {
  if (status === 'ENABLED' && conv14d > 0) {
    return '✅ Active';
  }
  if (status === 'ENABLED' && conv14d === 0) {
    return '⚠️ Needs Attention';
  }
  if (status === 'PAUSED') {
    return '⚠️ Inactive';
  }
  if (status === 'REMOVED') {
    return '❌ Deleted';
  }
  return status || ''; // Handles 'HIDDEN' and other statuses
}
