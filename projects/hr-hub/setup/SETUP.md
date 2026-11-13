# Connecting the HR Hub to Microsoft 365

Version 2 of the HR Hub keeps its data in CIM's SharePoint and uses Microsoft 365 sign-in. Until it's connected, the page shows "Not connected yet". You need a Microsoft 365 admin for step 2.

## Who sees what

Access is decided by SharePoint permissions on three lists, not by the website:

| List | Holds | HR | Staff who own checklist steps | Everyone else |
|---|---|---|---|---|
| HR Hub Private | people, interviews, paper inbox, feedback | Edit | No access | No access |
| HR Hub Tasks | checklist tasks (person's name, step, due date) | Edit | Contribute | No access |
| HR Hub Settings | checklist rules, messages, questions, departments, field map | Edit | Read | No access |

Anyone who can open **HR Hub Private** gets the full Hub. Everyone else who can sign in gets **My tasks** only. As in version 1, staff with access to the Tasks list can see every open task (the person's name and the step), not only their own.

## 1. Create the lists

1. Pick a SharePoint site HR controls, e.g. `https://contoso.sharepoint.com/sites/HR`.
2. Make two groups in Microsoft 365 (or use existing ones): one for **HR**, one for **staff who own checklist steps** (supervisors, payroll, IT, safety).
3. On a computer with PowerShell 7:
   ```powershell
   Install-Module PnP.PowerShell -Scope CurrentUser
   ./setup/Create-HRHubLists.ps1 -SiteUrl https://contoso.sharepoint.com/sites/HR -PnPClientId <PnP PowerShell client id> -HrGroup hr@contoso.com -StaffGroup hrhub-owners@contoso.com
   ```
   Reuse the "PnP PowerShell" client ID from the Quality Tracker or Bid Screener setup if there is one; otherwise see the top of the script.

By hand instead: create three custom lists named as above; in each, make `Title` indexed with "Enforce unique values: Yes", and add `DocCollection` (single line of text, indexed), `DocId` (single line of text) and `DocData` (multiple lines of **plain** text). Then set each list's permissions as in the table (List settings → Permissions for this list → Stop inheriting permissions).

## 2. Register the app in Entra ID (Azure AD)

1. <https://entra.microsoft.com> → **Applications → App registrations → New registration**.
   - Name: `CIM HR Hub`
   - Supported account types: **Accounts in this organizational directory only**
   - Redirect URI: platform **Single-page application (SPA)**:
     `https://conceptstothemoon-cmd.github.io/Concepts-in-Millwork-AI-Projects/projects/hr-hub/`
   - Also add `http://localhost:3000/` for testing. The trailing slash must match exactly.
2. **API permissions → Microsoft Graph → Delegated**: `User.Read`, `Sites.ReadWrite.All`. Then **Grant admin consent**.
3. Copy the **Application (client) ID** and **Directory (tenant) ID**.

No client secret is needed. `Sites.ReadWrite.All` is *delegated*: the page can only do what the signed-in person can already do in SharePoint, so the list permissions from step 1 still decide who sees what.

## 3. Fill in `config.js`

```js
window.HR_CONFIG = {
  tenantId: '<Directory (tenant) ID>',
  clientId: '<Application (client) ID>',
  siteHostname: 'contoso.sharepoint.com',
  sitePath: '/sites/HR',
  lists: { private: 'HR Hub Private', tasks: 'HR Hub Tasks', settings: 'HR Hub Settings' },
  refreshSeconds: 45,
};
```

Commit and push to `main`.

## 4. Load your checklists (HR, once)

Your checklist rules, questions, departments, message templates and field map are in **`hr-hub-setup.json`**. That file is kept out of this repository because it names CIM staff and describes internal HR steps. Get it from whoever set up the Hub.

Sign in as HR. Because the Settings list is empty, the Hub asks for the setup file: choose `hr-hub-setup.json` and wait for "Checklists loaded" (about a minute). After that, change anything under **Checklist rules** and **Who sees what**.

## Checklist

- [ ] HR signs in → the dashboard shows. Start a hire → its tasks appear in the HR Hub Tasks list.
- [ ] A supervisor signs in → only **My tasks** shows; they can tick off their step.
- [ ] Someone in neither group signs in → "Your account can't open the HR Hub lists".
- [ ] Download the people file and an export → the files save.

Common errors:
- `AADSTS50011 redirect URI mismatch`: the page address isn't in step 2.1 exactly.
- `AADSTS65001 consent`: admin consent wasn't granted.
- HR sees only My tasks: HR's account can't open **HR Hub Private**; check that list's permissions.
- "Your account can't open the HR Hub lists" for everyone: check `siteHostname`, `sitePath` and the list names in `config.js`.

## Moving records from version 1

Version 1's people, tasks, interviews and paper log are still in the claude.ai artifact; they aren't copied automatically. For a pilot, it's usually simplest to finish open checklists in version 1 and start new ones in version 2. If they need to move, ask for an export into the Private and Tasks lists.
