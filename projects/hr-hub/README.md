# HR Hub (version 2)

Onboarding, offboarding and promotion/transfer checklists for Concepts in Millwork HR. HR answers a few questions about a hire, transfer or departure once, and the Hub creates only the steps that apply to that person, each with an owner and a due date. Owners see and tick off their own steps; HR sees everything that's late.

## What it does
- **Dashboard:** new hires, departures and transfers in progress, overdue tasks, unsigned DocuSign documents, and departure deadlines (access, keys, final pay).
- **Start a checklist:** one form for a hire, transfer or departure; shows how many tasks and DocuSign documents it will create before you create it.
- **People:** every checklist, with a downloadable people file (Excel). Edit the file and drop it back in to start several checklists at once.
- **My tasks:** each owner's own steps.
- **Interviews and Paper inbox:** log interview bookings and paper forms that still arrive.
- **Exports:** CSV files for payroll, the supervisor roster, drivers and safety, the company directory and Innergy, each with only the columns allowed for that file.
- **Settings:** checklist rules (step, owner, when it applies, due date), message templates, questions, and who sees what.

## Open it

<https://conceptstothemoon-cmd.github.io/Concepts-in-Millwork-AI-Projects/projects/hr-hub/>: sign in with your CIM Microsoft 365 account. HR sees the whole Hub; everyone else who owns checklist steps sees **My tasks**. Until IT connects it (see [setup/SETUP.md](setup/SETUP.md)), the page says "Not connected yet".

**Never enter** pay, Social Security numbers, home addresses, medical, benefit or self-ID information. Those stay in payroll and Ease.

## Where the data is

Everything is in three SharePoint lists in CIM's Microsoft 365, and their permissions decide who sees what:

| List | Holds | Who |
|---|---|---|
| HR Hub Private | people, interviews, paper inbox, feedback | HR only |
| HR Hub Tasks | checklist tasks | HR edits; step owners update |
| HR Hub Settings | rules, messages, questions, departments, field map | HR edits; step owners read |

Nothing about employees or HR's process is in this repository. The starting checklist rules (`hr-hub-setup.json`) are loaded into SharePoint once by HR; that file is gitignored (`private-build/`).

## Run it on your PC

Microsoft sign-in needs `https://` or `http://localhost`:

```bash
npx serve -l 3000 .
```

Then open <http://localhost:3000/>.

## How it's built
- `index.html`: the page, plain HTML/CSS/JavaScript with no build step. SheetJS 0.18.5 from cdnjs for the Excel people file.
- `m365.js`: Microsoft 365 sign-in (MSAL, in `vendor/`) and the SharePoint storage. It gives the page the same `db`, `user` and `downloads` interfaces version 1 had on claude.ai, so the screens didn't change. Each open page checks for changes every 45 seconds.
- `config.js`: tenant, app and SharePoint site settings.
- The rules engine is `evalRule()` and `plan()` in `index.html`: each rule is `Always` or conditions such as `drives = Yes AND state = AZ`.
- `setup/`: list-creation script and IT setup guide.

Version 1 ran as a claude.ai artifact; its records stay there until moved (see the end of setup/SETUP.md).
