# Connecting to Microsoft 365 (live mode)

Out of the box the apps run in **demo mode** (sample data saved in each browser). Follow these steps once to store real issues in SharePoint. You need a Microsoft 365 admin for step 2.

## 1. Create the SharePoint list

1. Choose (or create) a SharePoint site, e.g. `https://contoso.sharepoint.com/sites/Quality`.
2. On a Windows or Mac machine with PowerShell 7:
   ```powershell
   Install-Module PnP.PowerShell -Scope CurrentUser
   Register-PnPEntraIDAppForInteractiveLogin -ApplicationName "PnP PowerShell" -Tenant contoso.onmicrosoft.com
   ./setup/Create-QualityList.ps1 -SiteUrl https://contoso.sharepoint.com/sites/Quality -PnPClientId <client id printed above>
   ```
3. Optional: load sample data for training with `./setup/Import-SampleData.ps1` (same parameters). Remove it later with `-Remove`.

Prefer clicking? You can create the list by hand: see the column table at the bottom.

## 2. Register the web app in Entra ID (Azure AD)

1. Go to <https://entra.microsoft.com> → **Applications → App registrations → New registration**.
2. Name: `CIM Quality`. Supported account types: **Accounts in this organizational directory only**.
3. Redirect URI: platform **Single-page application (SPA)**, and add **both** page URLs:
   - `https://conceptstothemoon-cmd.github.io/Concepts-in-Millwork-AI-Projects/projects/quality-tracker/entry/`
   - `https://conceptstothemoon-cmd.github.io/Concepts-in-Millwork-AI-Projects/projects/quality-tracker/dashboard/`
   - For local testing also add `http://localhost:3000/entry/` and `http://localhost:3000/dashboard/`.
   Trailing slashes matter: they must match exactly.
4. **API permissions → Add a permission → Microsoft Graph → Delegated**: `User.Read`, `Sites.ReadWrite.All`.
   Then click **Grant admin consent for <your org>**.
5. Copy the **Application (client) ID** and **Directory (tenant) ID** from the Overview page.

No client secret is needed (and none should ever be put in this repo).

> **About `Sites.ReadWrite.All`:** it's a *delegated* permission, so the app can only do what the signed-in person can already do in SharePoint. Who can see/add issues is controlled by the SharePoint site's own permissions. Give shop staff **Contribute** on the site (or just on the list).

## 3. Fill in `shared/config.js`

```js
window.CIM_CONFIG = {
  tenantId: '<Directory (tenant) ID>',
  clientId: '<Application (client) ID>',
  siteHostname: 'contoso.sharepoint.com',
  sitePath: '/sites/Quality',
  listName: 'Quality Issues',
};
```

Commit and push. GitHub Pages republishes in about a minute. Both pages now show a **Sign in** button instead of the "Demo mode" badge.

## Live-mode checklist

- [ ] Open the entry app → Sign in → you return signed in, your name in the header and in "Reported By".
- [ ] Submit an issue → success popup shows its `QI-####` number → item appears in the SharePoint list.
- [ ] Click the issue in **All Issues**, change Status to *In Progress*, save → SharePoint item updates.
- [ ] Open the dashboard → Sign in → the new issue is in **Recent Issues**; filters change the numbers.
- [ ] A user without site access gets a clear "SharePoint request failed (403)" message.

Common errors:
- `AADSTS50011 redirect URI mismatch` → the page URL isn't listed in step 2.3 exactly (check trailing slash).
- `AADSTS65001 consent` → admin consent not granted (step 2.4).
- `SharePoint request failed (404)` → `siteHostname` / `sitePath` / `listName` wrong in config.

## List columns (if creating by hand)

Internal names must match exactly (create each column with this name first, then rename the display name if you like).

| Internal name | Type | Values |
|---|---|---|
| Title | (built in) | short copy of the description |
| Project | Single line of text | |
| DateReported | Date (date only) | |
| MNumber | Single line of text | |
| Category | Choice | see `shared/lists.js` → `CATEGORIES` |
| IssueDescription | Multiple lines of text | |
| Severity | Choice | Critical, High, Medium, Low |
| CaughtBy | Choice | see `DEPTS` |
| CreatedByDept | Choice | see `DEPTS` |
| ReportedBy | Single line of text | |
| RootCause | Choice | see `ROOT_CAUSES` |
| CorrectiveAction | Multiple lines of text | |
| CostImpact | Currency | |
| Status | Choice | Open, In Progress, Resolved (default Open) |
