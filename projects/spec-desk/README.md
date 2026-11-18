# Spec Desk

Reads spec books, drawings, proposals and estimates, checks them against each other, and shows exactly where every piece of information came from.

## What it does
- **Spec books:** splits a spec book of any size into CSI sections and numbered paragraphs, with a coverage check showing every page was read and how cleanly.
- **Ask and summarize:** answers questions and summarizes sections from the spec only, quoting the exact paragraph and page.
- **Compare:** checks a proposal, contract or submittal (PDF or Excel) against chosen spec sections: match, conflict, gap, exclusion or extra.
- **Drawings:** checks sheet numbers, references like 5/A-501 and finish tags; reads Bluebeam markups; accepts pictures and screenshots; answers questions about the drawings.
- **Drawing review:** compares a CIM shop drawing with the architect's drawing and the spec, with close-ups of each spot.
- **Room schedule:** builds a draft from the drawings or an estimate, and turns it into a Microvellum import file.
- **Automatic checking:** every AI answer is checked again as soon as it's made, in rounds until nothing changes. Corrections are only accepted when backed by text in the document; anything else is flagged for a person.
- **Splitting:** saves a spec book as one PDF per section, a drawing set as one PDF per sheet (named by sheet number and title), or either one as parts under a size limit for email or upload.
- **Deep check:** goes back over the whole project several times until nothing new turns up.
- **Issues:** one list of everything flagged, with a decision for each: review required, approved exception or correction needed.

- **Microsoft 365:** sign in with a CIM work account, open documents straight from SharePoint or OneDrive, and save projects to a shared SharePoint folder so the team can open them.

## Two ways to run it

| | On its own (default) | With CIM's Microsoft 365 setup |
|---|---|---|
| Turned on by | `config.js` left blank | `config.js` filled in (see [setup/SETUP.md](setup/SETUP.md)) |
| Sign-in | None | Microsoft 365 work account |
| Documents | Opened from your computer | From your computer, SharePoint or OneDrive |
| Projects | In this browser; move them with **Save project file** | Also **Save to SharePoint** / **Open from SharePoint** for the team |
| AI features | Off (they work when the page is opened inside claude.ai) | On, through CIM's own Claude service (Azure Function in `api/`) |
| Save and Split buttons | Normal downloads | Normal downloads |

**Live site:** <https://conceptstothemoon-cmd.github.io/Concepts-in-Millwork-AI-Projects/projects/spec-desk/>

## Run it on your PC

Microsoft sign-in needs `https://` or `http://localhost`, and the PDF reader needs a web server, so serve the folder instead of double-clicking `index.html`:

```bash
npx serve -l 3000 .
```

Then open <http://localhost:3000/>. (`python3 -m http.server 3000` works too.)

## Folder guide

```
index.html                 the page: every screen and feature
config.js                  on-its-own vs Microsoft 365 settings: the only file to edit when going live
m365.js                    Microsoft 365 sign-in, SharePoint/OneDrive files, downloads, and calls to the Claude service
vendor/                    Microsoft's sign-in library (MSAL 4.30.0), stored here so it doesn't load from a CDN
api/                       Azure Function that holds the Claude API key and forwards requests to Claude (npm test runs its tests)
setup/SETUP.md             step-by-step setup for IT: SharePoint, Entra ID, Azure Function, costs
tests/                     end-to-end tests in a headless browser (see tests/README.md)
```

Projects being worked on are kept in your browser. Use **Projects → Save project file** (or **Save to SharePoint** when signed in) to back a job up or move it to another computer.
