# Spec Desk end-to-end tests

These drive `index.html` in headless Chromium with a simulated Claude (`mock-claude.js`). The simulated Claude answers from the real prompts the app sends, and it plants known mistakes so the tests can check that the app catches them: invented quotes, wrong values, a missed requirement, a false gap, and values that aren't on the drawing. The tests do **not** measure how good real Claude's answers are. That needs the API adapter described in `CLAUDE.md`.

    cd tests
    npm install
    node make-fixtures.js           # small spec book, proposal, A-501, M.01
    node make-fixtures2.js          # CAD plot + redlines, estimate, Microvellum template, 921-page spec, 507 MB / 512-sheet set
    node run.js  ../index.html      # spec, Ask, Compare, drawings, Drawing review, Ask the drawings, Deep check, errors, reopen
    node run2.js ../index.html      # RE: from pictures, markups, redline scoring, room schedule, estimate, Microvellum, cross-reference
    node run3.js ../index.html      # large files: 921-page spec book and 507 MB drawing set (takes a few minutes)

If Chromium isn't installed, run `npx playwright install chromium` first. Screenshots go to `shots/`.
