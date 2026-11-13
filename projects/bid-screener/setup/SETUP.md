# Connecting the Bid Screener to Microsoft 365 and Claude

Out of the box the page runs in **demo mode**: made-up examples saved only in each person's browser, with reading invites and "Ask a question" turned off. These steps switch it to **live mode**: people sign in with their CIM work account, everyone shares one GC list and invite list in SharePoint, and Claude reads invites and answers questions.

You need a Microsoft 365 admin for step 2 and someone who can create Azure resources for step 3. Steps 1 and 2 alone already give you shared data and sign-in; step 3 adds the Claude features.

## 1. Create the SharePoint list

1. Pick (or create) a SharePoint site the Sales and Estimating team can use, e.g. `https://contoso.sharepoint.com/sites/Sales`.
2. On a computer with PowerShell 7:
   ```powershell
   Install-Module PnP.PowerShell -Scope CurrentUser
   ./setup/Create-BidScreenerList.ps1 -SiteUrl https://contoso.sharepoint.com/sites/Sales -PnPClientId <PnP PowerShell client id>
   ```
   If the Quality Tracker setup already registered "PnP PowerShell", reuse that client ID. Otherwise see the note at the top of the script.
3. Give the team **Contribute** permission on the site (or just this list). Anyone without it can't open the data.

By hand instead: create a custom list named `Bid Screener Data`; make `Title` indexed and "Enforce unique values: Yes"; add `DocCollection` (single line of text, indexed), `DocId` (single line of text), `DocData` (multiple lines of **plain** text). Create each column with exactly that name.

## 2. Register the app in Entra ID (Azure AD)

1. <https://entra.microsoft.com> → **Applications → App registrations → New registration**.
   - Name: `CIM Bid Screener`
   - Supported account types: **Accounts in this organizational directory only**
   - Redirect URI: platform **Single-page application (SPA)**:
     `https://conceptstothemoon-cmd.github.io/Concepts-in-Millwork-AI-Projects/projects/bid-screener/`
   - Also add `http://localhost:3000/` for testing on a PC. The trailing slash must match exactly.
2. **API permissions → Add a permission → Microsoft Graph → Delegated**: `User.Read`, `Sites.ReadWrite.All`.
3. **Expose an API** (needed for step 3):
   - Click **Add** next to Application ID URI and accept `api://<client id>`.
   - **Add a scope**: name `access_as_user`, who can consent **Admins and users**, display name "Use the Bid Screener's Claude features".
   - Back in **API permissions → Add a permission → My APIs → CIM Bid Screener → Delegated → access_as_user**.
4. Click **Grant admin consent for <your org>**.
5. Copy the **Application (client) ID** and **Directory (tenant) ID** from Overview.

No client secret is needed, and none should ever go in this repo.

`Sites.ReadWrite.All` is *delegated*: the page can only do what the signed-in person can already do in SharePoint. Who can see and change the data is decided by the SharePoint permissions from step 1.

## 3. Set up the Claude service (Azure Function)

The page can't call Claude directly: the API key would be visible to anyone who opens it. The small function in `api/` holds the key, checks that the caller is signed in to CIM's Microsoft 365, and forwards the request.

1. **Get a Claude API key.** At <https://console.anthropic.com>, create an organization or use CIM's, add billing, and create an API key named "Bid Screener". Under **Limits**, set a monthly spend limit (see costs below).
2. **Create a Function App** in the Azure portal: Runtime **Node.js 22** (20 or later works), OS Linux, plan **Flex Consumption** (or Consumption). Name it, for example `cim-bid-screener`.
3. **App settings** (Function App → Settings → Environment variables):

   | Name | Value |
   |---|---|
   | `ANTHROPIC_API_KEY` | the key from step 3.1 (or a Key Vault reference to it) |
   | `TENANT_ID` | Directory (tenant) ID from step 2 |
   | `CLIENT_ID` | Application (client) ID from step 2 |
   | `CLAUDE_MODEL` | optional; defaults to `claude-opus-5-5` |

4. **CORS** (Function App → API → CORS): add `https://conceptstothemoon-cmd.github.io` (just the origin, no path) and `http://localhost:3000` for testing.
5. **Deploy** the `api/` folder. Easiest is VS Code with the Azure Functions extension (right-click `api` → Deploy to Function App). Or, with Azure Functions Core Tools:
   ```bash
   cd projects/bid-screener/api
   npm install
   func azure functionapp publish cim-bid-screener
   ```
6. The endpoint is `https://<function app name>.azurewebsites.net/api/claude` (Flex Consumption apps may show a different host name on the Overview page; use that one).

To try the function locally, copy `api/local.settings.example.json` to `api/local.settings.json` (ignored by git), fill it in, and run `func start`.

## 4. Fill in `config.js`

```js
window.BS_CONFIG = {
  tenantId: '<Directory (tenant) ID>',
  clientId: '<Application (client) ID>',
  siteHostname: 'contoso.sharepoint.com',
  sitePath: '/sites/Sales',
  listName: 'Bid Screener Data',
  claudeEndpoint: 'https://cim-bid-screener.azurewebsites.net/api/claude',
  refreshSeconds: 45,
};
```

Commit and push to `main`. GitHub Pages updates in about a minute. The page now shows **Sign in with Microsoft 365** instead of the demo badge.

## 5. Load the GC list

Sign in, open **GC list**, and import your GC spreadsheet. `gc-list-template.csv` has the columns it expects. Until a GC list exists, every invite is left for a person to decide.

## Live-mode checklist

- [ ] Open the page → Sign in → your name appears in the header.
- [ ] GC list → import the spreadsheet → the GCs appear; rows appear in the SharePoint list.
- [ ] Change a GC's tier → open the page in a second browser → the new tier shows within a minute.
- [ ] Check an invite → paste an invite email → a result appears in 10 to 30 seconds → Add to Today's invites.
- [ ] Ask a question → "Which GCs are Do Not Bid?" → an answer appears.
- [ ] A person without access to the SharePoint site sees "The shared data couldn't be loaded".

Common errors:
- `AADSTS50011 redirect URI mismatch`: the page address isn't in step 2.1 exactly (check the trailing slash).
- `AADSTS65001 consent`: admin consent wasn't granted (step 2.4).
- "SharePoint request failed (404)": `siteHostname`, `sitePath` or `listName` in `config.js` is wrong.
- "Your sign-in wasn't accepted by the Claude service": `TENANT_ID`/`CLIENT_ID` app settings are wrong, or step 2.3 wasn't done.
- "Couldn't reach the Claude service": wrong `claudeEndpoint`, or the GitHub Pages origin is missing from CORS (step 3.4).

## What it costs

- **SharePoint and sign-in:** included in Microsoft 365.
- **Azure Function:** a team this size normally stays inside the free monthly allowance.
- **Claude API:** billed by Anthropic per use. The model is Claude Opus 5.5 ($4 per million input tokens, $20 per million output tokens). Rough figures: reading one invite is a few cents; one "Ask a question" answer is usually 10 to 25 cents, more for questions that dig through many estimates. A spend limit on the API key (step 3.1) caps the bill.

## What runs where

| Piece | Where | Holds secrets? |
|---|---|---|
| `index.html`, `m365.js`, `config.js` | GitHub Pages (public) | No |
| GC list, invites, decisions, estimates, suggestions | SharePoint list, CIM tenant | Company data; access by SharePoint permissions |
| Claude API key | Azure Function app settings | Yes, only there |
