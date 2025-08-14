/**
 * MCC Script: Automatic GDN Placement Performance Report (Excluding YouTube)
 *
 * This script fetches performance data (Account Name, CID, Placement Display Name, Placement Domain, Clicks, Impressions, Cost, Conversions)
 * for Automatic Google Display Network (GDN) placements from all accounts under the MCC
 * that have the specified label.
 * It specifically EXCLUDES placements where the domain CONTAINS 'youtube.com'.
 * Data is written to a single Google Sheet, with an Account Name and CID column.
 * Data for each account is written before processing the next account.
 *
 * It uses AUTOMATIC_PLACEMENTS_PERFORMANCE_REPORT, querying both 'DisplayName' and 'Domain' fields.
 * No performance filter is applied (all non-YouTube GDN placements from labeled accounts are included).
 * Date Range: Last 7 Days.
 *
 * Version: 1.1 (Added CID column, confirmed per-account writing)
 * Based on single-acc-placement-performance.js v1.14 logic
 * Referenced mcc_conversion_counter.js for MCC structure
 */

// Configuration
const SPREADSHEET_URL = "YOUR_SPREADSHEET_URL_HERE"; // Replace with your Spreadsheet URL. If placeholder, a new sheet is created.
const SHEET_NAME = "MCC_GDN_NonYouTube_Perf";
const ACCOUNT_LABEL = "CM - Kurt"; // Case-sensitive label for accounts to process
const DATE_RANGE = "LAST_7_DAYS";

function main() {
  Logger.log('Starting MCC GDN (Non-YouTube) Placement Performance Report Script (v1.1)...');

  let spreadsheet;
  try {
    if (SPREADSHEET_URL && SPREADSHEET_URL.toUpperCase() !== "YOUR_SPREADSHEET_URL_HERE" && SPREADSHEET_URL.startsWith("https://docs.google.com/spreadsheets/d/")) {
      spreadsheet = SpreadsheetApp.openByUrl(SPREADSHEET_URL);
    } else {
      spreadsheet = SpreadsheetApp.create("MCC - GDN (Non-YouTube) Placement Performance Report");
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

  const headers = ["Account Name", "CID", "Placement Display Name", "Placement Domain", "Clicks", "Impressions", "Cost", "Conversions"];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  let totalRowsWrittenAcrossAccounts = 0;

  Logger.log("Processing accounts with label: '" + ACCOUNT_LABEL + "' for date range: " + DATE_RANGE);

  const accountSelector = MccApp.accounts()
    .withCondition("LabelNames CONTAINS '" + ACCOUNT_LABEL + "'")
    .get();

  if (!accountSelector.hasNext()) {
    Logger.log("No accounts found with the label: '" + ACCOUNT_LABEL + "'.");
    sheet.getRange(sheet.getLastRow() + 1, 1, 1, headers.length).setValues([["No accounts found with label: '" + ACCOUNT_LABEL + "'.", "", "", "", "", "", "", ""]]);
    return;
  }

  while (accountSelector.hasNext()) {
    const account = accountSelector.next();
    const accountName = account.getName() || "Unnamed Account";
    const customerId = account.getCustomerId();
    Logger.log("Processing account: " + accountName + " (ID: " + customerId + ")");

    MccApp.select(account); // Switch to the context of the current account
    
    const accountPlacementData = getPlacementDataForCurrentAccount(DATE_RANGE);
    const placementRows = accountPlacementData.rows;
    const skippedYoutubeCount = accountPlacementData.skippedYoutube;

    if (placementRows.length > 0) {
      const rowsToWrite = placementRows.map(function(row) {
        return [accountName, customerId].concat(row);
      });
      sheet.getRange(sheet.getLastRow() + 1, 1, rowsToWrite.length, headers.length).setValues(rowsToWrite);
      totalRowsWrittenAcrossAccounts += rowsToWrite.length;
      Logger.log("Wrote " + rowsToWrite.length + " placement rows for account " + accountName + ". Skipped " + skippedYoutubeCount + " youtube.com placements.");
    } else {
      const noDataMsg = [accountName, customerId, "No non-YouTube GDN placements found for this account.", (skippedYoutubeCount > 0 ? "(Skipped " + skippedYoutubeCount + " youtube.com)" : ""), "", "", "", ""];
      sheet.getRange(sheet.getLastRow() + 1, 1, 1, headers.length).setValues([noDataMsg]);
      totalRowsWrittenAcrossAccounts += 1;
      Logger.log("No non-YouTube GDN placements found for account " + accountName + ". Skipped " + skippedYoutubeCount + " youtube.com placements. Wrote status to sheet.");
    }
  } // end while (accountSelector.hasNext())

  if (totalRowsWrittenAcrossAccounts > 0) {
    Logger.log(totalRowsWrittenAcrossAccounts + " total rows of data/status messages written to spreadsheet: " + spreadsheet.getUrl() + " Sheet: " + SHEET_NAME);
  } else {
    Logger.log("No data or status messages were written to the sheet beyond headers (excluding the 'no accounts found' message). Check logs.");
  }
  Logger.log("MCC GDN (Non-YouTube) Placement Performance Report Script finished.");
}

/**
 * Fetches and filters placement data for the currently selected Google Ads account.
 * Excludes placements where the domain contains 'youtube.com'.
 * @param {string} dateRange The date range string (e.g., 'LAST_7_DAYS').
 * @return {{rows: Array<Array<string>>, skippedYoutube: number}} An object containing an array of data rows and count of skipped YouTube placements.
 */
function getPlacementDataForCurrentAccount(dateRange) {
  const dataRows = [];
  let skippedYoutubeCount = 0;
  Logger.log('Fetching Automatic GDN (Non-YouTube, no performance filter) placement data for current account...');

  try {
    const automaticQuery = "SELECT DisplayName, Domain, Clicks, Impressions, Cost, Conversions " +
                         "FROM AUTOMATIC_PLACEMENTS_PERFORMANCE_REPORT " +
                         "WHERE CampaignStatus = 'ENABLED' AND AdGroupStatus = 'ENABLED' " +
                         "DURING " + dateRange;
    
    const report = AdsApp.report(automaticQuery);
    const autoRows = report.rows();

    while (autoRows.hasNext()) {
      const row = autoRows.next();
      const domain = row['Domain'];

      if (domain && domain.toLowerCase().includes('youtube.com')) {
        skippedYoutubeCount++;
        continue;
      }

      const cost = parseFloat(row['Cost']).toFixed(2);
      dataRows.push([
        row['DisplayName'],
        domain, 
        row['Clicks'],
        row['Impressions'],
        cost,
        row['Conversions']
      ]);
    }
    Logger.log('For current account: Found ' + dataRows.length + ' non-YouTube GDN placements. Skipped ' + skippedYoutubeCount + ' containing youtube.com.');
  } catch (e) {
    Logger.log('Error fetching placements for current account: ' + e);
    // Optionally, could return an error indicator here if needed by the main loop
    // For now, just logs and returns empty data / current skipped count
  }
  return { rows: dataRows, skippedYoutube: skippedYoutubeCount };
} 