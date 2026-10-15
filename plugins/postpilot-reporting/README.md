# PostPilot Reporting

Turns your PostPilot Campaign Data Google Sheet into a performance read-out you can act on. Claude recreates your PostPilot dashboard views and answers questions about your direct mail campaigns in plain language. It recommends where to invest more, what to improve, and where to move budget, based on your own numbers, including iROAS measured against control groups.

## Getting started

1. In PostPilot, go to the **Integrations** page and open the **Google Sheets** integration to get the link to your Campaign Data sheet.
2. Connect Google Drive to Claude (Settings → Connectors) so Claude can open the sheet. Or download the sheet as a CSV and attach it instead.
3. Paste the link and ask, for example: "Give me a performance read-out" or "Which campaigns should I put more budget behind?"

If you ask about your campaigns without sharing the sheet, Claude will ask you for the link first.

## What this plugin runs, sends, and fetches

- **Contents:** two skills. `postpilot-reporting` is instructions for Claude. `postpilot-dashboard` adds the page code for a dashboard that Claude installs in your own Claude account.
- **Runs:** no MCP servers, hooks, or scripts on your computer. The dashboard's page code runs only inside the dashboard artifact in your Claude account.
- **Sends:** nothing to PostPilot or any third party.
- **Fetches:** only the Campaign Data sheet you share. Claude reads it through your own Google Drive or Google Sheets connection, or from a CSV you attach. The dashboard reads it through your Google Sheets connection each time it opens.
- **Your data:** handled by Claude under your account's data settings.

## Support

Contact your PostPilot Account Manager, or open an issue in this repository.

## License

MIT. See [LICENSE](LICENSE).
