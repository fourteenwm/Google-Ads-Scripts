// Google Ads Script: MCC Asset Status Reporter
// Description: This script fetches the status of all active assets (ad extensions) 
// for Google Ads accounts under an MCC, filtered by a specific account label.
// Only processes accounts with cost > 0 in the last 30 days to focus on active accounts.
// Removed assets are automatically filtered out to focus on actionable items.
// Data is exported to a single Google Sheet, with results written incrementally per account
// to prevent memory issues with large numbers of accounts.
// Version: 1.4
// Author: AI Assistant (adapted from single-account script and mcc-neg-keyword-conflict.js)

// --- Configuration ---
// Optional: Specify the URL of the Google Sheet. If blank, a new sheet is created.
const SHEET_URL = 'https://docs.google.com/spreadsheets/d/1gub008yXM1peJEfs1eKVIItzjnt3FS-QXFSoEfCG5Yk/edit?gid=1778948609#gid=1778948609'; // <-- Replace with your sheet URL if desired
const TAB_NAME = 'MCC Asset Status Report v2';
// Specify the account label to filter which accounts are processed.
const ACCOUNT_LABEL = 'CM - Kurt'; // <-- Replace with your desired account label
const HEADERS = [
    'Account ID',
    'Account Name',
    'Asset ID',
    'Asset Name',
    'Asset Type',
    'Asset Status',
    'Policy Approval Status',
    'Policy Review Status',
    'Disapproval Details'
];

// GAQL Query (runs within each selected account's context)
// Fetches asset details along with both basic status and policy information
const GAQL_QUERY = `
  SELECT
    asset.id,
    asset.name,
    asset.type,
    customer_asset.status,
    asset.policy_summary.approval_status,
    asset.policy_summary.review_status,
    asset.policy_summary.policy_topic_entries,
    customer.descriptive_name, 
    customer.id              
  FROM customer_asset
`;

// --- Main MCC Function ---
function main() {
    const ss = getSpreadsheet(SHEET_URL);
    let sheet = ss.getSheetByName(TAB_NAME);
    if (sheet) {
        sheet.clearContents(); // Clear existing content if sheet exists
    } else {
        sheet = ss.insertSheet(TAB_NAME);
    }
    sheet.appendRow(HEADERS); // Add headers once

    Logger.log(`Starting MCC Asset Status Report for accounts with label: "${ACCOUNT_LABEL}"...`);

    const accountSelector = MccApp.accounts()
        .withCondition(`LabelNames CONTAINS "${ACCOUNT_LABEL}"`)
        .withCondition('Cost > 0')
        .forDateRange('LAST_30_DAYS')
        .get();

    const totalAccounts = accountSelector.totalNumEntities();
    Logger.log(`Found ${totalAccounts} accounts with label "${ACCOUNT_LABEL}" that have cost > 0 in the last 30 days.`);

    if (totalAccounts === 0) {
        Logger.log('No accounts to process. Script will exit.');
        sheet.getRange('A2').setValue('No accounts found with the specified label that have cost > 0 in the last 30 days.');
        return;
    }

    let accountsProcessedCount = 0;
    while (accountSelector.hasNext()) {
        const account = accountSelector.next();
        MccApp.select(account); // Switch to the child account context
        accountsProcessedCount++;

        const accountName = account.getName() || `Account ID: ${account.getCustomerId()}`; // Fallback for name
        Logger.log(`--- (${accountsProcessedCount}/${totalAccounts}) Processing Account: ${accountName} (ID: ${account.getCustomerId()}) ---`);
        const accountStartTime = new Date();

        try {
            logSampleRowStructureForCurrentAccount(); // Log sample for verification
            processAccount(sheet, account); // Process and write data for the current account
        } catch (e) {
            Logger.log(`❌ Unhandled error processing account ${accountName}: ${e}`);
            Logger.log(`Stack: ${e.stack}`);
            // Write a generic error row for this account to the sheet
            const errorRowData = [[
                account.getCustomerId(),
                accountName,
                'Critical Error processing account',
                e.message.substring(0, 500), // Limit error message length
                '', '', '', '', ''
            ]];
            writeToSheet(sheet, errorRowData);
        } finally {
            const accountEndTime = new Date();
            const accountDuration = (accountEndTime.getTime() - accountStartTime.getTime()) / 1000;
            Logger.log(`--- Finished Processing Account: ${accountName} (Duration: ${accountDuration.toFixed(2)} seconds) ---`);
        }
    }

    Logger.log(`✓ Finished processing all ${totalAccounts} targeted accounts.`);
    Logger.log(`📊 Results available at: ${ss.getUrl()}`);
    Logger.log(`📋 Tab name: "${TAB_NAME}"`);
    Logger.log('🎯 MCC script finished successfully.');
}

// --- Per-Account Processing Logic ---
/**
 * Fetches asset data for the currently selected account and writes it to the sheet.
 * @param {SpreadsheetApp.Sheet} sheet The Google Sheet object to write to.
 * @param {MccApp.Account} gadsAccountObject The current Google Ads account object from MccApp.
 */
function processAccount(sheet, gadsAccountObject) {
    const accountReportData = []; // Holds rows for the current account

    Logger.log('Executing GAQL query to fetch asset data for current account...');
    try {
        const iterator = AdsApp.search(GAQL_QUERY); // Runs in the context of the selected account
        Logger.log('Query executed. Processing rows...');

        let rowCount = 0;
        let assetsFoundInAccount = false;

        while (iterator.hasNext()) {
            rowCount++;
            let row = iterator.next(); // Define row outside try-catch for error logging if needed

            try {
                // Check if asset is active (not removed) before processing
                const customerAssetStatus = row.customerAsset ? row.customerAsset.status : 'Unknown';
                
                // Skip removed assets - only process active assets
                if (customerAssetStatus === 'REMOVED') {
                    Logger.log(`Skipping removed asset ID: ${row.asset ? row.asset.id : 'Unknown'}`);
                    continue; // Skip to next asset
                }

                assetsFoundInAccount = true; // Only set to true if we find active assets

                // customer.id and customer.descriptiveName from GAQL are the account's ID and Name
                const accountId = row.customer && row.customer.id !== undefined ? row.customer.id.toString() : gadsAccountObject.getCustomerId();
                const accountName = row.customer && row.customer.descriptiveName !== undefined ? row.customer.descriptiveName : gadsAccountObject.getName();
                const assetId = row.asset && row.asset.id !== undefined ? row.asset.id.toString() : 'N/A';
                const assetName = row.asset && row.asset.name !== undefined ? row.asset.name : 'N/A';
                const assetType = row.asset && row.asset.type !== undefined ? row.asset.type : 'N/A';
                
                let assetStatus = customerAssetStatus;
                let policyApprovalStatus = 'Unknown';
                let policyReviewStatus = 'Unknown';
                let disapprovalDetails = '';

                if (row.asset && row.asset.policySummary) {
                    policyApprovalStatus = row.asset.policySummary.approvalStatus;
                    policyReviewStatus = row.asset.policySummary.reviewStatus;

                    if (policyApprovalStatus === 'APPROVED') {
                        policyApprovalStatus = 'Eligible';
                    } else if (policyApprovalStatus === 'DISAPPROVED') {
                        policyApprovalStatus = 'Not eligible';
                        const policyTopics = row.asset.policySummary.policyTopicEntries;
                        if (policyTopics && policyTopics.length > 0) {
                            const reasons = policyTopics.map(entry => entry.topic || 'Unknown reason').join('; ');
                            disapprovalDetails = `Disapproved (${reasons})`;
                        }
                    } else if (policyApprovalStatus === 'UNDER_REVIEW' || policyReviewStatus === 'UNDER_REVIEW') {
                        policyApprovalStatus = 'Under Review';
                    } else if (policyApprovalStatus === 'AREA_OF_INTEREST_ONLY') {
                        policyApprovalStatus = 'Eligible (Area of Interest)';
                    } // Other statuses will remain 'Unknown' or could be mapped if known
                }

                accountReportData.push([
                    accountId,
                    accountName,
                    assetId,
                    assetName,
                    assetType,
                    assetStatus,
                    policyApprovalStatus,
                    policyReviewStatus,
                    disapprovalDetails
                ]);
            } catch (e) {
                Logger.log(`Error processing a row for account ${gadsAccountObject.getName()}: ${e}. Row data: ${JSON.stringify(row)}`);
                // Add a specific error row for this problematic data row
                accountReportData.push([
                    gadsAccountObject.getCustomerId(),
                    gadsAccountObject.getName(),
                    row.asset && row.asset.id ? row.asset.id.toString() : 'Error in Row',
                    'Error processing row data',
                    e.message.substring(0, 100),
                    'Error',
                    'Error',
                    'Error',
                    JSON.stringify(row).substring(0,100)
                ]);
            }
        }
        Logger.log(`Processed ${rowCount} total assets for account ${gadsAccountObject.getName()}.`);
        Logger.log(`Found ${accountReportData.length} active assets (removed assets were filtered out).`);

        // Write data for this account immediately to prevent memory issues
        if (accountReportData.length > 0) {
            writeToSheet(sheet, accountReportData);
            Logger.log(`✓ Wrote ${accountReportData.length} assets for account ${gadsAccountObject.getName()} to sheet.`);
        } else if (!assetsFoundInAccount) {
            // No assets found for this specific account after a successful query execution
            Logger.log(`No assets found for account ${gadsAccountObject.getName()}.`);
            const noAssetsRow = [[
                gadsAccountObject.getCustomerId(),
                gadsAccountObject.getName(),
                'No assets found in this account', '', '', '', '', '', ''
            ]];
            writeToSheet(sheet, noAssetsRow);
            Logger.log(`✓ Wrote "no assets" row for account ${gadsAccountObject.getName()} to sheet.`);
        }
        // If assetsFoundInAccount is true but accountReportData is empty, it means all rows had errors.

    } catch (e) {
        Logger.log(`Failed to execute GAQL query or initial processing for account ${gadsAccountObject.getName()}: ${e}`);
        const queryErrorRow = [[
            gadsAccountObject.getCustomerId(),
            gadsAccountObject.getName(),
            'Error executing/processing GAQL query for account',
            e.message.substring(0, 500), // Limit error message length
            '', '', '', '', ''
        ]];
        writeToSheet(sheet, queryErrorRow);
    }
}

/**
 * Logs the structure of a sample row from the GAQL_QUERY for the currently selected account.
 * Helps in verifying field names and object structure.
 */
function logSampleRowStructureForCurrentAccount() {
    Logger.log('Attempting to fetch and log sample row structure for the current account...');
    try {
        const sampleQueryWithLimit = GAQL_QUERY + ' LIMIT 1';
        const sampleIterator = AdsApp.search(sampleQueryWithLimit);
        if (sampleIterator.hasNext()) {
            const sampleRow = sampleIterator.next();
            Logger.log("Sample Row Structure (raw JSON): " + JSON.stringify(sampleRow));
            if (sampleRow.asset) {
                Logger.log("Sample asset object: " + JSON.stringify(sampleRow.asset));
                if (sampleRow.asset.policySummary) {
                    Logger.log("Sample asset.policySummary object: " + JSON.stringify(sampleRow.asset.policySummary));
                }
            }
            if (sampleRow.customerAsset) {
                Logger.log("Sample customerAsset object: " + JSON.stringify(sampleRow.customerAsset));
            }
            if (sampleRow.customer) {
                Logger.log("Sample customer object (represents current account): " + JSON.stringify(sampleRow.customer));
            }
        } else {
            Logger.log("Sample query returned no rows. This might be normal if the account has no assets matching the query.");
        }
    } catch (e) {
        Logger.log(`Error fetching or logging sample row structure: ${e}`);
    }
}

// --- Spreadsheet Handling --- (Adapted from mcc-neg-keyword-conflict.js)
/**
 * Gets the spreadsheet object, creating one if URL is not provided or invalid.
 * @param {string} url The URL of the spreadsheet. If empty/invalid, a new one is created.
 * @return {SpreadsheetApp.Spreadsheet} The spreadsheet object.
 */
function getSpreadsheet(url) {
    let ss;
    if (url && typeof url === 'string' && url.trim() !== '') {
        try {
            ss = SpreadsheetApp.openByUrl(url);
            Logger.log(`Using existing spreadsheet: ${url}`);
            return ss;
        } catch (e) {
            Logger.log(`Failed to open spreadsheet with URL: "${url}". Error: ${e}. Creating a new one instead.`);
        }
    }
    const sheetName = `MCC Asset Status Report - ${getDateString()}`;
    ss = SpreadsheetApp.create(sheetName);
    Logger.log(`Created new spreadsheet: ${ss.getUrl()} with name "${sheetName}"`);
    return ss;
}

/**
 * Writes data to the specified sheet, appending to existing content.
 * @param {SpreadsheetApp.Sheet} sheet The sheet object.
 * @param {Array<Array<string>>} dataRows 2D array of rows to write.
 */
function writeToSheet(sheet, dataRows) {
    if (!dataRows || dataRows.length === 0) {
        Logger.log("No data provided to writeToSheet for this batch.");
        return;
    }
    try {
        const startRow = sheet.getLastRow() + 1; // Append after the last current row
        const numRows = dataRows.length;
        const numCols = dataRows[0].length; // Assume all rows have same number of columns

        if (numRows > 0 && numCols > 0) {
            sheet.getRange(startRow, 1, numRows, numCols).setValues(dataRows);
            Logger.log(`Successfully wrote ${numRows} rows to the sheet "${sheet.getName()}".`);
        } else {
            Logger.log("Data for writing was empty or malformed.");
        }
    } catch (e) {
        Logger.log(`Error writing data to sheet: ${e}`);
        Logger.log(`Data Rows (${dataRows.length}): ${JSON.stringify(dataRows).substring(0,500)}`);

    }
}

/**
 * Gets a formatted date string for sheet naming (YYYY-MM-DD).
 * @return {string} Formatted date string.
 */
function getDateString() {
    let timeZone;
    try {
        // MccApp.currentAccount() is null in the MCC script's global scope before an account is selected.
        // Session.getScriptTimeZone() is a reliable fallback.
        timeZone = Session.getScriptTimeZone();
        return Utilities.formatDate(new Date(), timeZone, 'yyyy-MM-dd');
    } catch (e) {
        Logger.log(`Error getting timezone for date string (${e}). Defaulting to UTC date.`);
        try {
            return Utilities.formatDate(new Date(), 'UTC', 'yyyy-MM-dd');
        } catch (formatError) {
            Logger.log(`Error formatting date even with UTC: ${formatError}. Returning static fallback.`);
            return 'DATE_ERROR';
        }
    }
} 