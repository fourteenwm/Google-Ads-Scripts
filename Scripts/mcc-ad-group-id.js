const SHEET_URL = "https://docs.google.com/spreadsheets/d/1MH3HFNOQEaV4ADVw_JsxMnpLre11WKiRzXP5UPgvfNI/";
const TAB = "AdGroup Data - Kurt";
const ACCOUNT_LABEL_1 = "CL - LC";
const ACCOUNT_LABEL_2 = "CM - Kurt";

const QUERY = `
  SELECT 
    campaign.id,
    campaign.name,
    ad_group.id,
    ad_group.name,
    ad_group.status
  FROM ad_group
  WHERE 
    campaign.status = 'ENABLED'
    AND ad_group.status = 'ENABLED'
    AND campaign.name LIKE '%Search%'
`;

function main() {
  let ss;
  
  // Handle sheet creation if no URL provided
  if (!SHEET_URL) {
    ss = SpreadsheetApp.create("Ad Group ID Report");
    let url = ss.getUrl();
    Logger.log("No SHEET_URL found, so this sheet was created: " + url);
  } else {
    ss = SpreadsheetApp.openByUrl(SHEET_URL);
  }
  
  let sheet = getSheet(ss, TAB);
  sheet.clear();
  
  // Set up headers
  const headers = ["Account", "CID", "Campaign", "Ad Group", "Campaign ID"];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  
  let allData = [];
  
  // Get accounts with BOTH labels
  let accountSelector = MccApp.accounts()
    .withCondition("LabelNames CONTAINS '" + ACCOUNT_LABEL_1 + "'")
    .withCondition("LabelNames CONTAINS '" + ACCOUNT_LABEL_2 + "'")
    .get();
  
  while (accountSelector.hasNext()) {
    try {
      let account = accountSelector.next();
      let accountName = account.getName();
      let customerId = account.getCustomerId();
      
      // Check if account has cost > 0 in the last 30 days using the proper method
      let accountStats = account.getStatsFor("LAST_30_DAYS");
      let accountCost = accountStats.getCost();
      
      // Skip accounts with no cost in the last 30 days
      if (accountCost <= 0) {
        Logger.log("Skipping account " + accountName + " - no cost in last 30 days");
        continue;
      }
      
      // Process each labeled account
      AdsManagerApp.select(account);
      
      // Log sample row structure for debugging
      const sampleQuery = QUERY + ' LIMIT 1';
      const sampleRows = AdsApp.search(sampleQuery);
      
      if (sampleRows.hasNext()) {
        const sampleRow = sampleRows.next();
        Logger.log("Sample row structure: " + JSON.stringify(sampleRow));
        Logger.log("Campaign object: " + JSON.stringify(sampleRow.campaign));
        Logger.log("Ad Group object: " + JSON.stringify(sampleRow.adGroup));
      }
      
      let adGroupIterator = AdsApp.search(QUERY);
      
      while (adGroupIterator.hasNext()) {
        try {
          let row = adGroupIterator.next();
          
          // Access nested objects correctly
          const campaign = row.campaign || {};
          const adGroup = row.adGroup || {};
          
          let campaignName = campaign.name || 'N/A';
          let adGroupName = adGroup.name || 'N/A';
          let campaignId = campaign.id || 'N/A';
          let adGroupId = adGroup.id || 'N/A';
          
          allData.push([
            accountName,
            customerId,
            campaignName,
            adGroupName,
            campaignId
          ]);
          
        } catch (rowError) {
          Logger.log("Error processing row: " + rowError + " | Row data: " + JSON.stringify(row));
          continue;
        }
      }
      
    } catch (accountError) {
      Logger.log("Error processing account: " + accountError);
      continue;
    }
  }
  
  // Write all data to sheet in one operation
  if (allData.length > 0) {
    sheet.getRange(2, 1, allData.length, headers.length).setValues(allData);
  }
  
  Logger.log("Ad group data (only from accounts with BOTH labels, 'Search' campaigns, enabled status, and cost > 0 in the last 30 days) has been exported.");
}

// Function to get the sheet
function getSheet(spreadsheet, sheetName) {
  let sheet = spreadsheet.getSheetByName(sheetName);
  
  if (!sheet) {
    sheet = spreadsheet.insertSheet(sheetName);
  }
  
  return sheet;
}
  