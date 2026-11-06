# Academic Quality Dashboard — SETE & Academic Performance Analytics

> **Academic prototype.** Every student, faculty member, grade and evaluation in this
> application is **synthetic demonstration data** generated for a case study. The
> dashboard is **not integrated** with any university Student and Faculty Portal or
> SETE (Student Evaluation of Teacher Effectiveness) system.

A database-backed analytics dashboard that monitors teaching effectiveness (SETE) and
student academic performance. It has five KPIs and three main visualizations. Targets
and alert thresholds are stored in the database. Filters cover academic year, semester,
college and department. Supabase Auth handles sign-in, and PostgreSQL Row-Level
Security enforces role-based access.

| | |
|---|---|
| **Live app** | _see [Deployment status](#deployment-status)_ |
| **Repository** | https://github.com/felman3/Steal-An-Egg-Diff (branch `claude/sweet-franklin-7ux0p5`) |
| **Database** | Supabase PostgreSQL 17 (project `ulcnqgrvqgnihwenqech`, region `ap-northeast-2`) |
| **Docs** | [Database schema](docs/DATABASE.md) · [Security & RBAC](docs/SECURITY.md) · [Deployment](docs/DEPLOYMENT.md) |

## Demo access

Public sign-up is disabled. Four **demonstration accounts** cover each role. They use
reserved `example.com` addresses and synthetic data only, and their credentials cannot
be changed. The login page has one-click buttons for each.

| Role | Email | Sees |
|---|---|---|
| Administrator (QA office) | `demo.admin@example.com` | Everything; can edit targets, thresholds and settings; audit trail |
| Dean | `demo.dean.ccis@example.com` | College of Computing and Information Sciences only |
| Department chair | `demo.chair.math@example.com` | Department of Mathematics only |
| Viewer (analyst) | `demo.viewer@example.com` | Aggregate KPIs for all colleges; **no** faculty-level or student-level data |

Password for all four: **`Demo-SETE-2026`**

## What it measures

| # | KPI | Definition | Better when | Default target / warning / critical |
|---|---|---|---|---|
| 1 | **Mean SETE rating** | Mean of all criterion scores (1–5) | Higher | 4.30 / 4.10 / 3.90 |
| 2 | **SETE response rate** | Evaluations ÷ eligible enrolments | Higher | 90% / 80% / 70% |
| 3 | **Course pass rate** | Passing grades (1.00–3.00) ÷ eligible enrolments | Higher | 93% / 88% / 83% (Engineering 88/83/78) |
| 4 | **Mean GWA** | Σ(grade × units) ÷ Σ units, graded enrolments | Lower | 2.00 / 2.20 / 2.40 (Engineering 2.20/2.40/2.60) |
| 5 | **Faculty meeting SETE standard** | % of evaluated faculty with mean ≥ 4.00 | Higher | 90% / 80% / 70% |

Each KPI gets a status computed **in the database** from the stored thresholds:
*On target* → *Below target* (no alert) → **Warning** → **Critical**. A college can
override the institution defaults (Engineering does for pass rate and GWA).

**Visualizations** (all Recharts, all fed by SQL functions):

1. **KPI trend by term.** A line chart with warning and critical zones, a target line and the selected period highlighted.
2. **KPI by department.** Bars colored and labeled by status, with a target tick for each department.
3. **SETE criteria breakdown.** Scope vs. institution benchmark for the four SETE criteria.
4. *(Bonus)* Final grade distribution, department scorecard and faculty watchlist.

Every chart also has a **table view**, and every data component has loading, empty,
error and restricted states.

## Architecture

```
Browser (React 19 + TypeScript + Vite + Tailwind 4 + Recharts 3)
   │  supabase-js with the PUBLISHABLE key only + the user's JWT
   ▼
Supabase ── Auth (email/password, sign-up disabled)
        └─ PostgREST → PostgreSQL 17
              • 20 tables, RLS enabled on every one, explicit grants (anon: none)
              • SECURITY DEFINER RPCs that check role and scope before aggregating
              • materialized fact views (private schema, not exposed)
Vercel ── static SPA (rewrites for client routing, security headers, CSP)
       └─ /api/health  serverless function (server-side DB check, no secrets)
```

## Project layout

```
api/health.ts                   Vercel serverless function
src/                            React app (pages, components, charts, auth, filters)
supabase/migrations/            Schema, RLS & security, analytics functions
supabase/seed/                  Deterministic synthetic data (5 steps)
scripts/db/apply.mjs            Apply migrations / seed through the Management API
scripts/db/create-demo-users.mjs  Create or reset the four demo accounts
scripts/test/verify-security.mjs  38 live authorization checks against the API
tests/e2e/                      Playwright end-to-end tests
docs/                           Database, security and deployment documentation
```

## Local development

```bash
npm ci
```

```bash
cp .env.example .env.local    # then fill in the Supabase URL + publishable key
```

```bash
npm run dev                   # http://localhost:5173
```

Quality gates:

```bash
npm run typecheck && npm run lint && npm run build
```

```bash
npm run test:e2e              # Playwright, against a local preview build
```

```bash
npm run test:security         # live RLS / RBAC checks (needs .env.local)
```

Setting up a fresh database is covered in [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

## Deployment status

See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md#current-deployment) for the live URL, the
verification evidence, and any steps still pending.

## Limitations (academic prototype)

- Synthetic data only. Faculty are pseudonymous ("Faculty CS-07") and students have synthetic numbers.
- No integration with the official Student and Faculty Portal or SETE.
- The shared demo accounts are intentionally public. Treat them as read-mostly sandboxes:
  the admin demo can change targets, and **Restore defaults** resets them.
