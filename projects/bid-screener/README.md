# Bid Screener (beta)

Screens incoming bid invitations for Sales and Estimating. Each invite gets a suggestion (decline, send to bid review, or "you decide") based on the GC's tier, plus warnings worth a look. A person still clicks every decision; nothing is sent to a GC automatically.

## What it does
- **Today's invites:** add saved Outlook emails (.eml), invite PDFs or text files (up to 25 at once). Claude reads each one and pulls out the project, GC, bid date, location, platform and more.
- **Check an invite:** paste a single invite email and see the result before adding it.
- **Bid review:** tracks projects sent to bid review through each step (awaiting review → estimating capacity check → back to Sales → bidding, or passed).
- **Past estimates:** load Innergy estimate exports (.xlsx or .csv) so they can be searched.
- **Ask a question:** plain-language questions about invites, GCs and past estimates, answered only from the saved data.
- **Archive, GC list, Rules, Accuracy, Suggestions:** set GC tiers (Top, Mid, Low, Watch, Do Not Bid), choose which warnings show, see how often suggestions match what the team actually did, and collect feedback.

## Open it
The working version runs as a claude.ai artifact, because it uses the artifact's shared database (GC list, invites, decisions, estimates), Claude (to read invites and answer questions) and sign-in (to show who made a suggestion). Open it from claude.ai while signed in to the company account.

`index.html` here is the source of that artifact. Opened directly or on GitHub Pages it shows the layout, but it can't load or save data and can't read invites; it shows a note saying so. Hooking it up outside claude.ai would mean replacing the `window.claude` calls in the **Boot** block at the bottom of the script with a real database and the Claude API.

## GC list template
`gc-list-template.csv` has the columns the **GC list → Import** screen expects: `GC name`, `Tier`, `Other names`, `Email domains`, `Notes`. Fill it in and import it; GCs already on the list are updated, not duplicated.

## How it's built
- One `index.html`: one `<style>`, one `<script>`, no build step. Libraries from cdnjs: SheetJS 0.18.5, and pdf.js 3.11.174 (loaded only when a PDF is added).
- The screening rule is in `screen()`; warnings are in `flagsFor()`; default settings are in `DEFAULT_SETTINGS`.
- Shared data collections: `gcs`, `invites`, `decisions`, `feedback`, `estimates`, `estrows`, and `settings/criteria`.
