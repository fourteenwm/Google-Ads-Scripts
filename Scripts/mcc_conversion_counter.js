// MCC Script to retrieve conversion action counts for the last 30 days from labeled accounts
// and write to a Google Sheet, writing data per account.

// Replace with your Spreadsheet URL. If left as "YOUR_SPREADSHEET_URL" or empty, a new sheet will be created.
const SPREADSHEET_URL = "YOUR_SPREADSHEET_URL";
const SHEET_NAME = "MCC_ConversionCounts_PerAccount"; // Sheet name updated
const ACCOUNT_LABEL = "cm-kurt"; // Case-sensitive label

function main() {
  let spreadsheet;
  try {
    if (SPREADSHEET_URL && SPREADSHEET_URL !== "YOUR_SPREADSHEET_URL") {
      spreadsheet = SpreadsheetApp.openByUrl(SPREADSHEET_URL);
    } else {
      spreadsheet = SpreadsheetApp.create("MCC Google Ads Conversion Counts Report (Per Account)");
      Logger.log("New spreadsheet created. URL: " + spreadsheet.getUrl());
      Logger.log("Please update SPREADSHEET_URL in the script with this new URL for future runs if you want to use the same sheet.");
    }
  } catch (e) {
    Logger.log("Error opening or creating spreadsheet: " + e);
    return;
  }

  let sheet = spreadsheet.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = spreadsheet.insertSheet(SHEET_NAME);
  } else {
    sheet.clearContents(); // Clear existing data
  }

  const headers = ["Account Name", "Conversion Action Name", "Conversion Source", "All Conversions"];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]); // Write headers once
  let firstAccountProcessed = false; // Flag to log sample row only for the first account

  const query =
    'SELECT ' +
    'conversion_action.name, ' +
    'conversion_action.type, ' +
    'metrics.all_conversions ' +
    'FROM conversion_action ' +
    'WHERE segments.date DURING LAST_30_DAYS ' +
    'ORDER BY metrics.all_conversions DESC';

  Logger.log("Processing accounts with label: '" + ACCOUNT_LABEL + "'");
  Logger.log("Base GAQL Query for each account: " + query);

  const accountSelector = MccApp.accounts()
    .withCondition("LabelNames CONTAINS '" + ACCOUNT_LABEL + "'")
    .get();

  if (!accountSelector.hasNext()) {
    Logger.log("No accounts found with the label: '" + ACCOUNT_LABEL + "'.");
    // Append a message below headers if no accounts are found
    sheet.getRange(sheet.getLastRow() + 1, 1, 1, headers.length).setValues([["No accounts found with the label: '" + ACCOUNT_LABEL + "'.", "", "", ""]]);
    return;
  }

  let totalRowsWrittenAcrossAccounts = 0;

  while (accountSelector.hasNext()) {
    const account = accountSelector.next();
    const accountName = account.getName();
    Logger.log("Processing account: " + accountName + " (ID: " + account.getCustomerId() + ")");

    MccApp.select(account); // Switch to the context of the current account
    const currentAccountDataRows = []; // To store rows for the current account

    try {
      if (!firstAccountProcessed) {
        const sampleQuery = query + ' LIMIT 1';
        const sampleReport = AdsApp.search(sampleQuery);
        if (sampleReport.hasNext()) {
          const sampleRow = sampleReport.next();
          Logger.log("Sample row structure for account " + accountName + ": " + JSON.stringify(sampleRow));
          if (sampleRow.conversionAction) Logger.log("Sample conversionAction object: " + JSON.stringify(sampleRow.conversionAction));
          if (sampleRow.metrics) Logger.log("Sample metrics object: " + JSON.stringify(sampleRow.metrics));
        } else {
          Logger.log("Sample query returned no rows for account " + accountName + ".");
        }
        firstAccountProcessed = true;
      }

      const report = AdsApp.search(query);
      let rowsProcessedForThisAccount = 0;

      while (report.hasNext()) {
        try {
          const row = report.next();
          const conversionName = row.conversionAction ? row.conversionAction.name : "N/A (Unknown Conversion Action)";
          const conversionSource = row.conversionAction ? row.conversionAction.type : "N/A";
          const conversions = row.metrics ? Number(row.metrics.allConversions) : 0;
          currentAccountDataRows.push([accountName, conversionName, conversionSource, conversions]);
          rowsProcessedForThisAccount++;
        } catch (e) {
          Logger.log("Error processing a row for account " + accountName + ": " + e + " | Row data: " + JSON.stringify(row || {}));
          currentAccountDataRows.push([accountName, "Error processing row", e.toString(), ""]);
        }
      }
      Logger.log(rowsProcessedForThisAccount + " conversion actions processed for account: " + accountName);

      if (currentAccountDataRows.length > 0) {
        sheet.getRange(sheet.getLastRow() + 1, 1, currentAccountDataRows.length, headers.length).setValues(currentAccountDataRows);
        totalRowsWrittenAcrossAccounts += currentAccountDataRows.length;
        Logger.log("Wrote " + currentAccountDataRows.length + " rows for account " + accountName);
      } else if (rowsProcessedForThisAccount === 0 && !report.hasNext()) {
        // No errors during row processing, but no actual conversion data rows found for this account
        const noDataMsg = [accountName, "No conversion data found for this account", "", ""];
        sheet.getRange(sheet.getLastRow() + 1, 1, 1, headers.length).setValues([noDataMsg]);
        totalRowsWrittenAcrossAccounts += 1;
        Logger.log("No conversion data found for account " + accountName + ". Wrote status to sheet.");
      }

    } catch (e) {
      Logger.log("Failed to execute GAQL query or process results for account " + accountName + ": " + e);
      const errorMsg = [accountName, "Error fetching/processing data for this account", e.toString(), ""];
      sheet.getRange(sheet.getLastRow() + 1, 1, 1, headers.length).setValues([errorMsg]);
      totalRowsWrittenAcrossAccounts += 1;
    }
  } // end while (accountSelector.hasNext())

  if (totalRowsWrittenAcrossAccounts > 0) {
    Logger.log(totalRowsWrittenAcrossAccounts + " total rows of data/status messages written to spreadsheet: " + spreadsheet.getUrl() + " Sheet: " + SHEET_NAME);
  } else {
    // This case implies no accounts were processed or other issues before account loop.
    // The initial "No accounts found" check should cover most of this.
    Logger.log("No data or status messages were written to the sheet beyond headers. Check logs.");
  }
  Logger.log("MCC Conversion Counts script (per-account writing) finished.");
} 