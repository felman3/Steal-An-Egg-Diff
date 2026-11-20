# SPECTRA

SPECTRA is an academic analytics dashboard for authorized academic administrators. It brings together academic performance and Student Evaluation of Teaching Effectiveness (SETE) results through KPI cards, interactive charts, and threshold alerts. Administrators can filter results by academic year, semester, college, and department.

The BAT 405 case-study prototype uses synthetic data to demonstrate how student and faculty portal records and SETE results could be reviewed together.

[Open the live demo](https://sete-analytics-dashboard.vercel.app/) and select **Sign in as the Academic Administrator** on the login page.

## Local development

The frontend uses React, TypeScript, and Vite. Supabase handles authentication and data.

1. With Node.js 22 installed, run `npm ci`.
2. Copy `.env.example` to `.env.local` and set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` for a configured Supabase project. See the [deployment guide](docs/DEPLOYMENT.md) if you need to set up the database and accounts.
3. Run `npm run dev` and open `http://localhost:5173`.

