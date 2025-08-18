
const SHEET_URL = "https://docs.google.com/spreadsheets/d/16c8sgm2ePGyv5rmmfudxBqrXs4qWwMLh_eCDCL3ZAd0/";

const TAB = "MTD";

const ACCOUNT_LABEL = "CM - Kurt";

const QUERY = `
SELECT 
    campaign.id,
    campaign.name,
    campaign.status,
    metrics.impressions,
    metrics.clicks,
    metrics.cost_micros,
    metrics.conversions,
    metrics.conversions_value
FROM campaign
WHERE segments.date DURING THIS_MONTH
ORDER BY metrics.cost_micros DESC
`;

function main() {
    let ss;
    
    // Handle sheet creation if no URL provided
    if (!SHEET_URL) {
        ss = SpreadsheetApp.create("MCC Campaign Performance Report");
        let url = ss.getUrl();
        Logger.log("No SHEET_URL found, so this sheet was created: " + url);
    } else {
        ss = SpreadsheetApp.openByUrl(SHEET_URL);
    }
    
    const sheet = ss.getSheetByName(TAB);
    if (!sheet) {
        Logger.log("Sheet '" + TAB + "' not found. Creating new sheet.");
        ss.insertSheet(TAB);
    }
    
    // Clear existing data and add headers
    sheet.clear();
    const headers = [
        'Account Name',
        'Customer ID',
        'Campaign Name',
        'Cost',
        'Campaign ID',
        'Campaign Status'
    ];
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    
    let rowIndex = 2; // Start after headers
    
    // Get accounts with the specified label
    const accountIterator = MccApp.accounts().withCondition("LabelNames CONTAINS '" + ACCOUNT_LABEL + "'").get();
    
    while (accountIterator.hasNext()) {
        try {
            const account = accountIterator.next();
            MccApp.select(account);
            
            Logger.log("Processing account: " + account.getName());
            
            // Check if account has cost > 0 in last 30 days
            const costCheckQuery = `
                SELECT 
                    metrics.cost_micros
                FROM customer
                WHERE segments.date DURING LAST_30_DAYS
                LIMIT 1
            `;
            
            const costCheckRows = AdsApp.search(costCheckQuery);
            let hasCost = false;
            
            if (costCheckRows.hasNext()) {
                const costRow = costCheckRows.next();
                const costMicros = Number(costRow.metrics.costMicros) || 0;
                const cost = costMicros / 1000000;
                hasCost = cost > 0;
                Logger.log("Account " + account.getName() + " has cost: $" + cost.toFixed(2) + " in last 30 days");
            }
            
            if (!hasCost) {
                Logger.log("Skipping account " + account.getName() + " - no cost in last 30 days");
                continue;
            }
            
            // Execute the GAQL query
            const rows = AdsApp.search(QUERY);
            
            let accountData = [];
            
            // Log sample row structure for debugging
            if (rows.hasNext()) {
                const sampleRow = rows.next();
                Logger.log("Sample row structure: " + JSON.stringify(sampleRow));
                Logger.log("Sample metrics object: " + JSON.stringify(sampleRow.metrics));
                Logger.log("Sample campaign object: " + JSON.stringify(sampleRow.campaign));
                
                // Process the sample row
                const sampleData = processRow(sampleRow, account);
                if (sampleData) {
                    accountData.push(sampleData);
                }
            }
            
            // Process remaining rows
            while (rows.hasNext()) {
                try {
                    const row = rows.next();
                    const rowData = processRow(row, account);
                    if (rowData) {
                        accountData.push(rowData);
                    }
                } catch (e) {
                    Logger.log("Error processing row in account " + account.getName() + ": " + e);
                    continue;
                }
            }
            
            // Write account data to sheet immediately
            if (accountData.length > 0) {
                sheet.getRange(rowIndex, 1, accountData.length, accountData[0].length).setValues(accountData);
                Logger.log("Wrote " + accountData.length + " rows for account: " + account.getName());
                rowIndex += accountData.length;
            }
            
        } catch (e) {
            Logger.log("Error processing account: " + e);
            continue;
        }
    }
    
    Logger.log("Script completed. Total rows written: " + (rowIndex - 2));
}

function processRow(row, account) {
    try {
        // Access nested objects with fallbacks
        const campaign = row.campaign || {};
        const metrics = row.metrics || {};
        
        // Extract campaign data
        const campaignId = campaign.id || '';
        const campaignName = campaign.name || '';
        const campaignStatus = campaign.status || '';
        
        // Extract and convert metrics to numbers
        const impressions = Number(metrics.impressions) || 0;
        const clicks = Number(metrics.clicks) || 0;
        const costMicros = Number(metrics.costMicros) || 0;
        const conversions = Number(metrics.conversions) || 0;
        const conversionValue = Number(metrics.conversionsValue) || 0;
        
        // Convert cost from micros to actual currency
        const cost = costMicros / 1000000;
        
        // Calculate derived metrics
        const cpc = clicks > 0 ? cost / clicks : 0;
        const ctr = impressions > 0 ? clicks / impressions : 0;
        const convRate = clicks > 0 ? conversions / clicks : 0;
        const cpa = conversions > 0 ? cost / conversions : 0;
        const roas = cost > 0 ? conversionValue / cost : 0;
        const aov = conversions > 0 ? conversionValue / conversions : 0;
        
        return [
            account.getName(),
            account.getCustomerId(),
            campaignName,
            cost,
            campaignId,
            campaignStatus
        ];
        
    } catch (e) {
        Logger.log("Error processing row data: " + e);
        return null;
    }
}