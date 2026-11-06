# Security, authentication and authorization

## Roles and scopes

Roles live in `public.user_profiles` and are assigned only by an administrator or the
service role. There is no client-side write path to profiles, so users cannot change
their own role. A CHECK constraint ties each role to its scope.

| Data | Administrator | Dean | Department chair | Viewer | Anonymous |
|---|---|---|---|---|---|
| Aggregate KPIs, trends, charts (RPCs) | all colleges | own college | own department | all (aggregates) | ✗ |
| Faculty-level SETE results | all | own college | own department | ✗ (42501) | ✗ |
| Student and grade rows (`students`, `enrollments`) | all | own college | own department | ✗ (0 rows) | ✗ |
| Raw anonymous SETE responses | ✓ | ✗ | ✗ | ✗ | ✗ |
| Reference data, KPI definitions, targets | read | read | read | read | ✗ |
| Change targets, thresholds, settings | ✓ | ✗ | ✗ | ✗ | ✗ |
| Target audit trail | ✓ | ✗ | ✗ | ✗ | ✗ |
| `app_health()` probe (counts only) | ✓ | ✓ | ✓ | ✓ | ✓ |

## How it is enforced (database, not just UI)

1. **RLS is enabled on all 20 public tables** (plus the private baseline table).
   - Policies use `private.accessible_department_ids()` and `private.accessible_section_ids()`, which are `SECURITY DEFINER` with `search_path = ''`.
   - Helper calls are wrapped in `(select …)` so Postgres evaluates them once per statement.
2. **Explicit grants.** This project does not auto-expose new tables.
   - The migrations `REVOKE ALL` from `anon` and `authenticated`, then grant only `SELECT` (plus admin-guarded writes on `kpi_targets` and column-level `UPDATE (value)` on `analytics_settings`).
   - `anon` has no table privileges at all.
3. **Aggregates through role-checked RPCs.**
   - Every dashboard function is `SECURITY DEFINER` with an empty `search_path` and fully qualified names.
   - Each one first calls `private.authorize_scope()`, which:
     - rejects users without a profile;
     - forces deans to their college and chairs to their department;
     - raises `42501` (HTTP 403) for anything outside scope.
   - `EXECUTE` is revoked from `PUBLIC`/`anon` and granted to `authenticated`.
4. **Anonymity.** SETE responses store no student identifier. Averages based on fewer
   than `min_evaluations_reported` (default 5) responses are returned as NULL.
5. **Integrity triggers.**
   - KPI targets are validated against the KPI's range and direction (target ≥ warning ≥ critical, or the reverse for lower-is-better).
   - Every insert, update and delete is written to `kpi_target_audit` with the acting user.
6. **The UI mirrors the rules but never relies on them.**
   - Filters are locked for deans and chairs, and the faculty page shows a Restricted state for viewers.
   - A hand-edited URL or a direct API call still hits the database checks above.

## Authentication (Supabase Auth)

- Email and password. **Public sign-up is disabled** (`disable_signup = true`), so accounts are provisioned.
- Minimum password length is 10. Changing a password requires the current password.
- TOTP enrollment is disabled, so visitors can't attach a second factor to shared demo accounts.
- The app uses only the **publishable** API key. Legacy JWT-based `anon`/`service_role` keys are not used anywhere.
- Sessions persist in `localStorage` under `sete-dashboard-auth` and refresh automatically. The query cache is cleared on every sign-in and sign-out, so one user's scope never leaks to the next.

### Demonstration accounts

Four shared accounts (`demo.*@example.com`) exist so evaluators can try every role.

- Their password is shown on the login page **by design**.
- `app_metadata.demo_account = true` marks them. Only the service role or SQL can set this flag.
- The `private.protect_demo_credentials` trigger on `auth.users` silently keeps their password, email and phone unchanged. Visitors therefore cannot lock others out.
- The automated test suite verifies this: it attempts a password change, then signs in with the original password.
- The demo admin *can* edit targets (that is the feature being demonstrated). **Restore defaults** resets them, and every change is audited.

## Secrets handling

| Secret | Where it lives | In the client bundle? |
|---|---|---|
| Supabase publishable key | `VITE_SUPABASE_PUBLISHABLE_KEY` (Vercel env) | Yes, by design (RLS protects data) |
| Database password | Supabase dashboard only | **No**. Not used by the app |
| Secret / service_role key | Supabase dashboard only | **No**. Not needed: demo users are provisioned through SQL by the Management API |
| Supabase personal access token | Provisioning machine only (used by `scripts/db/*.mjs`) | **No** |

`.env*` files are git-ignored (only `.env.example` with placeholders is committed).
Anything prefixed `VITE_` is compiled into the browser bundle, so never put a secret in
one.

## HTTP hardening (Vercel)

`vercel.json` sets:
- `Content-Security-Policy`: `default-src 'self'`. Connections are allowed only to `*.supabase.co`, and `frame-ancestors 'none'`.
- `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`.
- A restrictive `Permissions-Policy` and HSTS.

## Verification evidence

`npm run test:security` signs in as each role through Supabase Auth and calls the
Data API the same way the browser does. Result: **38/38 checks passed**.

Selected checks:

- anon: tables → 401/42501, KPI RPCs → 401, health probe → 200
- Rows visible to each role:
  - admin: faculty 113, students 3,670, grades 76,450, raw SETE 62,450
  - dean (CCIS): 32, 1,092, 22,630, 0
  - chair (MATH): 11, 251, 5,430, 0
  - viewer: 0 rows of faculty, students, grades and raw SETE
- dean requesting another college → 403 / 42501; chair requesting another department → 403 / 42501
- viewer requesting faculty-level results → 403 / 42501
- viewer and dean PATCH on `kpi_targets` → 0 rows changed; admin → 1 row; invalid value → 400
- users escalating their own role → 403
- demo password change attempt → original password still works

The Playwright suite (`npm run test:e2e`) checks the same rules through the UI.

## Known item requiring owner action

During provisioning, the project's **legacy HS256 JWT secret** was accidentally printed
to a provisioning log. That secret is no longer used for signing, since the project signs
with an ES256 key, but it was still listed as "previously used" (still verified). Auto
mode blocked the automated revocation, so the project owner should:

1. Go to Supabase dashboard → **Settings → JWT Keys** and **revoke** the *Legacy HS256 (previously used)* key.
2. Go to **Settings → API Keys** and **disable the legacy JWT-based API keys** (`anon`, `service_role`).

The app uses only the publishable key, so neither step breaks anything.
