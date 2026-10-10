# CashBook (Google edition)

A personal finance web app: record income and expenses, set a monthly budget, track savings goals and see reports.

This edition adds verified sign-up (email or phone code), Google sign-in, password recovery, a calculator for entering amounts, PDF and Excel report downloads, account settings, CSV export and account deletion. It is hosted separately from the plain email/password CashBook.

**Stack:** HTML, JavaScript and Tailwind CSS frontend; Express 5 and Mongoose 9 backend; MongoDB Atlas; JWT authentication; Google Identity Services; PDFKit and ExcelJS for report files.

## Features

- Sign up with a **6-digit verification code** sent by email or SMS (you choose); the account is created only after the code is entered
- Log in with email or phone number and password, or continue with Google
- Forgot password: one-time reset link valid for 15 minutes
- Dashboard, transactions, budget, goals and reports
- **Calculator** in the transaction form to work out an amount before saving it
- **Paste bank alert**: paste the SMS or email from your bank (GTBank, Access, Zenith, UBA, First Bank, Opay, Kuda and similar) and CashBook fills in the amount, type, description, date and category. It is read in the browser, you review it and press Save
- **Spending alerts**: a warning at 80% of the monthly budget, an alert at 100%, and a "money lasts until" estimate based on your recent daily spending (Dashboard and Budget pages)
- **Download reports as PDF or Excel** for this month, last month, last 3 months, this year, all time or custom dates
- Settings: edit profile, verify email/phone, change or set password, export CSV, delete account
- Google profile photo shown across the app
- Rate limiting on sensitive endpoints, CORS restricted to your frontend

## Folder layout

```
backend/              Express API (routes, models, middleware, utils, report fonts)
*.html, *.js          Frontend pages and scripts
auth-extra.js         Google button and forgot-password modal
calculator.js         Calculator for the transaction form
alertparser.js        Reads a pasted bank alert (used by the Paste bank alert button)
insights.js           Budget alerts and the "money lasts until" estimate
avatar.js             Shows the Google photo instead of initials
prepare-deploy.js     Builds the deploy/ folder for Netlify (also robots.txt, sitemap.xml, SEO links)
favicon.svg, og-image.png  Browser-tab icon and link-preview image
SETUP-AND-HOSTING.md  Full setup and hosting steps
```

## Quick start

```
cd backend
cp .env.example .env     # then fill in MONGODB_URI, JWT_SECRET, GOOGLE_CLIENT_ID
npm install
npm start
```

Open `index.html` with Live Server at `http://127.0.0.1:5500`. With no email/SMS service configured, verification codes are printed in the terminal running `npm start`.

Everything else, including the Google Client ID, email (Brevo), SMS (Termii), and hosting on GitHub, Render and Netlify, is in **SETUP-AND-HOSTING.md**.

## API summary

| Group | Endpoints |
|---|---|
| `/api/auth` | register/start, register/resend, register/verify, login, google, forgot-password, reset-password |
| `/api/account` | GET /me, PUT /profile, PUT /change-password, POST /verify/send, POST /verify/confirm, DELETE / |
| `/api/transactions` | list, add, edit, delete |
| `/api/budget` | get, save |
| `/api/goals` | list, add, edit, delete |
| `/api/reports` | GET /export?format=pdf\|xlsx&from=YYYY-MM-DD&to=YYYY-MM-DD |

All routes except `/api/auth/*` require `Authorization: Bearer <token>`.
