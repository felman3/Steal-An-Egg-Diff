# Deployment guide

Stack: **Supabase** (PostgreSQL, Auth, Data API) + **Vercel** (static SPA and one
serverless function) + **GitHub**.

## Current deployment

| Item | Value |
|---|---|
| Supabase project | `ulcnqgrvqgnihwenqech` (`https://ulcnqgrvqgnihwenqech.supabase.co`), region `ap-northeast-2` |
| Database state | 3 migrations applied, synthetic seed loaded, 4 demo accounts provisioned, auth hardened |
| GitHub | https://github.com/felman3/Steal-An-Egg-Diff, branch `claude/sweet-franklin-7ux0p5` |
| Vercel | _pending: see "Status" below_ |

**Status.** The database layer is live and verified: 38/38 live authorization checks
pass. The Vercel deployment needs the account owner to approve the Vercel connector's
access to their team, or to import the repository manually (section 3).

## 1. Environment variables

| Name | Where | Secret? | Purpose |
|---|---|---|---|
| `VITE_SUPABASE_URL` | Vercel (Production + Preview), `.env.local` | No | Supabase project URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Vercel (Production + Preview), `.env.local` | No (public by design) | Browser key; RLS protects data |
| `VITE_DEMO_PASSWORD` | Vercel (Production + Preview), `.env.local` | No (published demo credential) | Shows the demo-access panel. Leave empty to hide it |
| `SUPABASE_ACCESS_TOKEN` | Your shell only, when provisioning | **Yes** | Management API token for `scripts/db/*.mjs`. Never put it in Vercel or git |

The app does **not** need the database password or the secret/service-role key, so do
not add them to Vercel. Variables starting with `VITE_` are embedded in the browser
bundle.

## 2. Supabase (database, auth)

1. Create a project in the Supabase dashboard:
   - Keep **Data API** on.
   - Untick **"Automatically expose new tables"** (the migrations grant access explicitly).
   - Tick **"Enable automatic RLS"**.
2. Create a personal access token under **Account → Access Tokens**, then:

```bash
export SUPABASE_ACCESS_TOKEN=<token> SUPABASE_PROJECT_REF=<project-ref>
```

```bash
node scripts/db/apply.mjs --seed
```

```bash
DEMO_PASSWORD='Demo-SETE-2026' node scripts/db/create-demo-users.mjs
```

   `apply.mjs` runs the migrations in order and records them in
   `supabase_migrations.schema_migrations`, so `supabase db push` stays compatible. With
   `--seed` it then loads the five synthetic seed steps, about 35 seconds in total.
   (With the Supabase CLI instead: `supabase link`, `supabase db push`, then run the files
   in `supabase/seed/` in order with psql.)

3. Under **Authentication → Sign In / Providers**:
   - Disable **Allow new users to sign up**.
   - Set the minimum password length to **10**.
   - Require the current password to change a password.
   - Disable TOTP MFA enrollment.
4. Under **Authentication → URL Configuration**:
   - Set **Site URL** to the Vercel production URL.
   - Add `https://<project>.vercel.app/**` and `http://localhost:5173/**` to the redirect URLs.
5. Under **Settings → API Keys**, copy the **publishable** key (`sb_publishable_…`) for
   `VITE_SUPABASE_PUBLISHABLE_KEY`.

## 3. Vercel (hosting)

### Option A: dashboard import

1. Go to Vercel → **Add New → Project → Import Git Repository** and pick `felman3/Steal-An-Egg-Diff`.
2. Vercel reads the framework (**Vite**), the build command (`npm run build`), the output directory (`dist`) and the install command (`npm ci`) from `vercel.json`.
3. Add the three `VITE_*` variables from section 1 for **Production** and **Preview**.
4. Set the **production branch** to the branch you deploy, `claude/sweet-franklin-7ux0p5`, or merge it into `main` first.
5. Deploy. Every push to the production branch redeploys automatically.

### Option B: Vercel CLI

```bash
npx vercel link
```

```bash
npx vercel env add VITE_SUPABASE_URL production
```

```bash
npx vercel env add VITE_SUPABASE_PUBLISHABLE_KEY production
```

```bash
npx vercel env add VITE_DEMO_PASSWORD production
```

```bash
npx vercel deploy --prod
```

### What `vercel.json` configures

- SPA routing: every non-`/api/` path rewrites to `/index.html`, so deep links like `/faculty?ay=4` work on reload.
- Security headers and a CSP that only allows connections to `*.supabase.co`.
- Long-term caching for the hashed `/assets/*`.
- Serverless functions in `icn1` (Seoul), next to the database.

## 4. Verify the deployment

1. **Health (server → database):** `GET https://<app>.vercel.app/api/health` should return
   `{"status":"ok","database":{…"terms":8,…}}`.
2. **UI:** open the site, sign in with a demo account, change the filters and check that
   the KPIs and charts update.
3. **Automated:**

```bash
E2E_BASE_URL=https://<app>.vercel.app npm run test:e2e
```

```bash
npm run test:security
```

## 5. Production build checks (run before every deploy)

```bash
npm ci
```

```bash
npm run typecheck && npm run lint && npm run build
```

Last local run:
- `tsc` passes with 0 errors and ESLint with 0 problems.
- `vite build` produces about 79 KB gzipped of app code. Vendor chunks: react 34 KB, supabase 59 KB, charts 117 KB.
- Playwright: 12 end-to-end tests pass on desktop and mobile (390 px), including a no-horizontal-scroll check.

## 6. Re-seeding or resetting

- **Targets:** the admin **Restore defaults** button, or `select public.reset_kpi_targets();` run as an admin.
- **Demo accounts:** re-run `create-demo-users.mjs`. It is idempotent and resets passwords through a maintenance bypass of the protection trigger.
- **Full dataset:** recreate the database (`supabase db reset`, or truncate the data tables), then run `apply.mjs --only-seed`.
