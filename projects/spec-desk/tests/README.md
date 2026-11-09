# Spec Desk end-to-end tests

Drives index.html in headless Chromium with a simulated Claude (`mock-claude.js`) that answers from the real prompts and plants known mistakes (invented quotes, wrong values, a missed requirement, a false gap, a value that isn't on the drawing) to check that the app catches them.

    cd tests
    npm install
    npx playwright install chromium   # skip if Chromium is already available
    node make-fixtures.js             # regenerates fixtures/*.pdf
    node run.js ../index.html

Covers: spec splitting, summaries, Ask, Compare (+CSV), drawing sheets/references/tags, Ask the drawings, Drawing review, Deep check loop, error messages, Stop, and reopening a saved project.
It does not test real Claude answer quality; that needs the API adapter described in CLAUDE.md.
