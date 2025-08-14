// Google Ads Script: Asset Status Reporter
// Description: This script fetches the status of all assets (ad extensions) 
// in a Google Ads account and exports the data to a Google Sheet.
// Version: 1.0
// Author: AI Assistant (with reference to mega.md)

// Configuration:
// If SHEET_URL is empty, a new spreadsheet will be created, and its URL will be logged.
const SHEET_URL = ''; 
const TAB_NAME = 'Asset Status Report';

// GAQL Query to fetch asset details
const QUERY = `
  SELECT
    asset.id,
    asset.name,
    asset.type,
    customer_asset.status,
    customer.descriptive_name,
    customer.id
  FROM customer_asset
`;

function main() {
  let spreadsheet;
  if (!SHEET_URL) {
    spreadsheet = SpreadsheetApp.create("Google Ads Asset Status Report");
    Logger.log('New spreadsheet created. URL: ' + spreadsheet.getUrl());
    Logger.log('Please update SHEET_URL in the script with this URL for future runs if you want to reuse this sheet.');
  } else {
    try {
      spreadsheet = SpreadsheetApp.openByUrl(SHEET_URL);
    } catch (e) {
      Logger.log('Error opening spreadsheet by URL: ' + SHEET_URL + '. Error: ' + e);
      Logger.log('A new sheet will be created instead.');
      spreadsheet = SpreadsheetApp.create("Google Ads Asset Status Report - Fallback");
      Logger.log('New fallback spreadsheet created. URL: ' + spreadsheet.getUrl());
    }
  }

  let sheet = spreadsheet.getSheetByName(TAB_NAME);
  if (!sheet) {
    sheet = spreadsheet.insertSheet(TAB_NAME);
  }
  sheet.clearContents(); // Clear existing content

  Logger.log('Starting script: Asset Status Reporter');

  // Log sample row for field name verification (as per mega.md)
  try {
    const sampleQuery = QUERY + ' LIMIT 1';
    Logger.log('Executing sample query: ' + sampleQuery);
    const sampleRows = AdsApp.search(sampleQuery);
    if (sampleRows.hasNext()) {
      const sampleRow = sampleRows.next();
      Logger.log("Sample row structure: " + JSON.stringify(sampleRow));
      if (sampleRow.asset) {
        Logger.log("Sample asset object: " + JSON.stringify(sampleRow.asset));
      }
      if (sampleRow.customerAsset) {
        Logger.log("Sample customerAsset object: " + JSON.stringify(sampleRow.customerAsset));
      }
      if (sampleRow.customer) {
        Logger.log("Sample customer object: " + JSON.stringify(sampleRow.customer));
      }
    } else {
      Logger.log("Sample query returned no rows. The main query might also return no results.");
    }
  } catch (e) {
    Logger.log('Error fetching sample row: ' + e);
  }

  const reportData = [];
  const headers = [
    'Customer ID',
    'Customer Name',
    'Asset ID',
    'Asset Name',
    'Asset Type',
    'Asset Status'
  ];
  reportData.push(headers);

  Logger.log('Executing main query to fetch asset data...');
  try {
    const iterator = AdsApp.search(QUERY);
    Logger.log('Query executed. Processing rows...');

    let rowCount = 0;
    while (iterator.hasNext()) {
      rowCount++;
      let row = iterator.next();
      try {
        const customerId = row.customer && row.customer.id !== undefined ? row.customer.id : 'N/A';
        const customerName = row.customer && row.customer.descriptiveName !== undefined ? row.customer.descriptiveName : 'N/A';
        const assetId = row.asset && row.asset.id !== undefined ? row.asset.id : 'N/A';
        const assetName = row.asset && row.asset.name !== undefined ? row.asset.name : 'N/A';
        const assetType = row.asset && row.asset.type !== undefined ? row.asset.type : 'N/A';
        const assetStatus = row.customerAsset && row.customerAsset.status !== undefined ? row.customerAsset.status : 'N/A';

        reportData.push([
          customerId,
          customerName,
          assetId,
          assetName,
          assetType,
          assetStatus
        ]);
      } catch (e) {
        Logger.log(`Error processing row #${rowCount}: ${e}. Row data: ${JSON.stringify(row)}`);
        // Add a placeholder row or skip, depending on desired error handling for individual rows
        reportData.push([
          'ERROR', 
          'Error processing row', 
          JSON.stringify(row.asset ? row.asset.id : 'N/A'), 
          e.message, 
          '', 
          ''
        ]);
      }
    }
    Logger.log(`Processed ${rowCount} assets.`);

    if (reportData.length > 1) { // More than just headers
      sheet.getRange(1, 1, reportData.length, headers.length).setValues(reportData);
      Logger.log('Data written to sheet: ' + TAB_NAME);
    } else {
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]); // Write headers even if no data
      Logger.log('No asset data found to write to the sheet. Headers have been written.');
    }

  } catch (e) {
    Logger.log('Failed to execute or process query: ' + e);
    sheet.getRange(1,1,1,1).setValue('Error fetching data: ' + e);
  }

  Logger.log('Script finished.');
  Logger.log('Spreadsheet URL: ' + spreadsheet.getUrl());
  Logger.log('Tab Name: ' + TAB_NAME);
} 