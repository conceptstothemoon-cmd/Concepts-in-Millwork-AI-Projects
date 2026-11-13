# CIM Job Cost Pilot

A working tool for CIM Accounting:

- **Log a trip** (installer's phone): pick the day's jobs in order. Miles come from CIM's distance table and post to each job's WIP. Parking and a receipt photo can be added.
- **Mileage** (Tammy): approve trips and download the bank file, Sage lines and Innergy upload. Optionally check phone days against the Innergy Time Tracking export.
- **Imports** (Abby): drop in Sage and Innergy exports. Job numbers are translated between the two systems, and duplicates are skipped.
- **WIP schedule** (Dani): cost to date, cost to complete by budget line, over/under billing, flags, review sign-off and month-end lock.

## Open it

<https://conceptstothemoon-cmd.github.io/Concepts-in-Millwork-AI-Projects/projects/job-cost/>: sign in with your CIM Microsoft 365 account. Installers get the link ending in `#trip` from the Start page's **Copy link** button. Until IT connects it (see [setup/SETUP.md](setup/SETUP.md)), the page says "Not connected yet".

## Where the data is

- **Jobs, distances, settings, trips, mileage, parking, imports, WIP entries, reviews and closes:** the `Job Cost Data` SharePoint list in CIM's Microsoft 365.
- **Parking receipt photos:** the `Job Cost Receipts` folder in the same site.
- **Timecard files:** read in the browser and never uploaded.

The job list, distances and installers' names are not in this repository. They are loaded into SharePoint once from a private setup file (`private-build/job-cost-setup.json`, gitignored).

## Run it on your PC

Microsoft sign-in needs `https://` or `http://localhost`:

```bash
npx serve -l 3000 .
```

Then open <http://localhost:3000/>.

## How it's built
- `index.html`: the page, plain HTML/CSS/JavaScript with no build step. SheetJS 0.18.5 from cdnjs for Excel files.
- `m365.js`: Microsoft 365 sign-in (MSAL, in `vendor/`), SharePoint storage and receipt uploads. It gives the page the same `db`, `user`, `downloads` and `assets` interfaces the claude.ai pilot used, so the screens and the math didn't change. Each open page checks for changes every 45 seconds.
- `config.js`: tenant, app and SharePoint site settings.
- Collections: `jobs`, `legs`, `config/settings`, `trips`, `mileage`, `parking`, `wip`, `imports`, `lines`, `closes`, `reviews`. Each document is one list row: `Title` is `collection/id` and `DocData` holds the JSON. Imports are saved 200 rows per item to stay under SharePoint's size limit.
- `setup/`: list-creation script and IT setup guide.

First built as a claude.ai artifact; this version replaces the claude.ai storage and sign-in with Microsoft 365.
