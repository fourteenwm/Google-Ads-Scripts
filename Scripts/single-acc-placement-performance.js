/**
 * Google Ads Script for Single Account: Automatic GDN Placement Performance Report (Excluding YouTube)
 *
 * This script fetches performance data (Placement Display Name, Placement Domain, Clicks, Impressions, Cost, Conversions)
 * for Automatic Google Display Network (GDN) placements from a single Google Ads account,
 * specifically EXCLUDING placements where the domain CONTAINS 'youtube.com'.
 * It writes the data to a specified Google Sheet.
 *
 * It uses AUTOMATIC_PLACEMENTS_PERFORMANCE_REPORT, querying both 'DisplayName' and 'Domain' fields.
 * No performance filter is applied (all non-YouTube GDN placements are included).
 * Date Range: Last 7 Days.
 *
 * Version: 1.14 (Removed performance filter: Impr > 10 or Clicks >= 1)
 * Author: Gemini
 */

// Configuration: Replace with your actual Spreadsheet URL
var SPREADSHEET_URL = 'YOUR_SPREADSHEET_URL_HERE';
var GDN_SHEET_NAME = 'GDN_NonYouTube_Auto_Perf';
var DATE_RANGE = 'LAST_7_DAYS';

function main() {
  Logger.log('Starting Automatic GDN (Non-YouTube) Placement Performance Report Script (v1.14 - No Perf Filter)...');

  if (SPREADSHEET_URL === 'YOUR_SPREADSHEET_URL_HERE') {
    Logger.log('ERROR: Please specify the SPREADSHEET_URL variable in the script. The script cannot continue.');
    return;
  }

  var spreadsheet = openSpreadsheet(SPREADSHEET_URL);
  if (!spreadsheet) {
    Logger.log('Failed to open or create spreadsheet. Halting script. Please check previous logs for details.');
    return;
  }

  processAutomaticGdnPlacementReport(spreadsheet, GDN_SHEET_NAME, DATE_RANGE);

  Logger.log('Automatic GDN (Non-YouTube) Placement Performance Report Script finished. Check spreadsheet: ' + SPREADSHEET_URL);
}

function openSpreadsheet(spreadsheetUrl) {
  try {
    return SpreadsheetApp.openByUrl(spreadsheetUrl);
  } catch (e) {
    Logger.log('Failed to open spreadsheet by URL: ' + spreadsheetUrl + '. Error: ' + e);
    if (spreadsheetUrl.includes("YOUR_SPREADSHEET_URL_HERE") || !spreadsheetUrl.startsWith("https://docs.google.com/spreadsheets/d/")) {
        Logger.log("Attempting to create a new spreadsheet as the URL was invalid or a placeholder.");
        var newSheet = SpreadsheetApp.create("Google Ads Auto GDN (Non-YouTube) Report"); // Updated new sheet name
        var newSheetUrl = newSheet.getUrl();
        Logger.log("New spreadsheet created: " + newSheetUrl);
        Logger.log("CRITICAL: Please update SPREADSHEET_URL variable with this new URL: " + newSheetUrl + " and re-run.");
        throw new Error("New spreadsheet created. Please update SPREADSHEET_URL (" + newSheetUrl + ") and re-run.");
    }
    Logger.log('Could not open spreadsheet and did not attempt to create a new one. Error: ' + e);
    throw e;
  }
}

function processAutomaticGdnPlacementReport(spreadsheet, sheetName, dateRange) {
  Logger.log('Fetching Automatic GDN (Non-YouTube, no performance filter) placement data for: ' + sheetName + '...');
  var sheet = spreadsheet.getSheetByName(sheetName);
  if (!sheet) {
    sheet = spreadsheet.insertSheet(sheetName);
    Logger.log('Sheet "' + sheetName + '" was not found and has been created.');
  } else {
    sheet.clearContents();
    Logger.log('Sheet "' + sheetName + '" found and cleared.');
  }

  var headers = ['Placement Display Name', 'Placement Domain', 'Clicks', 'Impressions', 'Cost', 'Conversions'];
  sheet.appendRow(headers);
  Logger.log('Headers written to ' + sheetName + ': ' + headers.join(', '));

  var rowCount = 0;
  var skippedYoutubeCount = 0;

  try {
    Logger.log('Fetching All Automatic GDN Placements (pre-YouTube filter)...');
    var automaticQuery = "SELECT DisplayName, Domain, Clicks, Impressions, Cost, Conversions " +
                         "FROM AUTOMATIC_PLACEMENTS_PERFORMANCE_REPORT " +
                         "WHERE CampaignStatus = 'ENABLED' AND AdGroupStatus = 'ENABLED' " +
                         "DURING " + dateRange;
    
    var autoReport = AdsApp.report(automaticQuery);
    var autoRows = autoReport.rows();
    while (autoRows.hasNext()) {
      var row = autoRows.next();
      var domain = row['Domain'];

      // Exclude if the domain contains youtube.com (case-insensitive)
      if (domain && domain.toLowerCase().includes('youtube.com')) {
        skippedYoutubeCount++;
        continue; // Skip this row
      }
      
      var cost = parseFloat(row['Cost']).toFixed(2);
      sheet.appendRow([
        row['DisplayName'],
        domain, 
        row['Clicks'], // Using raw string value as parsing was for filter
        row['Impressions'], // Using raw string value
        cost,
        row['Conversions']
      ]);
      rowCount++;
    }
    Logger.log('Processed ' + rowCount + ' non-YouTube GDN placements.');
    Logger.log('Skipped ' + skippedYoutubeCount + ' placements containing \'youtube.com\'.');

  } catch (e) {
    Logger.log('Error fetching Automatic GDN Placements. Query: ' + automaticQuery + '. Error: ' + e);
    sheet.appendRow(['Error fetching Automatic GDN Placements: ' + e.toString(), '', '', '', '', '']);
  }

  if (rowCount === 0) { 
    var noDataMessage = "No Automatic GDN (non-YouTube) placements found.";
    if (skippedYoutubeCount > 0) { // Only check for YouTube skips now
        noDataMessage += " (Note: " + skippedYoutubeCount + " containing \'youtube.com\' placements were excluded).";
    }
    Logger.log(noDataMessage + ' For date range: ' + dateRange);
    sheet.appendRow([noDataMessage,'','','','','']);
  }
  Logger.log('Wrote a total of ' + rowCount + ' rows of non-YouTube Automatic GDN placement data to sheet: ' + sheetName);
} 