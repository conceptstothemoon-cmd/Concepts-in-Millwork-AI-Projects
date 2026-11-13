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
- CIM drawing conventions (sheet series M/P/V/S/ST/DR/W/T/SC/L, "RE:" architect references in view titles, item tags like 101.01, hatch legend) are in `CMI_CONVENTIONS`.

## What must change to run outside claude.ai
The page relies on two claude.ai artifact runtime features, reached through `window.claude.use(...)` in the `capabilities` and `wiring` blocks. Outside claude.ai `window.claude` doesn't exist, so the page loads but AI features and file saving stay hidden.

1. **AI calls (`caps.sample`).** 29 call sites use `caps.sample(prompt, opts)`, `caps.sample.json(prompt, opts)` and `caps.sample.limits()`. Options used: `signal` (AbortController), `modelTier` ('quick' | 'default'), `images` (array of JPEG Blobs). `.json()` must return the parsed JSON value of the reply.
   - Replace with a small adapter object that has the same shape, so call sites don't change.
   - The adapter should call the Claude API through a **server** that holds the API key (a small local Node or Python endpoint, or a serverless function). Never put an API key in the browser page or in this public repo.
   - Map `modelTier` to model ids; send images as base64 image blocks; parse JSON tolerantly (whole reply, else a fenced block, else first `{`/`[` to last `}`/`]`).
   - Errors should reject with `{ code, message }` using codes the UI already handles: `cancelled`, `rate_limited`, `prompt_too_large`, `invalid_json`, `not_granted`.
2. **File saving (`caps.downloads`).** 4 call sites use `caps.downloads.save({ filename, data })` (data is a string or Blob). Replace with a normal browser download (Blob → object URL → `<a download>` click).
3. Set `caps.ready = true` after wiring the adapters so `applyCaps()` shows the AI and save buttons.

Everything else (PDF parsing, IndexedDB projects, project files, rendering) already works in a normal browser, including on GitHub Pages.

## Running it locally
- Serve the folder over http (opening `index.html` as `file://` can break the pdf.js worker), e.g. `python3 -m http.server 8000` from this folder, then open http://localhost:8000.
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
