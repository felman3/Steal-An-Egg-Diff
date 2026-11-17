#!/usr/bin/env node
/**
 * End-to-end authorization test against a live Supabase project.
 * Signs in as each of the four user types (and an account with no role) through Supabase Auth and exercises the Data API
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
  const bad = await signIn('admin@example.com', 'wrong-password-123');
  check('wrong password is rejected', !bad.ok, bad.body?.error_code ?? bad.body?.msg ?? '');
}

// ---------------------------------------------------------------------------
// 2. The four user types, plus a signed-in account with no dashboard role
// ---------------------------------------------------------------------------
const accounts = {
  admin: 'admin@example.com',
  dean: 'dean@example.com', // College of Informatics and Computing Sciences
  chair: 'chair@example.com', // BS Information Technology
  faculty: 'faculty@example.com', // Faculty IT-07
  noaccess: 'noaccess@example.com',
};
const tokens = {};
for (const [who, email] of Object.entries(accounts)) {
  const s = await signIn(email);
  check(`${who} can sign in (authentication)`, s.ok && !!s.token, s.ok ? email : JSON.stringify(s.body));
  tokens[who] = s.token;
}
await loadIds(tokens.admin);

const tables = ['colleges', 'kpi_targets', 'faculty', 'students', 'class_sections', 'enrollments', 'sete_evaluations', 'sete_scores', 'user_profiles', 'kpi_target_audit'];
const counts = {};
for (const who of Object.keys(accounts)) {
  counts[who] = {};
  for (const t of tables) counts[who][t] = (await count(t, tokens[who])).n;
}
console.log('\nRows visible per account (RLS):');
console.table(counts);

const A = counts.admin;
const C = counts;
check('no-role account reads 0 rows of every table', tables.every((t) => C.noaccess[t] === 0), JSON.stringify(C.noaccess));
check('all four roles read reference data and targets', ['admin', 'dean', 'chair', 'faculty'].every((r) => C[r].colleges === A.colleges && C[r].kpi_targets === A.kpi_targets && A.colleges > 0), `${A.colleges} colleges`);
check('faculty rows narrow with scope: admin > dean > chair > faculty (self only)', A.faculty > C.dean.faculty && C.dean.faculty > C.chair.faculty && C.chair.faculty > 1 && C.faculty.faculty === 1, `${A.faculty} > ${C.dean.faculty} > ${C.chair.faculty} > ${C.faculty.faculty}`);
check('grade rows narrow with scope: admin > dean > chair', A.enrollments > C.dean.enrollments && C.dean.enrollments > C.chair.enrollments && C.chair.enrollments > 0, `${A.enrollments} > ${C.dean.enrollments} > ${C.chair.enrollments}`);
check('faculty member reads no student or grade rows', C.faculty.students === 0 && C.faculty.enrollments === 0, `${C.faculty.students}/${C.faculty.enrollments}`);
check('faculty member reads only their own class sections', C.faculty.class_sections > 0 && C.faculty.class_sections < C.chair.class_sections, `${C.faculty.class_sections} of ${C.chair.class_sections}`);
check('raw SETE forms: administrator only', A.sete_evaluations > 0 && ['dean', 'chair', 'faculty'].every((r) => C[r].sete_evaluations === 0 && C[r].sete_scores === 0), A.sete_evaluations);
check('non-admins see only their own profile', ['dean', 'chair', 'faculty'].every((r) => C[r].user_profiles === 1) && A.user_profiles >= 4, A.user_profiles);
check('audit trail: administrator only', ['dean', 'chair', 'faculty'].every((r) => C[r].kpi_target_audit === 0), A.kpi_target_audit);

// KPI functions
const summaries = {};
for (const who of ['admin', 'dean', 'chair', 'faculty']) {
  const r = await rpc('get_kpi_summary', {}, tokens[who]);
  summaries[who] = r.body;
  check(`${who} gets five KPIs for their own scope`, r.ok && r.body.length === 5, r.ok ? r.body.map((k) => k.kpi_code).join(',') : r.code);
}
check('faculty member gets on-time grades instead of the group-only KPI',
  summaries.faculty.some((k) => k.kpi_code === 'ontime_grades') && !summaries.faculty.some((k) => k.kpi_code === 'faculty_standard_rate'));
{
  const n = (who) => summaries[who].find((k) => k.kpi_code === 'pass_rate').sample_size;
  check('KPI sample narrows with scope: admin > dean > chair > faculty', n('admin') > n('dean') && n('dean') > n('chair') && n('chair') > n('faculty') && n('faculty') > 0, `${n('admin')} > ${n('dean')} > ${n('chair')} > ${n('faculty')}`);
  const u = await rpc('get_kpi_summary', {}, tokens.noaccess);
  check('no-role account is refused KPI functions', !u.ok && u.code === '42501', `${u.status} ${u.code}`);
}
const other = { p_college_id: ids.CAS };
check('admin can view any college', (await rpc('get_kpi_summary', other, tokens.admin)).ok);
for (const who of ['dean', 'chair', 'faculty']) {
  const r = await rpc('get_kpi_summary', other, tokens[who]);
  check(`${who} is refused another college`, !r.ok && r.code === '42501', `${r.status} ${r.code}`);
}
{
  const r = await rpc('get_kpi_summary', { p_department_id: ids['dept:CS'] }, tokens.dean);
  check('dean can drill into a department of their college', r.ok && r.body.length === 5, r.status);
  for (const who of ['chair', 'faculty']) {
    const x = await rpc('get_kpi_summary', { p_department_id: ids['dept:CS'] }, tokens[who]);
    check(`${who} is refused another department of the same college`, !x.ok && x.code === '42501', `${x.status} ${x.code}`);
  }
  const bad = await rpc('get_kpi_summary', { p_college_id: ids.CICS, p_department_id: ids['dept:NUR'] }, tokens.admin);
  check('inconsistent college/department filter is rejected', !bad.ok && bad.code === '22023', `${bad.status} ${bad.code}`);
}

// Department comparison
{
  const d = await rpc('get_department_kpis', {}, tokens.dean);
  check('dean department list is limited to CICS', d.ok && d.body.length > 0 && d.body.every((x) => x.college_code === 'CICS'), d.ok ? [...new Set(d.body.map((x) => x.department_code))].join(',') : d.code);
  const c = await rpc('get_department_kpis', {}, tokens.chair);
  check('chair department list is limited to IT', c.ok && c.body.length > 0 && c.body.every((x) => x.department_code === 'IT'), c.ok ? [...new Set(c.body.map((x) => x.department_code))].join(',') : c.code);
  const f = await rpc('get_department_kpis', {}, tokens.faculty);
  check('faculty member is refused department comparisons', !f.ok && f.code === '42501', `${f.status} ${f.code}`);
}

// Faculty-level SETE results
{
  const a = await rpc('get_faculty_performance', {}, tokens.admin);
  const d = await rpc('get_faculty_performance', {}, tokens.dean);
  const c = await rpc('get_faculty_performance', {}, tokens.chair);
  const f = await rpc('get_faculty_performance', {}, tokens.faculty);
  check('dean sees only CICS faculty results', d.ok && d.body.length > 0 && d.body.length < a.body.length && d.body.every((x) => x.college_code === 'CICS'), d.ok ? d.body.length : d.code);
  check('chair sees only IT faculty results', c.ok && c.body.length > 0 && c.body.every((x) => x.department_code === 'IT'), c.ok ? c.body.length : c.code);
  check('faculty member sees only their own SETE result', f.ok && f.body.length === 1 && f.body[0].pseudonym === 'Faculty IT-07', f.ok ? f.body.map((x) => x.pseudonym).join(',') : f.code);
}

// Class-level results
{
  const f = await rpc('get_class_results', {}, tokens.faculty);
  check('faculty member gets only their own classes', f.ok && f.body.length > 0 && f.body.every((x) => x.faculty_pseudonym === 'Faculty IT-07'), f.ok ? `${f.body.length} classes` : f.code);
  const c = await rpc('get_class_results', {}, tokens.chair);
  check('chair gets the classes of their program', c.ok && c.body.length > f.body.length && c.body.every((x) => x.course_code.startsWith('IT ')), c.ok ? `${c.body.length} classes` : c.code);
}

// KPI target writes: administrator only
{
  const res = await fetch(`${URL_}/rest/v1/kpi_targets?college_id=is.null&select=id,notes&limit=1`, { headers: headers(tokens.admin) });
  const [row] = await res.json();
  const patch = (token, body) =>
    fetch(`${URL_}/rest/v1/kpi_targets?id=eq.${row.id}`, {
      method: 'PATCH',
      headers: { ...headers(token), Prefer: 'return=representation' },
      body: JSON.stringify(body),
    }).then(async (r) => ({ ok: r.ok, status: r.status, rows: r.ok ? await r.json() : [] }));
  for (const who of ['dean', 'chair', 'faculty', 'noaccess']) {
    const t = await patch(tokens[who], { notes: `${who} tamper attempt` });
    check(`${who} cannot modify KPI targets`, t.rows.length === 0, `status ${t.status}, rows ${t.rows.length}`);
    const reset = await rpc('reset_kpi_targets', {}, tokens[who]);
    check(`${who} cannot restore targets`, !reset.ok && reset.code === '42501', `${reset.status} ${reset.code}`);
  }
  const a = await patch(tokens.admin, { notes: row.notes });
  check('admin can modify KPI targets', a.rows.length === 1, `status ${a.status}`);
  const invalid = await patch(tokens.admin, { target_value: 999 });
  check('invalid target values are rejected by the database', !invalid.ok, `status ${invalid.status}`);
  const audit = await count('kpi_target_audit', tokens.admin);
  check('target changes are written to the audit trail', audit.n > 0, audit.n);
}

// Nobody can change their own role or grant themselves access
{
  const up = await fetch(`${URL_}/rest/v1/user_profiles?user_id=not.is.null`, {
    method: 'PATCH', headers: { ...headers(tokens.faculty), Prefer: 'return=representation' }, body: JSON.stringify({ role: 'admin' }),
  });
  check('faculty member cannot promote themselves', !up.ok, `status ${up.status}`);
  const self = await fetch(`${URL_}/rest/v1/user_profiles`, {
    method: 'POST',
    headers: { ...headers(tokens.noaccess), Prefer: 'return=representation' },
    body: JSON.stringify({ user_id: JSON.parse(atob(tokens.noaccess.split('.')[1])).sub, full_name: 'x', role: 'admin' }),
  });
  check('no-role account cannot grant itself a profile', !self.ok, `status ${self.status}`);
}

// Shared demo credentials cannot be changed by visitors
{
  const res = await fetch(`${URL_}/auth/v1/user`, {
    method: 'PUT',
    headers: headers(tokens.faculty),
    body: JSON.stringify({ password: 'HijackedPassword#1', current_password: PW }),
  });
  const again = await signIn(accounts.faculty);
  const hijack = await signIn(accounts.faculty, 'HijackedPassword#1');
  check('demo password cannot be changed by a visitor', again.ok && !hijack.ok, `update status ${res.status}; original still works: ${again.ok}`);
}

console.log('\nAuthorization checks:');
console.table(results);
const failed = results.filter((r) => r.result === 'FAIL');
console.log(failed.length ? `\n${failed.length} check(s) FAILED` : `\nAll ${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
