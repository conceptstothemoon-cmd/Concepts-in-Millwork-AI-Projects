# Bid Screener (beta)

Screens incoming bid invitations for Sales and Estimating. Each invite gets a suggestion (decline, send to bid review, or "you decide") based on the GC's tier, plus warnings worth a look. A person still clicks every decision; nothing is sent to a GC automatically.

## What it does
- **Today's invites:** add saved Outlook emails (.eml), invite PDFs or text files (up to 25 at once). Claude reads each one and pulls out the project, GC, bid date, location, platform and more.
- **Check an invite:** paste a single invite email and see the result before adding it.
- **Bid review:** tracks projects sent to bid review through each step (awaiting review → estimating capacity check → back to Sales → bidding, or passed).
- **Past estimates:** load Innergy estimate exports (.xlsx or .csv) so they can be searched.
- **Ask a question:** plain-language questions about invites, GCs and past estimates, answered only from the saved data.
- **Archive, GC list, Rules, Accuracy, Suggestions:** set GC tiers (Top, Mid, Low, Watch, Do Not Bid), choose which warnings show, see how often suggestions match what the team actually did, and collect feedback.

## Two modes

| | Demo mode (default) | Live mode |
|---|---|---|
| Turned on by | `clientId` blank in `config.js` | `config.js` filled in (see [setup/SETUP.md](setup/SETUP.md)) |
| Data | Made-up examples, saved only in this browser | One SharePoint list in CIM's Microsoft 365, shared by everyone |
| Sign-in | None | Microsoft 365 work account |
| Reading invites, Ask a question | Off | On, through the Claude service (Azure Function in `api/`) |

**Live site (demo mode until set up):** <https://conceptstothemoon-cmd.github.io/Concepts-in-Millwork-AI-Projects/projects/bid-screener/>

## Run it on your PC

Microsoft sign-in needs `https://` or `http://localhost`, so serve the folder instead of double-clicking `index.html`:

```bash
npx serve -l 3000 .
```

Then open <http://localhost:3000/>. (`python3 -m http.server 3000` works too.)

## Folder guide

```
index.html                 the page: all screens, screening rules and warnings
config.js                  demo vs live settings: the only file to edit when going live
m365.js                    Microsoft 365 sign-in, SharePoint storage, and calls to the Claude service
sample-data.js             made-up examples for demo mode
vendor/                    Microsoft's sign-in library (MSAL 4.30.0), stored here so it doesn't load from a CDN
gc-list-template.csv       columns the GC list import expects
api/                       Azure Function that holds the Claude API key and forwards requests to Claude
setup/SETUP.md             step-by-step setup for IT: SharePoint, Entra ID, Azure Function, costs
setup/Create-BidScreenerList.ps1   creates the SharePoint list
```

## How it's built
- Plain HTML/CSS/JavaScript, no build step. Libraries from cdnjs: SheetJS 0.18.5, and pdf.js 3.11.174 (loaded only when a PDF is added).
- The screening rule is `screen()` in `index.html`; the warnings are `flagsFor()`; default settings are `DEFAULT_SETTINGS`.
- Data is grouped in collections (`gcs`, `invites`, `decisions`, `feedback`, `estimates`, `estrows`, `settings`). In live mode each document is one row of the SharePoint list: `Title` is `collection/id` and `DocData` holds the document as JSON. Each open page checks for changes every 45 seconds (`refreshSeconds`) and whenever the tab comes back into view.
- Claude: the page sends the conversation to `api/` with the person's Microsoft 365 token; the function checks the token, adds the API key, and calls Claude Opus 5.5 (`claude-opus-5-5`). For "Ask a question", Claude asks the page for data through tools (list estimates, summarize lines, room costs, list invites, look up a GC), and the page answers from what it has loaded.
- First built as a claude.ai artifact; this version replaces the claude.ai storage and sign-in with Microsoft 365.
