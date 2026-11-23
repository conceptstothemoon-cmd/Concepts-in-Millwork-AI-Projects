# Quality Tracker — Download & Install Walkthrough

Nothing to download or install from a disk — it's a web app. Just open a link in your browser.

## 1. Open the tool

```
https://conceptstothemoon-cmd.github.io/Concepts-in-Millwork-AI-Projects/projects/quality-tracker/
```

You'll see two links: the **Entry app** (report/update issues) and the **Dashboard** (charts and trends).

## 2. Install the Entry app (optional)

Puts an app icon on your home screen/desktop so you don't have to open a browser each time.

- **iPhone/iPad:** Open the Entry app → Share icon → Add to Home Screen.
- **Android:** Open the Entry app → ⋮ menu → Install app.
- **Windows/Mac:** Open the Entry app → click the install icon in the address bar.

## 3. Bookmark the Dashboard

```
https://conceptstothemoon-cmd.github.io/Concepts-in-Millwork-AI-Projects/projects/quality-tracker/dashboard/
```

---

Right now it's running in **demo mode** (sample data, saved only in your own browser) — good for trying it out and sending feedback before we turn on live mode (real data, shared across your team).

Both apps have a **Feedback** link in the header — use it any time something's confusing or you'd like a change.

---

## Turning on live mode (for whoever's doing the Microsoft 365 setup)

This makes real issues save to one shared list that your whole team can see, instead of sample data in just your own browser. You'll need a Microsoft 365 admin for one of the steps below.

### Step 1: Make a place to store the issues

In SharePoint, create a plain list named **Quality Issues** (any existing or new SharePoint site works). Then add these columns to it, one at a time, using **Add column** at the top of the list:

| Column name | Column type | What to type in for the choices |
|---|---|---|
| Project | Single line of text | — |
| DateReported | Date | Date only |
| MNumber | Single line of text | — |
| Category | Choice | Dimensional Error, Material Defect, Finish Quality, Hardware Issue, Design Mismatch, Assembly Error, Documentation Error, Shipping Damage, Installation Issue, Other |
| IssueDescription | Multiple lines of text | — |
| Severity | Choice | Critical, High, Medium, Low |
| CaughtBy | Choice | Estimating, Engineering, Project Management, Procurement, Programming, Case Work, Millwork, Layup, CNC, Edge Banding, Delivery, Installation |
| CreatedByDept | Choice | (same list as CaughtBy, above) |
| ReportedBy | Single line of text | — |
| RootCause | Choice | Human Error, Process Gap, Training Gap, Equipment Malfunction, Material Issue, Communication Failure, Design Error, Vendor Issue, Pending |
| CorrectiveAction | Multiple lines of text | — |
| CostImpact | Currency | — |
| Status | Choice | Open, In Progress, Resolved — set the default value to Open |

Important: the **column name** must be typed exactly as shown (capitalization and all, no spaces) — that's what the app looks for. You can give it a friendlier display name afterward if you want, that part doesn't matter.

### Step 2: Register the app with Microsoft (needs admin access)

1. Go to entra.microsoft.com → **App registrations → New registration**.
2. Name it `CIM Quality`. Under account types, choose **Accounts in this organizational directory only**.
3. Under Redirect URI, pick platform **Single-page application (SPA)** and add both of these (exactly as written, including the slash at the end):
   - `https://conceptstothemoon-cmd.github.io/Concepts-in-Millwork-AI-Projects/projects/quality-tracker/entry/`
   - `https://conceptstothemoon-cmd.github.io/Concepts-in-Millwork-AI-Projects/projects/quality-tracker/dashboard/`
4. Go to **API permissions → Add a permission → Microsoft Graph → Delegated permissions**, and add `User.Read` and `Sites.ReadWrite.All`. Then click **Grant admin consent**.
5. On the Overview page, copy the **Application (client) ID** and **Directory (tenant) ID** — you'll need both next.

No password or secret key is needed for any of this.

### Step 3: Give people access

On the SharePoint site (or just the list itself), give staff who'll be reporting issues **Contribute** access, and anyone who only needs to view the dashboard **Read** access.

### Step 4: Plug the values into the app

Open `shared/config.js` in the repo and fill in four values:

```js
window.CIM_CONFIG = {
  tenantId: '<Directory (tenant) ID from Step 2>',
  clientId: '<Application (client) ID from Step 2>',
  siteHostname: 'yourcompany.sharepoint.com',
  sitePath: '/sites/Quality',
  listName: 'Quality Issues',
};
```

Save, commit, and push. The site updates on its own in about a minute, and both apps switch from a "Demo mode" badge to a "Sign in" button.
