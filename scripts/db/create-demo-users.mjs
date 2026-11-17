#!/usr/bin/env node
/**
 * Create (or reset) the shared DEMONSTRATION accounts: one authorized academic
 * administrator and one unauthorized account for access-control testing.
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

// One authorized ACADEMIC ADMINISTRATOR (the dashboard's only user type) and one
// deliberately UNAUTHORIZED account (no profile) used to demonstrate that
// confidential data cannot be accessed by anyone else.
export const DEMO_ACCOUNTS = [
  { email: 'demo.academic.admin@example.com', fullName: 'Demo Academic Administrator', authorized: true,
    title: 'Office of the Vice President for Academic Affairs (demo account)' },
  { email: 'demo.unauthorized@example.com', fullName: 'Demo Unauthorized User', authorized: false,
    title: null },
];

const lit = (v) => (v === null ? 'null' : `'${String(v).replaceAll("'", "''")}'`);

const values = DEMO_ACCOUNTS.map(
  (a) => `(${lit(a.email)}, ${lit(a.fullName)}, ${a.authorized}, ${lit(a.title)})`,
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

  -- Retire demo accounts that are no longer part of the demonstration.
  delete from auth.users u
  where coalesce((u.raw_app_meta_data ->> 'demo_account')::boolean, false)
    and u.email not in (${DEMO_ACCOUNTS.map((a) => lit(a.email)).join(', ')});

  for r in
    select * from (values
      ${values}
    ) as t (email, full_name, authorized, title)
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

    if r.authorized then
      insert into public.user_profiles (user_id, full_name, role, title, is_demo)
      values (v_id, r.full_name, 'admin', r.title, true)
      on conflict (user_id) do update
        set full_name = excluded.full_name, role = 'admin', title = excluded.title, is_demo = true;
    else
      -- Unauthorized on purpose: signs in successfully but has no profile.
      delete from public.user_profiles where user_id = v_id;
    end if;
  end loop;
end
$do$;
select u.email, coalesce(p.role::text, '(none: unauthorized)') as role, p.is_demo
from auth.users u
left join public.user_profiles p on p.user_id = u.id
order by 1;`;

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
