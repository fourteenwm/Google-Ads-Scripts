/**
 * @name Single Account Campaign End Date Checker
 * @description This script checks for all active and paused campaigns in a single account that do not have an end date set, and writes the results to a Google Sheet.
 * @author Cursor
 * @version 1.1
 */

// URL of the Google Sheet for logging results.
// IMPORTANT: Make sure this URL points to a valid Google Sheet you have access to.
var SPREADSHEET_URL = 'YOUR_SPREADSHEET_URL_HERE'; 

function main() {
  Logger.log("Starting campaign end date check...");

  if (SPREADSHEET_URL === 'YOUR_SPREADSHEET_URL_HERE') {
    throw new Error('Please replace "YOUR_SPREADSHEET_URL_HERE" with a valid Google Sheet URL.');
  }

  var spreadsheet = SpreadsheetApp.openByUrl(SPREADSHEET_URL);
  // Using a sheet named "Report", creating it if it doesn't exist.
  var sheet = spreadsheet.getSheetByName("Report");
  if (!sheet) {
    sheet = spreadsheet.insertSheet("Report");
  }
  sheet.clear();
  // Set headers for the report
  sheet.appendRow(["Campaign Name", "Status"]);


  // Select all enabled and paused campaigns
  var campaignIterator = AdsApp.campaigns()
      .withCondition("Status IN ['ENABLED', 'PAUSED']")
      .get();

  var campaignsWithoutEndDate = [];

  // Iterate through all campaigns
  while (campaignIterator.hasNext()) {
    var campaign = campaignIterator.next();
    var endDate = campaign.getEndDate();

    // Check if the end date is not set (is null)
    if (!endDate) {
      campaignsWithoutEndDate.push(campaign.getName());
    }
  }

  // Log the results and write to the spreadsheet
  if (campaignsWithoutEndDate.length > 0) {
    Logger.log("The following campaigns do not have an end date:");
    var campaignList = campaignsWithoutEndDate.join('\n - ');
    Logger.log(' - ' + campaignList);

    // Write each campaign name to the sheet
    for (var i = 0; i < campaignsWithoutEndDate.length; i++) {
        sheet.appendRow([campaignsWithoutEndDate[i], "No End Date"]);
    }
    Logger.log("Results also written to: " + SPREADSHEET_URL);
  } else {
    var message = "All active and paused campaigns have an end date assigned.";
    Logger.log(message);
    sheet.appendRow(["-", message]);
  }

  Logger.log("Script finished.");
}
