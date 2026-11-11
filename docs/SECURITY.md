# Security, authentication and authorization

The system serves **one user type: the Authorized Academic Administrator**. Being authorized means having a row in
`public.user_profiles` (role `admin`, shown as "Academic Administrator"). Any other account can sign in, but it is **unauthorized**
and receives no data.

## Access model

| Data | Authorized academic administrator | Any other signed-in account | Signed out |
|---|---|---|---|
| KPIs, trends, charts, alerts (analytics functions) | ✓ all colleges | ✗ error 42501 (HTTP 403) | ✗ 401 |
| Faculty-level SETE results (pseudonymised) | ✓ | ✗ 42501 | ✗ |
| Student records and final grades (`students`, `enrollments`) | ✓ | ✗ 0 rows | ✗ |
| Raw SETE forms (`sete_evaluations`, `sete_scores`, anonymous) | ✓ | ✗ 0 rows | ✗ |
| Reference data, KPI definitions, targets | ✓ | ✗ 0 rows | ✗ |
| Change targets, thresholds, settings | ✓ | ✗ | ✗ |
| Target audit trail | ✓ | ✗ | ✗ |
| `app_health()` probe (row counts only) | ✓ | ✓ | ✓ |

## How it is enforced (in the database, not only the UI)

1. **Row-Level Security on all 20 public tables.**
   - Every read policy is `using ((select private.is_admin()))`.
   - `private.is_admin()` is a `SECURITY DEFINER` function with `search_path = ''`.
   - Migration `20261111000100_academic_admin_only.sql` set these policies.
2. **Explicit grants.**
   - `anon` has no table privileges.
   - `authenticated` has `SELECT`, plus writes on `kpi_targets` and `UPDATE (value)` on `analytics_settings`, both limited to administrators by RLS.
3. **Authorization in every analytics function.**
   - Every dashboard function is `SECURITY DEFINER` with an empty `search_path`, and starts with `private.authorize_scope()`.
   - That check raises **42501** unless the caller is an authorized academic administrator, then validates the college/department filter.
   - The functions return aggregates only.
4. **No self-authorization.**
   - Profiles are never created automatically (the old sign-up trigger was removed).
   - There is no client write path to `user_profiles`.
   - A CHECK constraint (`user_profiles_academic_admin_only`) allows only the academic-administrator role.
   - Access must be granted by the service role or SQL.
5. **Anonymity.**
   - SETE forms store no student identifier.
   - Averages from fewer than `min_evaluations_reported` (default 5) responses are returned as NULL.
   - Faculty are pseudonymised in this prototype.
6. **Integrity and accountability.**
   - Target values are validated against each KPI's range and direction.
   - Every insert, update and delete of a target is written to `kpi_target_audit` with the acting user.
7. **The UI mirrors the rules.**
   - An unauthorized account is shown **Access denied** and no data requests succeed.
   - Editing the URL or calling the API directly still hits the database checks above.

## Authentication (Supabase Auth)

- Email and password. **Public sign-up is disabled**, so accounts are provisioned.
- The minimum password length is 10, and changing a password requires the current password. TOTP enrollment is disabled.
- The app uses only the **publishable** API key. The secret/service-role key and the database password are not used anywhere in the app.
- Sessions persist in `localStorage` (`sete-dashboard-auth`). The data cache is cleared on every sign-in and sign-out.

### Demonstration accounts

| Account | Purpose |
|---|---|
| `demo.academic.admin@example.com` | The primary user: full dashboard |
| `demo.unauthorized@example.com` | Access-control demonstration: signs in, gets **Access denied**, reads 0 rows |

Both use reserved `example.com` addresses and are flagged `app_metadata.demo_account = true`. Their shared password is shown on the
login page **by design**. The `private.protect_demo_credentials` trigger keeps their password and email unchanged, so visitors cannot
lock others out. Re-running `scripts/db/create-demo-users.mjs` resets them.

## Secrets handling

| Secret | Where it lives | In the client bundle? |
|---|---|---|
| Supabase publishable key | `VITE_SUPABASE_PUBLISHABLE_KEY` (Vercel env) | Yes, by design (RLS protects data) |
| Database password | Supabase dashboard only | **No** |
| Secret / service-role key | Supabase dashboard only | **No**. Not needed: accounts are provisioned through SQL by the Management API |
| Supabase personal access token | Provisioning machine only | **No** |

`.env*` files are git-ignored. Anything prefixed `VITE_` is compiled into the browser bundle, so never put a secret in one.

## HTTP hardening (Vercel)

`vercel.json` sets:
- a Content-Security-Policy: `default-src 'self'`, connections only to `*.supabase.co`, `frame-ancestors 'none'`;
- `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy` and HSTS.

## Verification evidence

`npm run test:security` signs in as both accounts through Supabase Auth and calls the Data API as the browser does. **31/31 checks
passed:**
- **Signed out:** tables return 401/42501, analytics functions return 401, and only the health probe answers.
- **Wrong password:** rejected.
- **Academic administrator:**
  - reads every table (113 faculty, 3,670 students, 76,450 grades, 62,450 SETE forms);
  - gets results from all 6 analytics functions;
  - can edit targets, and invalid values are rejected (400);
  - every change is audited.
- **Unauthorized account:**
  - reads **0 rows** from all 13 tables tested;
  - is refused all 6 analytics functions and target restore (**42501**);
  - its target edit changes 0 rows;
  - its attempt to grant itself a profile is refused (403).
- **Demo password:** a visitor's attempt to change it doesn't take effect, and the original password still works.

The Playwright suite checks the same rules through the UI.

## Known item requiring owner action

During provisioning, the project's **legacy HS256 JWT secret** was accidentally printed to a provisioning log. It was never committed
to the repository. The project signs tokens with a newer ES256 key, but the legacy secret is still trusted for verification until it
is revoked. The project owner should:

1. Supabase dashboard → **Settings → JWT Keys** → **revoke** the *Legacy HS256 (previously used)* key.
2. **Settings → API Keys** → **disable the legacy JWT-based API keys** (`anon`, `service_role`).

The app uses only the publishable key, so neither step breaks anything.
