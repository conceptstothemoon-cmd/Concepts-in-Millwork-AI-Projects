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

## Please send back

| Item | Where to find it | Example |
|---|---|---|
| Directory (tenant) ID | App registration → Overview | `xxxxxxxx-xxxx-…` |
| Application (client) ID | App registration → Overview | `xxxxxxxx-xxxx-…` |
| SharePoint hostname | Site URL | `cim.sharepoint.com` |
| Site path | Site URL | `/sites/Quality` |
| List name | Only if you changed it from "Quality Issues" | |

None of these values are secret. Once we receive them, we switch the apps to live mode and test it with you.

## If you'd rather not grant `Sites.ReadWrite.All`

That permission is delegated, so it's limited to what each signed-in user can already reach. If your policy requires narrower access, let us know: the app can be switched to `Sites.Selected`, which limits it to this one site. That needs a small code change and one extra admin step.
