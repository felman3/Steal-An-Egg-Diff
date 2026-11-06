#!/usr/bin/env node
/**
 * End-to-end authorization test against a live Supabase project.
 * Signs in as each demo role through Supabase Auth and exercises the Data API
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
  const bad = await signIn('demo.viewer@example.com', 'wrong-password-123');
  check('wrong password is rejected', !bad.ok, bad.body?.error_code ?? bad.body?.msg ?? '');
}

// ---------------------------------------------------------------------------
// 2. Signed-in roles
// ---------------------------------------------------------------------------
const accounts = {
  admin: 'demo.admin@example.com',
  dean: 'demo.dean.ccis@example.com',
  chair: 'demo.chair.math@example.com',
  viewer: 'demo.viewer@example.com',
};
const tokens = {};
for (const [role, email] of Object.entries(accounts)) {
  const s = await signIn(email);
  check(`${role} can sign in`, s.ok && !!s.token, s.ok ? email : JSON.stringify(s.body));
  tokens[role] = s.token;
}
await loadIds(tokens.admin);

const counts = {};
for (const role of Object.keys(accounts)) {
  counts[role] = {};
  for (const t of ['colleges', 'faculty', 'students', 'class_sections', 'enrollments', 'sete_evaluations', 'sete_scores', 'user_profiles', 'kpi_targets', 'kpi_target_audit']) {
    counts[role][t] = (await count(t, tokens[role])).n;
  }
}
console.log('\nRows visible per role (RLS):');
console.table(counts);

const A = counts.admin;
check('all roles read reference data', ['admin', 'dean', 'chair', 'viewer'].every((r) => counts[r].colleges === A.colleges && A.colleges > 0), A.colleges);
check('admin reads all faculty', A.faculty > 0, A.faculty);
check('dean reads only a subset of faculty', counts.dean.faculty > 0 && counts.dean.faculty < A.faculty, counts.dean.faculty);
check('chair reads fewer faculty than dean scope', counts.chair.faculty > 0 && counts.chair.faculty < A.faculty, counts.chair.faculty);
check('viewer reads no faculty rows', counts.viewer.faculty === 0, counts.viewer.faculty);
check('viewer reads no students/grades', counts.viewer.students === 0 && counts.viewer.enrollments === 0, `${counts.viewer.students}/${counts.viewer.enrollments}`);
check('dean/chair grades are scoped', counts.dean.enrollments > 0 && counts.dean.enrollments < A.enrollments && counts.chair.enrollments > 0 && counts.chair.enrollments < A.enrollments, `${counts.dean.enrollments}/${counts.chair.enrollments} of ${A.enrollments}`);
check('raw SETE responses: admin only', A.sete_evaluations > 0 && ['dean', 'chair', 'viewer'].every((r) => counts[r].sete_evaluations === 0 && counts[r].sete_scores === 0), A.sete_evaluations);
check('non-admins see only their own profile', ['dean', 'chair', 'viewer'].every((r) => counts[r].user_profiles === 1) && A.user_profiles >= 4, A.user_profiles);
check('audit trail: admin only', A.kpi_target_audit > 0 && ['dean', 'chair', 'viewer'].every((r) => counts[r].kpi_target_audit === 0), A.kpi_target_audit);

// Scoped KPI RPCs
for (const role of Object.keys(accounts)) {
  const r = await rpc('get_kpi_summary', {}, tokens[role]);
  check(`${role} gets 5 KPIs for own scope`, r.ok && Array.isArray(r.body) && r.body.length === 5, r.ok ? r.body.map((k) => k.kpi_code).join(',') : r.code);
}
const ceng = { p_college_id: ids.CENG };
check('admin can view another college', (await rpc('get_kpi_summary', ceng, tokens.admin)).ok);
check('viewer can view aggregate KPIs of any college', (await rpc('get_kpi_summary', ceng, tokens.viewer)).ok);
{
  const r = await rpc('get_kpi_summary', ceng, tokens.dean);
  check('dean is refused outside own college', !r.ok && r.code === '42501', `${r.status} ${r.code}`);
  const r2 = await rpc('get_department_kpis', { p_department_id: ids['dept:CS'] }, tokens.chair);
  check('chair is refused outside own department', !r2.ok && r2.code === '42501', `${r2.status} ${r2.code}`);
  const r3 = await rpc('get_department_kpis', {}, tokens.chair);
  check('chair department list is limited to MATH', r3.ok && r3.body.every((x) => x.department_code === 'MATH'), r3.ok ? [...new Set(r3.body.map((x) => x.department_code))].join(',') : r3.code);
  const r4 = await rpc('get_department_kpis', {}, tokens.dean);
  check('dean department list is limited to CCIS', r4.ok && r4.body.length > 0 && r4.body.every((x) => x.college_code === 'CCIS'), r4.ok ? [...new Set(r4.body.map((x) => x.department_code))].join(',') : r4.code);
}

// Confidential faculty-level results
{
  const v = await rpc('get_faculty_performance', {}, tokens.viewer);
  check('viewer is refused faculty-level SETE results', !v.ok && v.code === '42501', `${v.status} ${v.code}`);
  const a = await rpc('get_faculty_performance', {}, tokens.admin);
  check('admin gets faculty-level results', a.ok && a.body.length > 0, a.ok ? a.body.length : a.code);
  const c = await rpc('get_faculty_performance', {}, tokens.chair);
  check('chair gets only own-department faculty', c.ok && c.body.length > 0 && c.body.every((f) => f.department_code === 'MATH'), c.ok ? c.body.length : c.code);
}

// KPI target writes: admin only
{
  const res = await fetch(`${URL_}/rest/v1/kpi_targets?college_id=is.null&select=id,target_value,kpi_id&limit=1`, { headers: headers(tokens.admin) });
  const [row] = await res.json();
  const patch = (token, value) =>
    fetch(`${URL_}/rest/v1/kpi_targets?id=eq.${row.id}`, {
      method: 'PATCH',
      headers: { ...headers(token), Prefer: 'return=representation' },
      body: JSON.stringify({ notes: value }),
    }).then(async (r) => ({ status: r.status, rows: r.ok ? await r.json() : [] }));
  const viewerTry = await patch(tokens.viewer, 'viewer tamper attempt');
  check('viewer cannot modify KPI targets', viewerTry.rows.length === 0, `status ${viewerTry.status}, rows ${viewerTry.rows.length}`);
  const deanTry = await patch(tokens.dean, 'dean tamper attempt');
  check('dean cannot modify KPI targets', deanTry.rows.length === 0, `status ${deanTry.status}, rows ${deanTry.rows.length}`);
  const adminTry = await patch(tokens.admin, 'Institution-wide standard');
  check('admin can modify KPI targets', adminTry.rows.length === 1, `status ${adminTry.status}`);
  const invalid = await fetch(`${URL_}/rest/v1/kpi_targets?id=eq.${row.id}`, {
    method: 'PATCH', headers: headers(tokens.admin), body: JSON.stringify({ target_value: 999 }),
  });
  check('invalid target values are rejected by the database', !invalid.ok, `status ${invalid.status}`);
  const ownRole = await fetch(`${URL_}/rest/v1/user_profiles?user_id=not.is.null`, {
    method: 'PATCH', headers: { ...headers(tokens.viewer), Prefer: 'return=representation' }, body: JSON.stringify({ role: 'admin' }),
  });
  check('users cannot escalate their own role', !ownRole.ok, `status ${ownRole.status}`);
}

// Shared demo credentials cannot be changed by visitors
{
  const res = await fetch(`${URL_}/auth/v1/user`, {
    method: 'PUT',
    headers: headers(tokens.viewer),
    body: JSON.stringify({ password: 'HijackedPassword#1', current_password: PW }),
  });
  const again = await signIn(accounts.viewer);
  const hijack = await signIn(accounts.viewer, 'HijackedPassword#1');
  check('demo password cannot be changed by a visitor', again.ok && !hijack.ok, `update status ${res.status}; original still works: ${again.ok}`);
}

console.log('\nAuthorization checks:');
console.table(results);
const failed = results.filter((r) => r.result === 'FAIL');
console.log(failed.length ? `\n${failed.length} check(s) FAILED` : `\nAll ${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
