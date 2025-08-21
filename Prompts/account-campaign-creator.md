PRD – Google Ads Account Builder Script (Phase 1: Campaign Creation, Multi-Account)
Project Overview

We are building a Google Ads script that functions as part of an account builder framework. The script will read data from a Google Sheet and create Google Ads campaigns inside of multiple existing Google Ads accounts.

This script will be the first component of a broader workflow, where other scripts will handle ad groups, ads, keywords, and ad assets in sequence.

The goal is to automate campaign setup across accounts at scale, reduce manual work, and ensure consistency.

Problem Statement

Currently, campaign setup across multiple accounts is time-consuming and error-prone. Manually copying details from spreadsheets into the Google Ads UI slows down account builds, especially when working across dozens or hundreds of accounts in an MCC.

This tool is for Google Ads managers and automation specialists who need a repeatable, efficient way to push campaign data directly from Google Sheets into multiple Google Ads accounts.

Core Features

Google Sheet Integration

Script connects to a specified Google Sheet.

Reads from a designated Campaigns tab containing campaign-level data.

Each row specifies the Account CID so the script can target the correct account.

Errors are written to a dedicated Error Log tab.

Campaign Creation (Multi-Account)

For each row:

Select the account using MccApp.select(accountCid).

Create a new campaign inside that account.

Script only creates new campaigns (no updates to existing ones).

Execution in Google Ads Environment

Script runs as a Google Ads MCC Script.

Can run on demand or via scheduled execution.

Error Handling

Any failed row is logged in the Error Log tab with CID, row number, and error message.

Script continues processing subsequent rows.

Batching & Runtime Safety

Script must complete within ≤25 minutes (buffer against Google Ads Script 30-minute cap).

Implement batching (e.g., process N rows per run).

Store a cursor (last processed row) in Script Properties or a Run State tab so the script can resume on the next run without duplicating work.

Duplicate Protection

Before creating a campaign, check if a campaign with the same name already exists in that account. Skip creation if found.

User Flow

User prepares a Google Sheet with tabs:

Campaigns (input tab, one row per campaign).

Error Log (output tab for failures).

Future tabs: Ad Groups, Ads, Keywords, Ad Assets.

User runs the MCC script from Google Ads Scripts.

Script iterates rows in the Campaigns tab:

Select account via Account CID.

Create campaign with row data.

Script logs any errors to the Error Log tab.

Script tracks its last processed row (for batching).

User verifies new campaigns in their respective accounts.

Success Criteria

Script creates campaigns in the correct accounts as specified by Account CID.

All mapped fields (budget, bidding, networks, dates, targeting, etc.) populate correctly.

Script runs safely under 25 minutes per execution, resuming from the last processed row as needed.

Errors log to the Error Log tab with full traceability.

Duplicate campaigns are not created if re-run on the same data.

Technical Requirements

Must be built as a Google Ads MCC Script (not single-account).

Input: Google Sheet with defined tab/column structure.

Output: Campaigns created in multiple accounts under the MCC.

Runtime: Must handle batching and resuming to stay under the 25-minute cap.

Error Handling:

Log all failures to the Error Log tab.

Script should not halt on single errors.

Duplicate Handling:

Check campaign names in each account before creating.

State Management:

Store last processed row (cursor) to allow safe continuation across runs.

Data Sources

Google Sheet

Campaigns tab = campaign-level input data.

Error Log tab = errors and failed rows.

Other tabs (Ad Groups, Ads, Keywords, Ad Assets) = future expansion.

Proposed Campaigns Tab Schema
Column Header	Description
Account CID	10-digit customer ID of the account (e.g., 123-456-7890).
Campaign Name	Unique name of the campaign.
Budget (Daily)	Numeric daily budget (e.g., 50 = $50/day).
Bidding Strategy	Strategy to apply (e.g., MAXIMIZE_CONVERSIONS, TARGET_CPA, MANUAL_CPC).
Campaign Type	Type of campaign (e.g., Search, Display, Performance Max).
Networks	Networks to include (e.g., Google Search; Search Partners; Display).
Start Date	Campaign start date (YYYY-MM-DD).
End Date	Campaign end date (YYYY-MM-DD or blank for none).
Status	Initial status (Enabled, Paused).
Location Targeting	Geographic targeting (e.g., United States; ZIP codes; city names).
Language Targeting	Languages to target (e.g., English, Spanish).
Tracking Template	Tracking template URL (optional).
Campaign Labels	Comma-separated list of labels to apply.
Notes	Free-text notes (ignored by script).
Proposed Error Log Tab Schema
Column Header	Description
Timestamp	Date/time when error occurred.
Account CID	Account where error occurred.
Row Number	Row number from Campaigns tab.
Campaign Name	Campaign name attempted.
Error Type	General category (Validation, Duplicate, API, etc.).
Error Message	Full descriptive error message.
Status	Whether row was skipped, retried, or aborted.
Timeline & Phases

Phase 1 (this PRD): Multi-account campaign creation script.

Phase 2: Ad group creation script (reads Ad Groups tab).

Phase 3: Ads creation script (reads Ads tab).

Phase 4: Keywords creation script (reads Keywords tab).

Phase 5: Ad Assets script (reads Ad Assets tab).

Future: Logging dashboards, automated retries, extended targeting options.

Out of Scope

Single-account script (this must support MCC).

UI/dashboard (script-only).

Non-Google data sources (all data comes from Sheets).

Editing/pausing existing campaigns (create-only).

✅ With these changes, your developer knows this script is MCC-ready, batch-safe, and error-resilient.

