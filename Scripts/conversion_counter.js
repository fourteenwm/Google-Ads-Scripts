// Script to retrieve conversion action counts for the last 30 days and write to a Google Sheet.

// Replace with your Spreadsheet URL. If left as "YOUR_SPREADSHEET_URL" or empty, a new sheet will be created.
const SPREADSHEET_URL = "YOUR_SPREADSHEET_URL";
const SHEET_NAME = "ConversionCounts_GAQL"; // Renamed to indicate GAQL version

function main() {
  let spreadsheet;
  try {
    if (SPREADSHEET_URL && SPREADSHEET_URL !== "YOUR_SPREADSHEET_URL") {
      spreadsheet = SpreadsheetApp.openByUrl(SPREADSHEET_URL);
    } else {
      spreadsheet = SpreadsheetApp.create("Google Ads Conversion Counts Report");
      Logger.log("New spreadsheet created. URL: " + spreadsheet.getUrl());
      Logger.log("Please update SPREADSHEET_URL in the script with this new URL for future runs if you want to use the same sheet.");
    }
  } catch (e) {
    Logger.log("Error opening or creating spreadsheet: " + e);
    // console.error("Error opening or creating spreadsheet: " + e); // console.error is not available
    return;
  }

  let sheet = spreadsheet.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = spreadsheet.insertSheet(SHEET_NAME);
  } else {
    sheet.clearContents(); // Clear existing data
  }

  const headers = ["Conversion Action Name", "All Conversions"];
  const dataToWrite = [headers];

  // GAQL Query to get conversion action names and their counts for the last 30 days
  const query = 
    'SELECT '
    + 'conversion_action.name, '
    + 'metrics.all_conversions '
    + 'FROM conversion_action '
    + 'WHERE segments.date DURING LAST_30_DAYS '
    // + 'AND metrics.all_conversions > 0 ' // Removed to include zero conversions
    + 'ORDER BY metrics.all_conversions DESC';

  Logger.log("Executing GAQL Query: " + query);

  try {
    // Log sample row for field name verification (as per mega.md)
    const sampleQuery = query + ' LIMIT 1';
    const sampleReport = AdsApp.search(sampleQuery);
    if (sampleReport.hasNext()) {
        const sampleRow = sampleReport.next();
        Logger.log("Sample row structure: " + JSON.stringify(sampleRow));
        if (sampleRow.conversionAction) {
            Logger.log("Sample conversionAction object: " + JSON.stringify(sampleRow.conversionAction));
        }
        if (sampleRow.metrics) {
            Logger.log("Sample metrics object: " + JSON.stringify(sampleRow.metrics));
        }
    } else {
        Logger.log("Sample query returned no rows. This might be normal if there's no data.");
    }

    const report = AdsApp.search(query);

    while (report.hasNext()) {
      try {
        const row = report.next();
        // Accessing fields using camelCase as per mega.md guidelines
        // Ensure conversionAction and metrics objects exist before accessing their properties
        const conversionName = row.conversionAction ? row.conversionAction.name : "N/A (Unknown Conversion Action)";
        const conversions = row.metrics ? Number(row.metrics.allConversions) : 0;

        dataToWrite.push([conversionName, conversions]);
      } catch (e) {
        Logger.log("Error processing a row: " + e + " | Row data: " + JSON.stringify(row || {}));
        // Optionally, push an error marker to the sheet or skip the row
        // dataToWrite.push(["Error processing row", e.toString()]);
      }
    }

    if (dataToWrite.length > 1) { // More than just headers
      sheet.getRange(1, 1, dataToWrite.length, dataToWrite[0].length).setValues(dataToWrite);
      Logger.log(dataToWrite.length - 1 + " rows of conversion data written to spreadsheet: " + spreadsheet.getUrl() + " Sheet: " + SHEET_NAME);
    } else {
      // If no data, still write headers and a message
      const noDataMessage = ["No conversion data found for the last 30 days."];
      dataToWrite.push(noDataMessage);
      sheet.getRange(1, 1, dataToWrite.length, dataToWrite[0].length).setValues(dataToWrite);
      Logger.log("No conversion data found for the last 30 days.");
    }

  } catch (e) {
    Logger.log("Failed to execute GAQL query or process results: " + e);
    // console.error("Failed to execute GAQL query or process results: " + e); // console.error is not available
    // Attempt to write error to sheet even if main processing fails
    try {
        sheet.getRange(sheet.getLastRow() + 1, 1, 1, 2).setValues([["Script Error", e.toString()]]);
    } catch (sheetError) {
        Logger.log("Additionally, failed to write error to sheet: " + sheetError);
    }
  }
} 