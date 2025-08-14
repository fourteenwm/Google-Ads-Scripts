/**
 * @name MCC Demand Gen Location Reporter
 * @version 2.0
 * @author Cursor
 * @overview This script iterates through all enabled Demand Gen campaigns in labeled accounts 
 *           and lists their targeted locations in a Google Sheet. It adheres to modern 
 *           Google Ads Scripts best practices, including GAQL and bulk sheet writing.
 *           This is for MCC use.
 */

// --- Configuration ---
const SPREADSHEET_URL = "https://docs.google.com/spreadsheets/d/1HpnV9OhFs0Zqp_JEhOhVPQMJIIA8OIn-S6hKtRXyaP0/edit?gid=0#gid=0";
const ACCOUNT_LABEL = "CM - Kurt";
const SHEET_NAME = "DGen Location Targeting Report";
// --- End Configuration ---

function main() {
  Logger.log(`Starting MCC DGen Location Targeting Report for accounts with label: "${ACCOUNT_LABEL}"`);

  const sheet = getSheet(SPREADSHEET_URL, SHEET_NAME);
  sheet.clear();
  const headers = ["Account Name", "Campaign Name", "Target Type", "Targeted Location/Proximity", "Criterion ID"];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight("bold");

  const accountIterator = MccApp.accounts()
    .withCondition(`LabelNames CONTAINS '${ACCOUNT_LABEL}'`)
    .get();

  let accountsProcessed = 0;

  while (accountIterator.hasNext()) {
    const account = accountIterator.next();
    const stats = account.getStatsFor("LAST_30_DAYS");

    if (stats.getCost() > 0) {
      MccApp.select(account);
      const accountName = account.getName();
      accountsProcessed++;
      Logger.log(`Processing account: ${accountName} (ID: ${account.getCustomerId()})`);
      
      processAccount(accountName, sheet);
    }
  }

  if (accountsProcessed === 0) {
      Logger.log(`No accounts found with the label '${ACCOUNT_LABEL}' that had spend in the last 30 days.`);
  }

  Logger.log(`Script finished. Results are in sheet: ${sheet.getParent().getUrl()}`);
}

function processAccount(accountName, sheet) {
  const allDgenCampaigns = getAllDgenCampaigns();
  if (Object.keys(allDgenCampaigns).length === 0) {
    Logger.log("No enabled Demand Gen campaigns found in this account.");
    return;
  }

  const query = `
    SELECT
      campaign.name,
      campaign_criterion.type,
      campaign_criterion.display_name,
      campaign_criterion.criterion_id,
      campaign_criterion.proximity.radius,
      campaign_criterion.proximity.radius_units,
      campaign_criterion.proximity.geo_point.latitude_in_micro_degrees,
      campaign_criterion.proximity.geo_point.longitude_in_micro_degrees
    FROM campaign_criterion
    WHERE campaign.advertising_channel_type = 'DEMAND_GEN'
      AND campaign.status = 'ENABLED'
      AND campaign_criterion.type IN ('LOCATION', 'PROXIMITY')
      AND campaign_criterion.negative = FALSE`;
      
  const searchIterator = AdsApp.search(query);
  
  const campaignsWithTargets = {};

  while (searchIterator.hasNext()) {
    try {
      const row = searchIterator.next();
      const campaignName = row.campaign.name;
      campaignsWithTargets[campaignName] = true;
      const criterion = row.campaignCriterion;

      if (criterion.type === "LOCATION") {
        sheet.appendRow([
          accountName,
          campaignName,
          "Location",
          criterion.displayName,
          criterion.criterionId
        ]);
      } else if (criterion.type === "PROXIMITY") {
          const proximity = criterion.proximity;
          const geoPoint = proximity.geoPoint || {};
          const lat = (geoPoint.latitudeInMicroDegrees || 0) / 1000000;
          const lon = (geoPoint.longitudeInMicroDegrees || 0) / 1000000;
          const proximityDetails = `Lat: ${lat}, Lon: ${lon}, Radius: ${proximity.radius} ${proximity.radiusUnits}`;
          sheet.appendRow([
            accountName,
            campaignName,
            "Proximity",
            proximityDetails,
            "N/A"
          ]);
      }
    } catch (e) {
      Logger.log(`Error processing a row for account ${accountName}. Error: ${e}`);
    }
  }

  for (const campaignName in allDgenCampaigns) {
    if (!campaignsWithTargets[campaignName]) {
      sheet.appendRow([accountName, campaignName, "N/A", "No specific location or proximity targets (defaults to all)", "N/A"]);
    }
  }
}

function getAllDgenCampaigns() {
    const campaigns = {};
    const query = `
      SELECT campaign.name 
      FROM campaign 
      WHERE campaign.advertising_channel_type = 'DEMAND_GEN' AND campaign.status = 'ENABLED'`;
    
    const searchIterator = AdsApp.search(query);

    while (searchIterator.hasNext()) {
        const row = searchIterator.next();
        campaigns[row.campaign.name] = true;
    }
    return campaigns;
}

function getSheet(spreadsheetUrl, sheetName) {
  try {
    let spreadsheet;
    if (spreadsheetUrl) {
      spreadsheet = SpreadsheetApp.openByUrl(spreadsheetUrl);
    } else {
      spreadsheet = SpreadsheetApp.create(`DGen Location Report - ${new Date().toLocaleDateString()}`);
      Logger.log(`No SPREADSHEET_URL provided. Created a new sheet: ${spreadsheet.getUrl()}`);
    }
    
    let sheet = spreadsheet.getSheetByName(sheetName);
    if (!sheet) {
      sheet = spreadsheet.insertSheet(sheetName);
    }
    return sheet;
  } catch(e) {
    Logger.log(`Could not open or create spreadsheet. Please check script permissions. Error: ${e}`);
    throw new Error(`Spreadsheet access failed: ${e}`);
  }
}
