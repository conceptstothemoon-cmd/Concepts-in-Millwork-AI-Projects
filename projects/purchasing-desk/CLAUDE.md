# Notes for an AI assistant working on this project

Read README.md first. Then:

- **The user is Jim Szabo, a buyer who is not comfortable with technical tools.** Keep screens simple: large buttons, plain words, one decision at a time. Don't add settings he has to learn before the tool is useful.
- **Never invent prices.** Real prices come only from `data/supplier-prices.json` and `data/document-info.json` (the Corian, Formica and Sugatsune prices typed from Jim's documents, plus document details and vendor terms). Anything else is sample data and must be labeled as sample in the page.
- **Never put prices in the repo.** `data/` and `private-build/` are gitignored, and the online page loads prices from SharePoint after Microsoft 365 sign-in. Don't add real prices, account numbers or vendor terms to `src/`, the README or any committed file: the repo is published with GitHub Pages.
- **Nothing is sent automatically.** The tool drafts supplier emails and builds files; Jim sends and uploads. Keep it that way.
- **Edit `src/`, then run `python build.py`.** Don't hand-edit `index.html` or anything in `private-build/`; the build overwrites them. `src/app.html` defines `PD_APP(DATA)`; the online loader and the offline copy both call it with the price data.
- **No external libraries in `src/app.html`.** The offline copy is plain JavaScript and opens from a file with no install. The online page adds only Microsoft's sign-in library, stored in `vendor/`. Google Fonts are optional.
- **Saved state lives in the browser's localStorage** under keys starting with `cim-desk3-` and `cim-beta-`. Changing the shape of saved rules may need a new key so old saved data doesn't break the page.
- **Record every change in CHANGELOG.md**, with what changed and why.
