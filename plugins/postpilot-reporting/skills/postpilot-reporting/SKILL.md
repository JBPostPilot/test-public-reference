---
name: postpilot-reporting
description: Analyze a PostPilot "Campaign Data" Google Sheet (title "PostPilot — <Brand> — Campaign Data") to reproduce the PostPilot dashboard views, answer questions about direct mail campaign performance, and make evidence-based recommendations on where to invest more, what to improve, where to redirect budget, and where spend is not paying off. Use whenever a user shares, links, pastes, or asks about one of these sheets or its CSV, or asks about their PostPilot or direct mail campaign performance. If the sheet link is not available, the only response is to ask for it (see "Start here"). Works for any brand; the column layout never changes. Written for brand owners and marketers.
---

# PostPilot Reporting

PostPilot mails physical postcards and mailers for e-commerce brands. A brand that turns on PostPilot's Google Sheets integration gets one sheet, rewritten in full once a day, with one row per campaign per send date. This skill turns that sheet into the same read-out the brand sees in the PostPilot app, lets the user ask questions against it, and produces recommendations grounded in the numbers.

## Start here: get the sheet link

Every answer comes from the user's own Campaign Data sheet. Before doing anything else, check whether the link to that Google Sheet (or the sheet's data, for example an attached CSV export of it) is in the conversation.

If it is not, the only response is to ask for the link. Do not answer the question, estimate, use general benchmarks, describe what the analysis would show, or ask anything else. Reply with this, adjusted only to fit the conversation:

> To look at your PostPilot results, I need the link to your PostPilot Campaign Data Google Sheet.
>
> 1. **Get the link:** in PostPilot, go to the **Integrations** page and open the **Google Sheets** integration.
> 2. **Connect Google Drive to Claude** if you haven't already (in Claude's settings, under **Connectors**), so I can open the sheet.
> 3. **Paste the link here** and I'll take it from there.
>
> Prefer not to connect Google Drive? Open the sheet, choose **File → Download → Comma-separated values (.csv)**, and attach the file here instead.

If Google Drive is already connected in this conversation, leave out step 2.

If a link is shared but cannot be opened (Google Drive is not connected, or the sheet is not shared with the Google account connected to Claude), say so plainly and give the same two fixes: connect Google Drive under Connectors in Claude's settings, or download the sheet as a CSV and attach it.

Three jobs, in order of importance:

1. Recommend: where to invest more, what to improve, where to redirect budget, and why.
2. Answer questions: "how did retention do last quarter", "which campaign has the best iROAS", "is spend up".
3. Reproduce the dashboard: top-line metrics, campaign table, category split, trend.

## 1. Who is reading

The reader is the brand owner or marketer who runs these campaigns. Write to them directly, in the second person: "your campaigns", "your Retention spend", "the link to your sheet". Never refer to them in the third person ("the brand", "the merchant", "the customer's sheet"). If someone else asked (for example a PostPilot Account Manager), write it the same way, since the read-out is shared with the brand as-is.

- Plain language, lead with outcomes and one or two actions, no internal jargon. Say "control group" rather than "holdout", "mailed" rather than "processed".
- "iROAS" is a product term, not jargon. Always use it by name (and ROAS, iRevenue, iRPR, CPA, AOV); explain it in plain words on first use ("iROAS, the return on the revenue the mail actually caused, measured against a control group"), then keep using the term. Never replace it with a paraphrase such as "revenue the mail caused" or "incremental return".
- Anything a reader might otherwise need PostPilot to explain (why recent months look low, why a campaign has no iROAS, why a figure is preliminary, why the sheet differs from the app) is explained in the response itself, in the sentence or table where it applies, in a form the brand can act on.
- Never add a section addressed to PostPilot staff ("For the AM", "Internal notes", "Diagnostics"). If a point is worth making, it is worth making to the brand.

## 2. The sheet

- Title: `PostPilot — <Brand> — Campaign Data`. One tab. Header in row 1, data from row 2, newest dates first.
- Named range `PostPilotData` covers columns A to J. Column K (`iroas`) is outside it. Read all eleven columns (`A1:K`).
- Grain: one row per `campaign_id` per `date`. The pair is unique.
- Window: rolling two years of send dates. Archived campaigns disappear with their whole history on the next rewrite.
- Refresh: replaced daily. Recent rows keep changing for about seven weeks (section 4).
- Currency: dollars, already converted. Never divide by 100.

The sheet uses generic ad-platform column labels (the format is shared with other channels). Translate every column to its PostPilot meaning on load and use only the PostPilot terms in anything you write. Never say "impressions" or "clicks" to a user.

| Sheet column | PostPilot meaning | Use as | Notes |
|---|---|---|---|
| `date` | Postcard created date (UTC) | Send date | The day the postcards for this row were created for mailing. A cohort date, not an order date: revenue on a row belongs to postcards created that day, whenever the order happened. |
| `channel_name` | Always `direct_mail` | Ignore | Only useful when blending with other channels. |
| `campaign_name` | Campaign name | Label | Can change if renamed. Group by `campaign_id`. |
| `campaign_id` | Campaign id | Key | Text. Keep it as a string. |
| `tactic` | Campaign category | Category | `Prospecting`, `Retargeting`, `Retention`, or `Other` (no category set). |
| `impressions` | Postcards created | Postcards | Count of postcards created for mailing that day. Control-group (unmailed) customers are not included. |
| `clicks` | Nothing | Drop on load | Never populated. Direct mail has no click signal. Do not mention it, do not treat it as zero. |
| `spend` | Postcard cost, dollars | Spend | Cost of the postcards in the row, including postage surcharges. |
| `conversions` | Orders | Orders | Orders attributed to the postcards created that day, matched-customer attribution. Coupon-code redemptions are not counted here. |
| `revenue` | Sales, dollars | Revenue | Revenue from those attributed orders. |
| `iroas` | iROAS | iROAS | Lifetime incremental ROAS for the whole campaign, repeated on every row of that campaign. Blank for most campaigns. Section 5. |

Vocabulary for output: postcards (not impressions or cards sent), orders (not conversions), revenue, spend, campaign category (not tactic), send date. "Cards" is fine as shorthand for postcards.

## 3. Loading

The usual input is the sheet link, read through the user's Google Drive or Google Sheets connection. An attached CSV export of the same sheet works too. Parse `date` as a date, the five numeric columns as numbers with blanks as missing (not zero), and `campaign_id` as text.

```python
import pandas as pd
from datetime import date, timedelta

df = pd.read_csv(path, dtype={"campaign_id": str}, parse_dates=["date"])
df = df.drop(columns=["clicks", "channel_name"]).rename(columns={
    "date": "send_date",
    "tactic": "category",
    "impressions": "postcards",
    "conversions": "orders",
})
for col in ["postcards", "spend", "orders", "revenue", "iroas"]:
    df[col] = pd.to_numeric(df[col], errors="coerce")

today = pd.Timestamp(date.today())
mature_cutoff = today - timedelta(days=48)
df["maturity"] = "mature"
df.loc[df["send_date"] > mature_cutoff, "maturity"] = "in_flight"
df.loc[df["send_date"] > today - timedelta(days=14), "maturity"] = "new"
```

If reading through the Google Sheets API, request `A1:K` with unformatted values and use the header row for column order.

## 4. Maturity: when numbers are final

Orders count toward a card for 48 days after it is mailed, and cards take about a week to land. Therefore:

- `date` older than 48 days: final.
- `date` within the last 48 days: still accruing. ROAS is understated.
- `date` within the last 14 days: usually little or no revenue yet. Not a failure.

Compute ROAS, CPA, conversion rate, and AOV on mature rows by default. Report in-flight spend and cards separately, or label their ratios "preliminary". Every read-out states the maturity cut-off date.

## 5. iROAS and the incremental metrics

iROAS (incremental ROAS) compares customers who were mailed with a random control group that was not. It answers "how much revenue did the mail cause", which is the number PostPilot treats as the real measure of performance. Name it "iROAS" in every output and explain it once; the explanation supports the term, it does not replace it. Plain ROAS includes orders those customers would have placed anyway and typically runs several times higher.

Definition (campaign lifetime, all send dates, not just the two-year window):

```
lift per recipient (iRPR) = treatment revenue / treatment cards  -  control revenue / control cards
iroas                      = iRPR / (treatment spend / treatment cards)
```

Rules:

- One value per campaign. Never sum, average, or trend the column; every row of a campaign repeats the same number.
- Blank means not measurable: no control group, no spend yet, lift was zero or negative, or the campaign is too new to report (roughly the first two weeks after its first send). Blank is never zero.
- Values are always positive. A campaign whose mailed group did no better than its control group shows blank rather than a negative number. So a blank on a campaign that does have a control group is a real result, not missing data: say so plainly (section 8).
- Re-estimated daily until every card in the campaign is past 48 days, so it moves for active campaigns.
- Control groups are usually 10 to 50 percent of the audience. Below roughly 1,000 mailed cards, treat iROAS as directional.
- What iROAS does not capture: it counts orders within the 48-day window only. Repeat purchases after that, lifetime value from new customers, and any lift outside matched customers are excluded, so it is a conservative measure of value, most of all for Prospecting. Mention this when a campaign sits near 1.0, but do not use it to excuse a campaign that stays well below 1.0.

Derived incremental metrics that match the app's algebra, per campaign, using lifetime cards and spend from the sheet where the campaign's full history is inside the two-year window:

| Metric | Formula |
|---|---|
| Cost per card | `spend / postcards` |
| iRPR (incremental revenue per recipient) | `iroas * cost per card` |
| iRevenue (incremental revenue) | `iRPR * postcards` |

The sheet does not carry control-group sizes or control revenue, so iConversions and a true account-level iROAS cannot be rebuilt. For a blended number, report `sum(iRevenue) / sum(spend)` over the campaigns that have an iROAS and label it "spend-weighted iROAS across measured campaigns".

## 6. Dashboard-equivalent views

Build these before answering anything; most questions are a filter on one of them.

Top line (account, mature rows, plus the in-flight line):

| Metric | Formula |
|---|---|
| Postcards | `sum(postcards)` |
| Spend | `sum(spend)` |
| Revenue | `sum(revenue)` |
| ROAS | `sum(revenue) / sum(spend)` |
| Orders | `sum(orders)` |
| Conversion rate | `sum(orders) / sum(postcards)` |
| CPA | `sum(spend) / sum(orders)` |
| AOV | `sum(revenue) / sum(orders)` |
| RPR | `sum(revenue) / sum(postcards)` |
| Measured campaigns | count with iROAS, and their share of spend |
| Spend-weighted iROAS | `sum(iRevenue) / sum(spend)` over measured campaigns |
| iROAS range | min, median, max across measured campaigns |

Campaign table (one row per `campaign_id`): name, category, status (active if sent in the last 30 days, otherwise finished), first and last send date, postcards, spend, orders, revenue, ROAS, CPA, AOV, conversion rate, iROAS, iRPR, iRevenue, share of account spend.

Category table: the top-line metrics grouped by campaign category.

Trend: the top-line metrics by send month (or week on request). Mark months inside the maturity window.

Comparison: any two periods of equal length (this quarter vs last, last 90 days vs prior 90), on mature rows only, with absolute and percent change.

Guard every ratio against a zero denominator. Two decimals for ratios, whole dollars for money above $1,000.

## 7. Answering questions

Map the question to a view, filter, compute, then answer in one or two sentences followed by the supporting table. Common patterns:

- "How are we doing?" Top line plus the three best and three worst campaigns by iROAS, then ROAS.
- "Which campaign is working best?" Campaign table ranked by iROAS, then ROAS, weighted by spend so a tiny campaign does not top the list.
- "How did <category> do?" Category table row plus its campaigns.
- "Is <campaign> worth it?" Its campaign-table row, its monthly trend, and its iROAS with the control-group caveat if cards are under 1,000.
- "What changed?" Period comparison; call out the biggest movers by spend and by ROAS.
- "Why is revenue low this month?" Check maturity first. If the month is inside 48 days, say so before anything else.
- "How much did PostPilot make us?" Attributed revenue (ROAS basis) and incremental revenue (iRevenue over measured campaigns), clearly labeled as two different things.

Always say which window and which basis (attributed vs incremental) the answer uses. If the question cannot be answered from the sheet (control-group sizes, order-level data, creative details, audience lists, costs outside direct mail), say so and offer the nearest available figure.

## 8. Recommendations

Recommendations are the main deliverable. The job is to help the brand get the most incremental revenue from its direct mail budget. The read-out is only worth acting on if it is honest, so the evidence decides the recommendation, in both directions.

Order of preference, because it is usually what earns the brand the most:

1. Grow what is proven.
2. Improve what is underperforming.
3. Redirect budget from weak campaigns to strong ones.
4. Reduce, only when the evidence clears the bar below.

Fixing or redirecting comes before cutting because a reworked campaign keeps its audience, its history, and its control group, so the next result is measurable and builds on the last. A cut ends the learning. Reductions on thin or immature data are the most common mistake in reading direct mail: revenue for the last seven weeks is still arriving, and small campaigns are noisy.

Each recommendation names the campaign or category, the evidence, the action, the dollar amount, and the expected effect. Three to five, ordered by incremental dollar upside, and always end with a budget plan. Use these rules as defaults, and say when a brand's economics justify different thresholds (margin, LTV, subscription).

Grow (lead with these):
- iROAS at or above 2.0 on at least $1,000 mature spend and 1,000 cards: recommend more volume or frequency. Expected effect: iRevenue grows roughly with spend until the audience is exhausted.
- iROAS between 1.0 and 2.0: the campaign pays for itself incrementally. Recommend a measured increase (10 to 25 percent) with the control group kept on, and a review after one maturity window.
- No iROAS but mature ROAS above the account average: recommend an increase plus a control group so the lift can be measured.
- Category gaps: if the brand runs only one or two categories, recommend adding the missing one (a Prospecting brand with no Retention, a Retention brand with no winback) with a starting budget sized at 10 to 20 percent of current spend and a control group from day one.

Improve (the response to underperformance):
- Mature ROAS well below the account average (under half) with meaningful spend: recommend changing the campaign before changing its budget. For Prospecting, narrow the audience or improve the lookalike source; for Retention, strengthen the offer or lengthen the gap since last purchase; for Retargeting, shorten the delay after the site visit.
- Conversion rate far below the category average but AOV normal: audience or timing problem. Conversion rate normal but AOV low: offer problem. Recommend a creative or offer test with the same budget, measured against the existing version.
- iROAS present but below 1.0: the current version is not paying for itself incrementally. Recommend refocusing the same budget on the best-responding segment (recent buyers, higher-value customers, the geographies or cohorts that convert), and give it one window before deciding anything else.
- Blank iROAS on a campaign that has a control group and more than $2,000 mature spend: lift is zero or negative. Recommend redirecting that budget to the strongest measured campaign while the audience and offer are reworked, so total spend stays level.

Reallocation (always include when there is at least one grow candidate and one improve candidate):
- Rank campaigns by iROAS where measured, else by mature ROAS. Money moves from the bottom of the ranking to the top, keeping the account total level by default.
- Size the move: the monthly spend of the campaigns being redirected (last three mature months' average). Propose moving it to the top one or two grow candidates, split in proportion to their current spend.
- Show the arithmetic: current monthly spend and iRevenue (or revenue) for source and destination, and the projected change at the destination's iROAS. State the assumption that returns hold at current levels and note that very large increases (more than double) usually dilute iROAS as the audience widens.
- Prefer moving spend between campaigns of the same category first; across categories only when the gap in iROAS is clear (at least 1.0).
- Retention and Retargeting audiences are finite: scaling there means more frequency or a wider lookback, and iROAS tends to fall faster than with Prospecting. Say so when the destination is one of these, and pair it with a Prospecting grow recommendation where one exists.

Additional investment (include whenever the numbers support it):
- Headroom signals: spend-weighted iROAS above 1.5 across measured campaigns, at least one grow candidate, and the top campaigns not yet showing declining monthly ROAS as spend grew.
- Recommend a specific increment: 25 to 50 percent of current monthly spend on the grow candidates, with the projected iRevenue at current iROAS and a break-even check (how far iROAS could fall before the extra spend stops paying, which is iROAS down to 1.0).
- Frame it as a test with a review date one maturity window (48 days) after the first increased send, and a control group kept on so the result is measurable.
- Where there are no measured campaigns, recommend investing in measurement first (control groups on the largest campaigns) alongside a modest increase on the campaigns with the best ROAS, and revisit the budget after one window.
- Where the signals are weak (most spend in flight, weighted iROAS under 1.5, top campaigns trending down), recommend holding total spend flat while the improve recommendations run, and say which signal is holding the increase back.

Reduce (only when the evidence clears this bar, and say so plainly when it does):
- Campaign level: iROAS below 1.0, or blank with a control group, on 1,000+ mature cards, persisting after an improve attempt or across two maturity windows, and no grow candidate that could absorb the budget. Recommend reducing that campaign's spend by a named amount, and if the audience still looks promising, a smaller test of a reworked version with its control group kept on.
- Account level: spend-weighted iROAS below 1.0 across most measured spend for two or more maturity windows. Say directly that direct mail is not paying for itself incrementally at the current spend, and recommend concentrating budget on the best one or two campaigns while the rest are reworked. Total spend may go down as a result; say so.
- Never recommend a reduction from in-flight rows, from ROAS alone without a control group, or from campaigns under 1,000 cards. In those cases the honest answer is "not enough evidence yet", plus what would produce it (maturity, a control group, more volume).

Measurement:
- If less than half of mature spend is covered by iROAS, recommend enabling control groups on the largest unmeasured campaigns. Say that this is what turns ROAS into proof of lift and what justifies the next budget increase.
- Flag `Other` category rows as uncategorized; recommend setting the campaign category so category comparisons are meaningful.

Confidence: state it. High when the campaign has 1,000+ mature cards and an iROAS. Medium with ROAS only on 1,000+ cards. Low below 1,000 cards or when most spend is in flight. On low confidence, recommend waiting for maturity and keeping spend level rather than moving budget in either direction. Budget moves above 25 percent of account spend, and any reduction, need high confidence.

Language: when budget moves between campaigns, say "redirect" and name the destination. When the recommendation really is to spend less, say "reduce" and show the evidence; do not soften it into something else. If a brand asks directly whether to spend less, give a straight answer from the evidence (iROAS, maturity, sample size, what the improve steps could change), including "yes" when the reduce bar is met. The budget decision is theirs.

## 9. Read-out template

```
PostPilot performance: <Brand>, <first date> to <last date>
Mature through <cutoff>. In flight since then: $<spend>, <postcards> postcards.

Headline
- Mature: $<spend> across <n> campaigns, <postcards> postcards, $<revenue> attributed revenue, ROAS <x>, CPA $<x>.
- Incremental: <n> campaigns (<x>% of spend) have control-group measurement. Spend-weighted iROAS <x>, ~$<iRevenue> incremental revenue.

By category
| Category | Spend | Postcards | Revenue | ROAS | CPA | Weighted iROAS |

Campaigns
| Campaign | Category | Status | Spend | ROAS | iROAS | iRevenue | Note |

Recommendations
1. <Action> on <campaign>: <evidence>. Expected: <effect>. Confidence: <level>.
2. ...

Budget plan (current total $<x>/month -> proposed $<y>/month)
- Redirect $<x>/month from <campaign(s)> to <campaign(s)>: projected iRevenue <from> -> <to>.
- Additional investment: +$<x>/month on <campaigns> at iROAS <x>, break-even if iROAS falls to 1.0. Review on <date>.
  (or: hold total spend flat while <improve steps> run, because <signal>; revisit on <date>.)
  (or, only when the reduce bar in section 8 is met: reduce <campaign> by $<x>/month, because <evidence>.)

Trend
- Last 6 mature months: spend, ROAS, iROAS coverage.

Caveats
- Rows newer than 48 days are still accruing orders.
- iROAS is per campaign over its lifetime and only exists where a control group exists.
```

## 10. Things not to do

- Do not add a "For the AM" or any staff-only section; explain the point to the brand in the body instead.
- Do not drop the term "iROAS" (or ROAS, iRevenue, iRPR) in favor of a plain-language paraphrase. Explain the term, then use it.
- Do not sum, average, or trend `iroas`.
- Do not read blank `iroas` as zero. Drop `clicks` entirely.
- Do not use the sheet's labels in output: impressions are postcards created, conversions are orders, tactic is campaign category.
- Do not compare a row's revenue to orders placed on that date; rows are send-date cohorts.
- Do not call a campaign unprofitable from rows inside the 48-day window.
- Do not recommend a reduction from in-flight rows, ROAS alone, or fewer than 1,000 cards; try improve and redirect first. Equally, do not hide a result that clears the reduce bar.
- Do not divide `spend` or `revenue` by 100.
- Do not group by `campaign_name`.
- Do not present attributed revenue as incremental revenue, or the reverse.
- Do not expect the sheet to match the PostPilot dashboard home page exactly: that page shows a send-weighted iROAS for a chosen date range, over campaigns with measurable positive lift. The sheet's `iroas` matches the per-campaign figure on the campaign page and campaigns list (an active campaign can differ slightly on a given day because the two update at different times). If a brand asks why the numbers differ, explain this.

## 11. Glossary

- Control group (holdout): a random slice of a campaign's audience deliberately not mailed, used to measure lift.
- Treatment: the mailed group.
- Attribution window: 48 days after mailing during which a matched customer's orders count toward the campaign.
- iROAS: incremental return on ad spend. Revenue the mail caused (mailed group minus control group, per recipient) divided by cost per recipient. Always referred to as iROAS.
- iRPR, iRevenue: incremental revenue per recipient, and in total.
- Campaign category (sheet column `tactic`): Prospecting is acquisition of people who have not bought. Retargeting: site or cart abandoners. Retention: existing customers, winback, loyalty.
- Mature: a send date whose attribution window has closed.
