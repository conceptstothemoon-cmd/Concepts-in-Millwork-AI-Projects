# Spec Desk

A single-page tool for Concepts in Millwork (CIM) that reads construction documents and checks them against each other: spec books (often 900+ pages), architectural drawings, CIM shop drawings, proposals, contracts and estimates. It was first built as a claude.ai artifact.

## Who uses it and why
- **Drafting:** spec requirements with citations, room schedule creation, shop vs. architect elevation checks, data for Microvellum.
- **Project management:** spec / proposal / contract comparison, drawing tag and reference checks, redline and returned-submittal tracking.
- Ground rule: the tool flags differences and shows evidence; a person decides. A difference (e.g. 34" vs 36") is not automatically an error, because fillers and scribes are often intentional.

## How it's built
- Everything is in `index.html`: one `<style>`, one `<script>`, no build step. Libraries load from cdnjs: pdf.js 3.11.174, pdf-lib 1.17.1, JSZip 3.10.1, SheetJS 0.18.5.
- PDFs are parsed in the browser. Nothing leaves the machine except the text and images sent to Claude for AI features.
- Projects persist in IndexedDB (database `specdesk`, stores `projects`, `blobs`, `heavy`, `work`). A project can be exported and imported as a `.zip` "project file" (`project.json` plus the original PDFs and pictures).
- Code is organized in commented blocks (`/* ---------- Name ---------- */`). Main ones, in order:
  helpers · patterns · state · PDF text extraction · section detection · reading confidence · keyword index (BM25) · Claude helpers · Section view · Ask · Compare · Coverage · saving files · reviewer decisions · Drawings (sheets, references, tags) · pictures and screenshots · page preview · Issues · Projects · Drawing review · Room schedule · Microvellum transfer · Drafting report · reviewer markups · reading RE: references · scoring against redlines · spreadsheets in Compare · Ask the drawings · showing where information came from · spec PDF preview · Deep check · capabilities · open spec · wiring.

## Key ideas to preserve
- **No summarizing to fit.** Specs are split by CSI section (`SECTION 08 44 13`, footers like `08 44 13 - 2`, `END OF SECTION`) into numbered paragraph records (`1.2.A.3`) that keep their page. AI calls get whole sections or keyword-retrieved paragraphs, never a condensed book.
- **Every AI claim is verifiable.** Prompts require passage ids plus exact quotes; `verifyQuote()` checks each quote against the source text and the UI marks failures in red. Drawing values are checked against the PDF text layer (`textOnPage`, `locateChunk`); values read only from images are labeled.
- **Show where.** Findings carry locations: exact (text found on the page, red circle) or approximate (box returned by Claude, orange dashed). `closeUp()` renders the spot; spec quotes open on the real PDF page with the words highlighted.
- **Reading confidence is measured, not self-reported** (`pageQuality`, `sectionConfidence`).
- **Coverage check:** every PDF page is accounted for (green / yellow / red / grey / white page map, grouped by section).
- **Deep check loop** (`runDeep`): repeats spec re-read for misses → verify each requirement against its source → re-search the proposal for gaps → close-up re-read of drawing findings → non-AI cross-reference. Stops when a round adds or changes nothing, or at the round limit. Corrections are only accepted when backed by a quote found in the document; otherwise they are flagged for a person.
- **Automatic checking** (`autoCheck`; settings `AC` in the Deep check tab, on by default, up to 5 rounds): every AI answer is re-checked as soon as it's made. Covers summaries (`huntSection` + `verifyStatements`), Ask, Compare (`checkComparison`: uncovered paragraphs, both sides re-read, batched fresh search for gaps), Drawing review (close-ups plus a second look given the already-found list), Ask the drawings, the room schedule (`checkRoomSheet`) and RE: references (read until two readings agree). Rounds stop when one adds and changes nothing. Same rule as Deep check: a correction needs text found in the document, an item is corrected at most once, and everything else is `disputed` and goes to Issues.
- **Splitting** (block "Splitting"): spec books by CSI section (`saveZip`); drawing sets as one PDF per sheet named "<sheet> <title>" in series folders (`splitSetBySheet`, title from `sheetTitle`); any PDF into parts under a size limit, keeping sections and sheets whole (`splitBySize`; a unit bigger than the limit is spread over parts and reported). ZIPs use STORE because PDFs are already compressed. Splitting a 500 MB set needs about 3.7 GB of browser memory.
- **Estimates** (`estCols`, `estNonProduct`): "ITEM TO BE PRICED" is the item identifier and DESCRIPTION the product name. Lines with no item number whose description is a charge (freight, tax, bond…) are skipped and named on screen; a $0 value is never a reason to skip.
- **Tests:** `tests/` drives the page in headless Chromium with a simulated Claude (`tests/mock-claude.js`) that plants known mistakes; `tests/run5.js` covers the Microsoft 365 route with fake sign-in and SharePoint (`tests/fake-m365.js`) and the real service handler. See `tests/README.md`.
- CIM drawing conventions (sheet series M/P/V/S/ST/DR/W/T/SC/L, "RE:" architect references in view titles, item tags like 101.01, hatch legend) are in `CMI_CONVENTIONS`.

## Running inside claude.ai and on its own
The page gets Claude and file saving from one of two places, chosen in the `wiring` block:
- **Inside claude.ai** (published as an artifact): `window.claude.use('sample')` and `use('downloads')`.
- **Anywhere else** (GitHub Pages, localhost): `m365.js` (`window.SD.connect()`), set up by `config.js`.
  - `downloads.save({filename, data})` is a normal browser download (CSV strings get a byte-order mark for Excel). Always on.
  - With `clientId` filled in: Microsoft 365 sign-in (MSAL, `vendor/`), the same as CIM's other tools. The header shows the account (`drawMsAccount`).
  - With `claudeEndpoint` too: `sample(prompt, {signal, modelTier, images})`, `sample.json` (tolerant parse: whole reply, fenced block, first `{`/`[` to last `}`/`]`) and `sample.limits()` call the Azure Function in `api/`, with the person's Entra token for the `access_as_user` scope. Images go as base64. Errors reject with the codes the UI handles (`cancelled`, `rate_limited`, `prompt_too_large`, `invalid_json`, `not_granted`, `network`, `refused`).
  - Files: `addSpButtons()` puts a "From SharePoint" button after every `label[for]` of a file input; the picker (`spPick`) downloads the chosen files and hands them to that input's own change handler. Projects: `buildProjectBlob` makes the project file; `saveProjectToSharePoint` uploads it to `projectsFolder` (upload session over 4 MB); **Open from SharePoint** imports it with `importProjectFile`.
- **The Claude service** (`api/`): `src/handler.js` holds all logic (sign-in check with `jose`, request limits, the Claude request, NDJSON streaming with pings so Azure's 230 s idle limit doesn't cut long answers); `src/functions/claude.js` is only the Azure wiring. Model `claude-opus-5-5`, adaptive thinking, effort `high` (`low` for the quick tier), `max_tokens` 64000, streaming with `finalMessage()`, server-side refusal fallbacks. Tests: `cd api && npm test`.

## Running it locally
- Serve the folder over http (opening `index.html` as `file://` can break the pdf.js worker), e.g. `npx serve -l 3000 .` (or `python3 -m http.server 3000`) from this folder, then open http://localhost:3000/. Port 3000 matches the Microsoft sign-in redirect address in setup/SETUP.md.
- Very large PDFs (a 512-page, ~500 MB architectural set was tested) need Chrome on a desktop with plenty of memory.

## Testing approach used so far
- Logic was tested in Node with jsdom + fake-indexeddb, running the page script directly, with Claude replies mocked.
- Real-file checks used pdfjs-dist 3.11.174 (legacy build) on one real school project: a 512-page architectural set with a text layer, a 313-page CIM redline set with no text layer (sheet ids come from the AutoCAD plot stamp `…\M.01.dwg, date`; 524 Bluebeam markups), and the estimate workbook (`Project Spreadsheet` tab, header on row 13, 520 lines across 84 rooms).
- Not yet tested with real Claude answers: Drawing review, room schedule reading, RE: reading from pictures, requirements checklist, redline scoring, Deep check.

## Privacy
This repository is public. Keep project documents, client names, bid amounts, estimates and API keys out of it. Real project files stay on people's own computers and in Spec Desk's browser storage.

## Open items
- Real Microvellum import layout (currently learned from any file Microvellum already accepts).
- Run Drawing review + "Score against the redlines" on real shop drawing sets to measure accuracy.
- Test spec features on a real 900-page spec book.
- Possible next: shared team issue list (currently per browser), automatic room-schedule scoring against CIM's drafted room schedule tables.
