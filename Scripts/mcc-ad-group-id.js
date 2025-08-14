function main() {
    var SPREADSHEET_URL = "https://docs.google.com/spreadsheets/d/1MH3HFNOQEaV4ADVw_JsxMnpLre11WKiRzXP5UPgvfNI/"; // Replace with your Google Sheets URL
    var SHEET_NAME = "AdGroup Data - Rachel"; // Name of the sheet where data will be stored
    var ACCOUNT_LABEL_1 = "CL - LC"; // First label
    var ACCOUNT_LABEL_2 = "CM - Rachel"; // Second label
  
    var sheet = getSheet(SPREADSHEET_URL, SHEET_NAME);
    sheet.clear(); // Clear previous data
  
    // Set up headers
    sheet.appendRow(["Account", "CID", "Campaign", "Ad Group", "Campaign ID"]);
  
    // Get accounts with BOTH labels
    var accountSelector = MccApp.accounts()
      .withCondition("LabelNames CONTAINS '" + ACCOUNT_LABEL_1 + "'")
      .withCondition("LabelNames CONTAINS '" + ACCOUNT_LABEL_2 + "'")
      .forDateRange("LAST_30_DAYS")
      .withCondition("Cost > 0")
      .get();
  
    while (accountSelector.hasNext()) {
      var account = accountSelector.next();
      var accountName = account.getName();
      var customerId = account.getCustomerId();
  
      // Process each labeled account
      AdsManagerApp.select(account);
      
      var query = `
        SELECT CampaignId, CampaignName, AdGroupId, AdGroupName 
        FROM ADGROUP_PERFORMANCE_REPORT
        WHERE CampaignStatus = 'ENABLED'
        AND AdGroupStatus = 'ENABLED'
        AND CampaignName CONTAINS 'Search'
      `;
  
      var adGroupIterator = AdsApp.report(query).rows();
  
      while (adGroupIterator.hasNext()) {
        var row = adGroupIterator.next();
        
        sheet.appendRow([
          accountName,
          customerId,
          row["CampaignName"],
          row["AdGroupName"],
          row["CampaignId"]
        ]);
      }
    }
  
    Logger.log("Ad group data (only from accounts with BOTH labels, 'Search' campaigns, enabled status, and cost > 0 in the last 30 days) has been exported.");
  }
  
  // Function to get the sheet
  function getSheet(spreadsheetUrl, sheetName) {
    var spreadsheet = SpreadsheetApp.openByUrl(spreadsheetUrl);
    var sheet = spreadsheet.getSheetByName(sheetName);
    
    if (!sheet) {
      sheet = spreadsheet.insertSheet(sheetName);
    }
    
    return sheet;
  }
  