# Spec Desk

Reads spec books, drawings, proposals and estimates, checks them against each other, and shows exactly where every piece of information came from.

## What it does
- **Spec books:** splits a spec book of any size into CSI sections and numbered paragraphs, with a coverage check showing every page was read and how cleanly.
- **Ask and summarize:** answers questions and summarizes sections from the spec only, quoting the exact paragraph and page.
- **Compare:** checks a proposal, contract or submittal (PDF or Excel) against chosen spec sections: match, conflict, gap, exclusion or extra.
- **Drawings:** checks sheet numbers, references like 5/A-501 and finish tags; reads Bluebeam markups; accepts pictures and screenshots; answers questions about the drawings.
- **Drawing review:** compares a CIM shop drawing with the architect's drawing and the spec, with close-ups of each spot.
- **Room schedule:** builds a draft from the drawings or an estimate, and turns it into a Microvellum import file.
- **Deep check:** goes back over the whole project several times until nothing new turns up.
- **Issues:** one list of everything flagged, with a decision for each: review required, approved exception or correction needed.

## Open it
Serve this folder over http and open it in Chrome:

    python3 -m http.server 8000

then visit http://localhost:8000. It also runs on this repo's GitHub Pages site.

Splitting, coverage, drawing reference checks, projects and exports work right away. The AI features need a Claude API connection; [CLAUDE.md](CLAUDE.md) explains what to hook up.

Project files and documents are stored only in your browser. Use **Projects → Save project file** to back a job up or move it to another computer.
