# Bid Screener Walkthrough

Built to screen incoming bid invites by GC tier, the Bid Screener is a website, so there is nothing to download or install on your computer, and everything below happens in your web browser and the Microsoft and Azure sites CIM already uses. This guide has two parts: a five-minute look at the demo, and then the setup that connects it to CIM's Microsoft 365 so your team can use it with real bids.

---

## Part 1: Try the demo (5 minutes)

1. Open this link in Chrome or Edge and bookmark it:
   **<https://conceptstothemoon-cmd.github.io/Concepts-in-Millwork-AI-Projects/projects/bid-screener/>**
2. You'll see a **demo** badge at the top. Everything on screen is made-up sample data, and nothing you click is saved anywhere except your own browser.
3. Click through the tabs:
   - **Today's invites:** each invite gets a suggestion (decline, send to bid review, or "you decide") plus warnings worth a look.
   - **Bid review:** follows a project from awaiting review, to the estimating capacity check, back to Sales, and then to bidding or passed.
   - **GC list:** where each GC gets a tier (Top, Mid, Low, Watch, Do Not Bid). The tiers drive the suggestions.
   - **Rules, Accuracy, Suggestions:** choose which warnings show, see how often the suggestions match what your team actually did, and leave feedback.

A person still clicks every decision, and nothing is ever sent to a GC automatically.

> Don't build your real GC list in the demo. Demo data stays in your browser and won't carry over once the tool is set up.

---

## Part 2: Set it up for your team

### Check these before the call

Setup can't finish in one call without the first three, so it's worth five minutes the day before.

1. **Can you make apps in Microsoft?** Go to <https://entra.microsoft.com> and sign in with your work account. Click **Applications → App registrations**. If you see a **New registration** button you can click, and you're a Global Administrator or Application Administrator, you're set. If you're not sure, ask IT whether they can join the call for 15 minutes for Step 2.
2. **Does CIM have Azure?** Go to <https://portal.azure.com>, sign in, and type **Subscriptions** in the search bar at the top. If at least one subscription shows up, you're set. If the list is empty, ask IT, or the person who handles Microsoft billing, to create one.
3. **Give Matt guest access.** Matt uploads one piece of the tool into Azure during Step 4, and since he isn't a CIM employee, Microsoft needs to know him first. You or IT: go to <https://entra.microsoft.com> → **Users → All users → New user → Invite external user**, enter Matt's email, and click **Invite**. Matt accepts the email invite before the call.
4. **Pick the SharePoint site** your Sales and Estimating team already uses, and have its address handy.
5. **Have a company credit card** ready for the Claude account in Step 3.
6. **Email Matt your GC list** (any spreadsheet is fine) so he can line its columns up with the tool before the call.

### During the call, have these ready

| You need | Why |
|---|---|
| A **Microsoft 365 admin** on the call (you, or someone from IT) | Step 2 needs admin rights |
| Access to CIM's **Azure portal** | Step 4 |
| The **company credit card** | Step 3 |
| A **notepad** (Notepad, Word, anything) | You'll copy a few codes as you go |

Plan on about an hour and a half. You'll share your screen for most of it, and Matt will take over for Steps 4.5 and 6.

### Good to know

- **CIM owns everything.** The SharePoint list, the Microsoft app, the Azure connector and the Claude account are all in CIM's name. The Claude account should use a CIM email and a CIM card, not a personal one.
- **The website itself is on Matt's GitHub.** That means updates go through Matt, and the settings file is publicly visible. That file only holds addresses and ID numbers (no passwords or keys), and nobody can see CIM's data without signing in with a CIM account.
- **What Claude sees.** When the tool reads an invite or answers a question, that text goes to Anthropic (the company behind Claude) to be processed. Anthropic doesn't train its AI on business API data by default. If CIM has a policy on outside software handling company information, check that it's okay, especially for past estimate pricing.
- **It's a beta.** Claude can misread a date or a GC name now and then, which is why a person still clicks every decision. The **Accuracy** tab shows how often its suggestions match what your team actually decides.

---

### Step 1: Make the SharePoint list (10 minutes)

This is where your team's GC list and invites will be stored.

1. Open the SharePoint site your Sales and Estimating team uses (for example `https://yourcompany.sharepoint.com/sites/Sales`). Write down the site address.
2. Click **+ New → List → Blank list**. Name it exactly **`Bid Screener Data`** and click **Create**.
3. Add three columns. For each one, click **+ Add column**, pick the type, and type the name exactly as shown:

   | Column name | Type |
   |---|---|
   | `DocCollection` | Single line of text |
   | `DocId` | Single line of text |
   | `DocData` | Multiple lines of text (in **More options**, make sure it's **plain text**, not rich text) |

4. Click the gear icon → **List settings**:
   - Click the **Title** column → set **Enforce unique values** to **Yes** → **OK**.
   - Click **Indexed columns → Create a new index** → pick **DocCollection** → **Create**.
5. Make sure everyone on your team has **Edit** (or **Contribute**) permission on the site. Anyone without it won't be able to open the data.

✅ Write down: **site address** and that the list is named `Bid Screener Data`.

---

### Step 2: Register the app with Microsoft (10 minutes, admin needed)

This lets your team sign in with their normal CIM work accounts.

1. Go to <https://entra.microsoft.com> → **Applications → App registrations → New registration**.
2. Fill in:
   - **Name:** `CIM Bid Screener`
   - **Supported account types:** *Accounts in this organizational directory only*
   - **Redirect URI:** choose **Single-page application (SPA)** and paste:
     `https://conceptstothemoon-cmd.github.io/Concepts-in-Millwork-AI-Projects/projects/bid-screener/`
     (keep the slash at the end).
3. Click **Register**.
4. On the **Overview** page, copy two values to your notepad:
   - **Application (client) ID**
   - **Directory (tenant) ID**
5. Left menu → **API permissions → Add a permission → Microsoft Graph → Delegated permissions**. Tick **User.Read** and **Sites.ReadWrite.All**, then click **Add permissions**.
6. Left menu → **Expose an API**:
   - Next to *Application ID URI*, click **Add** → **Save**.
   - Click **Add a scope**. Scope name: `access_as_user`. Who can consent: **Admins and users**. Display name: `Use the Bid Screener's Claude features`. Click **Add scope**.
7. Back to **API permissions → Add a permission → My APIs → CIM Bid Screener** → tick **access_as_user** → **Add permissions**.
8. Click **Grant admin consent for** *(your company name)* → **Yes**.

No password or "client secret" is needed here. If anything asks for one, skip it.

✅ Write down: **client ID** and **tenant ID**.

---

### Step 3: Get a Claude key (5 minutes)

Claude is the AI that reads the invite emails and answers questions.

1. Go to <https://console.anthropic.com> and sign up with your CIM email.
2. Go to **Billing** and add the company card.
3. Go to **Limits** and set a **monthly spend limit**. $25 is plenty to start, and the tool stops at the limit rather than overcharging.
4. Go to **API Keys → Create Key**, name it `Bid Screener`, and copy it.

> **Keep this key private.** It works like a password for the company's Claude account. Paste it only into Azure in Step 4. Don't email it, don't send it in Teams, and don't give it to Matt or anyone else. It never goes on the website.

---

### Step 4: Create the Claude connector in Azure (15 minutes)

This is a small program that sits between the website and Claude so the key stays hidden.

1. Go to <https://portal.azure.com> → **Create a resource** → search **Function App** → **Create**.
2. Choose:
   - **Hosting plan:** Flex Consumption (or Consumption)
   - **Name:** `cim-bid-screener`
   - **Runtime stack:** Node.js, **Version:** 22
   - **Operating system:** Linux
   - Click **Review + create → Create**, and wait a minute or two.
3. Open the new Function App → **Settings → Environment variables** → add these four, then click **Apply**:

   | Name | Value |
   |---|---|
   | `ANTHROPIC_API_KEY` | the Claude key from Step 3 |
   | `TENANT_ID` | tenant ID from Step 2 |
   | `CLIENT_ID` | client ID from Step 2 |
   | `CLAUDE_MODEL` | `claude-sonnet-5-5` (half the cost of the default; see "What it costs") |

4. **API → CORS** → add `https://conceptstothemoon-cmd.github.io` → **Save**.
5. **Upload the program.** Matt does this from his computer while sharing his screen, so you don't need to install anything. First give him access to this one Function App: **Access control (IAM) → Add → Add role assignment → Contributor → Next → Select members**, search for Matt's email (he shows up once he's accepted the guest invite from "Check these before the call"), then **Review + assign**.

   *If IT won't allow guest access:* someone at CIM can do the upload instead. They install the free [VS Code](https://code.visualstudio.com) editor and its **Azure Functions** extension, download this tool's files (on the [GitHub page](https://github.com/conceptstothemoon-cmd/Concepts-in-Millwork-AI-Projects), click the green **Code** button → **Download ZIP**), and Matt walks them through it (about 20 extra minutes).
6. On the **Overview** page, copy the **default domain** (it looks like `cim-bid-screener.azurewebsites.net`).

✅ Write down: **Function App address**.

---

### Step 5: Send Matt your values

Send Matt these, and only these. None of them are secret:

```
Tenant ID:        ________________________
Client ID:        ________________________
SharePoint site:  https://__________.sharepoint.com/sites/________
Function App:     ________________________.azurewebsites.net
```

**Do not send the Claude key.**

---

### Step 6: Matt turns it on (2 minutes)

Matt puts your values into the tool's settings file and publishes it. About a minute later the **demo** badge goes away and the page shows **Sign in with Microsoft 365**.

---

### Step 7: Sign in and load your GC list (10 minutes)

1. Refresh the Bid Screener page (the same bookmark from Part 1).
2. Click **Sign in with Microsoft 365** and use your CIM work account. Your name should show at the top.
3. Open the **GC list** tab and import your GC spreadsheet. It needs the same columns as [`gc-list-template.csv`](gc-list-template.csv), so Matt can help you match your columns up if they differ.

Until the GC list is loaded, every invite is marked "you decide."

---

### Step 8: Make sure it works (5 minutes)

- [ ] Your name shows in the header after signing in.
- [ ] Your GCs show on the **GC list** tab.
- [ ] **Check an invite** → paste a real invite email → a result appears in 10 to 30 seconds → click **Add to Today's invites**.
- [ ] **Ask a question** → type "Which GCs are Do Not Bid?" → an answer appears.
- [ ] Someone else on your team signs in and sees the same GC list.

Then send your team the bookmark link. That's all they need.

---

## If something goes wrong

| What you see | What it means |
|---|---|
| `AADSTS50011 redirect URI mismatch` | The web address in Step 2.2 isn't exact. Check the slash at the end. |
| `AADSTS65001 consent` | Step 2.8 (Grant admin consent) was skipped. |
| "SharePoint request failed (404)" | The site address or list name Matt was given doesn't match. Check Step 1. |
| "Your sign-in wasn't accepted by the Claude service" | The tenant or client ID in Step 4.3 is wrong, or Step 2.6 was skipped. |
| "Couldn't reach the Claude service" | The CORS address in Step 4.4 is missing, or Matt has the wrong Function App address. |
| "The shared data couldn't be loaded" | That person doesn't have permission on the SharePoint site (Step 1.5). |

---

## What it costs

| Part | Cost |
|---|---|
| SharePoint and sign-in | Free, included in Microsoft 365 |
| Azure Function | Free for a team this size (stays inside Azure's free monthly allowance) |
| Claude | Pay per use, billed by Anthropic |

Claude is the only part that costs money, and the cost depends on which model is set in Step 4.3:

| Model (`CLAUDE_MODEL`) | Reading one invite | One question |
|---|---|---|
| `claude-opus-5-5` (default if left blank) | a few cents | about 10 to 25 cents |
| `claude-sonnet-5-5` (recommended above) | about half that | about 5 to 12 cents |

For a team reading around 100 invites a month and asking a couple of questions a day, Sonnet works out to roughly $5 a month (about $10 on Opus), and the spend limit from Step 3.3 means it can never go over what you set.

Given that the whole tool runs on systems CIM already pays for, a small monthly Claude bill with a hard cap is the only new cost, and every invite your team doesn't have to read by hand pays for it many times over.
