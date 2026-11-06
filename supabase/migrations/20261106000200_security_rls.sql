-- =============================================================================
-- Security: role helpers, triggers, Row-Level Security and explicit grants
-- -----------------------------------------------------------------------------
-- Access model
--   admin  : every row, can edit KPI targets / analytics settings
--   dean   : rows belonging to their college (faculty, students, sections, grades)
--   chair  : rows belonging to their department
--   viewer : reference data + KPI targets only; KPIs come from aggregate RPCs
--   anon   : nothing (no table grants at all)
-- Raw anonymous SETE responses are readable by admins only. Deans and chairs
-- see SETE results through aggregate functions (see analytics migration).
-- =============================================================================

grant usage on schema private to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Role / scope helpers (SECURITY DEFINER so they can read user_profiles even
-- though user_profiles itself is protected by RLS; search_path pinned).
-- ---------------------------------------------------------------------------
create or replace function private.current_app_role()
returns public.app_role
language sql
stable
security definer
set search_path = ''
as $$
  select up.role from public.user_profiles up where up.user_id = (select auth.uid());
$$;

create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(private.current_app_role() = 'admin', false);
$$;

-- Departments whose row-level records the current user may read.
create or replace function private.accessible_department_ids()
returns setof smallint
language sql
stable
security definer
set search_path = ''
as $$
  select d.id
  from public.departments d
  join public.user_profiles up on up.user_id = (select auth.uid())
  where up.role = 'admin'
     or (up.role = 'dean'  and d.college_id = up.college_id)
     or (up.role = 'chair' and d.id = up.department_id);
$$;

-- Class sections whose row-level records (grades) the current user may read.
create or replace function private.accessible_section_ids()
returns setof integer
language sql
stable
security definer
set search_path = ''
as $$
  select cs.id
  from public.class_sections cs
  join public.courses c on c.id = cs.course_id
  where c.department_id in (select private.accessible_department_ids());
$$;

revoke all on function private.current_app_role() from public;
revoke all on function private.is_admin() from public;
revoke all on function private.accessible_department_ids() from public;
revoke all on function private.accessible_section_ids() from public;
grant execute on function private.current_app_role() to authenticated, service_role;
grant execute on function private.is_admin() to authenticated, service_role;
grant execute on function private.accessible_department_ids() to authenticated, service_role;
grant execute on function private.accessible_section_ids() to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Profile bootstrap: every new auth user gets a least-privilege viewer profile.
-- Roles are never taken from user-controlled metadata.
-- ---------------------------------------------------------------------------
create or replace function private.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.user_profiles (user_id, full_name, role, is_demo)
  values (
    new.id,
    left(coalesce(nullif(new.raw_user_meta_data ->> 'full_name', ''), split_part(new.email, '@', 1), 'User'), 120),
    'viewer',
    coalesce((new.raw_app_meta_data ->> 'demo_account')::boolean, false)
  )
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_auth_user();

-- ---------------------------------------------------------------------------
-- Shared demo accounts: their credentials are published on the login page, so
-- visitors must not be able to change the password/email and lock others out.
-- app_metadata.demo_account can only be set with the service role.
-- Maintenance can bypass with: set local app.allow_demo_account_changes = 'on';
-- ---------------------------------------------------------------------------
create or replace function private.protect_demo_credentials()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce((old.raw_app_meta_data ->> 'demo_account')::boolean, false)
     and coalesce(current_setting('app.allow_demo_account_changes', true), '') <> 'on' then
    new.encrypted_password         := old.encrypted_password;
    new.email                      := old.email;
    new.phone                      := old.phone;
    new.email_change               := old.email_change;
    new.email_change_token_new     := old.email_change_token_new;
    new.email_change_token_current := old.email_change_token_current;
    new.phone_change               := old.phone_change;
    new.raw_app_meta_data          := old.raw_app_meta_data;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_demo_credentials on auth.users;
create trigger protect_demo_credentials
  before update on auth.users
  for each row execute function private.protect_demo_credentials();

-- ---------------------------------------------------------------------------
-- KPI target integrity + audit trail
-- ---------------------------------------------------------------------------
create or replace function private.validate_kpi_target()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  d public.kpi_definitions%rowtype;
begin
  select * into d from public.kpi_definitions where id = new.kpi_id;

  if new.target_value not between d.min_value and d.max_value
     or new.warning_threshold not between d.min_value and d.max_value
     or new.critical_threshold not between d.min_value and d.max_value then
    raise exception 'Values for "%" must be between % and %', d.name, d.min_value, d.max_value
      using errcode = '22023';
  end if;

  if d.direction = 'higher_is_better'
     and not (new.target_value >= new.warning_threshold and new.warning_threshold >= new.critical_threshold) then
    raise exception 'For "%" (higher is better) the order must be target >= warning >= critical', d.name
      using errcode = '22023';
  elsif d.direction = 'lower_is_better'
     and not (new.target_value <= new.warning_threshold and new.warning_threshold <= new.critical_threshold) then
    raise exception 'For "%" (lower is better) the order must be target <= warning <= critical', d.name
      using errcode = '22023';
  end if;

  new.updated_at := now();
  new.updated_by := (select auth.uid());
  return new;
end;
$$;

create trigger kpi_targets_validate
  before insert or update on public.kpi_targets
  for each row execute function private.validate_kpi_target();

create or replace function private.audit_kpi_target()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.kpi_target_audit (kpi_target_id, kpi_id, college_id, action, old_values, new_values, changed_by)
  values (
    coalesce(new.id, old.id),
    coalesce(new.kpi_id, old.kpi_id),
    coalesce(new.college_id, old.college_id),
    tg_op,
    case when tg_op in ('UPDATE', 'DELETE')
         then jsonb_build_object('target_value', old.target_value, 'warning_threshold', old.warning_threshold,
                                 'critical_threshold', old.critical_threshold, 'notes', old.notes) end,
    case when tg_op in ('INSERT', 'UPDATE')
         then jsonb_build_object('target_value', new.target_value, 'warning_threshold', new.warning_threshold,
                                 'critical_threshold', new.critical_threshold, 'notes', new.notes) end,
    (select auth.uid())
  );
  return null;
end;
$$;

create trigger kpi_targets_audit
  after insert or update or delete on public.kpi_targets
  for each row execute function private.audit_kpi_target();

create or replace function private.stamp_analytics_setting()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  new.updated_by := (select auth.uid());
  return new;
end;
$$;

create trigger analytics_settings_stamp
  before update on public.analytics_settings
  for each row execute function private.stamp_analytics_setting();

create or replace function private.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger user_profiles_touch
  before update on public.user_profiles
  for each row execute function private.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Row-Level Security: enabled on EVERY table in public.
-- ---------------------------------------------------------------------------
alter table public.colleges           enable row level security;
alter table public.departments        enable row level security;
alter table public.programs           enable row level security;
alter table public.academic_years     enable row level security;
alter table public.semesters          enable row level security;
alter table public.terms              enable row level security;
alter table public.faculty            enable row level security;
alter table public.students           enable row level security;
alter table public.courses            enable row level security;
alter table public.class_sections     enable row level security;
alter table public.enrollments        enable row level security;
alter table public.sete_criteria      enable row level security;
alter table public.sete_rating_scale  enable row level security;
alter table public.sete_evaluations   enable row level security;
alter table public.sete_scores        enable row level security;
alter table public.user_profiles      enable row level security;
alter table public.kpi_definitions    enable row level security;
alter table public.kpi_targets        enable row level security;
alter table public.kpi_target_audit   enable row level security;
alter table public.analytics_settings enable row level security;
alter table private.kpi_target_baseline enable row level security;

-- Non-confidential reference data: any signed-in user may read.
create policy "Signed-in users can read colleges"       on public.colleges          for select to authenticated using (true);
create policy "Signed-in users can read departments"    on public.departments       for select to authenticated using (true);
create policy "Signed-in users can read programs"       on public.programs          for select to authenticated using (true);
create policy "Signed-in users can read academic years" on public.academic_years    for select to authenticated using (true);
create policy "Signed-in users can read semesters"      on public.semesters         for select to authenticated using (true);
create policy "Signed-in users can read terms"          on public.terms             for select to authenticated using (true);
create policy "Signed-in users can read courses"        on public.courses           for select to authenticated using (true);
create policy "Signed-in users can read SETE criteria"  on public.sete_criteria     for select to authenticated using (true);
create policy "Signed-in users can read rating scale"   on public.sete_rating_scale for select to authenticated using (true);
create policy "Signed-in users can read KPI definitions" on public.kpi_definitions  for select to authenticated using (true);
create policy "Signed-in users can read KPI targets"    on public.kpi_targets       for select to authenticated using (true);
create policy "Signed-in users can read analytics settings" on public.analytics_settings for select to authenticated using (true);

-- Confidential row-level records: scoped by role.
create policy "Scoped users can read faculty"
  on public.faculty for select to authenticated
  using (department_id in (select private.accessible_department_ids()));

create policy "Scoped users can read students"
  on public.students for select to authenticated
  using (program_id in (
    select p.id from public.programs p
    where p.department_id in (select private.accessible_department_ids())
  ));

create policy "Scoped users can read class sections"
  on public.class_sections for select to authenticated
  using (id in (select private.accessible_section_ids()));

create policy "Scoped users can read enrollments and grades"
  on public.enrollments for select to authenticated
  using (section_id in (select private.accessible_section_ids()));

-- Anonymous SETE responses: QA office (admin) only.
create policy "Admins can read SETE evaluations"
  on public.sete_evaluations for select to authenticated
  using ((select private.is_admin()));

create policy "Admins can read SETE scores"
  on public.sete_scores for select to authenticated
  using ((select private.is_admin()));

-- Profiles: users see their own; admins see all. No client-side writes, so a
-- user can never change their own role or scope.
create policy "Users can read own profile; admins read all"
  on public.user_profiles for select to authenticated
  using (user_id = (select auth.uid()) or (select private.is_admin()));

-- KPI targets / thresholds: admins only may change.
create policy "Admins can insert KPI targets"
  on public.kpi_targets for insert to authenticated
  with check ((select private.is_admin()));

create policy "Admins can update KPI targets"
  on public.kpi_targets for update to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

create policy "Admins can delete college overrides"
  on public.kpi_targets for delete to authenticated
  using ((select private.is_admin()) and college_id is not null);

create policy "Admins can read the KPI target audit trail"
  on public.kpi_target_audit for select to authenticated
  using ((select private.is_admin()));

create policy "Admins can update analytics settings"
  on public.analytics_settings for update to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

-- private.kpi_target_baseline: RLS on, no policies => only definer functions.

-- ---------------------------------------------------------------------------
-- Explicit grants. The project does not auto-expose new tables, and anon gets
-- nothing. RLS still filters every row for authenticated.
-- ---------------------------------------------------------------------------
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;

grant select on
  public.colleges, public.departments, public.programs, public.academic_years, public.semesters,
  public.terms, public.faculty, public.students, public.courses, public.class_sections,
  public.enrollments, public.sete_criteria, public.sete_rating_scale, public.sete_evaluations,
  public.sete_scores, public.user_profiles, public.kpi_definitions, public.kpi_targets,
  public.kpi_target_audit, public.analytics_settings
to authenticated;

grant insert, update, delete on public.kpi_targets to authenticated;
grant usage on sequence public.kpi_targets_id_seq to authenticated;
grant update (value) on public.analytics_settings to authenticated;

grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
grant all on private.kpi_target_baseline to service_role;

-- Trigger functions are never callable directly.
revoke all on function private.handle_new_auth_user() from public;
revoke all on function private.protect_demo_credentials() from public;
revoke all on function private.validate_kpi_target() from public;
revoke all on function private.audit_kpi_target() from public;
revoke all on function private.stamp_analytics_setting() from public;
revoke all on function private.touch_updated_at() from public;
