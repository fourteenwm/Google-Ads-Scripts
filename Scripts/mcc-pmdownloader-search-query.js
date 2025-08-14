// ---------------- CONFIGURATION ----------------

const SHEET_URL = 'https://docs.google.com/spreadsheets/d/15WMyARa1U3CerInuVrStupmhs62qSz-t_V1Fta8A8qs/';
const NUM_DAYS = 30;
const MIN_CLICKS = 0;
const ACCOUNT_LABEL_1 = "CM - Kurt";
const ACCOUNT_LABEL_2 = "CL - LC - Pmax";

// ---------------- MAIN SCRIPT ----------------

function main() {
  Logger.log("Starting MCC-Level PMax Script");

  const ss = SpreadsheetApp.openByUrl(SHEET_URL);
  const accountSelector = getLabeledAccounts(ACCOUNT_LABEL_1, ACCOUNT_LABEL_2);

  if (!accountSelector.hasNext()) {
    Logger.log(`No accounts found with both labels "${ACCOUNT_LABEL_1}" and "${ACCOUNT_LABEL_2}". Exiting.`);
    return;
  }

  // Initialize headers with Account info
  let allCats = [['Account Name', 'Account ID', 'Campaign Name', 'Campaign ID', 'Category Label', 'Category ID', 'Clicks', 'Impr', 'Conv', 'Value', 'CTR', 'CVR', 'AOV']];
  let allTerms = [['Account Name', 'Account ID', 'Campaign Name', 'Campaign ID', 'Category Label', 'Search Term', 'Clicks', 'Impr', 'Conv', 'Value', 'CTR', 'CVR', 'AOV']];

  const dateRange = getDateRange(NUM_DAYS);
  const start = new Date();

  while (accountSelector.hasNext()) {
    const account = accountSelector.next();
    AdsManagerApp.select(account);

    const accountName = account.getName();
    const accountId = account.getCustomerId();

    Logger.log(`Processing account: ${accountName} (${accountId})`);

    try {
      const report = AdsApp.report(`
        SELECT campaign.id, campaign.name
        FROM campaign
        WHERE campaign.status != 'REMOVED'
          AND campaign.advertising_channel_type = "PERFORMANCE_MAX"
          AND segments.date BETWEEN ${dateRange}
      `).rows();

      while (report.hasNext()) {
        const campaign = report.next();

        const insights = AdsApp.report(`
          SELECT campaign.name, campaign.id,
                 campaign_search_term_insight.category_label, campaign_search_term_insight.id,
                 metrics.clicks, metrics.impressions, metrics.conversions, metrics.conversions_value
          FROM campaign_search_term_insight
          WHERE segments.date BETWEEN ${dateRange}
            AND campaign_search_term_insight.campaign_id = ${campaign['campaign.id']}
            AND metrics.clicks >= ${MIN_CLICKS}
        `).rows();

        while (insights.hasNext()) {
          const insight = insights.next();

          const clicks = parseFloat(insight['metrics.clicks']);
          const impressions = parseFloat(insight['metrics.impressions']);
          const conversions = parseFloat(insight['metrics.conversions']);
          const convValue = parseFloat(insight['metrics.conversions_value']);

          const CTR = impressions > 0 ? (clicks / impressions * 100).toFixed(2) + '%' : '0%';
          const CvR = clicks > 0 ? (conversions / clicks * 100).toFixed(2) + '%' : '0%';
          const AOV = conversions > 0 ? (convValue / conversions).toFixed(2) : '0';

          allCats.push([
            accountName, accountId,
            campaign['campaign.name'],
            campaign['campaign.id'],
            insight['campaign_search_term_insight.category_label'],
            insight['campaign_search_term_insight.id'],
            clicks,
            impressions,
            conversions.toFixed(1),
            convValue.toFixed(2),
            CTR,
            CvR,
            AOV
          ]);

          // Search terms
          const terms = AdsApp.report(`
            SELECT segments.search_subcategory, segments.search_term,
                   metrics.clicks, metrics.impressions, metrics.conversions, metrics.conversions_value
            FROM campaign_search_term_insight
            WHERE segments.date BETWEEN ${dateRange}
              AND campaign_search_term_insight.campaign_id = ${campaign['campaign.id']}
              AND campaign_search_term_insight.id = "${insight['campaign_search_term_insight.id']}"
          `).rows();

          while (terms.hasNext()) {
            const term = terms.next();
            const termClicks = parseFloat(term['metrics.clicks']);
            if (termClicks <= 0) continue;

            const termImpr = parseFloat(term['metrics.impressions']);
            const termConv = parseFloat(term['metrics.conversions']);
            const termVal = parseFloat(term['metrics.conversions_value']);

            const termCTR = termImpr > 0 ? (termClicks / termImpr * 100).toFixed(2) + '%' : '0%';
            const termCvR = termClicks > 0 ? (termConv / termClicks * 100).toFixed(2) + '%' : '0%';
            const termAOV = termConv > 0 ? (termVal / termConv).toFixed(2) : '0';

            allTerms.push([
              accountName, accountId,
              campaign['campaign.name'],
              campaign['campaign.id'],
              insight['campaign_search_term_insight.category_label'],
              term['segments.search_term'],
              termClicks,
              termImpr,
              termConv.toFixed(1),
              termVal.toFixed(2),
              termCTR,
              termCvR,
              termAOV
            ]);
          }
        }
      }
    } catch (e) {
      Logger.log(`Error in account ${accountId}: ${e}`);
    }
  }

  writeToSheet(ss, 'categories', allCats);
  writeToSheet(ss, 'terms', dedupeRows(allTerms));

  const end = new Date();
  Logger.log(`Script finished in ${(end - start) / 1000} seconds`);
}

// ---------------- HELPERS ----------------

// Get only accounts that have both labels
function getLabeledAccounts(label1, label2) {
  return MccApp.accounts()
    .withCondition(`LabelNames CONTAINS '${label1}'`)
    .withCondition(`LabelNames CONTAINS '${label2}'`)
    .get();
}

// Format date range string
function getDateRange(numDays) {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(endDate.getDate() - numDays);
  const format = d => Utilities.formatDate(d, AdsApp.currentAccount().getTimeZone(), 'yyyyMMdd');
  return `${format(startDate)} AND ${format(endDate)}`;
}

// Write to Google Sheet
function writeToSheet(ss, tabName, data) {
  if (data.length <= 1) {
    Logger.log(`No data for ${tabName}`);
    return;
  }

  let sheet = ss.getSheetByName(tabName);
  if (!sheet) {
    sheet = ss.insertSheet(tabName);
  } else {
    sheet.clear();
  }

  sheet.getRange(1, 1, data.length, data[0].length).setValues(data);
  sheet.getRange(1, 1, 1, sheet.getLastColumn()).setFontWeight('bold');
  sheet.setFrozenRows(1);
}

// Dedupe rows using JSON string match
function dedupeRows(rows) {
  const seen = new Set();
  const unique = [];
  for (let row of rows) {
    const key = JSON.stringify(row);
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(row);
    }
  }
  return unique;
}
