# Bid Screener (beta)

Screens incoming bid invitations for Sales and Estimating. Each invite gets a suggestion (decline, send to bid review, or "you decide") based on the GC's tier, plus warnings worth a look. A person still clicks every decision; nothing is sent to a GC automatically.

## What it does
- **Today's invites:** add saved Outlook emails (.eml), invite PDFs or text files (up to 25 at once). Claude reads each one and pulls out the project, GC, bid date, location, platform and more.
- **Check an invite:** paste a single invite email and see the result before adding it.
- **Bid review:** tracks projects sent to bid review through each step (awaiting review → estimating capacity check → back to Sales → bidding, or passed).
- **Bid specs → Innergy:** on an invite (from its details or the Bid review row), add the spec book, invitation to bid and addenda as PDFs. Claude fills in the Innergy opportunity (name, address, bid date and time, RFI date, pre-bid meeting, owner, architect, basis of award, bid notes) and lists the millwork spec requirements and possible RFIs. A person checks every value, then downloads an **Innergy import file** and a **requirements and RFIs** workbook (or PDF) to attach to the opportunity. See "Bid specs → Innergy" below.
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
- Data is grouped in collections (`gcs`, `invites`, `decisions`, `feedback`, `estimates`, `estrows`, `specs`, `settings`). In live mode each document is one row of the SharePoint list: `Title` is `collection/id` and `DocData` holds the document as JSON. Each open page checks for changes every 45 seconds (`refreshSeconds`) and whenever the tab comes back into view.
- Claude: the page sends the conversation to `api/` with the person's Microsoft 365 token; the function checks the token, adds the API key, and calls Claude Opus 5.5 (`claude-opus-5-5`). For "Ask a question", Claude asks the page for data through tools (list estimates, summarize lines, room costs, list invites, look up a GC), and the page answers from what it has loaded.
- First built as a claude.ai artifact; this version replaces the claude.ai storage and sign-in with Microsoft 365.

## Bid specs → Innergy

Code: the block "Bid specs → Innergy" in `index.html` (`viewSpecs`, `readSpecs`, `downloadImport`, `innergyCard`).

- **Reading:** PDFs are read in the browser with pdf.js. Each page is assigned to a CSI section from its `SECTION 06 41 00` heading or its `06 41 00 - 2` footer; table-of-contents pages are skipped. Nothing is uploaded except the text sent to Claude.
- **What goes to Claude:** the bid-information pages (pages before the first section, Division 00, 01 10 and similar, and any file named "Addendum…") for the opportunity, and the ticked sections (millwork by default: 06 20, 06 40, 06 60, 06 80, 12 30) in batches of about 140,000 characters for requirements and RFIs. Addenda go with every batch.
- **Evidence rule:** Claude must return the file, page and an exact quote for every value. `findQuote()` checks the quote against the PDF text (fixing the page when Claude got it wrong). Anything not found is marked **Check** on screen and in the files.
- **Invite vs specs:** values from the invite are kept; when the specs disagree (often an addendum moving the bid date), the specs' value is shown under the field with **Use this**.
- **Import file:** Innergy has no public API, so the page makes a file to import. On **Rules → Innergy import file**, load Innergy's own opportunity import template (.xlsx or .csv); its column names are matched to the details automatically and can be changed. Without a template the built-in column names are used. Dates as MM/DD/YYYY or YYYY-MM-DD.
- **Saved:** `specs/<invite id>` holds the opportunity details, RFIs and file names; requirements go in `specs/<invite id>--r0`, `--r1`… so no SharePoint row passes its size limit. The PDFs themselves are not saved; choose them again to re-read.
- **Open questions for Innergy:** the exact opportunity import template and which fields it accepts; whether files can be attached by import (for now the requirements file is attached by hand).
