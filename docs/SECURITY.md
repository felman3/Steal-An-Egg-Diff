# Security, authentication and authorization

The system serves four user types. A user's role and scope live in `public.user_profiles`; an account without a row there
can sign in but receives no data.

## Access model

| Data | Academic Administrator | Dean | Program Chair | Faculty Member | No role / signed out |
|---|---|---|---|---|---|
| KPIs, trends, charts, alerts (analytics functions) | all colleges | own college | own program | own classes | ✗ |
| Faculty-level SETE results | all | own college | own program | own result only | ✗ |
| Class-level results (`get_class_results`) | — | — | own program | own classes | ✗ |
| Department comparisons | ✓ | own college | own department | ✗ (42501) | ✗ |
| Faculty rows (`faculty`) | all | own college | own program | own row | ✗ |
| Student and grade rows (`students`, `enrollments`) | all | own college | own program | ✗ (0 rows) | ✗ |
| Raw SETE forms (anonymous) | ✓ | ✗ | ✗ | ✗ | ✗ |
| Reference data, KPI definitions, targets | read | read | read | read | ✗ |
| Change targets, thresholds, settings | ✓ | ✗ | ✗ | ✗ | ✗ |
| Target audit trail | ✓ | ✗ | ✗ | ✗ | ✗ |
| `app_health()` probe (row counts only) | ✓ | ✓ | ✓ | ✓ | ✓ |

## How it is enforced (in the database, not only the UI)

1. **Row-Level Security on all 20 public tables.**
   - Reference tables are readable by any user with a profile (`private.has_profile()`).
   - Confidential tables use `private.accessible_department_ids()`, `private.accessible_section_ids()` and `private.own_faculty_id()`.
   - These helpers are `SECURITY DEFINER` with `search_path = ''`.
2. **Explicit grants.**
   - `anon` has no table privileges.
   - `authenticated` has `SELECT`, plus writes on `kpi_targets` and `UPDATE (value)` on `analytics_settings`, both limited to the administrator by RLS.
3. **Scope resolved in every analytics function.**
   - Each one starts with `private.authorize_scope()`, which reads the caller's profile and returns the scope the query must use.
   - A dean is forced to their college, a program chair to their department, and a faculty member to their own faculty record.
   - A request for anything outside that scope raises **42501** (HTTP 403). The functions return aggregates only.
4. **No self-authorization.**
   - Profiles are never created automatically, and there is no client write path to `user_profiles`.
   - A CHECK constraint (`user_profiles_role_scope`) ties each role to exactly one kind of scope.
5. **Anonymity.**
   - SETE forms store no student identifier.
   - Averages from fewer than `min_evaluations_reported` (default 5) responses are returned as NULL, including a faculty member's own per-class ratings.
   - Faculty are pseudonymised in this prototype.
6. **Integrity and accountability.**
   - Target values are validated against each KPI's range and direction.
   - Every change to a target is written to `kpi_target_audit` with the acting user.
7. **The UI mirrors the rules.**
   - Locked filter chips, role-specific menus and "Restricted" pages are conveniences.
   - Editing the URL or calling the API directly still hits the database checks above.

## Authentication (Supabase Auth)

- Email and password. **Public sign-up is disabled**, so accounts are provisioned.
- The minimum password length is 10, and changing a password requires the current password. TOTP enrollment is disabled.
- The app uses only the **publishable** API key. The secret/service-role key and the database password are not used anywhere in the app.
- Sessions persist in `localStorage` (`sete-dashboard-auth`). The data cache is cleared on every sign-in and sign-out.

### Demonstration accounts

| Account | Role and scope |
|---|---|
| `admin@example.com` | Academic Administrator: whole university |
| `dean@example.com` | Dean: College of Informatics and Computing Sciences |
| `chair@example.com` | Program Chair: BS Information Technology |
| `faculty@example.com` | Faculty Member: "Faculty IT-07", own classes |
| `noaccess@example.com` | No role: signs in, then is denied all data (used by the tests; not on the login page) |

All use reserved `example.com` addresses and the password `password`, shown on the login page **by design**. That password is
deliberately weak, which is acceptable only because the accounts hold synthetic data. The
`private.protect_demo_credentials` trigger keeps their password and email unchanged, so visitors cannot lock others out.
Real accounts should use strong passwords (the project's minimum length for new passwords is 10).

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

`npm run test:security` signs in as each account through Supabase Auth and calls the Data API as the browser does.
**56/56 checks passed:**
- **Signed out:** tables and analytics functions are refused; only the health probe answers. A wrong password is rejected.
- **Rows visible:**

  | Account | faculty | students | class sections | grades | raw SETE forms |
  |---|---|---|---|---|---|
  | admin | 145 | 5,149 | 3,230 | 107,840 | 88,512 |
  | dean (CICS) | 26 | 1,021 | 640 | 21,400 | 0 |
  | chair (IT) | 14 | 516 | 320 | 10,830 | 0 |
  | faculty (IT-07) | 1 | 0 | 22 | 0 | 0 |
  | no role | 0 | 0 | 0 | 0 | 0 |

- **Scope:** every role gets five KPIs for its own scope. Dean, chair and faculty are refused another college; chair and
  faculty are refused another department; the faculty member is refused department comparisons and sees only their own SETE result and classes.
- **Writes:** only the administrator can change or restore targets; invalid values are rejected; changes are audited.
- **Escalation:** a faculty member cannot change their own role, and an account with no role cannot grant itself one.
- **Demo password:** a visitor's attempt to change it doesn't take effect.

The Playwright suite checks the same rules through the UI.

## Known item requiring owner action

During provisioning, the project's **legacy HS256 JWT secret** was accidentally printed to a provisioning log. It was never committed
to the repository. The project signs tokens with a newer ES256 key, but the legacy secret is still trusted for verification until it
is revoked. The project owner should:

1. Supabase dashboard → **Settings → JWT Keys** → **revoke** the *Legacy HS256 (previously used)* key.
2. **Settings → API Keys** → **disable the legacy JWT-based API keys** (`anon`, `service_role`).

The app uses only the publishable key, so neither step breaks anything.
