# Quality Tracker — Download & Install Walkthrough

This explains what you need to do on your end to start using the Quality Tracker. There is nothing to download from a website or install from a disk — it's a web app, so you just open a link in your browser and, if you want, install it like an app on your phone, tablet, or computer.

---

## Step 1: Open the tool

1. Open your web browser (Safari, Chrome, or Edge).
2. Go to this link:
   ```
   https://conceptstothemoon-cmd.github.io/Concepts-in-Millwork-AI-Projects/projects/quality-tracker/
   ```
3. You'll see two options: the **Entry app** (for reporting and updating quality issues) and the **Dashboard** (for totals, trends, and reports).

## Step 2: Install the Entry app on your device

This makes the Entry app open like a regular app, with its own icon, instead of living in a browser tab. It still works the exact same way — this is just a shortcut. Open the Entry app first, then follow the steps for your device:

**iPhone or iPad (Safari):**
1. Open the Entry app:
   ```
   https://conceptstothemoon-cmd.github.io/Concepts-in-Millwork-AI-Projects/projects/quality-tracker/entry/
   ```
2. Tap the **Share** icon — the square with an arrow pointing up, in the bottom toolbar (on iPad, it may be at the top instead).
3. Scroll down the menu that pops up and tap **Add to Home Screen**.
4. A preview box appears with the app name and icon already filled in — tap **Add** in the top-right corner.
5. The app icon now appears on your Home Screen like any other app. Tap it to open.

**Android (Chrome):**
1. Open the Entry app link above.
2. Tap the **three-dot menu** in the top-right corner of Chrome.
3. Tap **Install app** (or **Add to Home screen**, depending on your Android version).
4. Confirm by tapping **Install** in the popup.
5. The app icon is added to your Home Screen or app drawer. Tap it to open.

**Windows or Mac (Chrome or Edge):**
1. Open the Entry app link above.
2. Look at the right side of the address bar — you'll see a small icon (a monitor with a down arrow in Chrome, or similar in Edge). This is the **install icon**, not a menu.
3. Click it, then click **Install** in the popup that appears.
4. The app opens in its own window and an icon is added to your desktop/taskbar (Windows) or Applications folder / Dock (Mac).

Once installed, you can open it anytime from your home screen, desktop, or dock, even without an internet connection — though submitting an issue still requires internet.

## Step 3: Bookmark the Dashboard

The Dashboard doesn't need to be installed — just bookmark it in your browser so you can check it whenever you want:
```
https://conceptstothemoon-cmd.github.io/Concepts-in-Millwork-AI-Projects/projects/quality-tracker/dashboard/
```

---

## Turning on live mode (real data, not demo)

Right now the tool runs in **demo mode** — sample data only, saved just in your own browser. To switch to **live mode**, where everyone signs in with their CIM Microsoft 365 account and real issues are saved to one shared SharePoint list, four values need to be filled into `shared/config.js` in the repo: `tenantId`, `clientId`, `siteHostname`, and `sitePath`.

Getting those values requires a few steps in CIM's Microsoft 365 admin center (Entra ID and SharePoint), and the app registration step specifically needs **Microsoft 365 admin rights** to grant consent. If you already have that kind of admin access yourself, you can do it — the full steps are written out in [`setup/CIM-IT-HANDOFF.md`](CIM-IT-HANDOFF.md) in this same folder. If you don't have admin rights, that document is written to hand directly to whoever at CIM does (your IT admin) — they can follow it start to finish in about 30 minutes.

## Sending feedback

Both the Entry app and the Dashboard now have a **Feedback** link in the header (and on the home page) that opens a pre-addressed email, so if something's confusing or you'd like a change, just click it and send your thoughts — that's how this tool gets improved over time.
