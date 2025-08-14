/**
 * @name MCC Location Targeting Reporter
 * @version 3.0
 * @author Cursor
 * @overview This script, updated to use GAQL, iterates through all enabled campaigns 
 * in labeled accounts and lists their targeted locations and proximities in a Google Sheet.
 * This is for MCC use.
 */

// --- Configuration ---

// Optional: Set the URL of an existing Google Sheet. If blank, a new sheet will be created.
const SPREADSHEET_URL = "https://docs.google.com/spreadsheets/d/1HpnV9OhFs0Zqp_JEhOhVPQMJIIA8OIn-S6hKtRXyaP0/edit?gid=0#gid=0";
// Label to identify which accounts to process.
const ACCOUNT_LABEL = "CM - Kurt";
// Name of the sheet tab where the report will be written.
const SHEET_NAME = "Location Targeting Report";

// GAQL query to fetch targeted locations and proximities for all enabled campaigns.
const QUERY = `
    SELECT
        campaign.name,
        campaign_criterion.display_name,
        campaign_criterion.type,
        campaign_criterion.criterion_id,
        campaign_criterion.proximity.radius,
        campaign_criterion.proximity.radius_units,
        campaign_criterion.proximity.geo_point.latitude_in_micro_degrees,
        campaign_criterion.proximity.geo_point.longitude_in_micro_degrees,
        campaign_criterion.proximity.address.street_address,
        campaign_criterion.proximity.address.city_name,
        campaign_criterion.proximity.address.postal_code
    FROM campaign_criterion
    WHERE
        campaign_criterion.type IN ('LOCATION', 'PROXIMITY')
        AND campaign.status = 'ENABLED'
        AND campaign_criterion.negative = FALSE
`;

function main() {
    Logger.log(`Starting MCC location targeting report for accounts with label: "${ACCOUNT_LABEL}"`);

    const sheet = getSheet(SPREADSHEET_URL, SHEET_NAME);
    const headers = ["Account Name", "Campaign Name", "Target Type", "Target Details", "Criterion ID", "Timestamp"];
    
    sheet.clear();
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);

    const accountIterator = MccApp.accounts()
        .withCondition(`LabelNames CONTAINS '${ACCOUNT_LABEL}'`)
        .get();

    if (!accountIterator.hasNext()) {
        Logger.log(`No accounts found with the label "${ACCOUNT_LABEL}".`);
        return;
    }

    while (accountIterator.hasNext()) {
        const account = accountIterator.next();
        MccApp.select(account);
        const accountName = account.getName();

        // Check if the account has any cost in the last 30 days before processing.
        if (account.getStatsFor("LAST_30_DAYS").getCost() === 0) {
            Logger.log(`Skipping account "${accountName}" as it has no cost in the last 30 days.`);
            continue;
        }

        Logger.log(`Processing account: ${accountName}`);

        try {
            // 1. Get all enabled campaigns in the account to track which ones have targeting.
            const allCampaigns = {};
            const campaignQuery = `SELECT campaign.name FROM campaign WHERE campaign.status = 'ENABLED'`;
            const campaignReport = AdsApp.search(campaignQuery);
            while (campaignReport.hasNext()) {
                const campaignRow = campaignReport.next();
                allCampaigns[campaignRow.campaign.name] = { hasTargeting: false };
            }

            // 2. Get all location/proximity targets and process them.
            const report = AdsApp.search(QUERY);
            let rowsWritten = 0;

            while (report.hasNext()) {
                const row = report.next();
                const campaignName = row.campaign.name;
                const targetType = row.campaignCriterion.type;
                const criterionId = row.campaignCriterion.criterionId;
                let targetDetails = '';

                if (allCampaigns[campaignName]) {
                    allCampaigns[campaignName].hasTargeting = true;
                }

                if (targetType === 'LOCATION') {
                    targetDetails = row.campaignCriterion.displayName;
                } else if (targetType === 'PROXIMITY') {
                    const proximity = row.campaignCriterion.proximity;
                    const geoPoint = proximity.geoPoint;
                    if (geoPoint) {
                        const lat = geoPoint.latitudeInMicroDegrees / 1000000;
                        const lon = geoPoint.longitudeInMicroDegrees / 1000000;
                        targetDetails = `Lat: ${lat}, Lon: ${lon}, Radius: ${proximity.radius} ${proximity.radiusUnits}`;
                        const address = proximity.address;
                        if (address) {
                            const addressParts = [address.streetAddress, address.cityName, address.postalCode].filter(Boolean);
                            if (addressParts.length > 0) {
                                targetDetails += ` (${addressParts.join(', ')})`;
                            }
                        }
                    }
                }

                sheet.appendRow([accountName, campaignName, targetType, targetDetails, criterionId, new Date()]);
                rowsWritten++;
            }
            
            // 3. Report on campaigns that had no specific targets.
            for (const campaignName in allCampaigns) {
                if (!allCampaigns[campaignName].hasTargeting) {
                    sheet.appendRow([accountName, campaignName, 'N/A', 'No specific location or proximity targets (defaults to all)', 'N/A', new Date()]);
                     rowsWritten++;
                }
            }

            if (rowsWritten === 0) {
                Logger.log(`No enabled campaigns found in "${accountName}".`);
            } else {
                Logger.log(`Wrote ${rowsWritten} targeting rows for account "${accountName}".`);
            }

        } catch (e) {
            Logger.log(`Error processing account ${accountName}: ${e}`);
        }
    }

    Logger.log(`Script finished. Results are in sheet: ${sheet.getParent().getUrl()}`);
}

/**
 * Retrieves a sheet by URL and name, creating the sheet if it doesn't exist.
 * If the URL is not provided, it creates a new spreadsheet.
 * @param {string} spreadsheetUrl - The URL of the spreadsheet.
 * @param {string} sheetName - The name of the sheet.
 * @returns {GoogleAppsScript.Spreadsheet.Sheet} The sheet object.
 */
function getSheet(spreadsheetUrl, sheetName) {
    try {
        let spreadsheet;
        if (spreadsheetUrl) {
            spreadsheet = SpreadsheetApp.openByUrl(spreadsheetUrl);
        } else {
            spreadsheet = SpreadsheetApp.create("MCC Location Targeting Report");
            Logger.log(`Created new spreadsheet: ${spreadsheet.getUrl()}`);
        }

        let sheet = spreadsheet.getSheetByName(sheetName);
        if (!sheet) {
            sheet = spreadsheet.insertSheet(sheetName);
            Logger.log(`Created new sheet: "${sheetName}"`);
        }
        return sheet;
    } catch (e) {
        Logger.log(`Could not open or create spreadsheet. Please check the SPREADSHEET_URL and script permissions. Error: ${e}`);
        throw new Error(e);
    }
}
