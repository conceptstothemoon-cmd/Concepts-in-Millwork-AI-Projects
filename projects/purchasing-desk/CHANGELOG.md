# Changelog

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
