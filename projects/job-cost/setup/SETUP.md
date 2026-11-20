# Connecting the Job Cost Pilot to Microsoft 365

The pilot keeps its jobs, distances, trips, mileage, imports and WIP in CIM's SharePoint, and everyone signs in with their CIM Microsoft 365 account. Until it's connected, the page shows "Not connected yet". You need a Microsoft 365 admin for step 2.

**Installers don't need a company email.** Most use Gmail, so step 5 invites each installer's Gmail address as a guest in CIM's Microsoft 365. Anyone not invited yet can have Tammy send their day from her screen, as the Start page says.

## 1. Create the list and receipts folder

1. Pick a SharePoint site Accounting uses, e.g. `https://contoso.sharepoint.com/sites/Accounting`.
2. Make (or reuse) a Microsoft 365 group with everyone who uses the pilot: Dani, Tammy, Abby and the installers. Installers with Gmail are added to it in step 5, so the group must allow guests.
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

`tenantId` is required: guests can only sign in through CIM's own directory, so the page stays on "Not connected yet" without it.

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

## 5. Installers who sign in with Gmail

Each installer's Gmail address becomes a **guest** in CIM's Microsoft 365. Guests don't need a Microsoft 365 license to use the pilot. Do steps 5.1 to 5.3 once, then 5.4 for each installer.

1. **Let guests in.** <https://entra.microsoft.com> → **External Identities → External collaboration settings**: guest invitations allowed at least for admins. Under **All identity providers**, check **Email one-time passcode** is on (the default).
2. **Optional, smoother: Google sign-in.** In **All identity providers → Google**, add a Google Cloud OAuth client (Google Cloud console → APIs & Services → Credentials → OAuth client ID, type Web application) with these authorized redirect URIs, using the Directory (tenant) ID from step 2:
   - `https://login.microsoftonline.com/te/<tenant id>/oauth2/authresp`
   - `https://login.microsoftonline.com/te/<tenant name>.onmicrosoft.com/oauth2/authresp`

   With it, installers tap **Sign in with Google** instead of typing an emailed code.
3. **Let guests into the site and group.**
   - SharePoint admin center → **Policies → Sharing**: at least **Existing guests** for the organization, and the same on the Accounting site (**Sites → Active sites → the site → Sharing**).
   - Microsoft 365 admin center → **Settings → Org settings → Microsoft 365 Groups**: allow group owners to add people outside the organization.
4. **For each installer:** Entra → **Users → New user → Invite external user** → their Gmail address, display name as on their timecard. Then add that guest to the group from step 1.2. The invitation email isn't needed: the installer just opens the pilot link.

The installer opens the link ending in `#trip` on their phone, taps **Sign in**, enters their Gmail, and either taps **Sign in with Google** or enters the code emailed to them. The first time, they accept the permissions prompt.

**Expect to re-sign in.** Microsoft keeps a phone signed in to a web page like this for about a day. With Google sign-in that's usually one tap; with emailed codes it's a code each time. If that's too much for installers, ask about a no-sign-in trip form instead.

**Test with one Gmail first** (yours is fine) before inviting everyone: sign in on a phone, send a trip with a receipt photo, and check it on Tammy's Mileage page.

## Checklist

- [ ] Tammy signs in → Start here → Setup shows the rate and installers.
- [ ] An installer opens the link on their phone (it ends in `#trip`) → signs in with their Gmail → sends a day with a receipt photo → it appears on Tammy's Mileage page, and the photo is in the Job Cost Receipts folder.
- [ ] Tammy approves it and downloads the bank file.
- [ ] Abby imports a Sage export → the rows appear on the WIP schedule.
- [ ] Dani reviews a job and locks the month.

Common errors:
- `AADSTS50011 redirect URI mismatch`: the page address isn't in step 2.1 exactly.
- `AADSTS65001 consent`: admin consent wasn't granted.
- "Could not read jobs": the person's account can't open the Job Cost Data list, or `siteHostname`/`sitePath`/`listName` in `config.js` is wrong.
- "Could not save: your account can't change the Job Cost list": the person has Read, not Contribute.
- `AADSTS50020 user account ... does not exist in tenant`: that Gmail hasn't been invited as a guest (step 5.4), or it was invited under a different address.
- A guest signs in but sees "Could not read jobs": the guest isn't in the group yet, or the site's sharing setting blocks guests (step 5.3).
