# Connecting Spec Desk to Microsoft 365 and Claude

Out of the box, Spec Desk on GitHub Pages works on its own: documents and projects stay in each person's browser, the Save and Split buttons download files, and the AI features are off. These steps let people:

- sign in with their CIM work account,
- open spec books, drawings, proposals and estimates straight from SharePoint or OneDrive,
- save whole projects to a shared SharePoint folder so others on the team can open them,
- use every AI feature (Ask, Compare, summaries, Drawing review, room schedule reading, Deep check and the automatic checking) through CIM's own Claude service.

You need a Microsoft 365 admin for step 2 and someone who can create Azure resources for step 3. Steps 1 and 2 alone already give sign-in, SharePoint files and shared projects; step 3 adds Claude.

## 1. Pick the SharePoint site

1. Pick (or create) a SharePoint site the estimating and drafting team uses, e.g. `https://contoso.sharepoint.com/sites/Estimating`.
2. Give the team **Edit** (or Contribute) permission on the site's **Documents** library. Spec Desk creates a folder named `Spec Desk Projects` there the first time someone saves a project.
3. That's all; no list or columns are needed. People can also keep project folders and documents anywhere else they already have access to: the file browser shows the site's Documents library and each person's OneDrive.

If you leave the site out of `config.js` (step 4), projects are saved to each person's own OneDrive instead, which they can share from OneDrive.

## 2. Register the app in Entra ID (Azure AD)

1. <https://entra.microsoft.com> → **Applications → App registrations → New registration**.
   - Name: `CIM Spec Desk`
   - Supported account types: **Accounts in this organizational directory only**
   - Redirect URI: platform **Single-page application (SPA)**:
     `https://conceptstothemoon-cmd.github.io/Concepts-in-Millwork-AI-Projects/projects/spec-desk/`
   - Also add `http://localhost:3000/` for testing on a PC. The trailing slash must match exactly.
2. **API permissions → Add a permission → Microsoft Graph → Delegated**: `User.Read`, `Files.ReadWrite.All`, `Sites.ReadWrite.All`.
3. **Expose an API** (needed for step 3):
   - Click **Add** next to Application ID URI and accept `api://<client id>`.
   - **Add a scope**: name `access_as_user`, who can consent **Admins and users**, display name "Use Spec Desk's Claude features".
   - Back in **API permissions → Add a permission → My APIs → CIM Spec Desk → Delegated → access_as_user**.
4. Click **Grant admin consent for <your org>**.
5. Copy the **Application (client) ID** and **Directory (tenant) ID** from Overview.

No client secret is needed, and none should ever go in this repo.

The Graph permissions are *delegated*: Spec Desk can only open and save what the signed-in person can already open and save in SharePoint and OneDrive. Who can see a shared project is decided by the folder's SharePoint permissions.

## 3. Set up Spec Desk's Claude service (Azure Function)

The page can't call Claude directly: the API key would be visible to anyone who opens it. The small function in `api/` holds the key, checks that the caller is signed in to CIM's Microsoft 365, and forwards the request. It is separate from the Bid Screener's service, so Spec Desk has its own key, its own spend limit and its own usage figures.

1. **Get a Claude API key.** At <https://console.anthropic.com>, use CIM's organization, create an API key named "Spec Desk", and under **Limits** set a monthly spend limit for it (see costs below).
2. **Create a Function App** in the Azure portal: Runtime **Node.js 22** (20 or later works), OS Linux, plan **Flex Consumption** (recommended: long drawing reviews take a minute or two). Name it, for example `cim-spec-desk`.
3. **App settings** (Function App → Settings → Environment variables):

   | Name | Value |
   |---|---|
   | `ANTHROPIC_API_KEY` | the key from step 3.1 (or a Key Vault reference to it) |
   | `TENANT_ID` | Directory (tenant) ID from step 2 |
   | `CLIENT_ID` | Application (client) ID from step 2 |
   | `CLAUDE_MODEL` | optional; defaults to `claude-opus-5-5` |
   | `CLAUDE_EFFORT` | optional; defaults to `high` (how hard Claude thinks on comparisons, reviews and checks) |
   | `CLAUDE_EFFORT_QUICK` | optional; defaults to `low` (reading sheet references, matching spreadsheet columns) |

4. **CORS** (Function App → API → CORS): add `https://conceptstothemoon-cmd.github.io` (just the origin, no path) and `http://localhost:3000` for testing.
5. **Deploy** the `api/` folder. Easiest is VS Code with the Azure Functions extension (right-click `api` → Deploy to Function App). Or, with Azure Functions Core Tools:
   ```bash
   cd projects/spec-desk/api
   npm install
   npm test
   func azure functionapp publish cim-spec-desk
   ```
6. The endpoint is `https://<function app name>.azurewebsites.net/api/claude` (Flex Consumption apps may show a different host name on the Overview page; use that one).

The function streams its answer back while Claude works, so long requests aren't cut off by Azure's 230-second limit; each request may run up to 10 minutes (`host.json`). Claude's thinking is on, and if Claude's safety checks ever decline a request, the API automatically retries it on a fallback model.

To try the function locally, copy `api/local.settings.example.json` to `api/local.settings.json` (ignored by git), fill it in, and run `func start`.

## 4. Fill in `config.js`

```js
window.SD_CONFIG = {
  tenantId: '<Directory (tenant) ID>',
  clientId: '<Application (client) ID>',
  siteHostname: 'contoso.sharepoint.com',
  sitePath: '/sites/Estimating',
  projectsFolder: 'Spec Desk Projects',
  claudeEndpoint: 'https://cim-spec-desk.azurewebsites.net/api/claude',
};
```

Commit and push to `main`. GitHub Pages updates in about a minute. The header now shows **Sign in with Microsoft**.

## Checklist

- [ ] Open the page → **Sign in with Microsoft** → "Signed in as <your name>" appears in the header.
- [ ] **From SharePoint** next to "Choose a spec book PDF" → the file browser shows the site's Documents library and My OneDrive → pick a spec book → it opens and splits into sections.
- [ ] Ask tab → ask a question → an answer appears in under a minute, followed by a green "Checked automatically" box.
- [ ] Projects → **Save to SharePoint** → a `… - Spec Desk project.zip` file appears in `Spec Desk Projects`.
- [ ] On another computer (or browser), sign in → Projects → **Open from SharePoint** → open that file → the spec book, comparison, drawings and decisions are all there.
- [ ] Save index (CSV) → the file downloads.

Common errors:
- `AADSTS50011 redirect URI mismatch`: the page address isn't in step 2.1 exactly (check the trailing slash).
- `AADSTS65001 consent`: admin consent wasn't granted (step 2.4).
- The file browser shows only My OneDrive: `siteHostname` or `sitePath` in `config.js` is wrong, or the person has no access to the site.
- "Your Microsoft 365 sign-in wasn't accepted by the Claude service": the `TENANT_ID`/`CLIENT_ID` app settings are wrong, or step 2.3 wasn't done.
- "Couldn't reach the Claude service": wrong `claudeEndpoint`, or the GitHub Pages origin is missing from CORS (step 3.4).
- "Claude isn't connected on this site yet": `claudeEndpoint` is blank in `config.js`.

## What it costs

- **SharePoint, OneDrive and sign-in:** included in Microsoft 365.
- **Azure Function:** a team this size normally stays inside the free monthly allowance.
- **Claude API:** billed by Anthropic per use. The model is Claude Opus 5.5 ($4 per million input tokens, $20 per million output tokens). Spec Desk sends a lot of text and pictures, and checks each answer automatically, so it costs more per use than the Bid Screener. Rough figures, to be confirmed from the first weeks' bills: a question in Ask, a few cents to about 25 cents with its checking; comparing one spec section against a proposal, roughly $1 to $5 with checking; a drawing review of one sheet with images, roughly $1 to $5 with checking; a Deep check of several sections, several dollars or more. Turning automatic checking down (Deep check tab: fewer rounds, or off) lowers the cost. A spend limit on the API key (step 3.1) caps the bill.

## What runs where

| Piece | Where | Holds secrets? |
|---|---|---|
| `index.html`, `m365.js`, `config.js` | GitHub Pages (public) | No |
| Projects people save, documents they open | SharePoint / OneDrive, CIM tenant | Company data; access by SharePoint permissions |
| Projects being worked on | Each person's browser storage | Company data, on that computer only |
| Claude API key | Azure Function app settings | Yes, only there |
| Text and sheet images sent for AI features | Anthropic's Claude API, through CIM's function | Sent per request under CIM's API agreement |
