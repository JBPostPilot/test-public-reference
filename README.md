# PostPilot Reporting Skill

A Claude skill that analyzes your PostPilot **Campaign Data** Google Sheet. It recreates your dashboard views, answers questions about campaign performance, and recommends where to invest more, what to improve, and where to move budget, based on your own numbers.

It is the same analysis PostPilot Account Managers use. The skill contains instructions only, no data.

## Install

### Claude Code: just ask Claude

Paste this into Claude Code:

> Install the PostPilot reporting plugin from https://github.com/JBPostPilot/test-public-reference

Or run the two commands yourself:

```
/plugin marketplace add JBPostPilot/test-public-reference
/plugin install postpilot-reporting@postpilot
```

### Claude.ai and Claude Desktop

Claude can't install skills from inside a chat on these apps. Add it once in settings instead:

1. Go to **Customize → Plugins** ([claude.ai/customize/plugins](https://claude.ai/customize/plugins)).
2. Click **Add → Add marketplace** and paste `https://github.com/JBPostPilot/test-public-reference`.
3. Install **postpilot-reporting**.

Plugins you add on claude.ai are saved to your account, so they also show up in Claude Code when you're signed in.

**Alternative:** download `postpilot-reporting.zip` from this repo's [Releases](https://github.com/JBPostPilot/test-public-reference/releases). Then go to **Customize → Skills → + → Upload a skill** and upload it.

## Before you start

- **Turn on Google Sheet reports for your PostPilot account.** Ask your Account Manager or PostPilot support. You'll get a sheet titled `PostPilot — <Your Brand> — Campaign Data`, refreshed daily.
- **On Team and Enterprise plans,** an admin may need to allow skills and plugins.

## Use

Give Claude your sheet in one of these ways:

- Export it as CSV and attach it.
- Share it through a connected Google Drive.
- Paste the data in.

Then ask:

- "Give me a performance read-out."
- "Which campaigns should I put more budget behind?"
- "Compare last 90 days to the prior 90."
- "Is my winback campaign worth it?"

## What it does

- **Dashboard views:** top-line metrics, campaign table, category breakdown, and monthly trend.
- **Plain-language answers** to performance questions.
- **Recommendations:** grow, improve, redirect, or reduce, each with the evidence, a dollar amount, and a confidence level.

It is built to be honest about what the data can and cannot show:

- **Recent results are labeled preliminary.** Orders count for 48 days after mailing, so recent sends are still collecting orders.
- **Incremental and attributed results are kept separate.** iROAS is measured against a control group. Plain ROAS includes orders customers would have placed anyway.
- **It says when there isn't enough evidence to act.**

## Data and privacy

This repository contains no customer data. Your sheet is processed by Claude under your own account and its data settings. PostPilot receives nothing through this skill.

## Feedback

Open an issue in this repository, or contact your PostPilot Account Manager.
