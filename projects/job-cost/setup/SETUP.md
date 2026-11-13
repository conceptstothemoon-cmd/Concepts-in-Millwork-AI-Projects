# Connecting the Job Cost Pilot to Microsoft 365

The pilot keeps its jobs, distances, trips, mileage, imports and WIP in CIM's SharePoint, and everyone signs in with their CIM Microsoft 365 account. Until it's connected, the page shows "Not connected yet". You need a Microsoft 365 admin for step 2.

**Installers need a Microsoft 365 account** to send trips from their phones. Anyone without one yet can have Tammy send their day from her screen, as the Start page says.

## 1. Create the list and receipts folder

1. Pick a SharePoint site Accounting uses, e.g. `https://contoso.sharepoint.com/sites/Accounting`.
2. Make (or reuse) a Microsoft 365 group with everyone who uses the pilot: Dani, Tammy, Abby and the installers.
3. On a computer with PowerShell 7:
   ```powershell
   Install-Module PnP.PowerShell -Scope CurrentUser
   ./setup/Create-JobCostList.ps1 -SiteUrl https://contoso.sharepoint.com/sites/Accounting -PnPClientId <PnP PowerShell client id> -UsersGroup jobcost@contoso.com
   ```

By hand instead: create a custom list named `Job Cost Data`; make `Title` indexed with "Enforce unique values: Yes"; add `DocCollection` (single line of text, indexed), `DocId` (single line of text) and `DocData` (multiple lines of **plain** text). Give the group Contribute on the list. In the site's Documents library, create a folder `Job Cost Receipts` and give the group Contribute on it.

As in the claude.ai pilot, everyone with access can see and change everything in the pilot. If installers should only send trips and not see the WIP schedule, that needs a second list; ask before go-live.

## 2. Register the app in Entra ID (Azure AD)

1. <https://entra.microsoft.com> → **Applications → App registrations → New registration**.
   - Name: `CIM Job Cost Pilot`
   - Supported account types: **Accounts in this organizational directory only**
   - Redirect URI: platform **Single-page application (SPA)**:
     `https://conceptstothemoon-cmd.github.io/Concepts-in-Millwork-AI-Projects/projects/job-cost/`
   - Also add `http://localhost:3000/` for testing. The trailing slash must match exactly.
2. **API permissions → Microsoft Graph → Delegated**: `User.Read`, `Sites.ReadWrite.All`. Then **Grant admin consent**.
3. Copy the **Application (client) ID** and **Directory (tenant) ID**.

No client secret is needed. `Sites.ReadWrite.All` is *delegated*: the page can only do what the signed-in person can already do in SharePoint.

## 3. Fill in `config.js`

```js
window.JC_CONFIG = {
  tenantId: '<Directory (tenant) ID>',
  clientId: '<Application (client) ID>',
  siteHostname: 'contoso.sharepoint.com',
  sitePath: '/sites/Accounting',
  listName: 'Job Cost Data',
  receiptsFolder: 'Job Cost Receipts',
  refreshSeconds: 45,
};
```

Commit and push to `main`.

## 4. Load the jobs (once)

The 83 jobs (Sage and Innergy numbers, names, miles from Colorado Springs and Englewood), the confirmed job-to-job distances, the $0.58 mileage rate and the installers' home bases are in **`job-cost-setup.json`**. That file is kept out of this repository because it lists customer jobs and installers' names. Get it from whoever set up the pilot.

Sign in. Because the list is empty, the pilot shows **One-time setup: load the jobs**: choose `job-cost-setup.json` and wait for "Jobs, distances and settings loaded" (under a minute).

## Checklist

- [ ] Tammy signs in → Start here → Setup shows the rate and installers.
- [ ] An installer opens the link on their phone (it ends in `#trip`) → signs in → sends a day with a receipt photo → it appears on Tammy's Mileage page, and the photo is in the Job Cost Receipts folder.
- [ ] Tammy approves it and downloads the bank file.
- [ ] Abby imports a Sage export → the rows appear on the WIP schedule.
- [ ] Dani reviews a job and locks the month.

Common errors:
- `AADSTS50011 redirect URI mismatch`: the page address isn't in step 2.1 exactly.
- `AADSTS65001 consent`: admin consent wasn't granted.
- "Could not read jobs": the person's account can't open the Job Cost Data list, or `siteHostname`/`sitePath`/`listName` in `config.js` is wrong.
- "Could not save: your account can't change the Job Cost list": the person has Read, not Contribute.
