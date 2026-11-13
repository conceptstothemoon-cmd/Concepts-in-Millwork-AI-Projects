# CIM Quality Tracker — setup request for CIM IT

**Estimated time:** about 30 minutes, one time. A Microsoft 365 admin is needed for step 3.

## What this is

A quality-issue tracker for the shop:

- **Entry app:** <https://conceptstothemoon-cmd.github.io/Concepts-in-Millwork-AI-Projects/projects/quality-tracker/entry/>
  Staff sign in with their normal CIM Microsoft 365 account and log quality issues. It can be installed on phones and tablets ("Add to Home Screen").
- **Dashboard:** <https://conceptstothemoon-cmd.github.io/Concepts-in-Millwork-AI-Projects/projects/quality-tracker/dashboard/>
  Shows charts of the logged issues.

Right now both run in demo mode on sample data. After the steps below, they read and write one SharePoint list in CIM's tenant.

## What it needs, and why it's safe

- **Data stays in CIM's SharePoint.** The web pages are static files with no server and no database of their own. All data lives in a SharePoint list you control.
- **Delegated permissions only.** The app acts as the signed-in person and can do only what that person can already do in SharePoint. Access is controlled by normal SharePoint site permissions.
- **No secrets.** There is no client secret and no stored credentials. The app registration is a public single-page app, and its client ID is not sensitive.
- **Open source.** All code is in the repo linked above, so you can review it. The Microsoft Graph calls are all in `shared/data.js`.

## Steps

### 1. Choose a SharePoint site
Use an existing site or create one, for example `https://<cim>.sharepoint.com/sites/Quality`.

### 2. Create the "Quality Issues" list
**Option A: script.** Requires PowerShell 7 and PnP.PowerShell. From the repo's `projects/quality-tracker/setup/` folder:
```powershell
Install-Module PnP.PowerShell -Scope CurrentUser
Register-PnPEntraIDAppForInteractiveLogin -ApplicationName "PnP PowerShell" -Tenant <cim>.onmicrosoft.com
./Create-QualityList.ps1 -SiteUrl https://<cim>.sharepoint.com/sites/Quality -PnPClientId <client id printed above>
```
**Option B: by hand.** Create a list named **Quality Issues** with the columns in the table at the bottom of [AZURE-SETUP.md](AZURE-SETUP.md). The internal column names must match exactly.

### 3. Register the app in Entra ID (admin)
1. <https://entra.microsoft.com> → **App registrations → New registration**
2. Name: `CIM Quality Tracker`. Accounts: **this organizational directory only**.
3. Redirect URI, platform **Single-page application (SPA)**. Add both URLs exactly as shown, with the trailing slash:
   - `https://conceptstothemoon-cmd.github.io/Concepts-in-Millwork-AI-Projects/projects/quality-tracker/entry/`
   - `https://conceptstothemoon-cmd.github.io/Concepts-in-Millwork-AI-Projects/projects/quality-tracker/dashboard/`
4. **API permissions → Microsoft Graph → Delegated:** `User.Read`, `Sites.ReadWrite.All` → **Grant admin consent**.
5. Do **not** create a client secret. None is needed.

### 4. Give people access
On the site (or just the list): **Contribute** for staff who report issues, **Read** for anyone who only views the dashboard.

## 5. Enter CIM's values in GitHub

The app reads its settings from one file, `shared/config.js`. It has four blank values (`''`). While they're blank, the app shows sample data. Once they're filled in, it signs people in with CIM accounts and saves issues to your SharePoint list.

1. Sign in to GitHub (a free account works) and open:
   <https://github.com/conceptstothemoon-cmd/Concepts-in-Millwork-AI-Projects/edit/main/projects/quality-tracker/shared/config.js>
2. Type each value between its quotes. Keep the quotes and the comma.

| In the file | What it does | Where to find it | What to type (example) |
|---|---|---|---|
| `tenantId: '',` | Uses CIM's Microsoft 365 sign-in | App registration → Overview → **Directory (tenant) ID** | `tenantId: '1a2b3c4d-1111-2222-3333-444455556666',` |
| `clientId: '',` | Identifies this app to Microsoft | App registration → Overview → **Application (client) ID** | `clientId: '9f8e7d6c-aaaa-bbbb-cccc-ddddeeeeffff',` |
| `siteHostname: '',` | CIM's SharePoint address | Site URL, from the host up to `.com` | `siteHostname: 'cim.sharepoint.com',` |
| `sitePath: '',` | Which site holds the list | Site URL, the part after `.com` | `sitePath: '/sites/Quality',` |
| `listName: 'Quality Issues',` | Name of the list | Change only if you renamed the list | leave as-is |

3. Click **Commit changes…** → **Propose changes** → **Create pull request**. Matt approves it, and the site updates within about a minute.

None of these values are secret. They're addresses, not passwords, and every request still needs a CIM login. **Do not** put a password or client secret in the file.

Would you rather not use GitHub? Email the four values to Matt instead.

## If you'd rather not grant `Sites.ReadWrite.All`

That permission is delegated, so it's limited to what each signed-in user can already reach. If your policy requires narrower access, let us know: the app can be switched to `Sites.Selected`, which limits it to this one site. That needs a small code change and one extra admin step.
