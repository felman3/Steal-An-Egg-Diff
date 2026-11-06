#!/usr/bin/env node
/**
 * Create (or reset) the four shared DEMONSTRATION accounts, one per role.
 *
 *   SUPABASE_ACCESS_TOKEN=<personal access token> \
 *   SUPABASE_PROJECT_REF=<project ref> \
 *   DEMO_PASSWORD=<shared demo password> \
 *   node scripts/db/create-demo-users.mjs
 *
 * The accounts use reserved example.com addresses (they can never receive
 * mail), are flagged app_metadata.demo_account = true, and are protected by the
 * private.protect_demo_credentials trigger so visitors cannot change their
 * password or e-mail. Users are written through SQL (Management API) so no
 * service-role / secret API key is needed anywhere.
 */
const ref = process.env.SUPABASE_PROJECT_REF;
const token = process.env.SUPABASE_ACCESS_TOKEN;
const password = process.env.DEMO_PASSWORD;

if (!ref || !token || !password) {
  console.error('Set SUPABASE_PROJECT_REF, SUPABASE_ACCESS_TOKEN and DEMO_PASSWORD first.');
  process.exit(1);
}
if (password.length < 10) {
  console.error('DEMO_PASSWORD must be at least 10 characters.');
  process.exit(1);
}
if (/[#\s"'`$\\]/.test(password)) {
  // "#" starts a comment in .env files (Vite/dotenv) and would silently truncate
  // VITE_DEMO_PASSWORD; quotes/$/backslashes are similarly fragile in env files.
  console.error('DEMO_PASSWORD must not contain #, whitespace, quotes, $ or backslashes.');
  process.exit(1);
}

export const DEMO_ACCOUNTS = [
  { email: 'demo.admin@example.com', fullName: 'Demo QA Director', role: 'admin', college: null, department: null,
    title: 'Quality Assurance Office (demo account)' },
  { email: 'demo.dean.ccis@example.com', fullName: 'Demo Dean, CCIS', role: 'dean', college: 'CCIS', department: null,
    title: 'Dean, College of Computing and Information Sciences (demo account)' },
  { email: 'demo.chair.math@example.com', fullName: 'Demo Chair, Mathematics', role: 'chair', college: null, department: 'MATH',
    title: 'Chair, Department of Mathematics (demo account)' },
  { email: 'demo.viewer@example.com', fullName: 'Demo Analyst (Viewer)', role: 'viewer', college: null, department: null,
    title: 'Read-only analyst (demo account)' },
];

const lit = (v) => (v === null ? 'null' : `'${String(v).replaceAll("'", "''")}'`);

const values = DEMO_ACCOUNTS.map(
  (a) => `(${lit(a.email)}, ${lit(a.fullName)}, ${lit(a.role)}, ${lit(a.college)}, ${lit(a.department)}, ${lit(a.title)})`,
).join(',\n      ');

const sql = `
do $do$
declare
  r     record;
  v_id  uuid;
  v_pw  constant text := ${lit(password)};
begin
  -- allow this maintenance transaction to (re)set demo credentials
  perform set_config('app.allow_demo_account_changes', 'on', true);

  for r in
    select * from (values
      ${values}
    ) as t (email, full_name, role, college_code, dept_code, title)
  loop
    select u.id into v_id from auth.users u where u.email = r.email;

    if v_id is null then
      v_id := gen_random_uuid();
      insert into auth.users (
        instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
        raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
        confirmation_token, recovery_token, email_change_token_new, email_change,
        is_sso_user, is_anonymous)
      values (
        '00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated', r.email,
        extensions.crypt(v_pw, extensions.gen_salt('bf', 10)), now(),
        jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email'), 'demo_account', true),
        jsonb_build_object('full_name', r.full_name),
        now(), now(), '', '', '', '', false, false);

      insert into auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
      values (v_id::text, v_id,
              jsonb_build_object('sub', v_id::text, 'email', r.email, 'email_verified', true, 'phone_verified', false),
              'email', now(), now(), now());
    else
      update auth.users
         set encrypted_password = extensions.crypt(v_pw, extensions.gen_salt('bf', 10)),
             raw_app_meta_data  = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"demo_account": true}'::jsonb,
             banned_until       = null,
             updated_at         = now()
       where id = v_id;
    end if;

    insert into public.user_profiles (user_id, full_name, role, college_id, department_id, title, is_demo)
    values (v_id, r.full_name, r.role::public.app_role,
            (select c.id from public.colleges c where c.code = r.college_code),
            (select d.id from public.departments d where d.code = r.dept_code),
            r.title, true)
    on conflict (user_id) do update
      set full_name = excluded.full_name, role = excluded.role, college_id = excluded.college_id,
          department_id = excluded.department_id, title = excluded.title, is_demo = true;
  end loop;
end
$do$;
select u.email, p.role, p.is_demo, c.code as college, d.code as department
from public.user_profiles p
join auth.users u on u.id = p.user_id
left join public.colleges c on c.id = p.college_id
left join public.departments d on d.id = p.department_id
order by p.role;`;

const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ query: sql }),
});
const body = await res.text();
if (!res.ok) {
  console.error(`Failed (HTTP ${res.status}): ${body.slice(0, 1500)}`);
  process.exit(1);
}
console.table(JSON.parse(body));
