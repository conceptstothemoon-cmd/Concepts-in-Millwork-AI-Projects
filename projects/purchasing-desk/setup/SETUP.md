# Putting the Purchasing Desk behind Microsoft 365 sign-in

The online page (`index.html`) contains no prices. When someone opens it, they sign in with their CIM Microsoft 365 account and the page reads the price file from SharePoint. If their account can't open that file, they see "You don't have access to the prices" and nothing else. The prices never go in the GitHub repo or on the GitHub Pages site.

You need a Microsoft 365 admin for step 2.

## 1. Put the price file in SharePoint

1. Pick a SharePoint site only the purchasing team (and whoever maintains the tool) can open, e.g. `https://contoso.sharepoint.com/sites/Purchasing`. Create one if needed.
2. In that site's **Documents** library, make a folder named `Purchasing Desk`.
3. Upload `purchasing-desk-data.json` into it. To make the file: put `supplier-prices.json` and `document-info.json` in `data/`, run `python build.py`, and upload `private-build/purchasing-desk-data.json`.
4. Check the permissions on that folder or file: everyone who should see prices needs at least **Read**. Nobody else should have access. That's the only thing that controls who sees the prices.

When prices change, rebuild and upload the new file over the old one. Everyone sees it the next time they open the page.

## 2. Register the app in Entra ID (Azure AD)

1. <https://entra.microsoft.com> → **Applications → App registrations → New registration**.
   - Name: `CIM Purchasing Desk`
   - Supported account types: **Accounts in this organizational directory only**
   - Redirect URI: platform **Single-page application (SPA)**:
     `https://conceptstothemoon-cmd.github.io/Concepts-in-Millwork-AI-Projects/projects/purchasing-desk/`
   - Also add `http://localhost:3000/` for testing on a PC. The trailing slash must match exactly.
2. **API permissions → Add a permission → Microsoft Graph → Delegated**: `User.Read`, `Sites.Read.All`. Then **Grant admin consent for <your org>**.
3. Copy the **Application (client) ID** and **Directory (tenant) ID** from Overview.

No client secret is needed. `Sites.Read.All` is *delegated*: the page can read only what the signed-in person can already open in SharePoint, so the file permissions from step 1.4 still decide who sees prices.

## 3. Fill in `config.js`

```js
window.PD_CONFIG = {
  tenantId: '<Directory (tenant) ID>',
  clientId: '<Application (client) ID>',
  siteHostname: 'contoso.sharepoint.com',
  sitePath: '/sites/Purchasing',
  dataFile: 'Purchasing Desk/purchasing-desk-data.json',
};
```

Commit and push to `main`. Turn on GitHub Pages if it isn't on yet (repo **Settings → Pages**: branch `main`, folder `/ (root)`).

## Checklist

- [ ] Open the page → **Sign in** → you return signed in, your name at the top right, and the welcome panel and prices appear.
- [ ] Open it in a private window with an account that has no access to the file → "You don't have access to the prices".
- [ ] Open `https://conceptstothemoon-cmd.github.io/Concepts-in-Millwork-AI-Projects/projects/purchasing-desk/data/supplier-prices.json` → not found (the price files aren't in the repo).

Common errors:
- `AADSTS50011 redirect URI mismatch`: the page address isn't in step 2.1 exactly (check the trailing slash).
- `AADSTS65001 consent`: admin consent wasn't granted (step 2.2).
- "You don't have access to the prices" for someone who should have it: check the file permissions, and `siteHostname`, `sitePath` and `dataFile` in `config.js` (a wrong path looks the same as no access).

## The offline copy

`python build.py` also writes `private-build/Purchasing-Desk-Beta.html`, the single file with prices built in that Jim can open without signing in. Anyone who gets that file can see every price, so share it only inside CIM (Teams or email), and never commit it.
