# Notes for an AI assistant working on this project

Read README.md first. Then:

- **The user is Jim Szabo, a buyer who is not comfortable with technical tools.** Keep screens simple: large buttons, plain words, one decision at a time. Don't add settings he has to learn before the tool is useful.
- **Never invent prices.** Real prices come only from `data/supplier-prices.json` or from the CORIAN, FORMICA and SUGA constants in `src/app.html`, which were typed from Jim's documents. Anything else is sample data and must be labeled as sample in the page.
- **Keep the repo private.** It contains CIM's negotiated prices. Don't turn on GitHub Pages or copy the data anywhere public.
- **Nothing is sent automatically.** The tool drafts supplier emails and builds files; Jim sends and uploads. Keep it that way.
- **Edit `src/`, then run `python build.py`.** Don't hand-edit `Purchasing-Desk-Beta.html`; it's overwritten by the build.
- **No external libraries.** The page is plain JavaScript so it opens from a file with no install. Only Google Fonts load from the web, and the page works without them.
- **Saved state lives in the browser's localStorage** under keys starting with `cim-desk3-` and `cim-beta-`. Changing the shape of saved rules may need a new key so old saved data doesn't break the page.
- **Record every change in CHANGELOG.md**, with what changed and why.
