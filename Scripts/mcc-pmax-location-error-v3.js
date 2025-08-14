/**
 * @name MCC PMax Location Reporter
 * @version 3.1
 * @author Your Name
 * @overview This script iterates through all enabled Performance Max campaigns in labeled accounts 
 *           and lists their targeted locations in a Google Sheet, writing data row-by-row.
 * @see {@link file:///C:/Users/kmhen/Documents/Cursor/Google%20Ads%20Scripts/Prompts/mega.md}
 */

const SPREADSHEET_URL = ""; // Optional: Provide a sheet URL. If empty, a new one is created.
const ACCOUNT_LABEL = "CM - Kurt";
const SHEET_NAME = "PMax Location Targeting Report";

const QUERY = `
    SELECT
        campaign.name,
        campaign.id,
        campaign_criterion.type,
        campaign_criterion.location.geo_target_constant,
        campaign_criterion.display_name,
        campaign_criterion.criterion_id,
        campaign_criterion.proximity.radius,
        campaign_criterion.proximity.radius_units,
        campaign_criterion.proximity.geo_point.latitude_in_micro_degrees,
        campaign_criterion.proximity.geo_point.longitude_in_micro_degrees
    FROM campaign_criterion
    WHERE
        campaign.advertising_channel_type = 'PERFORMANCE_MAX'
        AND campaign.status = 'ENABLED'
        AND campaign_criterion.type IN ('LOCATION', 'PROXIMITY')
        AND campaign_criterion.negative = FALSE
`;

function main() {
    Logger.log(`Starting MCC PMax Location Targeting Report for accounts with label: "${ACCOUNT_LABEL}"`);

    let ss;
    try {
        if (SPREADSHEET_URL) {
            ss = SpreadsheetApp.openByUrl(SPREADSHEET_URL);
        } else {
            ss = SpreadsheetApp.create(SHEET_NAME + " Report");
            Logger.log(`New spreadsheet created: ${ss.getUrl()}`);
        }
    } catch (e) {
        Logger.log(`Could not open or create spreadsheet. Please check SPREADSHEET_URL and permissions. Error: ${e}`);
        return; // Stop execution if sheet fails
    }

    let sheet = ss.getSheetByName(SHEET_NAME);
    if (!sheet) {
        sheet = ss.insertSheet(SHEET_NAME);
    }
    
    sheet.clear();
    const headers = ["Account Name", "Campaign Name", "Target Type", "Targeted Location/Proximity", "Criterion ID", "Campaign ID"];
    sheet.appendRow(headers);

    const accountIterator = MccApp.accounts()
        .withCondition(`LabelNames CONTAINS '${ACCOUNT_LABEL}'`)
        .get();

    let accountsProcessed = 0;
    let rowsWritten = 0;

    while (accountIterator.hasNext()) {
        const account = accountIterator.next();
        MccApp.select(account);

        const stats = account.getStatsFor("LAST_30_DAYS");
        if (stats.getCost() === 0) {
            Logger.log(`Skipping account: ${account.getName()} (ID: ${account.getCustomerId()}) due to zero cost.`);
            continue;
        }

        accountsProcessed++;
        Logger.log(`Processing account: ${account.getName()} (ID: ${account.getCustomerId()})`);
        
        try {
            const reportIterator = AdsApp.search(QUERY);
            
            if (rowsWritten === 0) { // Only log sample for the first account with results
                const sampleQuery = QUERY + ' LIMIT 1';
                const sampleRows = AdsApp.search(sampleQuery);
                if (sampleRows.hasNext()) {
                    const sampleRow = sampleRows.next();
                    Logger.log("Sample row structure: " + JSON.stringify(sampleRow, null, 2));
                } else {
                     Logger.log(`No location criteria found for account ${account.getName()}`);
                }
            }

            while(reportIterator.hasNext()){
                const row = reportIterator.next();
                const campaign = row.campaign;
                const criterion = row.campaignCriterion;
                let targetType = 'N/A';
                let targetDetails = 'N/A';
        
                if (criterion.type === 'LOCATION' && criterion.location && criterion.displayName) {
                    targetType = 'Location';
                    targetDetails = criterion.displayName;
                } else if (criterion.type === 'PROXIMITY' && criterion.proximity) {
                    targetType = 'Proximity';
                    const proximity = criterion.proximity;
                    const lat = proximity.geoPoint.latitudeInMicroDegrees / 1000000;
                    const lon = proximity.geoPoint.longitudeInMicroDegrees / 1000000;
                    targetDetails = `Lat: ${lat}, Lon: ${lon}, Radius: ${proximity.radius} ${proximity.radiusUnits}`;
                }
                
                sheet.appendRow([
                    account.getName(),
                    campaign.name,
                    targetType,
                    targetDetails,
                    criterion.criterionId,
                    campaign.id
                ]);
                rowsWritten++;
            }

        } catch (e) {
            Logger.log(`Error processing account ${account.getName()}. Error: ${e}`);
        }
    }

    if (rowsWritten === 0) {
        Logger.log("No data found to write to the sheet.");
    } else {
         Logger.log(`Wrote ${rowsWritten} rows to sheet: ${ss.getUrl()}`);
    }

    if (accountsProcessed === 0) {
        Logger.log(`No accounts found with the label '${ACCOUNT_LABEL}' that had spend in the last 30 days.`);
    }

    Logger.log("Script finished.");
}
