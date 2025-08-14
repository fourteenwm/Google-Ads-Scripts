/**
 * @name MCC Location Error Detector
 * @version 1.0
 * @author Cursor
 * @overview This script identifies enabled campaigns in labeled accounts that target "United States" or "All countries and territories" and writes the findings to a Google Sheet.
 * This is for MCC use.
 */

// Configuration
var SPREADSHEET_URL = "https://docs.google.com/spreadsheets/d/1HpnV9OhFs0Zqp_JEhOhVPQMJIIA8OIn-S6hKtRXyaP0/edit?gid=0#gid=0";
var ACCOUNT_LABEL = "CM - Kurt";
var SHEET_NAME = "Location Errors Report";

function main() {
  Logger.log("Starting MCC location error check for accounts with label: " + ACCOUNT_LABEL);

  if (SPREADSHEET_URL === 'YOUR_SPREADSHEET_URL_HERE' || SPREADSHEET_URL === "") {
    throw new Error('Please set a valid Google Sheet URL in the SPREADSHEET_URL variable.');
  }

  var sheet = getSheet(SPREADSHEET_URL, SHEET_NAME);
  sheet.clear();
  sheet.appendRow(["Account Name", "Campaign Name", "Issue"]);

  var accountIterator = MccApp.accounts()
    .withCondition("LabelNames CONTAINS '" + ACCOUNT_LABEL + "'")
    .get();

  var totalIssuesFound = 0;

  while (accountIterator.hasNext()) {
    var account = accountIterator.next();
    MccApp.select(account);
    var accountName = account.getName();
    var issuesInAccount = 0;
    var campaignsWithErrors = {};

    var campaignIterator = AdsApp.campaigns()
        .withCondition("Status = ENABLED")
        .get();

    Logger.log('Checking ' + campaignIterator.totalNumEntities() + ' enabled campaigns in account: ' + accountName);

    while (campaignIterator.hasNext()) {
      var campaign = campaignIterator.next();
      var campaignName = campaign.getName();

      var locationIterator = campaign.targeting().targetedLocations().get();
      var proximityIterator = campaign.targeting().targetedProximities().get();

      var targetsUS = false;
      var hasTargetedLocations = false;

      while (locationIterator.hasNext()) {
        hasTargetedLocations = true;
        var location = locationIterator.next();
        if (location.getId() === 2840) { // Criterion ID for United States
          targetsUS = true;
          break; // Found the most specific issue, no need to check further.
        }
      }

      var issueFound = false;
      if (targetsUS) {
        campaignsWithErrors[campaignName] = 'Targets "United States"';
        issueFound = true;
      } else if (!hasTargetedLocations && proximityIterator.totalNumEntities() === 0) {
        campaignsWithErrors[campaignName] = 'Targets "All countries and territories"';
        issueFound = true;
      }
      
      if (issueFound) {
        issuesInAccount++;
      }
    }

    if (issuesInAccount > 0) {
        for (var name in campaignsWithErrors) {
            sheet.appendRow([accountName, name, campaignsWithErrors[name]]);
        }
    } else {
      sheet.appendRow([accountName, "-", "No location errors found"]);
    }
    totalIssuesFound += issuesInAccount;
  }

  if (totalIssuesFound > 0) {
    Logger.log("Found " + totalIssuesFound + " campaigns with location errors. Results written to: " + SPREADSHEET_URL);
  } else {
    Logger.log("No location errors found in any labeled accounts.");
  }

  Logger.log("Script finished.");
}

function getSheet(spreadsheetUrl, sheetName) {
  try {
    var spreadsheet = SpreadsheetApp.openByUrl(spreadsheetUrl);
    var sheet = spreadsheet.getSheetByName(sheetName);
    if (!sheet) {
      sheet = spreadsheet.insertSheet(sheetName);
    }
    return sheet;
  } catch(e) {
    throw new Error("Could not open spreadsheet. Please check the SPREADSHEET_URL and script permissions. Error: " + e);
  }
}
