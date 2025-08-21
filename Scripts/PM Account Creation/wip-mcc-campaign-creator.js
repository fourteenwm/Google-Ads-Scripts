/**
 * @name MCC Campaign Creator
 * @description Google Ads MCC script that creates campaigns across multiple accounts based on data from a Google Sheet.
 * @author Cursor
 * @version 1.0
 * 
 * This script reads campaign data from a "Campaigns" tab in a Google Sheet and creates
 * campaigns in the specified accounts. It includes error handling, duplicate protection,
 * batching for runtime safety, and logs errors to an "Error Log" tab.
 */

// Configuration
const SPREADSHEET_URL = 'https://docs.google.com/spreadsheets/d/1qJdxqDSWy1xEwJOyt0CroiZaUmTi6-M4_sCdADXi1L8/edit?gid=494624246#gid=494624246';
const CAMPAIGNS_TAB = 'Campaigns';
const ERROR_LOG_TAB = 'Error Log';
const RUN_STATE_TAB = 'Run State';
const BATCH_SIZE = 50; // Number of rows to process per run
const REQUIRED_LABELS = []; // Empty array means no label requirement - will process all accessible accounts

// Script state management
const SCRIPT_PROPERTY_KEY = 'MCC_CAMPAIGN_CREATOR_LAST_ROW';

function main() {
  Logger.log('Starting MCC Campaign Creator script...');
  
  // Get or create spreadsheet
  const spreadsheet = getSpreadsheet();
  const campaignsSheet = getSheet(spreadsheet, CAMPAIGNS_TAB);
  const errorLogSheet = getSheet(spreadsheet, ERROR_LOG_TAB);
  const runStateSheet = getSheet(spreadsheet, RUN_STATE_TAB);
  
  // Initialize sheets if needed
  initializeSheets(campaignsSheet, errorLogSheet, runStateSheet);
  
  // Check if we should reset the run state (if no data has been processed yet)
  const lastProcessedRow = getLastProcessedRow(runStateSheet);
  const totalRows = campaignsSheet.getLastRow();
  
  // If we've processed more rows than exist, or if we're starting fresh, reset to 0
  if (lastProcessedRow >= totalRows || lastProcessedRow === 0) {
    Logger.log(`Resetting run state. Last processed: ${lastProcessedRow}, Total rows: ${totalRows}`);
    resetRunState(runStateSheet);
  }
  
  const currentLastProcessedRow = getLastProcessedRow(runStateSheet);
  Logger.log(`Resuming from row: ${currentLastProcessedRow + 1}`);
  
  // Get campaign data
  const campaignData = getCampaignData(campaignsSheet, currentLastProcessedRow);
  
  if (campaignData.length === 0) {
    Logger.log('No new campaign data to process.');
    return;
  }
  
  Logger.log(`Processing ${campaignData.length} campaign rows...`);
  
  // Process campaigns in batches
  let processedCount = 0;
  let errorCount = 0;
  
  for (let i = 0; i < campaignData.length; i += BATCH_SIZE) {
    const batch = campaignData.slice(i, i + BATCH_SIZE);
    const batchResults = processCampaignBatch(batch, errorLogSheet);
    
    processedCount += batchResults.processed;
    errorCount += batchResults.errors;
    
    // Update run state
    const currentRow = lastProcessedRow + i + batch.length;
    updateRunState(runStateSheet, currentRow);
    
    Logger.log(`Batch processed: ${batchResults.processed} successful, ${batchResults.errors} errors`);
    
    // Check runtime safety
    if (i + BATCH_SIZE < campaignData.length) {
      Logger.log('Pausing for 2 seconds before next batch...');
      Utilities.sleep(2000);
    }
  }
  
  Logger.log(`Script completed. Processed: ${processedCount}, Errors: ${errorCount}`);
  Logger.log(`Spreadsheet URL: ${spreadsheet.getUrl()}`);
}

function getSpreadsheet() {
  if (!SPREADSHEET_URL) {
    const spreadsheet = SpreadsheetApp.create("MCC Campaign Creator");
    Logger.log(`Created new spreadsheet: ${spreadsheet.getUrl()}`);
    return spreadsheet;
  }
  
  try {
    return SpreadsheetApp.openByUrl(SPREADSHEET_URL);
  } catch (e) {
    throw new Error(`Failed to open spreadsheet: ${e.message}`);
  }
}

function getSheet(spreadsheet, sheetName) {
  let sheet = spreadsheet.getSheetByName(sheetName);
  if (!sheet) {
    sheet = spreadsheet.insertSheet(sheetName);
  }
  return sheet;
}

function initializeSheets(campaignsSheet, errorLogSheet, runStateSheet) {
  // Initialize Campaigns tab if empty
  if (campaignsSheet.getLastRow() === 0) {
    const campaignHeaders = [
      'Account CID',
      'Campaign Name',
      'Budget (Daily)',
      'Bidding Strategy',
      'Campaign Type',
      'Networks',
      'Start Date',
      'End Date',
      'Status',
      'Location Targeting',
      'Language Targeting',
      'Tracking Template',
      'Campaign Labels',
      'Notes'
    ];
    campaignsSheet.getRange(1, 1, 1, campaignHeaders.length).setValues([campaignHeaders]);
    Logger.log('Initialized Campaigns tab with headers');
  }
  
  // Initialize Error Log tab if empty
  if (errorLogSheet.getLastRow() === 0) {
    const errorHeaders = [
      'Timestamp',
      'Account CID',
      'Row Number',
      'Campaign Name',
      'Error Type',
      'Error Message',
      'Status'
    ];
    errorLogSheet.getRange(1, 1, 1, errorHeaders.length).setValues([errorHeaders]);
    Logger.log('Initialized Error Log tab with headers');
  }
  
  // Initialize Run State tab if empty
  if (runStateSheet.getLastRow() === 0) {
    const stateHeaders = ['Last Processed Row', 'Last Run Time', 'Total Processed', 'Total Errors'];
    runStateSheet.getRange(1, 1, 1, stateHeaders.length).setValues([stateHeaders]);
    runStateSheet.getRange(2, 1, 1, 4).setValues([[0, new Date().toISOString(), 0, 0]]);
    Logger.log('Initialized Run State tab');
  }
}

function getLastProcessedRow(runStateSheet) {
  const lastRow = runStateSheet.getRange(2, 1).getValue();
  return lastRow || 0;
}

function getCampaignData(sheet, startRow) {
  const lastRow = sheet.getLastRow();
  Logger.log(`Sheet has ${lastRow} rows, starting from row ${startRow + 1}`);
  
  if (lastRow <= startRow) {
    Logger.log('No new data to process');
    return [];
  }
  
  // Always start from row 2 (skip header row) and adjust for startRow
  const actualStartRow = Math.max(2, startRow + 1);
  const dataRange = sheet.getRange(actualStartRow, 1, lastRow - actualStartRow + 1, 14);
  const values = dataRange.getValues();
  Logger.log(`Read ${values.length} rows of data from sheet (starting from row ${actualStartRow})`);
  
  const campaigns = [];
  for (let i = 0; i < values.length; i++) {
    const row = values[i];
    const rowNumber = actualStartRow + i;
    
    Logger.log(`Processing row ${rowNumber}: ${JSON.stringify(row)}`);
    
    // Skip empty rows
    if (!row[0] || !row[1]) {
      Logger.log(`Skipping empty row ${rowNumber}`);
      continue;
    }
    
    const campaign = {
      rowNumber: rowNumber,
      accountCid: row[0].toString().replace(/-/g, ''),
      campaignName: row[1],
      dailyBudget: parseFloat(row[2]) || 0,
      biddingStrategy: row[3],
      campaignType: row[4],
      networks: row[5],
      startDate: row[6],
      endDate: row[7],
      status: row[8],
      locationTargeting: row[9],
      languageTargeting: row[10],
      trackingTemplate: row[11],
      campaignLabels: row[12],
      notes: row[13]
    };
    
    Logger.log(`Parsed campaign data: ${JSON.stringify(campaign)}`);
    campaigns.push(campaign);
  }
  
  Logger.log(`Total campaigns to process: ${campaigns.length}`);
  return campaigns;
}

function processCampaignBatch(campaigns, errorLogSheet) {
  let processed = 0;
  let errors = 0;
  
  for (const campaign of campaigns) {
    try {
      Logger.log(`Processing campaign: ${campaign.campaignName} for account ${campaign.accountCid}`);
      Logger.log(`Campaign data: ${JSON.stringify(campaign)}`);
      
      const result = createCampaign(campaign);
      if (result.success) {
        processed++;
        Logger.log(`Created campaign: ${campaign.campaignName} in account ${campaign.accountCid}`);
      } else {
        errors++;
        Logger.log(`Failed to create campaign: ${campaign.campaignName}. Error: ${result.errorType} - ${result.errorMessage}`);
        logError(errorLogSheet, campaign, result.errorType, result.errorMessage, 'Skipped');
      }
    } catch (e) {
      errors++;
      Logger.log(`Exception creating campaign ${campaign.campaignName}: ${e.message}`);
      Logger.log(`Stack trace: ${e.stack}`);
      logError(errorLogSheet, campaign, 'Exception', e.message, 'Failed');
    }
  }
  
  return { processed, errors };
}

function createCampaign(campaignData) {
  // Select the account
  const account = getAccountByCid(campaignData.accountCid);
  if (!account) {
    return {
      success: false,
      errorType: 'Account Not Found',
      errorMessage: `Account with CID ${campaignData.accountCid} not found or not accessible`
    };
  }
  
  MccApp.select(account);
  
  // Check for duplicate campaign
  if (campaignExists(campaignData.campaignName)) {
    return {
      success: false,
      errorType: 'Duplicate Campaign',
      errorMessage: `Campaign "${campaignData.campaignName}" already exists in account ${campaignData.accountCid}`
    };
  }
  
  // Validate required fields
  const validation = validateCampaignData(campaignData);
  if (!validation.valid) {
    return {
      success: false,
      errorType: 'Validation Error',
      errorMessage: validation.message
    };
  }
  
  // Try to create campaign using the available Google Ads Scripts API
  try {
    Logger.log('Attempting to create campaign using available Google Ads Scripts API');
    
    // First, let's check what methods are available
    Logger.log('Checking available AdsApp methods...');
    Logger.log('AdsApp.campaigns(): ' + (typeof AdsApp.campaigns === 'function'));
    Logger.log('AdsApp.newCampaignBuilder: ' + (typeof AdsApp.newCampaignBuilder === 'function'));
    Logger.log('AdWordsApp.campaigns(): ' + (typeof AdWordsApp.campaigns === 'function'));
    Logger.log('AdWordsApp.newCampaign: ' + (typeof AdWordsApp.newCampaign === 'function'));
    
    // Try different approaches to create a campaign
    let campaign = null;
    let creationMethod = '';
    
    // Method 1: Try AdsApp.newCampaignBuilder() if it exists
    if (typeof AdsApp.newCampaignBuilder === 'function') {
      try {
        Logger.log('Trying AdsApp.newCampaignBuilder()...');
        const campaignBuilder = AdsApp.newCampaignBuilder()
          .withName(campaignData.campaignName);
        
        // Try to set budget if the method exists
        if (typeof AdsApp.budgets === 'function' && typeof AdsApp.budgets().newBudgetBuilder === 'function') {
          campaignBuilder.withBudget(AdsApp.budgets().newBudgetBuilder()
            .withAmount(campaignData.dailyBudget)
            .build());
        }
        
        const campaignOperation = campaignBuilder.build();
        if (campaignOperation.isSuccessful()) {
          campaign = campaignOperation.getResult();
          creationMethod = 'AdsApp.newCampaignBuilder()';
        }
      } catch (e) {
        Logger.log(`AdsApp.newCampaignBuilder() failed: ${e.message}`);
      }
    }
    
    // Method 2: Try AdWordsApp.newCampaign() if it exists
    if (!campaign && typeof AdWordsApp.newCampaign === 'function') {
      try {
        Logger.log('Trying AdWordsApp.newCampaign()...');
        campaign = AdWordsApp.newCampaign()
          .withName(campaignData.campaignName)
          .withBudget(campaignData.dailyBudget);
        creationMethod = 'AdWordsApp.newCampaign()';
      } catch (e) {
        Logger.log(`AdWordsApp.newCampaign() failed: ${e.message}`);
      }
    }
    
    // Method 3: Try using bulk upload as a fallback
    if (!campaign && typeof AdWordsApp.bulkUploads === 'function') {
      try {
        Logger.log('Trying bulk upload method...');
        const columns = ['Campaign', 'Budget', 'Bid Strategy type'];
        const upload = AdWordsApp.bulkUploads().newCsvUpload(columns, {moneyInMicros: false});
        
        const params = {
          'Campaign': campaignData.campaignName,
          'Budget': campaignData.dailyBudget,
          'Bid Strategy type': getBidStrategyType(campaignData.biddingStrategy)
        };
        
        upload.append(params);
        upload.forCampaignManagement();
        const result = upload.apply();
        
        Logger.log(`Bulk upload result: ${JSON.stringify(result)}`);
        
        // Wait a bit and check if campaign was created
        Utilities.sleep(5000);
        if (campaignExists(campaignData.campaignName)) {
          const campaignIterator = AdWordsApp.campaigns()
            .withCondition(`Name = '${campaignData.campaignName.replace(/'/g, "\\'")}'`)
            .get();
          
          if (campaignIterator.hasNext()) {
            campaign = campaignIterator.next();
            creationMethod = 'Bulk Upload';
          }
        }
      } catch (e) {
        Logger.log(`Bulk upload failed: ${e.message}`);
      }
    }
    
    if (campaign) {
      Logger.log(`Campaign "${campaign.getName()}" created successfully using ${creationMethod}`);
      
      // Set additional properties
      setAdditionalPropertiesAfterCreation(campaign, campaignData);
      
      return { success: true };
    } else {
      Logger.log('All campaign creation methods failed');
      
      return {
        success: false,
        errorType: 'Creation Failed',
        errorMessage: 'No available method to create campaigns in Google Ads Scripts'
      };
    }
    
  } catch (e) {
    Logger.log(`Campaign creation error: ${e.message}`);
    Logger.log(`Error stack: ${e.stack}`);
    
    return {
      success: false,
      errorType: 'Creation Error',
      errorMessage: e.message
    };
  }
}

function getAccountByCid(cid) {
  Logger.log(`Looking for account with CID: ${cid}`);
  
  try {
    // Use the more efficient withIds approach like the old script
    // First try with the CID as-is (in case it has hyphens)
    let accountIterator = MccApp.accounts().withIds([cid]).get();
    
    if (accountIterator.hasNext()) {
      const account = accountIterator.next();
      Logger.log(`Found account using withIds([${cid}]): ${account.getName()} (${account.getCustomerId()})`);
      return account;
    }
    
    // If that didn't work, try with hyphens removed
    const cleanCid = cid.replace(/-/g, '');
    if (cleanCid !== cid) {
      Logger.log(`Trying with clean CID: ${cleanCid}`);
      accountIterator = MccApp.accounts().withIds([cleanCid]).get();
      
      if (accountIterator.hasNext()) {
        const account = accountIterator.next();
        Logger.log(`Found account using withIds([${cleanCid}]): ${account.getName()} (${account.getCustomerId()})`);
        return account;
      }
    }
    
    // If withIds approach fails, fall back to the old method for debugging
    Logger.log('withIds approach failed, falling back to iteration method');
    
    // Remove hyphens from the search CID for comparison
    const searchCid = cid.replace(/-/g, '');
    
    let fallbackIterator;
    
    if (REQUIRED_LABELS.length > 0) {
      // If labels are specified, filter by them
      Logger.log(`Required labels: ${REQUIRED_LABELS.join(', ')}`);
      const labelCondition = `LabelNames CONTAINS_ALL [${REQUIRED_LABELS.map(label => `'${label}'`).join(', ')}]`;
      Logger.log(`Label condition: ${labelCondition}`);
      
      fallbackIterator = MccApp.accounts()
        .withCondition(labelCondition)
        .get();
    } else {
      // No label requirement - get all accessible accounts
      Logger.log('No label requirement - searching all accessible accounts');
      fallbackIterator = MccApp.accounts().get();
    }
    
    let accountCount = 0;
    while (fallbackIterator.hasNext()) {
      const account = fallbackIterator.next();
      accountCount++;
      const accountCid = account.getCustomerId();
      const accountName = account.getName();
      Logger.log(`Found account: ${accountName} (${accountCid})`);
      
      // Remove hyphens from account CID for comparison
      const cleanAccountCid = accountCid.replace(/-/g, '');
      
      if (cleanAccountCid === searchCid) {
        Logger.log(`Matched account: ${accountName} (${accountCid})`);
        return account;
      }
    }
    
    Logger.log(`Total accounts found: ${accountCount}`);
    Logger.log(`No account found with CID: ${cid}`);
    return null;
    
  } catch (e) {
    Logger.log(`Error in getAccountByCid: ${e.message}`);
    Logger.log(`Stack trace: ${e.stack}`);
    return null;
  }
}

function campaignExists(campaignName) {
  // Use AdWordsApp to check for existing campaigns
  const campaignIterator = AdWordsApp.campaigns()
    .withCondition(`Name = '${campaignName.replace(/'/g, "\\'")}'`)
    .get();
  
  return campaignIterator.hasNext();
}

function validateCampaignData(campaignData) {
  if (!campaignData.campaignName || campaignData.campaignName.trim() === '') {
    return { valid: false, message: 'Campaign name is required' };
  }
  
  if (!campaignData.accountCid || campaignData.accountCid.trim() === '') {
    return { valid: false, message: 'Account CID is required' };
  }
  
  if (campaignData.dailyBudget < 0) {
    return { valid: false, message: 'Daily budget must be non-negative' };
  }
  
  if (campaignData.startDate) {
    const startDate = new Date(campaignData.startDate);
    if (isNaN(startDate.getTime())) {
      return { valid: false, message: 'Invalid start date format' };
    }
  }
  
  if (campaignData.endDate) {
    const endDate = new Date(campaignData.endDate);
    if (isNaN(endDate.getTime())) {
      return { valid: false, message: 'Invalid end date format' };
    }
  }
  
  return { valid: true };
}

function setBiddingStrategy(campaign, biddingStrategy) {
  if (!biddingStrategy) return;
  
  const strategy = biddingStrategy.toUpperCase();
  
  // Check if this is a campaign builder (AdsApp) or campaign object (AdWordsApp)
  if (typeof campaign.withMaximizeConversions === 'function') {
    // This is a campaign builder (AdsApp)
    switch (strategy) {
      case 'MAXIMIZE_CONVERSIONS':
        campaign.withMaximizeConversions();
        break;
      case 'TARGET_CPA':
        campaign.withTargetCpa(10.0); // Default CPA, could be made configurable
        break;
      case 'MANUAL_CPC':
        campaign.withManualCpc();
        break;
      case 'MAXIMIZE_CLICKS':
        campaign.withMaximizeClicks();
        break;
      default:
        campaign.withMaximizeConversions(); // Default fallback
    }
  } else {
    // This is a campaign object (AdWordsApp)
    switch (strategy) {
      case 'MAXIMIZE_CONVERSIONS':
        campaign.getBiddingStrategyConfiguration().setStrategyType('MAXIMIZE_CONVERSIONS');
        break;
      case 'TARGET_CPA':
        campaign.getBiddingStrategyConfiguration().setStrategyType('TARGET_CPA');
        campaign.getBiddingStrategyConfiguration().setTargetCpa(10.0); // Default CPA, could be made configurable
        break;
      case 'MANUAL_CPC':
        campaign.getBiddingStrategyConfiguration().setStrategyType('MANUAL_CPC');
        break;
      case 'MAXIMIZE_CLICKS':
        campaign.getBiddingStrategyConfiguration().setStrategyType('MAXIMIZE_CLICKS');
        break;
      default:
        campaign.getBiddingStrategyConfiguration().setStrategyType('MAXIMIZE_CONVERSIONS'); // Default fallback
    }
  }
}

function setCampaignTypeAndNetworks(campaign, campaignType, networks) {
  if (!campaignType) {
    // Default to Search Network
    if (typeof campaign.withSearchNetwork === 'function') {
      // This is a campaign builder (AdsApp)
      campaign.withSearchNetwork();
    } else {
      // This is a campaign object (AdWordsApp)
      campaign.getNetworkSetting().setIncludeSearchNetwork(true);
    }
    return;
  }
  
  const type = campaignType.toLowerCase();
  const networkList = networks ? networks.toLowerCase() : '';
  
  if (type.includes('search')) {
    if (typeof campaign.withSearchNetwork === 'function') {
      // This is a campaign builder (AdsApp)
      campaign.withSearchNetwork();
      if (networkList.includes('search partners')) {
        campaign.withSearchPartners();
      }
    } else {
      // This is a campaign object (AdWordsApp)
      campaign.getNetworkSetting().setIncludeSearchNetwork(true);
      if (networkList.includes('search partners')) {
        campaign.getNetworkSetting().setIncludeSearchPartners(true);
      }
    }
  } else if (type.includes('display')) {
    if (typeof campaign.withDisplayNetwork === 'function') {
      campaign.withDisplayNetwork();
    } else {
      campaign.getNetworkSetting().setIncludeDisplayNetwork(true);
    }
  } else if (type.includes('performance max') || type.includes('pmax')) {
    // Performance Max campaigns are created differently
    Logger.log('Performance Max campaigns require special handling');
  } else if (type.includes('video')) {
    if (typeof campaign.withVideoNetwork === 'function') {
      campaign.withVideoNetwork();
    } else {
      campaign.getNetworkSetting().setIncludeVideoNetwork(true);
    }
  } else {
    // Default to Search
    if (typeof campaign.withSearchNetwork === 'function') {
      campaign.withSearchNetwork();
    } else {
      campaign.getNetworkSetting().setIncludeSearchNetwork(true);
    }
  }
}

function setAdditionalProperties(campaign, campaignData) {
  // Set tracking template if provided
  if (campaignData.trackingTemplate) {
    campaign.setTrackingTemplate(campaignData.trackingTemplate);
  }
  
  // Set location targeting if provided
  if (campaignData.locationTargeting) {
    setLocationTargeting(campaign, campaignData.locationTargeting);
  }
  
  // Set language targeting if provided
  if (campaignData.languageTargeting) {
    setLanguageTargeting(campaign, campaignData.languageTargeting);
  }
  
  // Set campaign labels if provided
  if (campaignData.campaignLabels) {
    setCampaignLabels(campaign, campaignData.campaignLabels);
  }
}

function setLocationTargeting(campaign, locationTargeting) {
  try {
    const locations = locationTargeting.split(';').map(loc => loc.trim());
    for (const location of locations) {
      if (location) {
        campaign.targeting().newLocationBuilder()
          .withName(location)
          .build();
      }
    }
  } catch (e) {
    Logger.log(`Warning: Could not set location targeting "${locationTargeting}": ${e.message}`);
  }
}

function setLanguageTargeting(campaign, languageTargeting) {
  try {
    const languages = languageTargeting.split(';').map(lang => lang.trim());
    for (const language of languages) {
      if (language) {
        campaign.targeting().newLanguageBuilder()
          .withName(language)
          .build();
      }
    }
  } catch (e) {
    Logger.log(`Warning: Could not set language targeting "${languageTargeting}": ${e.message}`);
  }
}

function setCampaignLabels(campaign, campaignLabels) {
  try {
    const labels = campaignLabels.split(',').map(label => label.trim());
    for (const label of labels) {
      if (label) {
        campaign.createLabel(label);
      }
    }
  } catch (e) {
    Logger.log(`Warning: Could not set campaign labels "${campaignLabels}": ${e.message}`);
  }
}

function logError(errorLogSheet, campaign, errorType, errorMessage, status) {
  const errorRow = [
    new Date().toISOString(),
    campaign.accountCid,
    campaign.rowNumber,
    campaign.campaignName,
    errorType,
    errorMessage,
    status
  ];
  
  const nextRow = errorLogSheet.getLastRow() + 1;
  errorLogSheet.getRange(nextRow, 1, 1, errorRow.length).setValues([errorRow]);
}

function resetRunState(runStateSheet) {
  const currentTime = new Date().toISOString();
  runStateSheet.getRange(2, 1, 1, 4).setValues([
    [0, currentTime, 0, 0]
  ]);
  Logger.log('Run state reset to start from beginning');
}

function updateRunState(runStateSheet, lastProcessedRow) {
  const currentTime = new Date().toISOString();
  const totalProcessed = runStateSheet.getRange(2, 3).getValue() || 0;
  const totalErrors = runStateSheet.getRange(2, 4).getValue() || 0;
  
  runStateSheet.getRange(2, 1, 1, 4).setValues([
    [lastProcessedRow, currentTime, totalProcessed + BATCH_SIZE, totalErrors]
  ]);
}

function getBiddingStrategyForBuilder(biddingStrategy) {
  if (!biddingStrategy) return 'MAXIMIZE_CONVERSIONS';
  
  const strategy = biddingStrategy.toUpperCase();
  switch (strategy) {
    case 'MAXIMIZE_CONVERSIONS':
      return 'MAXIMIZE_CONVERSIONS';
    case 'TARGET_CPA':
      return 'TARGET_CPA';
    case 'MANUAL_CPC':
      return 'MANUAL_CPC';
    case 'MAXIMIZE_CLICKS':
      return 'MAXIMIZE_CLICKS';
    case 'TARGET_ROAS':
      return 'TARGET_ROAS';
    default:
      return 'MAXIMIZE_CONVERSIONS';
  }
}

function getBidStrategyType(biddingStrategy) {
  if (!biddingStrategy) return 'cpc';
  
  const strategy = biddingStrategy.toUpperCase();
  switch (strategy) {
    case 'MAXIMIZE_CONVERSIONS':
      return 'maximize_conversions';
    case 'TARGET_CPA':
      return 'target_cpa';
    case 'MANUAL_CPC':
      return 'cpc';
    case 'MAXIMIZE_CLICKS':
      return 'maximize_clicks';
    default:
      return 'cpc';
  }
}

function getLanguageCode(languageTargeting) {
  if (!languageTargeting) return null;
  
  const language = languageTargeting.toLowerCase();
  if (language.includes('english') || language.includes('en')) {
    return 'en';
  } else if (language.includes('spanish') || language.includes('es')) {
    return 'es';
  } else if (language.includes('french') || language.includes('fr')) {
    return 'fr';
  } else if (language.includes('german') || language.includes('de')) {
    return 'de';
  } else if (language.includes('italian') || language.includes('it')) {
    return 'it';
  } else if (language.includes('portuguese') || language.includes('pt')) {
    return 'pt';
  } else if (language.includes('dutch') || language.includes('nl')) {
    return 'nl';
  } else if (language.includes('japanese') || language.includes('ja')) {
    return 'ja';
  } else if (language.includes('korean') || language.includes('ko')) {
    return 'ko';
  } else if (language.includes('chinese') || language.includes('zh')) {
    return 'zh';
  }
  
  // Default to English if no match
  return 'en';
}

function getLocationCode(locationTargeting) {
  if (!locationTargeting) return null;
  
  const location = locationTargeting.toLowerCase();
  if (location.includes('united states') || location.includes('us') || location.includes('usa')) {
    return 'US';
  } else if (location.includes('canada') || location.includes('ca')) {
    return 'CA';
  } else if (location.includes('united kingdom') || location.includes('uk') || location.includes('gb')) {
    return 'GB';
  } else if (location.includes('australia') || location.includes('au')) {
    return 'AU';
  } else if (location.includes('germany') || location.includes('de')) {
    return 'DE';
  } else if (location.includes('france') || location.includes('fr')) {
    return 'FR';
  } else if (location.includes('spain') || location.includes('es')) {
    return 'ES';
  } else if (location.includes('italy') || location.includes('it')) {
    return 'IT';
  } else if (location.includes('japan') || location.includes('jp')) {
    return 'JP';
  } else if (location.includes('south korea') || location.includes('kr')) {
    return 'KR';
  }
  
  // Default to US if no match
  return 'US';
}

function setAdditionalPropertiesAfterCreation(campaign, campaignData) {
  try {
    // Set campaign status
    if (campaignData.status === 'Paused') {
      campaign.pause();
      Logger.log(`Campaign "${campaign.getName()}" paused`);
    }
    
    // Set start and end dates if provided
    if (campaignData.startDate) {
      campaign.setStartDate(new Date(campaignData.startDate));
      Logger.log(`Set start date to ${campaignData.startDate}`);
    }
    
    if (campaignData.endDate) {
      campaign.setEndDate(new Date(campaignData.endDate));
      Logger.log(`Set end date to ${campaignData.endDate}`);
    }
    
    // Set tracking template if provided
    if (campaignData.trackingTemplate) {
      campaign.setTrackingTemplate(campaignData.trackingTemplate);
      Logger.log(`Set tracking template: ${campaignData.trackingTemplate}`);
    }
    
    // Set campaign labels if provided
    if (campaignData.campaignLabels) {
      const labels = campaignData.campaignLabels.split(',').map(label => label.trim());
      for (const label of labels) {
        if (label) {
          campaign.createLabel(label);
          Logger.log(`Added label: ${label}`);
        }
      }
    }
    
    Logger.log(`Additional properties set for campaign "${campaign.getName()}"`);
    
  } catch (e) {
    Logger.log(`Warning: Could not set some additional properties: ${e.message}`);
  }
}
