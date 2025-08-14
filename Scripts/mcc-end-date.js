/**
 * @name MCC Campaign End Date Checker
 * @description This script checks for all active and paused campaigns in labeled accounts that do not have an end date set, and writes the results to a Google Sheet. It uses GAQL and bulk updates for efficiency.
 * @author Cursor
 * @version 2.0
 */

// URL of the Google Sheet for logging results.
// If left blank or as 'YOUR_SPREADSHEET_URL_HERE', a new sheet will be created.
const SPREADSHEET_URL = 'https://docs.google.com/spreadsheets/d/1xXfkV_S5J6Yfu48n1IlR2hoQey3SDiJdnRdhIse4o0s/edit?gid=1942859639#gid=1942859639';
const ACCOUNT_LABEL = "CM - Kurt";
const SHEET_NAME = "Campaign End Date Report";

function main() {
  Logger.log(`Starting MCC campaign end date check for accounts with label: ${ACCOUNT_LABEL}`);

  let ss;
  if (!SPREADSHEET_URL || SPREADSHEET_URL === 'YOUR_SPREADSHEET_URL_HERE') {
    ss = SpreadsheetApp.create("Campaign End Date Report");
    Logger.log(`A new sheet was created for the report: ${ss.getUrl()}`);
  } else {
    try {
      ss = SpreadsheetApp.openByUrl(SPREADSHEET_URL);
    } catch (e) {
      throw new Error(`Failed to open spreadsheet with URL "${SPREADSHEET_URL}". Please check the URL and permissions.`);
    }
  }

  const sheet = getSheet(ss, SHEET_NAME);
  sheet.clear();
  const headers = ["Account Name", "Campaign Name", "Status"];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);

  const accountIterator = MccApp.accounts()
    .withCondition(`LabelNames CONTAINS '${ACCOUNT_LABEL}'`)
    .get();

  if (!accountIterator.hasNext()) {
    Logger.log(`No accounts found with the label "${ACCOUNT_LABEL}".`);
    Logger.log("Script finished.");
    return;
  }
    
  let totalIssuesFound = 0;
  let firstAccountProcessed = false;
  let nextRow = 2;

  while (accountIterator.hasNext()) {
    const account = accountIterator.next();
    MccApp.select(account);
    const accountName = account.getName();

    const query = `
      SELECT campaign.name, campaign.end_date, campaign.status
      FROM campaign
      WHERE campaign.status IN ('ENABLED', 'PAUSED')`;

    if (!firstAccountProcessed) {
        const sampleReport = AdsApp.search(`${query} LIMIT 1`);
        if (sampleReport.hasNext()) {
            const sampleRow = sampleReport.next();
            Logger.log(`Sample row structure for account ${accountName}: ${JSON.stringify(sampleRow)}`);
        }
        firstAccountProcessed = true;
    }

    const report = AdsApp.search(query);
    
    let accountIssues = 0;
    const accountRows = [];

    while (report.hasNext()) {
      try {
        const row = report.next();
        if (!row.campaign.endDate) {
          accountRows.push([accountName, row.campaign.name, "No End Date"]);
          accountIssues++;
        }
      } catch (e) {
        Logger.log(`Could not process a row in account "${accountName}". Error: ${e}`);
      }
    }

    let rowsToWrite;
    if (accountIssues === 0) {
      rowsToWrite = [[accountName, "-", "All campaigns have end dates"]];
    } else {
      rowsToWrite = accountRows;
    }
    
    if (rowsToWrite.length > 0) {
        sheet.getRange(nextRow, 1, rowsToWrite.length, rowsToWrite[0].length).setValues(rowsToWrite);
        nextRow += rowsToWrite.length;
    }
    totalIssuesFound += accountIssues;
  }

  if (totalIssuesFound > 0) {
    Logger.log(`Found ${totalIssuesFound} campaigns without an end date. Results written to: ${ss.getUrl()}`);
  } else {
    Logger.log("All active and paused campaigns in labeled accounts have an end date assigned.");
  }

  Logger.log("Script finished.");
}

function getSheet(spreadsheet, sheetName) {
  let sheet = spreadsheet.getSheetByName(sheetName);
  if (!sheet) {
    sheet = spreadsheet.insertSheet(sheetName);
  }
  return sheet;
}

