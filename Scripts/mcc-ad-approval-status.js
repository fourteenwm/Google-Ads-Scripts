function main() {
    const sheetUrl = 'https://docs.google.com/spreadsheets/d/1iNCzXefe6RZYE1k1v4UpEuSLQZ8y2KIUNy11zLiSiEY/'; // Replace with your Sheet URL
    const sheetName = 'MCC RSA Approval Status Report';
    const ACCOUNT_LABEL_1 = 'CL - LC';
    const ACCOUNT_LABEL_2 = 'CM - Kurt';
  
    const spreadsheet = SpreadsheetApp.openByUrl(sheetUrl);
    let sheet = spreadsheet.getSheetByName(sheetName);
  
    if (!sheet) {
      sheet = spreadsheet.insertSheet(sheetName);
    } else {
      sheet.clear();
    }
  
    // Set up headers
    sheet.appendRow([
      'Account Name',
      'Ad ID',
      'Campaign Name',
      'Ad Group Name',
      'Ad Type',
      'Ad Status',
      'Approval Status'
    ]);
  
    // Select only accounts with BOTH labels
    const accountSelector = MccApp.accounts()
      .withCondition("LabelNames CONTAINS '" + ACCOUNT_LABEL_1 + "'")
      .withCondition("LabelNames CONTAINS '" + ACCOUNT_LABEL_2 + "'")
      .get();
  
    while (accountSelector.hasNext()) {
      const account = accountSelector.next();
      const accountName = account.getName();
      MccApp.select(account);
  
      const query = `
        SELECT
          ad_group_ad.ad.id,
          campaign.name,
          ad_group.name,
          ad_group_ad.ad.type,
          ad_group_ad.status,
          ad_group_ad.policy_summary.approval_status
        FROM ad_group_ad
        WHERE ad_group_ad.ad.type = 'RESPONSIVE_SEARCH_AD'
        AND ad_group_ad.status = 'ENABLED'
      AND campaign.status = 'ENABLED'
        LIMIT 50000
      `;
  
      try {
        const report = AdsApp.report(query);
        const rows = report.rows();
  
        while (rows.hasNext()) {
          const row = rows.next();
          sheet.appendRow([
            accountName,
            row['ad_group_ad.ad.id'],
            row['campaign.name'],
            row['ad_group.name'],
            row['ad_group_ad.ad.type'],
            row['ad_group_ad.status'],
            row['ad_group_ad.policy_summary.approval_status']
          ]);
        }
  
        Logger.log(`✅ Pulled data from account: ${accountName}`);
      } catch (e) {
        Logger.log(`❌ Failed in account ${accountName}: ${e}`);
      }
    }
  
    Logger.log('✅ MCC RSA approval status report complete (accounts with BOTH labels).');
  }
  