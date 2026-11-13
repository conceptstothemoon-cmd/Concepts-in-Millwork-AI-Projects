# HR Hub (version 1)

Onboarding, offboarding and promotion/transfer checklists for Concepts in Millwork HR. HR answers a few questions about a hire, transfer or departure once, and the Hub creates only the steps that apply to that person, each with an owner and a due date. Owners see and tick off their own steps; HR sees everything that's late.

## What it does
- **Dashboard:** new hires, departures and transfers in progress, overdue tasks, unsigned DocuSign documents, and departure deadlines (access, keys, final pay).
- **Start a checklist:** one form for a hire, transfer or departure; shows how many tasks and DocuSign documents it will create before you create it.
- **People:** every checklist, with a downloadable people file (Excel). Edit the file and drop it back in to start several checklists at once.
- **My tasks:** each owner's own steps, for everyone the Hub is shared with.
- **Interviews and Paper inbox:** log interview bookings and paper forms that still arrive, until those are automated.
- **Exports:** CSV files for payroll, the supervisor roster, drivers and safety, the company directory and Innergy, each with only the columns allowed for that file.
- **Settings:** checklist rules (step, owner, when it applies, due date), message templates, questions, and who sees what.

## Open it

Version 1 runs as a claude.ai artifact: the people, tasks, rules and settings are stored in the artifact's database, and claude.ai handles sign-in and who can see what (HR can see and change everything; other people see only **My tasks**). Use the claude.ai link HR shares.

`index.html` here is the source of that artifact. Opened anywhere else it shows a note saying to open it from claude.ai; it can't load or save data.

**Never enter** pay, Social Security numbers, home addresses, medical, benefit or self-ID information. Those stay in payroll and Ease.

## How it's built
- One `index.html`: one `<style>`, one `<script>`, no build step. SheetJS 0.18.5 from cdnjs for the Excel people file.
- The rules engine is `evalRule()` and `plan()`: each rule is `Always` or conditions such as `drives = Yes AND state = AZ`.
- Data collections: `people`, `tasks`, `rules`, `messages`, `questions`, `fields`, `departments`, `settings`, `interviews`, `paper`, `feedback`. HR-only collections (`people`, `interviews`, `paper`, `feedback`) are readable only by editors of the artifact.

Moving it to CIM's Microsoft 365 (SharePoint storage and Microsoft 365 sign-in, like the Bid Screener) is the planned next step.
