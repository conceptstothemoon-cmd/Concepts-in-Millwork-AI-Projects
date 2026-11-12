# CIM Quality

Quality issue tracking for Concepts in Millwork.

- **Entry app** (`entry/`): report and update quality issues. Installable on phones, tablets, and PCs as an app (PWA).
- **Dashboard** (`dashboard/`): totals, trends, severity, and Pareto analysis of which departments catch and create issues.

Both are plain HTML/CSS/JavaScript with no build step. Data is stored in a SharePoint list in CIM's Microsoft 365, and people sign in with their normal work account.

## Two modes

| | Demo mode (default) | Live mode |
|---|---|---|
| Turned on by | `clientId` blank in `shared/config.js` | config filled in (see `setup/AZURE-SETUP.md`) |
| Data | 240 sample issues, saved in each browser | SharePoint "Quality Issues" list, shared by everyone |
| Sign-in | none | Microsoft 365 |

In demo mode, "Reset sample data" on the home page restores the original sample set.

## Publish with GitHub Pages

This project lives in `projects/quality-tracker/` of the
[Concepts-in-Millwork-AI-Projects](https://github.com/conceptstothemoon-cmd/Concepts-in-Millwork-AI-Projects) repo.
GitHub Pages serves the repo from branch `main`, folder `/ (root)` (Repo → **Settings → Pages**), so the live addresses are:

- Home: <https://conceptstothemoon-cmd.github.io/Concepts-in-Millwork-AI-Projects/projects/quality-tracker/>
- Entry app: <https://conceptstothemoon-cmd.github.io/Concepts-in-Millwork-AI-Projects/projects/quality-tracker/entry/>
- Dashboard: <https://conceptstothemoon-cmd.github.io/Concepts-in-Millwork-AI-Projects/projects/quality-tracker/dashboard/>

Changes pushed to `main` go live in about a minute.

If the repo is public, the code is public. That's OK: there are no secrets in it, and SharePoint data still requires a CIM sign-in. Use a private repo if you prefer (GitHub Pages on private repos needs a paid GitHub plan).

## Install the entry app

- **iPhone/iPad (Safari):** open `/entry/` → Share → **Add to Home Screen**.
- **Android (Chrome):** open `/entry/` → menu → **Install app**.
- **Windows/Mac (Chrome or Edge):** open `/entry/` → install icon at the right of the address bar.

The installed app opens without a connection (it caches its own files), but submitting an issue needs internet.

## Run locally

Microsoft sign-in requires `https://` or `http://localhost`, so don't double-click the HTML files; serve the folder:

```bash
npx serve -l 3000 .
```

Run that from this folder, then open <http://localhost:3000/>. (Any static server works, e.g. `python3 -m http.server 3000`.)

## Folder guide

```
index.html            home page linking both apps
shared/config.js      demo vs live settings: the only file you must edit to go live
shared/lists.js       departments, categories, root causes, severities, statuses
shared/data.js        reads/writes issues (browser storage in demo, Microsoft Graph in live)
shared/auth.js        Microsoft 365 sign-in (MSAL)
shared/sample-data.js sample issue generator
shared/vendor/        Microsoft's MSAL library (v4.30.0), stored here so nothing loads from a CDN
entry/                entry app + PWA manifest, service worker, icons
dashboard/            dashboard
setup/                SharePoint list script, sample data, Azure + Power BI guides
```

## Changing the choice lists

Edit `shared/lists.js`, then update the matching choice column on the SharePoint list (or re-run `setup/Create-QualityList.ps1`, which adds missing columns but does not change existing choices). After changing files under `entry/`, bump `CACHE` in `entry/sw.js` so installed apps pick up the change right away.
