// Copyright 2024 Google LLC
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     https://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

/**
 * @name Negative Keyword Conflict Finder
 * @overview Identifies conflicts between positive keywords and negative keywords
 *           at the Ad Group, Campaign, and Shared List levels within a Google Ads account.
 *           Outputs the conflicts to a Google Sheet.
 * @author Google Ads Scripts Team & Gemini
 * @version 1.1
 * @changelog
 *  - 1.1: Removed automatic sharing of newly created sheets.
 *  - 1.0: Initial version using GAQL and cache for conflict detection.
 */

// --- Configuration ---
// Optional: Specify the URL of the Google Sheet to write results to.
// If left blank (''), a new sheet will be created.
const SHEET_URL = ''; // <-- Replace with your sheet URL if desired, otherwise leave blank
const TAB_NAME = 'Negative Conflicts';
const HEADERS = ['Conflicting Negative Keyword', 'Level & Location', 'Blocked Positive Keywords'];

// --- Main Function ---
function main() {
    const ss = getSpreadsheet(SHEET_URL);
    const sheet = ss.getSheetByName(TAB_NAME) || ss.insertSheet(TAB_NAME);
    sheet.clearContents(); // Clear previous results
    sheet.appendRow(HEADERS); // Add headers first

    Logger.log('Starting Negative Keyword Conflict Check...');

    const dataCache = buildDataCache();

    if (!dataCache) {
        Logger.log('Could not build data cache. Exiting.');
        return;
    }

    const conflicts = findConflicts(dataCache);

    if (conflicts.length > 0) {
        Logger.log(`Found ${conflicts.length} conflicts. Writing to sheet...`);
        outputConflictsToSheet(sheet, conflicts);
        Logger.log(`Conflicts written to: ${ss.getUrl()}`);
    } else {
        Logger.log('No negative keyword conflicts found.');
        // Optionally write a message to the sheet
         sheet.appendRow(['No conflicts found.', '', '']);
    }

    Logger.log('Script finished.');
}

// --- Data Fetching and Caching ---

/**
 * Builds a cache of positive keywords, negative keywords (all levels),
 * and shared list associations.
 * @return {object|null} The data cache or null if fetching fails.
 */
function buildDataCache() {
    const cache = {
        campaigns: {}, // { campaignId: { name: '...', adGroups: {...}, negatives: [...], sharedListNegatives: [...] } }
        sharedLists: {} // { listId: { name: '...', negatives: [...] } }
    };

    try {
        Logger.log('Fetching positive and ad group negative keywords...');
        fetchKeywords(cache);

        Logger.log('Fetching campaign negative keywords...');
        fetchCampaignNegatives(cache);

        Logger.log('Fetching shared negative keyword lists and associations...');
        fetchSharedNegativeLists(cache);

        return cache;
    } catch (e) {
        Logger.log(`Error building data cache: ${e}`);
        Logger.log(`Stack: ${e.stack}`);
        return null;
    }
}

/**
 * Fetches positive and ad group level negative keywords using GAQL.
 * Populates the cache.
 * @param {object} cache The data cache object.
 */
function fetchKeywords(cache) {
    const keywordQuery = `
      SELECT
        campaign.id,
        campaign.name,
        ad_group.id,
        ad_group.name,
        ad_group_criterion.keyword.text,
        ad_group_criterion.keyword.match_type,
        ad_group_criterion.negative,
        ad_group_criterion.status
      FROM keyword_view
      WHERE campaign.status = 'ENABLED'
        AND ad_group.status = 'ENABLED'
        AND ad_group_criterion.status = 'ENABLED'
        AND ad_group_criterion.type = 'KEYWORD'
      LIMIT 1`; // Limit 1 for initial structure logging

    Logger.log("Running sample keyword query for structure check...");
    const sampleIterator = AdsApp.search(keywordQuery);
     if (sampleIterator.hasNext()) {
        const sampleRow = sampleIterator.next();
        Logger.log("Sample Row (Keyword View): " + JSON.stringify(sampleRow));
        if(sampleRow.campaign) Logger.log("Sample Campaign: " + JSON.stringify(sampleRow.campaign));
        if(sampleRow.adGroup) Logger.log("Sample AdGroup: " + JSON.stringify(sampleRow.adGroup));
        if(sampleRow.adGroupCriterion) Logger.log("Sample AdGroupCriterion: " + JSON.stringify(sampleRow.adGroupCriterion));
        if(sampleRow.adGroupCriterion && sampleRow.adGroupCriterion.keyword) Logger.log("Sample Keyword: " + JSON.stringify(sampleRow.adGroupCriterion.keyword));
     } else {
         Logger.log("Sample keyword query returned no results.");
     }

    const fullKeywordQuery = keywordQuery.replace("LIMIT 1", ""); // Remove limit for full fetch
    const report = AdsApp.search(fullKeywordQuery);

    while (report.hasNext()) {
        let row; // Define row outside try block for logging in catch
        try {
            row = report.next();
            const campaignData = row.campaign || {};
            const adGroupData = row.adGroup || {};
            const criterionData = row.adGroupCriterion || {};
            const keywordData = criterionData.keyword || {};

            const campaignId = campaignData.id;
            const campaignName = campaignData.name;
            const adGroupId = adGroupData.id;
            const adGroupName = adGroupData.name;
            const keywordText = keywordData.text;
            const keywordMatchType = keywordData.matchType;
            const isNegative = criterionData.negative; // Check if boolean

            if (!campaignId || !adGroupId || !keywordText || !keywordMatchType) {
                 Logger.log(`Skipping keyword row due to missing essential data (Campaign/AdGroup ID, Text, MatchType): ${JSON.stringify(row)}`);
                 continue;
            }

             // Initialize Campaign Cache
            if (!cache.campaigns[campaignId]) {
                cache.campaigns[campaignId] = {
                    name: campaignName,
                    adGroups: {},
                    negatives: [],
                    sharedListNegatives: [] // { listId: '...', listName: '...' }
                };
            }

            // Initialize Ad Group Cache
            if (!cache.campaigns[campaignId].adGroups[adGroupId]) {
                cache.campaigns[campaignId].adGroups[adGroupId] = {
                    name: adGroupName,
                    positives: [],
                    negatives: []
                };
            }

            const normalizedKeyword = normalizeKeyword(keywordText, keywordMatchType);

            // Check the boolean value explicitly
            if (isNegative === true) {
                 cache.campaigns[campaignId].adGroups[adGroupId].negatives.push(normalizedKeyword);
            } else if (isNegative === false) {
                 cache.campaigns[campaignId].adGroups[adGroupId].positives.push(normalizedKeyword);
            } else {
                 // Handle cases where 'negative' might not be a boolean (though it should be)
                 // This could happen if the field is missing or has an unexpected value.
                 // Assume positive if not explicitly negative, but log a warning.
                 Logger.log(`Warning: ad_group_criterion.negative was not explicitly true or false for criterion in Ad Group ${adGroupName} (ID: ${adGroupId}). Value: ${isNegative}. Assuming it's a positive keyword.`);
                 cache.campaigns[campaignId].adGroups[adGroupId].positives.push(normalizedKeyword);
            }

        } catch (e) {
             Logger.log(`Error processing keyword row: ${e} | Row: ${JSON.stringify(row)}`);
             // Optionally log stack trace: Logger.log(`Stack: ${e.stack}`);
        }
    }
     Logger.log(`Finished processing positive/ad group negative keywords for ${Object.keys(cache.campaigns).length} campaigns.`);
}


/**
 * Fetches campaign level negative keywords using GAQL.
 * Populates the cache.
 * @param {object} cache The data cache object.
 */
function fetchCampaignNegatives(cache) {
    const campaignNegativeQuery = `
      SELECT
        campaign.id,
        campaign_criterion.keyword.text,
        campaign_criterion.keyword.match_type
      FROM campaign_criterion
      WHERE campaign_criterion.negative = TRUE
        AND campaign_criterion.type = 'KEYWORD'
        AND campaign.status = 'ENABLED'
        AND campaign_criterion.status = 'ENABLED'
      LIMIT 1`; // Limit 1 for initial structure logging

    Logger.log("Running sample campaign negative query for structure check...");
    const sampleIterator = AdsApp.search(campaignNegativeQuery);
     if (sampleIterator.hasNext()) {
        const sampleRow = sampleIterator.next();
        Logger.log("Sample Row (Campaign Criterion): " + JSON.stringify(sampleRow));
        if(sampleRow.campaign) Logger.log("Sample Campaign: " + JSON.stringify(sampleRow.campaign));
        if(sampleRow.campaignCriterion) Logger.log("Sample CampaignCriterion: " + JSON.stringify(sampleRow.campaignCriterion));
        if(sampleRow.campaignCriterion && sampleRow.campaignCriterion.keyword) Logger.log("Sample Keyword: " + JSON.stringify(sampleRow.campaignCriterion.keyword));
     } else {
         Logger.log("Sample campaign negative query returned no results.");
     }

    const fullCampaignNegativeQuery = campaignNegativeQuery.replace("LIMIT 1", "");
    const report = AdsApp.search(fullCampaignNegativeQuery);

    while (report.hasNext()) {
        let row; // Define row outside try block for logging in catch
        try {
            row = report.next();
            const campaignData = row.campaign || {};
            const criterionData = row.campaignCriterion || {};
            const keywordData = criterionData.keyword || {};

            const campaignId = campaignData.id;
            const keywordText = keywordData.text;
            const keywordMatchType = keywordData.matchType;

            if (!campaignId || !keywordText || !keywordMatchType) {
                 Logger.log(`Skipping campaign negative row due to missing essential data (Campaign ID, Text, MatchType): ${JSON.stringify(row)}`);
                 continue;
            }

            if (cache.campaigns[campaignId]) {
                const normalizedKeyword = normalizeKeyword(keywordText, keywordMatchType);
                cache.campaigns[campaignId].negatives.push(normalizedKeyword);
            } else {
                // Campaign might exist but wasn't picked up by the first query (e.g., no active ad groups/keywords)
                // Or it's a campaign status issue mismatch between queries. Log it.
                Logger.log(`Warning: Found campaign negative for Campaign ID ${campaignId}, but campaign not found in initial keyword fetch cache. This negative will be ignored for conflict checks.`);
            }
        } catch (e) {
             Logger.log(`Error processing campaign negative row: ${e} | Row: ${JSON.stringify(row)}`);
             // Optionally log stack trace: Logger.log(`Stack: ${e.stack}`);
        }
    }
     Logger.log("Finished processing campaign negatives.");
}


/**
 * Fetches shared negative keyword lists, their keywords, and campaign associations.
 * Populates the cache.
 * @param {object} cache The data cache object.
 */
function fetchSharedNegativeLists(cache) {
    // 1. Get all shared lists and their negative keywords
    const listQuery = `
      SELECT
        shared_set.id,
        shared_set.name,
        shared_criterion.keyword.text,
        shared_criterion.keyword.match_type
      FROM shared_criterion
      WHERE shared_set.type = 'NEGATIVE_KEYWORDS'
        AND shared_set.status = 'ENABLED'
        AND shared_criterion.type = 'KEYWORD'
     `;
     // Cannot easily log sample row structure for shared_criterion via GAQL in the same way.
     // We rely on the known structure or older API methods if GAQL fails here.

    const listReport = AdsApp.search(listQuery);
    Logger.log("Processing shared negative lists and their keywords...");
    while (listReport.hasNext()) {
         let row; // Define row outside try block for logging in catch
         try {
            row = listReport.next();
            const sharedSetData = row.sharedSet || {};
            const criterionData = row.sharedCriterion || {};
            const keywordData = criterionData.keyword || {};

            const listId = sharedSetData.id;
            const listName = sharedSetData.name;
            const keywordText = keywordData.text;
            const keywordMatchType = keywordData.matchType;

             if (!listId || !listName || !keywordText || !keywordMatchType) {
                 Logger.log(`Skipping shared list keyword row due to missing essential data (List ID/Name, Text, MatchType): ${JSON.stringify(row)}`);
                 continue;
            }

            if (!cache.sharedLists[listId]) {
                cache.sharedLists[listId] = { name: listName, negatives: [] };
            }
            cache.sharedLists[listId].negatives.push(normalizeKeyword(keywordText, keywordMatchType));
         } catch (e) {
            Logger.log(`Error processing shared list keyword row: ${e} | Row: ${JSON.stringify(row)}`);
            // Optionally log stack trace: Logger.log(`Stack: ${e.stack}`);
         }
    }
     Logger.log(`Finished processing ${Object.keys(cache.sharedLists).length} shared lists and their keywords.`);


    // 2. Get campaign associations for these lists
    // We might need to iterate through campaigns if GAQL for campaign_shared_set is complex/unreliable
    Logger.log("Fetching campaign associations for shared lists...");
    const campaignListQuery = `
       SELECT
         campaign.id,
         campaign_shared_set.shared_set
       FROM campaign_shared_set
       WHERE campaign_shared_set.status = 'ENABLED'
         AND campaign.status = 'ENABLED'
         AND shared_set.type = 'NEGATIVE_KEYWORDS'
         AND shared_set.status = 'ENABLED'  -- Added status check for the shared set itself
    `;

    const campaignListReport = AdsApp.search(campaignListQuery);
     while (campaignListReport.hasNext()) {
         let row; // Define row outside try block for logging in catch
         try {
            row = campaignListReport.next();
            const campaignData = row.campaign || {};
            const campaignSharedSetData = row.campaignSharedSet || {};

             // shared_set field is the resource name like 'customers/123/sharedSets/456'
            const campaignId = campaignData.id;
            const sharedSetResourceName = campaignSharedSetData.sharedSet;

             if (!campaignId || !sharedSetResourceName) {
                 Logger.log(`Skipping campaign shared set row due to missing essential data (Campaign ID, Set Resource Name): ${JSON.stringify(row)}`);
                 continue;
             }

             // Extract listId from resource name
             const listIdMatch = sharedSetResourceName.match(/sharedSets\/(\d+)$/);
             if (!listIdMatch || !listIdMatch[1]) {
                 Logger.log(`Could not extract list ID from resource name: ${sharedSetResourceName}. Skipping association.`);
                 continue;
             }
             const listId = listIdMatch[1];


            if (cache.campaigns[campaignId] && cache.sharedLists[listId]) {
                 // Check if already added to prevent duplicates if query returns multiple times
                 const alreadyAdded = cache.campaigns[campaignId].sharedListNegatives.some(item => item.listId === listId);
                 if (!alreadyAdded) {
                    cache.campaigns[campaignId].sharedListNegatives.push({
                        listId: listId,
                        listName: cache.sharedLists[listId].name
                    });
                 }
            } else {
                if (!cache.campaigns[campaignId]) {
                     // This is expected if the campaign wasn't in the first query (no active keywords/adgroups)
                     // Logger.log(`Warning: Found shared list association for Campaign ID ${campaignId}, but campaign not in initial keyword cache. Skipping association.`);
                }
                 if (!cache.sharedLists[listId]) {
                     // This case might happen if a list is associated but has no keywords, or status mismatch.
                     Logger.log(`Warning: Found shared list association for List ID ${listId}, but list details (name/keywords) not found in cache (maybe empty or status mismatch?). Skipping association.`);
                 }
            }
         } catch (e) {
             Logger.log(`Error processing campaign shared set row: ${e} | Row: ${JSON.stringify(row)}`);
             // Optionally log stack trace: Logger.log(`Stack: ${e.stack}`);
         }
     }
     Logger.log("Finished processing campaign-shared list associations.");
}


// --- Conflict Detection Logic ---

/**
 * Iterates through the cached data to find conflicts.
 * @param {object} cache The populated data cache.
 * @return {Array<Array<string>>} An array of conflict rows for the spreadsheet.
 */
function findConflicts(cache) {
    const conflictsOutput = []; // [['negDisplayText', 'Level: Name', 'posDisplayText1, posDisplayText2'], ...]
    Logger.log("Starting conflict analysis...");

    for (const campaignId in cache.campaigns) {
        const campaign = cache.campaigns[campaignId];

        for (const adGroupId in campaign.adGroups) {
            const adGroup = campaign.adGroups[adGroupId];
            const positives = adGroup.positives; // Array of normalized { display, raw, matchType }

            if (positives.length === 0) continue; // No positives in this ad group, no conflicts possible here

            const adGroupLocation = `Ad Group: ${adGroup.name} (Campaign: ${campaign.name})`;
            const campaignLocation = `Campaign: ${campaign.name}`;

            // 1. Check Ad Group Negatives
            checkLevelForConflicts(
                conflictsOutput,
                adGroup.negatives,
                positives,
                adGroupLocation
            );

            // 2. Check Campaign Negatives
            checkLevelForConflicts(
                conflictsOutput,
                campaign.negatives,
                positives,
                campaignLocation
            );

            // 3. Check Shared List Negatives applied to this campaign
            for (const listInfo of campaign.sharedListNegatives) { // { listId, listName }
                 const listId = listInfo.listId;
                 const listName = listInfo.listName;
                 const sharedListLocation = `Shared List: ${listName} (Applied to Campaign: ${campaign.name})`;

                 if (cache.sharedLists[listId] && cache.sharedLists[listId].negatives) {
                     checkLevelForConflicts(
                         conflictsOutput,
                         cache.sharedLists[listId].negatives,
                         positives,
                         sharedListLocation
                     );
                 }
            }
        }
    }
    Logger.log(`Conflict analysis complete. Found ${conflictsOutput.length} potential conflicts.`);
    return conflictsOutput;
}


/**
 * Helper function to check negatives at a specific level against positives.
 * Modifies the conflictsOutput array directly.
 * @param {Array<Array<string>>} conflictsOutput The main array holding conflict rows.
 * @param {Array<object>} negatives Array of normalized negative keywords { display, raw, matchType }.
 * @param {Array<object>} positives Array of normalized positive keywords { display, raw, matchType }.
 * @param {string} locationString Description of where the negative keyword exists (e.g., "Campaign: X").
 */
function checkLevelForConflicts(conflictsOutput, negatives, positives, locationString) {
     if (!negatives || negatives.length === 0) return; // No negatives at this level

    for (const negative of negatives) {
        const blockedPositivesDisplay = [];
        for (const positive of positives) {
            try {
                if (negativeBlocksPositive(negative, positive)) {
                    blockedPositivesDisplay.push(positive.display);
                }
            } catch (e) {
                 Logger.log(`Error during conflict check between negative "${negative.display}" and positive "${positive.display}" at ${locationString}: ${e}`);
            }
        }

        if (blockedPositivesDisplay.length > 0) {
            conflictsOutput.push([
                negative.display,
                locationString,
                blockedPositivesDisplay.join(', ') // Combine blocked positives display texts
            ]);
        }
    }
}

/**
 * Determines if a negative keyword blocks a positive keyword based on text and match type.
 * Logic based on how Google Ads matching prevents ads from showing.
 * @param {object} negative Normalized negative keyword { display, raw, matchType }.
 * @param {object} positive Normalized positive keyword { display, raw, matchType }.
 * @return {boolean} True if the negative blocks the positive.
 */
function negativeBlocksPositive(negative, positive) {
    // Scenario 1: Negative Exact Match
    // Blocks ANY positive type if the positive keyword text *exactly* matches the negative text.
    if (negative.matchType === 'EXACT') {
        return positive.raw === negative.raw;
    }

    // Scenario 2: Negative Phrase Match
    // Blocks Phrase and Broad positives if the negative text is contained as an ordered sequence within the positive text.
    // Blocks Exact positives only if the texts match exactly.
    if (negative.matchType === 'PHRASE') {
         if (positive.matchType === 'EXACT') {
             return positive.raw === negative.raw;
         } else { // Positive is PHRASE or BROAD
             return isSubsequence(negative.raw, positive.raw);
         }
    }

    // Scenario 3: Negative Broad Match
    // Blocks ANY positive type if *all* terms in the negative keyword are present *anywhere* within the positive keyword text.
    if (negative.matchType === 'BROAD') {
        return hasAllTokens(negative.raw, positive.raw);
    }

    // Should not happen with valid match types
    Logger.log(`Warning: Encountered unexpected negative match type '${negative.matchType}' during conflict check.`);
    return false;
}


// --- Text Processing and Normalization ---

/**
 * Normalizes keyword text and match type.
 * Raw: lowercase, no modifier symbols (+), no phrase/exact wrappers ("", []), single spaces between words, trimmed.
 * Display: Includes match type symbols ([], "") for readability, based on normalized type.
 * MatchType: Simple uppercase ('EXACT', 'PHRASE', 'BROAD').
 * @param {string} text Keyword text.
 * @param {string} matchType Keyword match type (e.g., 'EXACT', 'PHRASE', 'BROAD_MATCH').
 * @return {{display: string, raw: string, matchType: string}} Normalized keyword object. Returns null if text is invalid.
 */
function normalizeKeyword(text, matchType) {
    if (!text || typeof text !== 'string' || text.trim() === '') {
        Logger.log(`Warning: Invalid keyword text received: ${text}`);
        return null; // Or handle as needed
    }
    if (!matchType || typeof matchType !== 'string') {
         Logger.log(`Warning: Invalid match type received: ${matchType} for text: ${text}`);
         return null; // Or handle as needed
    }

    let raw = text.trim();
    // Normalize GAQL match types to simple uppercase (e.g., BROAD_MATCH -> BROAD)
    let normalizedMatchType = matchType.toUpperCase().replace('_MATCH', '');

    // Validate normalized match type
    if (!['EXACT', 'PHRASE', 'BROAD'].includes(normalizedMatchType)) {
        Logger.log(`Warning: Unrecognized normalized match type '${normalizedMatchType}' for text: ${text}. Defaulting to BROAD.`);
        normalizedMatchType = 'BROAD'; // Default or handle error
    }


    // Clean raw text based on original match type assumptions (remove wrappers)
    if (normalizedMatchType === 'PHRASE') {
        raw = trimKeyword(raw, '"', '"');
    } else if (normalizedMatchType === 'EXACT') {
        raw = trimKeyword(raw, '[', ']');
    }

    // Remove broad match modifier '+' sign PREPENDED to words
    raw = raw.replace(/\+(\S+)/g, '$1'); // More specific regex: + followed by non-space
    // Collapse multiple spaces and trim again
    raw = raw.replace(/\s+/g, ' ').trim();
    // Lowercase for case-insensitive comparison
    raw = raw.toLowerCase();

    // Create display version using the raw, cleaned text
    let display = raw;
    if (normalizedMatchType === 'PHRASE') {
        display = '"' + display + '"';
    } else if (normalizedMatchType === 'EXACT') {
        display = '[' + display + ']';
    }
    // No special display format for BROAD

    // Final check for empty raw string after cleaning
    if (raw === '') {
         Logger.log(`Warning: Keyword text became empty after normalization. Original text: "${text}", MatchType: ${matchType}`);
         return null;
    }

    return { display: display, raw: raw, matchType: normalizedMatchType };
}


/**
 * Removes leading/trailing characters if they match exactly.
 * @param {string} text The string to trim.
 * @param {string} open The expected opening character.
 * @param {string} close The expected closing character.
 * @return {string} The trimmed string.
 */
function trimKeyword(text, open, close) {
    if (text.startsWith(open) && text.endsWith(close)) {
        // Slice from after the open char to before the close char
        return text.substring(open.length, text.length - close.length).trim();
    }
    return text; // Return original if no match
}

/**
 * Checks if all space-separated tokens from keywordText1 are present in keywordText2.
 * Order does not matter. Comparison is case-insensitive (expects lowercase inputs).
 * @param {string} keywordText1 The 'needle' keyword text (raw, normalized, lowercase).
 * @param {string} keywordText2 The 'haystack' keyword text (raw, normalized, lowercase).
 * @return {boolean} True if all tokens from text1 are in text2.
 */
function hasAllTokens(keywordText1, keywordText2) {
    if (!keywordText1 || !keywordText2) return false; // Handle null/empty inputs
    const tokens1 = keywordText1.split(' ');
    // Create a Set of tokens from keywordText2 for efficient O(1) average time complexity lookups
    const tokenSet2 = new Set(keywordText2.split(' '));

    for (const token of tokens1) {
        // If any token from keywordText1 is not found in the Set derived from keywordText2, return false
        if (!tokenSet2.has(token)) {
            return false;
        }
    }
    // If the loop completes, all tokens from keywordText1 were found in keywordText2
    return true;
}

/**
 * Checks if keywordText1 appears as an ordered subsequence within keywordText2.
 * Comparison is case-insensitive (expects lowercase inputs). Checks for whole word/phrase boundaries.
 * @param {string} keywordText1 The 'needle' keyword text (raw, normalized, lowercase).
 * @param {string} keywordText2 The 'haystack' keyword text (raw, normalized, lowercase).
 * @return {boolean} True if text1 is a subsequence of text2.
 */
function isSubsequence(keywordText1, keywordText2) {
     if (!keywordText1 || !keywordText2) return false; // Handle null/empty inputs
    // Add spaces to the start and end of both strings.
    // This ensures that we match whole words or the entire phrase,
    // preventing partial matches like "car" in "carpet".
    // For example, checking if "cat food" is in "the big cat food bowl".
    // Becomes checking if " cat food " is in " the big cat food bowl ".
    return (' ' + keywordText2 + ' ').indexOf(' ' + keywordText1 + ' ') !== -1;
}


// --- Spreadsheet Handling ---

/**
 * Gets the spreadsheet object, creating one if URL is not provided or invalid.
 * @param {string} url The URL of the spreadsheet. If empty/invalid, a new one is created.
 * @return {Spreadsheet} The spreadsheet object.
 */
function getSpreadsheet(url) {
    let ss;
    if (url && typeof url === 'string' && url.trim() !== '') {
        try {
            ss = SpreadsheetApp.openByUrl(url);
            Logger.log(`Using existing spreadsheet: ${url}`);
            return ss;
        } catch (e) {
            Logger.log(`Failed to open spreadsheet with URL: ${url}. Error: ${e}. Creating a new one instead.`);
            // Fall through to create a new one
        }
    }

    // Create a new spreadsheet if no valid URL provided or opening failed
    ss = SpreadsheetApp.create(`Negative Keyword Conflicts Report - ${getDateString()}`);
    Logger.log(`Created new spreadsheet: ${ss.getUrl()}`);
    // Removed automatic sharing: ss.addEditor(Session.getEffectiveUser());
    // You might need to manually share the newly created sheet if others need access.
    return ss;
}

/**
 * Writes the conflict data to the spreadsheet, starting below the header row.
 * @param {Sheet} sheet The sheet object.
 * @param {Array<Array<string>>} conflictData 2D array of conflict rows.
 */
function outputConflictsToSheet(sheet, conflictData) {
    if (!conflictData || conflictData.length === 0) {
        Logger.log("No conflict data to write to the sheet.");
        return; // Nothing to write
    }
    try {
        // Determine the range: Start at row 2 (below headers), column 1,
        // for the number of rows in conflictData, and the number of columns in the first conflict row.
        const startRow = 2;
        const startCol = 1;
        const numRows = conflictData.length;
        const numCols = conflictData[0].length; // Assumes all rows have the same number of columns

        sheet.getRange(startRow, startCol, numRows, numCols)
             .setValues(conflictData);
        Logger.log(`Successfully wrote ${numRows} conflicts to the sheet.`);
    } catch (e) {
         Logger.log(`Error writing conflict data to sheet: ${e}`);
         // Optionally log stack trace: Logger.log(`Stack: ${e.stack}`);
    }
}

/**
 * Gets a formatted date string for sheet naming (YYYY-MM-DD).
 * @return {string} Formatted date string.
 */
function getDateString() {
    try {
        return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
    } catch (e) {
         Logger.log(`Error getting script time zone or formatting date: ${e}. Defaulting to UTC.`);
         // Fallback to UTC if timezone fails
         return Utilities.formatDate(new Date(), 'UTC', 'yyyy-MM-dd');
    }
}
  
  