# Purchasing Desk (Beta 1)

A tool for Jim Szabo, Purchasing at Concepts in Millwork (CIM). It shows what an automated weekly price review, price lookup, buying list and material tracker would look like, using Jim's real supplier documents.

Built by the BYU internship team (Hamid Jaeyoung Jahangir and Ian Wilcox), November 2026.

> **Where the prices are.** CIM's negotiated supplier prices are not in this repository. The online page (`index.html`) has no prices: people sign in with Microsoft 365 and it loads the price file from SharePoint, so only people with access to that file see prices. The price files (`data/`) and the offline copy (`private-build/`) are kept out of git by `.gitignore`. Setup: [setup/SETUP.md](setup/SETUP.md).

## Quick start

| You want to | Do this |
| --- | --- |
| Use the tool | Open the [online page](https://conceptstothemoon-cmd.github.io/Concepts-in-Millwork-AI-Projects/projects/purchasing-desk/) and sign in with your CIM Microsoft 365 account. |
| Send Jim an offline copy | Run `python build.py` with the price files in `data/`, then send him `private-build/Purchasing-Desk-Beta.html` over Teams or email. Share it only inside CIM: it has every price in it. |
| Change the tool | Edit `src/app.html` or `src/style.css`, then run `python build.py`. |
| Load new supplier prices | Get the price files into `data/` (from SharePoint or the team), run `python tools/extract_prices.py CONTRACT.txt PRICE_SHEET.xlsx`, then `python build.py`, and upload `private-build/purchasing-desk-data.json` to SharePoint over the old one. |

## What's real and what's sample data

| Part | Source |
| --- | --- |
| Wurth Louis and Company contract prices (113 parts) | Real: contract update dated Jul 20, 2026 |
| Soudal (BOSS Products) prices (793 items) | Real: distributor price sheet effective May 1, 2026; compared with the older sheet in the same workbook (column "Proposed Pricing", treated as 2025, still to be confirmed with Jim) |
| Hallmark Corian prices by color group | Real: price book effective Jan 5, 2026 |
| Formica increase rules | Real: National Wood Products notice dated Jan 2, effective Feb 2, 2026 |
| Sugatsune stainless slide increases (18 parts) | Real: email from Rob Berrett (Wurth), Jan 28, effective Jan 30, 2026 |
| Vendor terms (freight, minimums, lead times) | Real, from the same documents. Wurth freight terms are not in the contract letter. |
| Jobs, quantities, need-by dates | Sample |
| Material tracker items | Sample |
| Innergy costs and Innergy IDs | Not yet. Needs Jim's Innergy materials export. |

The beta does not connect to Innergy, email or any vendor. The online page only reads the price file from SharePoint; nothing Jim clicks is sent anywhere except the feedback email he chooses to send.

## The five tabs

1. **This week's prices.** One decision per supplier document, not per price. Contract price lists from trusted vendors are approved automatically, except prices the checks flag. Choices produce draft questions for suppliers and an Innergy import file (CSV).
2. **Price lookup.** Search every part, color and increase across all five documents.
3. **Buying list.** Sample jobs, priced with real prices and vendor terms, grouped by vendor ("what to order") or by job. Shows savings from combining jobs, minimum-order and commercial-quote notes, and order-by dates.
4. **Material tracker.** Six steps from Received to At job site, one button per move, with flags for material sitting too long, ship dates and unconfirmed deliveries.
5. **My rules.** Trusted vendors, change limits, checks, combining window, preferred and never-buy vendors, vendor terms. Saved in Jim's browser.

## How the checks work

| Check | Rule | Example it caught |
| --- | --- | --- |
| Size out of line | In a slide series (part numbers ending in a size and `B`), a size more than 10% cheaper than the next smaller size and cheaper than the next larger | A 20" slide in a Wurth series priced below both the 18" and the 22" |
| Unit mismatch | A part ending in `-5` (5-gallon) priced per quart | A Wurth 5-gallon finish listed per quart |
| Bigger container | A gallon part (`-1`) whose `-5` pail costs less per gallon | 9 finishes, 3.0% to 6.8% cheaper per gallon |
| Price-sheet changes | Compares each item with last year's price; under the auto limit (5%) is approved, over the hold limit (50%) is held back | 24 Soudal items up more than 50% |

## Files

```
purchasing-desk/
  index.html                  The online page. No prices: signs in and loads them from SharePoint.
  config.js                   Sign-in and SharePoint settings for the online page.
  vendor/                     Microsoft's sign-in library (MSAL 4.30.0), stored here so it doesn't load from a CDN.
  build.py                    Builds index.html, and the private files below when the price files are present.
  src/app.html                Page markup and all logic (plain JavaScript). Takes the price data when it starts.
  src/online-loader.js        Sign-in and loading the price file, for the online page only.
  src/style.css               Styles, with light and dark themes.
  tools/extract_prices.py     Rebuilds data/supplier-prices.json from the supplier files.
  setup/SETUP.md              SharePoint and Microsoft 365 setup for IT.

  Not in git (private, see .gitignore):
  data/supplier-prices.json   Wurth and Soudal prices pulled from Jim's files.
  data/document-info.json     Corian, Formica and Sugatsune prices, document details, vendor terms.
  private-build/              The price file to upload to SharePoint, and the offline copy for Jim.
  CHANGELOG.md                What changed in each version.
  CLAUDE.md                   Notes for an AI assistant (Claude Code, Hats AI) editing this project.
```

Supplier PDFs and spreadsheets are not stored here. Get them from Jim.

## Feedback

Jim writes notes at the bottom of any tab. Notes are kept per tab on his computer. **Email my notes to Hamid and Ian** opens an email with all his notes filled in. If email doesn't open, **Copy my notes** copies them for pasting.

## Path to a real version

The beta shows the workflow. A production version is planned in CIM's Microsoft 365, after IT approval:

1. Supplier emails and attachments land in one shared mailbox or SharePoint folder.
2. AI reads each document into the same structure as `data/supplier-prices.json`.
3. Prices are matched to Innergy IDs using Jim's materials export.
4. Jim gets the Monday email and makes his choices.
5. A rule-based step builds the Innergy import file in Innergy's own template.

Open questions are listed in the plan doc for Jim, "Purchasing Plan for Jim, Version 2".
