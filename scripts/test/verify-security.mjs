#!/usr/bin/env node
/**
 * End-to-end authorization test against a live Supabase project.
 * Signs in as the academic administrator and as an unauthorized account through Supabase Auth and exercises the Data API
 * (PostgREST) exactly as the browser would, then asserts the access matrix.
 *
 *   VITE_SUPABASE_URL=https://<ref>.supabase.co \
 *   VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_... \
 *   VITE_DEMO_PASSWORD=... \
 *   node scripts/test/verify-security.mjs
 *
 * (Reads .env.local automatically when present.) Exits non-zero on failure.
 */
import { existsSync, readFileSync } from 'node:fs';

if (existsSync('.env.local')) {
  for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}

const URL_ = process.env.VITE_SUPABASE_URL;
const KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const PW = process.env.VITE_DEMO_PASSWORD;
if (!URL_ || !KEY || !PW) {
  console.error('Missing VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY / VITE_DEMO_PASSWORD');
  process.exit(1);
}

const results = [];
const check = (name, ok, detail = '') => results.push({ check: name, result: ok ? 'PASS' : 'FAIL', detail: String(detail) });

async function signIn(email, password = PW) {
  const res = await fetch(`${URL_}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const body = await res.json();
  return { ok: res.ok, token: body.access_token, body };
}

function headers(token) {
  const h = { apikey: KEY, 'Content-Type': 'application/json' };
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
}

// Row count visible to the caller (null + error code when the request is refused).
async function count(table, token) {
  const res = await fetch(`${URL_}/rest/v1/${table}?select=*&limit=1`, {
    headers: { ...headers(token), Prefer: 'count=exact' },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    return { n: null, status: res.status, code: body.code };
  }
  const range = res.headers.get('content-range') ?? '*/0';
  return { n: Number(range.split('/')[1]), status: res.status };
}

async function rpc(fn, args, token) {
  const res = await fetch(`${URL_}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: headers(token),
    body: JSON.stringify(args ?? {}),
  });
  const body = await res.json().catch(() => null);
  return { ok: res.ok, status: res.status, body, code: body?.code };
}

const ids = {};
async function loadIds(token) {
  const get = async (q) => (await fetch(`${URL_}/rest/v1/${q}`, { headers: headers(token) })).json();
  for (const c of await get('colleges?select=id,code')) ids[c.code] = c.id;
  for (const d of await get('departments?select=id,code')) ids[`dept:${d.code}`] = d.id;
}

// ---------------------------------------------------------------------------
// 1. Anonymous (no session): nothing but the health probe.
// ---------------------------------------------------------------------------
{
  const c = await count('colleges');
  check('anon cannot read reference tables', c.n === null || c.n === 0, `status ${c.status} ${c.code ?? ''}`);
  const e = await count('enrollments');
  check('anon cannot read grades', e.n === null || e.n === 0, `status ${e.status} ${e.code ?? ''}`);
  const r = await rpc('get_kpi_summary', {});
  check('anon cannot call KPI RPCs', !r.ok, `status ${r.status} ${r.code ?? ''}`);
  const h = await rpc('app_health', {});
  check('anon can call app_health', h.ok && h.body?.status === 'ok', `status ${h.status}`);
  const bad = await signIn('demo.academic.admin@example.com', 'wrong-password-123');
  check('wrong password is rejected', !bad.ok, bad.body?.error_code ?? bad.body?.msg ?? '');
}

// ---------------------------------------------------------------------------
// 2. The one authorized user type vs. an unauthorized signed-in account
// ---------------------------------------------------------------------------
const accounts = { admin: 'demo.academic.admin@example.com', unauthorized: 'demo.unauthorized@example.com' };
const tokens = {};
for (const [who, email] of Object.entries(accounts)) {
  const s = await signIn(email);
  check(`${who} account can sign in (authentication)`, s.ok && !!s.token, s.ok ? email : JSON.stringify(s.body));
  tokens[who] = s.token;
}
await loadIds(tokens.admin);

const tables = ['colleges', 'departments', 'terms', 'kpi_definitions', 'kpi_targets', 'faculty', 'students', 'class_sections',
  'enrollments', 'sete_evaluations', 'sete_scores', 'user_profiles', 'kpi_target_audit'];
const counts = { admin: {}, unauthorized: {} };
for (const who of Object.keys(counts)) for (const t of tables) counts[who][t] = (await count(t, tokens[who])).n;
console.log('\nRows visible (RLS):');
console.table(counts);

const A = counts.admin;
check('academic admin reads every dashboard table', tables.filter((t) => t !== 'kpi_target_audit').every((t) => A[t] > 0), `${A.enrollments} grades, ${A.sete_evaluations} SETE forms`);
check('unauthorized account reads 0 rows of every table', tables.every((t) => counts.unauthorized[t] === 0), JSON.stringify(counts.unauthorized));

const rpcs = ['get_kpi_summary', 'get_kpi_trend', 'get_department_kpis', 'get_sete_criteria', 'get_grade_distribution', 'get_faculty_performance'];
for (const fn of rpcs) {
  const a = await rpc(fn, {}, tokens.admin);
  check(`academic admin can call ${fn}`, a.ok && Array.isArray(a.body) && a.body.length > 0, a.ok ? `${a.body.length} rows` : a.code);
  const u = await rpc(fn, {}, tokens.unauthorized);
  check(`unauthorized account is refused ${fn}`, !u.ok && u.code === '42501', `${u.status} ${u.code}`);
}
{
  const r = await rpc('get_kpi_summary', {}, tokens.admin);
  check('KPI summary returns the five KPIs', r.ok && r.body.length === 5, r.body?.map((k) => k.kpi_code).join(','));
  const f = await rpc('get_kpi_summary', { p_college_id: ids.COE, p_department_id: ids['dept:CE'] }, tokens.admin);
  check('college + department filters are accepted', f.ok && f.body.length === 5, f.status);
  const bad = await rpc('get_kpi_summary', { p_college_id: ids.CICS, p_department_id: ids['dept:CE'] }, tokens.admin);
  check('inconsistent college/department filter is rejected', !bad.ok && bad.code === '22023', `${bad.status} ${bad.code}`);
  const reset = await rpc('reset_kpi_targets', {}, tokens.unauthorized);
  check('unauthorized account cannot restore targets', !reset.ok && reset.code === '42501', `${reset.status} ${reset.code}`);
}

// KPI target writes
{
  const res = await fetch(`${URL_}/rest/v1/kpi_targets?college_id=is.null&select=id,notes&limit=1`, { headers: headers(tokens.admin) });
  const [row] = await res.json();
  const patch = (token, body) =>
    fetch(`${URL_}/rest/v1/kpi_targets?id=eq.${row.id}`, {
      method: 'PATCH',
      headers: { ...headers(token), Prefer: 'return=representation' },
      body: JSON.stringify(body),
    }).then(async (r) => ({ ok: r.ok, status: r.status, rows: r.ok ? await r.json() : [] }));
  const u = await patch(tokens.unauthorized, { notes: 'tamper attempt' });
  check('unauthorized account cannot modify KPI targets', u.rows.length === 0, `status ${u.status}, rows ${u.rows.length}`);
  const a = await patch(tokens.admin, { notes: row.notes });
  check('academic admin can modify KPI targets', a.rows.length === 1, `status ${a.status}`);
  const invalid = await patch(tokens.admin, { target_value: 999 });
  check('invalid target values are rejected by the database', !invalid.ok, `status ${invalid.status}`);
  const audit = await count('kpi_target_audit', tokens.admin);
  check('target changes are written to the audit trail (admin-readable)', audit.n > 0, audit.n);
}

// Nobody can grant themselves access
{
  const self = await fetch(`${URL_}/rest/v1/user_profiles`, {
    method: 'POST',
    headers: { ...headers(tokens.unauthorized), Prefer: 'return=representation' },
    body: JSON.stringify({ user_id: JSON.parse(atob(tokens.unauthorized.split('.')[1])).sub, full_name: 'x', role: 'admin' }),
  });
  check('unauthorized account cannot grant itself the admin profile', !self.ok, `status ${self.status}`);
}

// Shared demo credentials cannot be changed by visitors
{
  const res = await fetch(`${URL_}/auth/v1/user`, {
    method: 'PUT',
    headers: headers(tokens.admin),
    body: JSON.stringify({ password: 'HijackedPassword#1', current_password: PW }),
  });
  const again = await signIn(accounts.admin);
  const hijack = await signIn(accounts.admin, 'HijackedPassword#1');
  check('demo password cannot be changed by a visitor', again.ok && !hijack.ok, `update status ${res.status}; original still works: ${again.ok}`);
}

console.log('\nAuthorization checks:');
console.table(results);
const failed = results.filter((r) => r.result === 'FAIL');
console.log(failed.length ? `\n${failed.length} check(s) FAILED` : `\nAll ${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
