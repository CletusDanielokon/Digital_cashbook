# CashBook (Google edition): setup and hosting guide

This is **Project 2**. It is hosted completely separately from your first CashBook (the one without Google).
Nothing here touches the old project: new GitHub repo, new Render service, new Netlify site, new database name.

| | Project 1 (no Google) | Project 2 (this one) |
|---|---|---|
| GitHub repo | my-Cashbook | **new repo, e.g. cashbook-google** |
| Render service | cashbook-api-vebm | **new service, e.g. cashbook-google-api** |
| Netlify site | personal-cashbook | **new site, e.g. cashbook-google** |
| Database name | your current one | **cashbook_google** (same Atlas cluster is fine) |
| JWT_SECRET | your current one | **a new, different one** |

---

## 0. Quick path after extracting the zip

1. Open the extracted `cashbook-google` folder in VS Code.
2. Backend: go into `backend/`, copy `.env.example` to `.env`, fill in `MONGODB_URI` (database name `cashbook_google`) and a new `JWT_SECRET`. Run `npm install` then `npm start`. (Section 2)
3. Frontend: right-click `index.html` > **Open with Live Server** and use `http://127.0.0.1:5500`.
4. Sign up. With no email/SMS configured, the verification code is printed in the terminal running `npm start`. Test the calculator on Transactions and the downloads on Reports.
5. Get a Google Client ID and paste it in two places. (Section 3)
6. Connect Brevo for email, and Termii for SMS if you want phone codes. (Section 4)
7. Put it online: new GitHub repo, Render, Netlify. (Section 5)
8. Make it findable on Google. (Section 9)

---

## 1. What is extra in this edition

**Sign-up and sign-in**
- Sign up asks you to choose **Email or Phone (SMS)**. A 6-digit code is sent there, and the account is only created after the code is entered, so a mistyped email or phone number never becomes an account. The code lasts 10 minutes, dies after 5 wrong guesses, and can be resent after 60 seconds (or sent by the other method instead).
- Phone numbers are saved in one standard form (`+234...`), so `08012345678`, `+234 801 234 5678` and `2348012345678` all mean the same person and all work at login.
- Sign in with Google (also links to an existing email account with the same address).
- Forgot password by email, with a 15-minute one-time link.
- Settings shows whether your email and phone are verified, and lets you verify the one you skipped at sign-up.

**Using the app**
- **Calculator** in the Add/Edit Transaction form (the calculator icon in the Amount box): type or tap a sum like `2500 + 1200 × 3`, see the live result, press **Use this amount**. Amounts can now have kobo (for example 999.99).
- **Download reports as PDF or Excel** on the Reports page: pick This month, Last month, Last 3 months, This year, All time, or any custom dates, then Download PDF or Download Excel. The Excel file has a Summary sheet and a Transactions sheet with real formulas.
- Google profile photo in place of initials.
- Settings: edit name, phone and book name; change password (or set one if you signed up with Google); export all transactions to CSV; delete account.
- Rate limits on login, sign-up, codes, password reset and delete; CORS locked to your own Netlify site.

---

## 2. Run it on your computer first

1. Install Node.js (version 18 or newer) and have a MongoDB Atlas cluster ready.
2. In `backend/` copy `.env.example` to a new file called `.env` and fill it in:
   - `MONGODB_URI`: your Atlas string, ending with `/cashbook_google?...` so this project uses its own database.
   - `JWT_SECRET`: any long random text. Make a new one, do not reuse the old project's.
   - `GOOGLE_CLIENT_ID`: from step 3 (you can leave it for later).
   - `FRONTEND_URL=http://127.0.0.1:5500`
   - Leave the email and SMS lines empty for now.
3. In a terminal:
   ```
   cd backend
   npm install
   npm start
   ```
   You should see "MongoDB connected" and the server listening on port 5000.
4. Open the project folder in VS Code and start **Live Server** on `index.html`. Use `http://127.0.0.1:5500` (not `localhost`) so it matches what you register with Google.

**While testing on your computer without email/SMS set up:** sign up normally. The 6-digit code is **printed in the terminal where `npm start` is running** (look for "DEV MODE"). Type it into the code box.

---

## 3. Get a Google Client ID (free, about 10 minutes)

1. Go to https://console.cloud.google.com and create a project (name it CashBook).
2. **APIs and Services > OAuth consent screen**: choose External, fill in the app name and your email, save.
3. Still on the consent screen, click **Publish app** (set to "In production"). If you skip this, only test users you add by hand can sign in.
4. **APIs and Services > Credentials > Create credentials > OAuth client ID > Web application**.
5. Under **Authorized JavaScript origins** add:
   - `http://127.0.0.1:5500`
   - `http://localhost:5500`
   - `https://YOUR-NETLIFY-NAME.netlify.app` (add after step 5.3)
6. Create it and copy the Client ID (ends with `.apps.googleusercontent.com`).
7. Paste it in **two places**:
   - `backend/.env` as `GOOGLE_CLIENT_ID=...`
   - near the top of `auth-extra.js`, replacing `PASTE_YOUR_GOOGLE_CLIENT_ID_HERE`

The Client ID is not a secret. Never put a Client **Secret** anywhere; this project does not use one. Google changes can take a few minutes to start working.

---

## 4. Email and SMS for the verification codes (important for a real deployment)

The codes only reach people if you connect an email service (and, for phone codes, an SMS service). Without them, codes are only printed in the server log, which is fine for you testing but useless for real users. The server prints a WARNING at start-up when either is missing.

### 4.1 Email: use Brevo (recommended on Render)
Render's free plan blocks normal email (SMTP), so use a service that sends over the web.
1. Create a free account at https://www.brevo.com and verify the email address you want to send **from** (Settings > Senders).
2. Create an API key (SMTP and API > API keys).
3. On Render set:
   - `BREVO_API_KEY` = the key
   - `EMAIL_FROM` = `CashBook <the-address-you-verified@example.com>`

Brevo's free plan allows 300 emails a day. If you verify a free Gmail address as the sender, some inboxes may put the mail in spam; send yourself a test first. A sender on your own domain is more reliable.

Other options the server understands: `RESEND_API_KEY` (but its free test sender only delivers to your own Resend account email, so it will not work for other people until you verify a domain), or `EMAIL_USER` + `EMAIL_PASS` (Gmail App Password; works on your computer only).

### 4.2 SMS: Termii (Nigerian provider)
1. Create an account at https://termii.com, add credit, and register a **Sender ID** (approval can take a while).
2. On Render set `TERMII_API_KEY`, `TERMII_SENDER_ID` and, if some numbers do not receive messages, `TERMII_CHANNEL=dnd`.

SMS costs credit per message, which is why the server limits each visitor to 10 code requests per hour and one code per minute per sign-up.

**If you do not want to pay for SMS:** the app still works. Tell users to choose Email. Phone codes would only appear in the server log.

---

## 5. Put it online (separate from Project 1)

Do the steps in this order, because each one gives you an address the next one needs.

### 5.1 New GitHub repo
1. Create a new **private** repo, e.g. `cashbook-google`.
2. From this project folder:
   ```
   git init
   git add .
   git commit -m "CashBook Google edition"
   git branch -M main
   git remote add origin https://github.com/YOUR-USERNAME/cashbook-google.git
   git push -u origin main
   ```
   `.gitignore` keeps `.env`, `node_modules` and `deploy` out of GitHub. Check on GitHub that no `.env` file is there.

### 5.2 New Render web service (the backend)
1. Render > New > Web Service > connect the new repo.
2. Settings: **Root Directory** `backend`, **Build Command** `npm install`, **Start Command** `npm start`, free plan.
3. Environment variables:

| Name | Value |
|---|---|
| `MONGODB_URI` | Atlas string ending `/cashbook_google?retryWrites=true&w=majority` |
| `JWT_SECRET` | a new long random string |
| `GOOGLE_CLIENT_ID` | your Client ID |
| `FRONTEND_URL` | `https://YOUR-NETLIFY-NAME.netlify.app` (set after 5.3, then redeploy) |
| `CORS_ORIGIN` | the same Netlify address, no trailing slash |
| `BREVO_API_KEY`, `EMAIL_FROM` | see 4.1 |
| `TERMII_API_KEY`, `TERMII_SENDER_ID` | optional, see 4.2 |

4. Deploy. Open the Render address; you should see "CashBook (Google edition) backend is running successfully!"
5. In Atlas > **Network Access**, make sure Render may connect (the same `0.0.0.0/0` entry your first project uses is enough).

### 5.3 New Netlify site (the frontend)
1. Paste the Client ID into `auth-extra.js` (step 3.7).
2. In the project folder run:
   ```
   node prepare-deploy.js https://YOUR-RENDER-ADDRESS.onrender.com https://YOUR-NETLIFY-NAME.netlify.app
   ```
   This creates a `deploy` folder with only the frontend, with `config.js` pointing every request at your Render API. It warns you if the Client ID is still the placeholder. The second address (your Netlify site) adds the SEO files, see section 9. You will not know the Netlify address before the first upload: upload once, note the address, then run the command again with it and re-upload.
3. Netlify > Add new site > **Deploy manually** > drag the `deploy` folder in.
4. Optional: change the site name to something like `cashbook-google`.
5. Go back and:
   - add the Netlify address to Google's **Authorized JavaScript origins** (step 3.5)
   - set `FRONTEND_URL` and `CORS_ORIGIN` on Render to the Netlify address and let Render redeploy

Whenever you change the frontend, run `prepare-deploy.js` again and drag the new `deploy` folder to Netlify.

---

## 6. Test checklist after deploying

The free Render service sleeps; the first request after a rest can take about 50 seconds.

- [ ] Open the Render address: the "running successfully" message shows
- [ ] **Sign up with Email:** fill the form, choose Email, the code arrives in the inbox (check spam), enter it, you land on the welcome page
- [ ] **Sign up with Phone:** same with Phone (SMS) (skip if you have not set up Termii)
- [ ] Try a wrong code: it says how many attempts are left
- [ ] Settings > Security shows which of email/phone is verified; verify the other one
- [ ] Add a transaction using the calculator, and check the saved amount is the result
- [ ] Reports > pick **This month** > Download PDF, then Download Excel: both open and show the right totals
- [ ] Log out, **Continue with Google**, pick an account: you land on the dashboard with your photo
- [ ] Settings: edit profile, change password, export CSV
- [ ] Forgot password: request a link, set a new password
- [ ] Register a throwaway account and delete it in Settings > Danger zone
- [ ] In Atlas > Browse Collections, confirm data is in the `cashbook_google` database and **not** in your first project's database (a collection called `otps` also appears; its rows delete themselves after 10 minutes)
- [ ] Open Project 1's site: it still works exactly as before

## 7. If something fails

| Symptom | Likely cause |
|---|---|
| "We could not send the email right now" at sign-up | No email service set on Render, the Brevo sender address is not verified, or the API key is wrong. Check the Render logs for the exact error |
| Code never arrives | Check spam. With Resend's test sender, only your own Resend email receives mail. For phone: Termii credit, Sender ID not approved, or the number is on Do-Not-Disturb (try `TERMII_CHANNEL=dnd`) |
| "Your sign-up has expired" | More than 10 minutes passed; fill the form again |
| Google button missing or "origin not allowed" | The Netlify address is not in Authorized JavaScript origins, or the Client ID is still the placeholder in `auth-extra.js` |
| "Access blocked: app has not completed verification" | The consent screen is still in Testing; click Publish app |
| Page says it cannot reach the server | Render is waking up (wait a minute), or `config.js` points to the wrong address (re-run `prepare-deploy.js`) |
| Console shows a CORS error | `CORS_ORIGIN` on Render does not exactly match the Netlify address |
| 429 "Too many ..." | A rate limit fired; wait 15 minutes (an hour for code requests and password reset) |
| Download button says it cannot create the report | Render may be asleep; try again. Dates must be valid and start must not be after end |
| Data from Project 1 appears here | `MONGODB_URI` is missing the `/cashbook_google` database name |

## 8. Honest limitations (good to know for a defense)

- **Not tested against live services.** The automated checks (about 250, in test scripts that are not part of the repository) ran against stand-in database models and a simulated browser, plus a real Chromium browser against the real server code. They did **not** use a live Atlas cluster, real Google sign-in, or real Brevo/Termii delivery. Run the checklist in section 6 once online. The Brevo and Termii request formats were written from their public documentation and checked against mocked responses only.
- Phone verification is only as good as your SMS provider and costs money per message.
- Email addresses are checked by the code, not by looking at the domain: a real, working address that is not the person's own would still pass if they can read its inbox. That is what verification proves.
- The calculator's `%` means "divide by 100" (so `5000 × 10%` is 500). It does not use the "add 10% to the total" style some phone calculators have.
- Reports are tables and totals with a category bar chart in the PDF; there are no pie charts or line graphs in the downloads.
- Login tokens are kept in the browser's localStorage, which is simple but exposed if a page ever had a script-injection bug.
- Dates are stored as text (`YYYY-MM-DD`), which sorts and filters correctly but is not a real date type.
- There are no automated tests inside the repository itself.

---

## 9. SEO: getting CashBook found on Google

**What is already built in (nothing to code):**
- The home page (`index.html`) has a search-friendly title and description, a share image for WhatsApp/Facebook/LinkedIn/X links, an icon for the browser tab, and structured data that tells search engines it is a finance web app.
- Every page behind the login (dashboard, transactions, budget, reports, profile, settings, welcome, reset-password) is marked `noindex`, so Google never lists private screens.
- `node prepare-deploy.js <render-address> <netlify-address>` also writes `robots.txt` and `sitemap.xml` and adds the canonical link, using your real Netlify address.

**What you do:**
1. **Deploy with both addresses** (section 5.3) so `robots.txt`, `sitemap.xml` and the canonical link are generated. Then check in a browser: `https://YOUR-SITE.netlify.app/robots.txt`, `/sitemap.xml`, and View Source on the home page (look for `canonical` and `og:image`).
2. **Check the share preview.** Paste your link into the Facebook Sharing Debugger or LinkedIn Post Inspector; you should see the green CashBook card. Test the page with Google's Rich Results Test and PageSpeed Insights.
3. **Add the site to Google Search Console** (https://search.google.com/search-console):
   - Add property > **URL prefix** > your Netlify address.
   - Choose the **HTML tag** verification. Google gives you a line like `<meta name="google-site-verification" content="...">`. Paste it inside `<head>` of `index.html`, run `prepare-deploy.js` again, upload the new `deploy` folder, then click Verify.
   - Go to **Sitemaps**, submit `sitemap.xml`.
   - Go to **URL inspection**, paste your home page address, and click **Request indexing**.
4. **Bing:** in Bing Webmaster Tools use "Import from Google Search Console".
5. **Be patient and check back.** A new site usually takes days to a few weeks to appear. Search Console > Pages shows what Google has indexed and why anything was skipped.
6. **Get links to it.** Search engines trust sites other people link to. Put the address in your LinkedIn, GitHub README, school project page and social bios.

**Be realistic about what this will do:**
- The public home page is a login/sign-up form with little text. It can appear when someone searches for "CashBook" plus your name, but it will not rank for broad searches like "personal finance app Nigeria". "CashBook" is also a very common app name. For real search traffic, the next step is a **public landing page** with real text (what it does, who it is for, screenshots, a short FAQ). I can build that and add it to the sitemap.
- Pages load Tailwind from a CDN and compile styles in the browser, which Tailwind itself says is for development. That slows loading, and speed counts for ranking. Switching to the pre-built `output.css` is the fix.
- A custom domain (for example `cashbook.yourname.com`) looks more trustworthy than `*.netlify.app`. If you move, re-run `prepare-deploy.js` with the new address and update Google's Authorized JavaScript origins, `FRONTEND_URL` and `CORS_ORIGIN` on Render.
