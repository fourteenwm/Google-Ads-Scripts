/**
 * @name Single Account Location Error Detector
 * @version 1.1
 * @author Edited to remove FoundSM
 * @overview This script identifies enabled campaigns that target "United States" or "All countries and territories" and writes the findings to a Google Sheet.
 * This is for single-account use.
 * For support, please contact your administrator.
 */

function main() {
  var SPREADSHEET_URL = "https://docs.google.com/spreadsheets/d/1HpnV9OhFs0Zqp_JEhOhVPQMJIIA8OIn-S6hKtRXyaP0/edit?gid=0#gid=0";
  var SHEET_NAME = "Location Errors";
  var campaignsWithErrors = {};

  var campaignIterator = AdsApp.campaigns()
    .withCondition("Status = ENABLED")
    .get();

  Logger.log('Checking ' + campaignIterator.totalNumEntities() + ' enabled campaigns...');

  while (campaignIterator.hasNext()) {
    var campaign = campaignIterator.next();
    var campaignName = campaign.getName();

    var locationIterator = campaign.targeting().targetedLocations().get();
    var proximityIterator = campaign.targeting().targetedProximities().get();

    if (locationIterator.totalNumEntities() === 0 && proximityIterator.totalNumEntities() === 0) {
      // Campaigns with no specific location or proximity targets default to "All countries and territories"
      campaignsWithErrors[campaignName] = 'Targets "All countries and territories"';
    } else {
      while (locationIterator.hasNext()) {
        var location = locationIterator.next();
        // The criterion ID for United States is 2840.
        if (location.getId() === 2840) {
          campaignsWithErrors[campaignName] = 'Targets "United States"';
          // Found the problematic location, no need to check others for this campaign.
          break;
        }
      }
    }
  }

  var errorCount = Object.keys(campaignsWithErrors).length;

  if (errorCount > 0) {
    Logger.log('----------------------------------------');
    Logger.log('Found ' + errorCount + ' campaign(s) with location targeting errors:');
    Logger.log('----------------------------------------');

    for (var name in campaignsWithErrors) {
      Logger.log('Campaign: "' + name + '" - Issue: ' + campaignsWithErrors[name]);
    }
    Logger.log('----------------------------------------');
    Logger.log('Please review the campaigns listed above.');

  } else {
    Logger.log('----------------------------------------');
    Logger.log('No campaigns found targeting "United States" or "All countries and territories".');
    Logger.log('----------------------------------------');
  }
  
  if (SPREADSHEET_URL && SPREADSHEET_URL !== "YOUR_SPREADSHEET_URL_HERE") {
    try {
      var spreadsheet = SpreadsheetApp.openByUrl(SPREADSHEET_URL);
      var sheet = spreadsheet.getSheetByName(SHEET_NAME);

      if (sheet) {
        sheet.clear();
      } else {
        sheet = spreadsheet.insertSheet(SHEET_NAME);
      }

      sheet.appendRow(['Campaign', 'Issue']);

      if (errorCount > 0) {
        for (var name in campaignsWithErrors) {
          sheet.appendRow([name, campaignsWithErrors[name]]);
        }
      } else {
        sheet.appendRow(['No location errors found.', '']);
      }
      Logger.log('Results have been written to the Google Sheet: ' + SPREADSHEET_URL);
    } catch(e) {
      Logger.log('Could not write to spreadsheet. Please check the SPREADSHEET_URL and script permissions. Error: ' + e);
    }
  } else {
      Logger.log("SPREADSHEET_URL has not been set. Skipping export to Google Sheet.");
  }
}
