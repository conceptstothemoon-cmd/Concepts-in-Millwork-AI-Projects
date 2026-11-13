# Changelog

## Behind Microsoft 365 sign-in — November 13, 2026

- The online page (`index.html`) no longer contains prices. People sign in with their CIM Microsoft 365 account and the page loads the price file from SharePoint, so only people with access to that file see prices. This makes it safe to publish the page with GitHub Pages.
- Moved the Corian, Formica and Sugatsune prices, document details (account and customer numbers) and vendor terms out of `src/app.html` into a private data file, `data/document-info.json`.
- Removed `data/supplier-prices.json` and `Purchasing-Desk-Beta.html` from the repo; `data/` and `private-build/` are now gitignored. Earlier commits still contain them, so keep the repo private.
- `build.py` now writes `index.html` (no prices) every time, and, when the price files are in `data/`, the SharePoint price file and the offline copy for Jim into `private-build/`. The offline copy works exactly as before.
- Removed real prices from the README's examples.
- Added `setup/SETUP.md` for IT.

## Folder move — November 13, 2026

- Moved from `projects/purchasing-desk-beta1/purchasing-desk/` to `projects/purchasing-desk/`.
- `build.py` now also writes `index.html`, identical to `Purchasing-Desk-Beta.html`, so the folder has a default page.
- Added `.gitignore` so supplier PDFs and spreadsheets stay out of the repo.

## Beta 1 — November 12, 2026

First version sent to Jim to try.

- Runs as one HTML file in any browser, with no login or install.
- Uses Jim's five real supplier documents: the Wurth contract, the Hallmark Corian price book, the Soudal price sheet, the Formica increase notice and the Sugatsune increase email.
- One decision per supplier document, with automatic approval of trusted contract price lists.
- Checks for out-of-line sizes, wrong units and cheaper bigger containers.
- Draft supplier questions and a downloadable Innergy import file (CSV).
- Price lookup across all documents.
- Buying list with real vendor terms; jobs are sample data.
- Material tracker with sample data.
- Rules Jim can change, saved in his browser.
- Notes on every tab, with a button that emails them to the BYU team.
- Removed: the national market price box (government price index). It doesn't give CIM's prices, and supplier notices warn earlier.

## Before Beta 1 (prototype drafts, in Claude)

- Draft 3: switched from made-up prices to Jim's supplier documents.
- Draft 2: changes from Jim's Nov 5 meeting: review only exceptions, buying list by job and by vendor, editable rules, material tracker.
- Draft 1: first prototype on sample data.
