---
name: postpilot-dashboard
description: Build a live PostPilot direct mail performance dashboard in Claude from your brand's PostPilot Campaign Data Google Sheet. It is a visual page with headline results, iROAS vs. ROAS by campaign, recommendations, a budget plan, monthly trends, always-on campaigns, and a sortable campaign table, recalculated from the sheet every time it opens. Use when the user asks for a PostPilot dashboard, report page, visual report, or artifact of their direct mail results. If the sheet link is not available, the only response is to ask for it (see "Start here").
---

# PostPilot Dashboard

This skill builds one live dashboard for the user's brand from their PostPilot Campaign Data sheet, using Claude's **Dashboard** artifact type. The page reads the sheet through the user's own Google Sheets connection each time it opens, then calculates every number, chart, and recommendation on the page. Nothing is copied into the dashboard by hand.

The page itself is already written. It is the four files in `assets/`. Your job is to connect it to the user's sheet and install it exactly as written. Do not redesign, rewrite, shorten, or "improve" the files.

For a written read-out or questions about the numbers, use the `postpilot-reporting` skill. It follows the same rules as this page.

## Start here: get the sheet link

Before doing anything else, check whether the link to the user's PostPilot Campaign Data Google Sheet is in the conversation.

If it is not, the only response is to ask for it. Do not build anything, describe the dashboard, or ask anything else. Reply with this, adjusted only to fit the conversation:

> To build your PostPilot dashboard, I need the link to your PostPilot Campaign Data Google Sheet.
>
> 1. **Get the link:** in PostPilot, go to the **Integrations** page and open the **Google Sheets** integration.
> 2. **Connect Google Sheets to Claude** if you haven't already (in Claude's settings, under **Connectors**). The dashboard reads your sheet through it each time it opens.
> 3. **Paste the link here** and I'll build it.

If Google Sheets is already connected in this conversation, leave out step 2.

## Requirements

- **Dashboard artifacts:** the ability to create an artifact from the Dashboard type (claude.ai). If you cannot, say that this environment can't build the live dashboard, and offer a written read-out with the `postpilot-reporting` skill instead.
- **Google Sheets connector:** the user's Google Sheets connector, with access to the sheet. A CSV export won't work here, because the dashboard must stay live. If the user only has a CSV, offer the written read-out instead.

## Build steps

1. **Get the sheet ID.** It is the part of the link between `/spreadsheets/d/` and the next `/`.

2. **Check access with a small read.** Call the Google Sheets connector's tool for reading cell values (for example `get_values`) with `{"spreadsheetId": "<id>", "range": "A1:K3"}`.
   - The header row must be: `date, channel_name, campaign_name, campaign_id, tactic, impressions, clicks, spend, conversions, revenue, iroas`.
   - If the call fails, tell the user what failed: not connected, no access to the sheet, or the wrong sheet. Stop there.
   - If the header doesn't match, say that this isn't a PostPilot Campaign Data sheet. Stop there.

3. **Get the brand name.** Take it from the sheet's title, `PostPilot — <brand name> — Campaign Data`. Read the title with the connector's spreadsheet-details tool if it has one, or use the name the user gave. If you can't get it, use `Your brand`.

4. **Create the dashboard.** Create an artifact from the **Dashboard** type, titled `<brand name> Direct Mail Performance`. Follow the type's own instructions for creating and writing it.

5. **Write everything in one batch** to the dashboard's store:

   | Document | Content |
   |---|---|
   | `dash/meta` | `{"title": "<brand name> Direct Mail Performance"}` |
   | `datasets/sheet` | See below |
   | `files/style.css` | `{"text": <assets/style.css, exactly>}` |
   | `files/common.js` | `{"text": <assets/common.js, exactly>}` |
   | `files/engine.js` | `{"text": <assets/engine.js, exactly>}` |
   | `files/index.html` | `{"text": <assets/index.html, exactly, with __BRAND__ replaced by the brand name>}` |

   Write `datasets/sheet` as follows:

   ```json
   {
     "title": "Campaign Data sheet",
     "description": "Every row of your PostPilot Campaign Data Google Sheet, one row per campaign per send date. Every figure, chart and recommendation on this page is calculated from it on load. Reads columns A to K of the first tab.",
     "source": {
       "kind": "query",
       "connector": "<the Google Sheets connector's name, as the user added it>",
       "tool": "<the tool you used in step 2>",
       "args": { "spreadsheetId": "<id>", "range": "A1:K" }
     }
   }
   ```

   - The dataset id must be `sheet`. The page's code reads it by that name, and its loader turns the connector's answer into rows.
   - Copy each asset file character for character. If your environment can write a document from a local file, use that instead of retyping the contents.
   - Replace `__BRAND__` (it appears once, in `index.html`) and change nothing else.

6. **Run the stored call once**, as the Dashboard type asks. A full read (`A1:K`) can be large. If the result comes back as a file, that's fine; you don't need to read it.

7. **Hand over** in a few plain sentences:
   - What the page shows: headline results, iROAS vs. ROAS, recommendations and budget plan, trends, always-on campaigns, and every campaign.
   - That it is live: it recalculates from the sheet each time it opens, and PostPilot refreshes the sheet daily.
   - That anyone the user shares the dashboard with needs their own Google Sheets connection and access to the sheet to see numbers.
   - That they can ask you to explain any number, or ask for a written read-out.

## Changes after it's built

- **Change only what the user asks for.**
- **Leave the calculations in `engine.js` alone unless asked.** The page's rules match the `postpilot-reporting` skill: iROAS first, results final after 48 days, grow, then improve, then redirect, and reduce only when the evidence clears the bar.
- **If a number looks wrong,** re-run the sheet read yourself and compare it before editing anything.
- **Talk about it as the user's dashboard,** in plain words. Don't talk about stores, documents, or datasets.

## Things not to do

- Do not build anything before you have the sheet link.
- Do not copy sheet rows into the dashboard as a file, or put numbers in the page markup. The page must read the sheet live.
- Do not rewrite, restyle, minify, or partly copy the asset files.
- Do not use another brand's sheet, or compare the user's results with other brands.
- Do not use the sheet's column labels on the page or in your hand-over. Impressions are postcards, conversions are orders, and tactic is campaign category.
