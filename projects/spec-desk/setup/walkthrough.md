# Spec Desk — Setup Walkthrough

This walks you through getting Spec Desk up and running. It's broken into four levels — start at Level 1 and stop at whatever level gives you what you need.

---

## Level 1: Use the live site (no setup needed)

Spec Desk is already hosted and ready to use. Nothing to install, nothing to configure.

**What to do:**

1. Open your web browser (Chrome, Edge, etc.)
2. Go to this URL:
   ```
   https://conceptstothemoon-cmd.github.io/Concepts-in-Millwork-AI-Projects/projects/spec-desk/
   ```
3. You should see the Spec Desk interface load up.

**What you can do from here:**
- Click "Choose a spec book PDF" to open a spec book from your computer
- The tool will automatically split it into CSI sections
- Use the Split/Save buttons to download individual sections or sheets
- Use **Projects → Save project file** to save your work, and **Open project file** to reload it later

**What you can't do yet** (requires Levels 3 and 4):
- Sign in with your Microsoft 365 work account
- Browse files from SharePoint or OneDrive
- Share projects with the team via SharePoint
- Use the AI features (Ask, Compare, Drawing review, Deep check)

**If this is enough for your needs, you're done. No further setup required.**

---

## Level 2: Run Spec Desk on your own computer

You only need this if you're going to set up the Microsoft 365 integration (Level 3) and want to test it locally. If you're just using the live site from Level 1, skip this.

### What you need first

- **Python 3** or **Node.js** installed on your computer
  - To check if you have Python: open a terminal/command prompt and type `python3 --version`
  - To check if you have Node.js: type `node --version`
  - If you don't have either, install Node.js from https://nodejs.org (the LTS version)
- **Git** installed (to download the code)
  - To check: type `git --version`
  - If you don't have it: https://git-scm.com/downloads

### Step-by-step

1. **Open a terminal** (on Mac: Terminal app; on Windows: Command Prompt or PowerShell)

2. **Pick a folder where you want to put the code.** For example, your Desktop:
   ```bash
   cd ~/Desktop
   ```

3. **Download the code from GitHub:**
   ```bash
   git clone https://github.com/conceptstothemoon-cmd/Concepts-in-Millwork-AI-Projects.git
   ```
   Wait for it to finish. You'll see a new folder called `Concepts-in-Millwork-AI-Projects`.

4. **Navigate into the spec-desk folder specifically:**
   ```bash
   cd Concepts-in-Millwork-AI-Projects/projects/spec-desk
   ```

   > ⚠️ **This is the most common mistake.** You must be inside `projects/spec-desk/`, NOT the top-level repo folder. If you run the server from the wrong folder, you'll see the repo file listing instead of Spec Desk.
   >
   > **How to check you're in the right place:** type `ls` (Mac/Linux) or `dir` (Windows). You should see `index.html`, `config.js`, `m365.js`, and other files. If you see folders like `projects/` and `tools/` instead, you're one level too high — run `cd projects/spec-desk` to fix it.

5. **Start a local web server.** Use one of these commands:

   If you have Node.js:
   ```bash
   npx serve -l 3000 .
   ```

   If you only have Python:
   ```bash
   python3 -m http.server 3000
   ```

   > ⚠️ **Use port 3000, not 8000.** The Microsoft sign-in configuration (Level 3) expects `http://localhost:3000/` exactly. Using a different port number will cause a "redirect URI mismatch" error later. Even if you're not setting up Microsoft yet, use 3000 so you don't have to change habits later.

   The terminal should show that the server is running. **Leave this terminal window open** — closing it stops the server.

6. **Open your browser and go to:**
   ```
   http://localhost:3000/
   ```

   You should see the same Spec Desk interface as the live site.

7. **To stop the server later:** go back to the terminal and press `Ctrl+C`.

---

## Level 3: Add Microsoft 365 sign-in and SharePoint

This lets your team sign in with their CIM work accounts, browse files from SharePoint and OneDrive, and save shared projects. **You need a Microsoft 365 admin to complete this level.**

### Step 3.1 — Pick the SharePoint site

Decide which SharePoint site the team will use. This is where shared Spec Desk projects will be stored.

1. **Pick an existing site** the estimating/drafting team already uses, or **create a new one.** The URL will look something like:
   ```
   https://yourcompany.sharepoint.com/sites/Estimating
   ```
   Write down two pieces from this URL — you'll need them in Step 3.4:
   - The **hostname**: `yourcompany.sharepoint.com`
   - The **site path**: `/sites/Estimating`

2. **Make sure the team has Edit access.** In the SharePoint site:
   - Go to **Settings (gear icon) → Site permissions**
   - Confirm team members have **Edit** or **Contribute** permission on the **Documents** library

3. That's all you need to do in SharePoint. No lists, columns, or apps to install. Spec Desk will automatically create a folder called `Spec Desk Projects` the first time someone saves a project.

> **Note:** If you skip this step and leave the SharePoint fields blank in config.js (Step 3.4), Spec Desk will save projects to each person's own OneDrive instead, which they can then share manually.

### Step 3.2 — Register the app in Entra ID (Azure AD)

This tells Microsoft that Spec Desk is an approved app for your organization.

1. **Go to** https://entra.microsoft.com and sign in with an admin account.

2. **Navigate to:** Applications → App registrations → **New registration**

3. **Fill in the form:**
   - **Name:** `CIM Spec Desk`
   - **Supported account types:** Select **"Accounts in this organizational directory only"**
   - **Redirect URI:**
     - Change the platform dropdown to **"Single-page application (SPA)"**
     - Enter this URL exactly (including the trailing slash):
       ```
       https://conceptstothemoon-cmd.github.io/Concepts-in-Millwork-AI-Projects/projects/spec-desk/
       ```
   - Click **Register**

4. **Add a second redirect URI** (for local testing):
   - On the app's page, click **Authentication** in the left sidebar
   - Under "Single-page application" redirect URIs, click **Add URI**
   - Enter exactly:
     ```
     http://localhost:3000/
     ```
   - Click **Save**

   > ⚠️ The trailing slash on both URIs is required. `http://localhost:3000` (no slash) will NOT work.

5. **Add API permissions:**
   - Click **API permissions** in the left sidebar
   - Click **Add a permission**
   - Select **Microsoft Graph**
   - Select **Delegated permissions**
   - Search for and check these three permissions:
     - `User.Read`
     - `Files.ReadWrite.All`
     - `Sites.ReadWrite.All`
   - Click **Add permissions**

6. **Expose an API** (this is needed for the Claude service in Level 4):
   - Click **Expose an API** in the left sidebar
   - Next to "Application ID URI," click **Add**. Accept the default value (`api://<some long ID>`). Click **Save**.
   - Click **Add a scope** and fill in:
     - **Scope name:** `access_as_user`
     - **Who can consent:** Select **"Admins and users"**
     - **Admin consent display name:** `Use Spec Desk's Claude features`
     - **Admin consent description:** `Allows the app to call the Claude AI service on behalf of the signed-in user.`
     - **State:** Enabled
   - Click **Add scope**
   - Now go back to **API permissions → Add a permission → My APIs**
   - Select **CIM Spec Desk**
   - Check **access_as_user** under Delegated permissions
   - Click **Add permissions**

7. **Grant admin consent:**
   - Still on the API permissions page, click **"Grant admin consent for [your organization name]"**
   - Click **Yes** to confirm

8. **Copy your IDs:**
   - Click **Overview** in the left sidebar
   - Copy and save these two values somewhere (a notepad, sticky note, etc.):
     - **Application (client) ID** — looks like `a1b2c3d4-e5f6-7890-abcd-ef1234567890`
     - **Directory (tenant) ID** — same format

> **Important:** No client secret is needed for this app. Do not create one, and never put secrets in the code repository.

### Step 3.3 — Fill in config.js

1. **Open the file** `projects/spec-desk/config.js` in a text editor (VS Code, Notepad++, or even regular Notepad).

2. **Replace the empty values** with your actual IDs and SharePoint info:

   ```js
   window.SD_CONFIG = {
     tenantId: 'paste-your-directory-tenant-id-here',
     clientId: 'paste-your-application-client-id-here',
     siteHostname: 'yourcompany.sharepoint.com',
     sitePath: '/sites/Estimating',
     projectsFolder: 'Spec Desk Projects',
     claudeEndpoint: '',    // ← leave this blank for now; Level 4 fills it in
   };
   ```

   > Replace `yourcompany.sharepoint.com` and `/sites/Estimating` with the values you wrote down in Step 3.1.

3. **Save the file.**

4. **Commit and push to GitHub:**
   ```bash
   git add config.js
   git commit -m "Add Microsoft 365 configuration"
   git push
   ```

5. **Wait about one minute** for GitHub Pages to update.

### Step 3.4 — Test Microsoft sign-in

1. Open the live site:
   ```
   https://conceptstothemoon-cmd.github.io/Concepts-in-Millwork-AI-Projects/projects/spec-desk/
   ```
2. You should now see **"Sign in with Microsoft"** in the header.
3. Click it and sign in with your CIM work account.
4. After signing in, the header should show **"Signed in as [your name]"**.
5. Next to "Choose a spec book PDF," you should now see a **"From SharePoint"** button. Click it — you should see your SharePoint Documents library and your OneDrive.

**If something goes wrong:**

| What you see | What's wrong | How to fix it |
|---|---|---|
| `AADSTS50011 redirect URI mismatch` | The page URL doesn't exactly match what you entered in Step 3.2.3 | Go back to Entra ID → your app → Authentication. Check that the redirect URI matches the page URL character-for-character, including the trailing `/` |
| `AADSTS65001 consent` | Admin consent wasn't granted | Go back to Entra ID → your app → API permissions → click "Grant admin consent" (Step 3.2.7) |
| File browser shows only "My OneDrive" | SharePoint site info is wrong or you don't have access | Double-check `siteHostname` and `sitePath` in config.js. Make sure your account has at least Edit permission on the SharePoint site |
| Nothing happens when you click Sign in | config.js wasn't saved or pushed correctly | Open the browser developer console (F12 → Console tab) and look for error messages. Verify config.js has your IDs filled in |

---

## Level 4: Turn on the AI features

This is the final level. It deploys a small Azure Function that holds the Claude API key and securely forwards requests. After this, your team can use Ask, Compare, Drawing review, Deep check, and automatic checking.

**You need:**
- Access to CIM's Anthropic account (https://console.anthropic.com)
- An Azure subscription where you can create resources
- One of these for deploying the function:
  - VS Code with the Azure Functions extension, OR
  - Azure Functions Core Tools (command line)

### Step 4.1 — Get a Claude API key

1. Go to https://console.anthropic.com
2. Sign in with CIM's organization account
3. Go to **API Keys** and click **Create Key**
4. Name it: `Spec Desk`
5. Under **Limits**, set a monthly spend limit for this key (see cost estimates at the end of this document)
6. Click **Create**
7. **Copy the key immediately** — you won't be able to see it again after you leave this page. Save it somewhere safe (a password manager, not a sticky note).

### Step 4.2 — Create the Azure Function App

1. Go to https://portal.azure.com
2. Click **Create a resource**
3. Search for **Function App** and select it
4. Click **Create** and fill in:
   - **Subscription:** your Azure subscription
   - **Resource Group:** pick an existing one or create a new one (e.g. `cim-spec-desk-rg`)
   - **Function App name:** `cim-spec-desk` (or whatever you prefer — this becomes part of the URL)
   - **Runtime stack:** Node.js
   - **Version:** 22 (20 or later works)
   - **Operating System:** Linux
   - **Hosting plan:** Flex Consumption (recommended — drawing reviews can take a minute or two and need the longer timeout)
5. Click **Review + create**, then **Create**
6. Wait for deployment to complete, then click **Go to resource**

### Step 4.3 — Configure the Function App settings

1. In your Function App, go to **Settings → Environment variables**
2. Add each of these as a new application setting (click **+ Add** for each):

   | Name | Value | Notes |
   |---|---|---|
   | `ANTHROPIC_API_KEY` | The key you copied in Step 4.1 | Or use a Key Vault reference if you prefer |
   | `TENANT_ID` | Your Directory (tenant) ID from Step 3.2.8 | Same value as in config.js |
   | `CLIENT_ID` | Your Application (client) ID from Step 3.2.8 | Same value as in config.js |

   These three are optional — only add them if you want to override the defaults:

   | Name | Default | What it does |
   |---|---|---|
   | `CLAUDE_MODEL` | `claude-opus-5-5` | Which Claude model to use |
   | `CLAUDE_EFFORT` | `high` | How hard Claude works on comparisons, reviews, and checks |
   | `CLAUDE_EFFORT_QUICK` | `low` | Effort for quick tasks like reading sheet references |

3. Click **Apply** to save all the settings.

### Step 4.4 — Configure CORS

1. In your Function App, go to **API → CORS**
2. Add these two allowed origins:
   ```
   https://conceptstothemoon-cmd.github.io
   ```
   ```
   http://localhost:3000
   ```
   > **Important:** Just the origin — no path after it. NOT `https://conceptstothemoon-cmd.github.io/Concepts-in-Millwork-AI-Projects/...`
3. Click **Save**

### Step 4.5 — Deploy the function code

**Option A — Using VS Code (easiest):**
1. Install the **Azure Functions extension** in VS Code if you don't have it
2. Open the `projects/spec-desk/api` folder in VS Code
3. In the Azure panel (left sidebar), find your Function App
4. Right-click it → **Deploy to Function App**
5. Confirm when prompted

**Option B — Using the command line:**
```bash
cd projects/spec-desk/api
npm install
npm test                                        # make sure tests pass
func azure functionapp publish cim-spec-desk    # deploy to Azure
```

**Option C — Test locally first (recommended):**
```bash
cd projects/spec-desk/api
npm install
cp local.settings.example.json local.settings.json
```
Now open `local.settings.json` in a text editor and fill in your real values:
```json
{
  "IsEncrypted": false,
  "Values": {
    "FUNCTIONS_WORKER_RUNTIME": "node",
    "AzureWebJobsStorage": "",
    "ANTHROPIC_API_KEY": "sk-ant-your-actual-key-here",
    "TENANT_ID": "your-tenant-id",
    "CLIENT_ID": "your-client-id"
  },
  "Host": { "CORS": "http://localhost:3000" }
}
```
> ⚠️ `local.settings.json` is already in `.gitignore` and will NOT be committed. This is intentional — it contains your API key.

Then start the function locally:
```bash
func start
```
Your local endpoint will be `http://localhost:7071/api/claude`. You can temporarily put this in config.js to test before deploying to Azure.

### Step 4.6 — Find your function's URL

1. In the Azure portal, go to your Function App's **Overview** page
2. Your endpoint URL will be:
   ```
   https://cim-spec-desk.azurewebsites.net/api/claude
   ```
   > **Note:** Flex Consumption apps sometimes show a different hostname on the Overview page (something like `cim-spec-desk-xyz.azurewebsites.net`). Use whatever hostname is shown there.

### Step 4.7 — Update config.js with the endpoint

1. Open `projects/spec-desk/config.js` again
2. Add your function URL to the `claudeEndpoint` line:
   ```js
   claudeEndpoint: 'https://cim-spec-desk.azurewebsites.net/api/claude',
   ```
3. Save, commit, and push:
   ```bash
   git add config.js
   git commit -m "Add Claude endpoint"
   git push
   ```
4. Wait about one minute for GitHub Pages to update.

### Step 4.8 — Test the AI features

1. Open the live site and sign in with Microsoft
2. Open a spec book PDF and let it split into sections
3. Go to the **Ask** tab
4. Type a question about the spec (e.g. "What are the requirements for wood blocking?")
5. You should get an answer within about a minute. It will quote the exact section and page number.
6. After the answer appears, you should see a green **"Checked automatically"** box — this means the answer was verified against the source document.

**Run through the full checklist:**
- [ ] Sign in works → "Signed in as [name]" in header
- [ ] From SharePoint → file browser shows Documents library and OneDrive
- [ ] Open a spec book → it splits into sections
- [ ] Ask tab → ask a question → answer appears with "Checked automatically"
- [ ] Projects → Save to SharePoint → a `.zip` file appears in the `Spec Desk Projects` folder
- [ ] On another computer, sign in → Open from SharePoint → open that file → everything is there
- [ ] Save index (CSV) → file downloads

**If something goes wrong:**

| What you see | What's wrong | How to fix it |
|---|---|---|
| "Claude isn't connected on this site yet" | `claudeEndpoint` is blank in config.js | Fill in the endpoint URL (Step 4.7) and push |
| "Couldn't reach the Claude service" | Wrong endpoint URL, or CORS is misconfigured | Double-check the URL in config.js matches your Function App. Check that CORS (Step 4.4) has the GitHub Pages origin |
| "Your Microsoft 365 sign-in wasn't accepted by the Claude service" | Tenant/Client ID mismatch or missing scope | Check that `TENANT_ID` and `CLIENT_ID` in the Azure Function settings match config.js. Make sure you completed Step 3.2.6 (Expose an API / add scope) |

---

## Cost estimates

| Item | Cost |
|---|---|
| SharePoint, OneDrive, and sign-in | Included in your Microsoft 365 subscription |
| Azure Function App (Flex Consumption) | Typically free for a team this size |
| Claude API (Opus 5.5) | $4 per million input tokens, $20 per million output tokens |

**Rough per-use cost estimates** (to be confirmed from the first few weeks of bills):

| Action | Approximate cost |
|---|---|
| Ask a question (with automatic checking) | A few cents to ~$0.25 |
| Compare one spec section against a proposal (with checking) | ~$1–$5 |
| Drawing review of one sheet with images (with checking) | ~$1–$5 |
| Deep check across several sections | Several dollars or more |

**To reduce costs:** In the Deep check tab, you can turn down the number of automatic checking rounds or turn checking off entirely. The spend limit you set on the API key (Step 4.1.5) puts a hard cap on the monthly bill.
