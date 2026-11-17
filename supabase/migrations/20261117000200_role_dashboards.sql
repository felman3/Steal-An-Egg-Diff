-- =============================================================================
-- Four user types, each with their own dashboard scope
-- -----------------------------------------------------------------------------
--   admin   Authorized Academic Administrator : whole institution, edits targets
--   dean    Dean                              : one college
--   chair   Program Chair                     : one department / program
--   faculty Faculty Member                    : only their own classes and SETE
-- Accounts without a profile still get nothing. All data is synthetic.
-- =============================================================================

-- 1) Profiles: scope must match the role ---------------------------------------
alter table public.user_profiles
  add column if not exists faculty_id integer references public.faculty (id) on update cascade on delete cascade;
create index if not exists user_profiles_faculty_id_idx on public.user_profiles (faculty_id);

alter table public.user_profiles drop constraint if exists user_profiles_academic_admin_only;
alter table public.user_profiles add constraint user_profiles_role_scope check (
     (role = 'admin'   and college_id is null     and department_id is null     and faculty_id is null)
  or (role = 'dean'    and college_id is not null and department_id is null     and faculty_id is null)
  or (role = 'chair'   and college_id is null     and department_id is not null and faculty_id is null)
  or (role = 'faculty' and college_id is null     and department_id is null     and faculty_id is not null)
);
comment on table public.user_profiles is
  'Dashboard role and data scope of each authorized user. Accounts without a row cannot read any dashboard data.';
comment on type public.app_role is
  'admin = Academic Administrator; dean = one college; chair = Program Chair (one department); faculty = own classes only. ''viewer'' is unused.';

-- 2) Scope helpers ---------------------------------------------------------------
create or replace function private.has_profile()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.user_profiles up where up.user_id = (select auth.uid()));
$$;

create or replace function private.own_faculty_id()
returns integer language sql stable security definer set search_path = '' as $$
  select up.faculty_id from public.user_profiles up where up.user_id = (select auth.uid());
$$;

-- Departments whose row-level records the caller may read (faculty members: none).
create or replace function private.accessible_department_ids()
returns setof smallint language sql stable security definer set search_path = '' as $$
  select d.id
  from public.departments d
  join public.user_profiles up on up.user_id = (select auth.uid())
  where up.role = 'admin'
     or (up.role = 'dean'  and d.college_id = up.college_id)
     or (up.role = 'chair' and d.id = up.department_id);
$$;

create or replace function private.accessible_section_ids()
returns setof integer language sql stable security definer set search_path = '' as $$
  select cs.id
  from public.class_sections cs
  join public.courses c on c.id = cs.course_id
  where c.department_id in (select private.accessible_department_ids());
$$;

revoke all on function private.has_profile() from public;
revoke all on function private.own_faculty_id() from public;
revoke all on function private.accessible_department_ids() from public;
revoke all on function private.accessible_section_ids() from public;
grant execute on function private.has_profile() to authenticated, service_role;
grant execute on function private.own_faculty_id() to authenticated, service_role;
grant execute on function private.accessible_department_ids() to authenticated, service_role;
grant execute on function private.accessible_section_ids() to authenticated, service_role;

-- 3) Row-Level Security -----------------------------------------------------------
-- Reference data: any authorized dashboard user.
do $$
declare r record;
begin
  for r in
    select * from (values
      ('colleges', 'colleges'), ('departments', 'departments'), ('programs', 'programs'),
      ('academic_years', 'academic years'), ('semesters', 'semesters'), ('terms', 'terms'),
      ('courses', 'courses'), ('sete_criteria', 'SETE criteria'), ('sete_rating_scale', 'rating scale'),
      ('kpi_definitions', 'KPI definitions'), ('kpi_targets', 'KPI targets'), ('analytics_settings', 'analytics settings')
    ) as t (tbl, label)
  loop
    execute format('alter policy %I on public.%I using ((select private.has_profile()))', 'Academic admins can read ' || r.label, r.tbl);
    execute format('alter policy %I on public.%I rename to %I', 'Academic admins can read ' || r.label, r.tbl, 'Dashboard users can read ' || r.label);
  end loop;
end $$;

-- Confidential rows: scoped by role.
alter policy "Academic admins can read faculty" on public.faculty
  using (department_id in (select private.accessible_department_ids()) or id = (select private.own_faculty_id()));
alter policy "Academic admins can read faculty" on public.faculty rename to "Scoped users can read faculty";

alter policy "Academic admins can read students" on public.students
  using (program_id in (select p.id from public.programs p where p.department_id in (select private.accessible_department_ids())));
alter policy "Academic admins can read students" on public.students rename to "Scoped users can read students";

alter policy "Academic admins can read class sections" on public.class_sections
  using (id in (select private.accessible_section_ids()) or faculty_id = (select private.own_faculty_id()));
alter policy "Academic admins can read class sections" on public.class_sections rename to "Scoped users can read class sections";

alter policy "Academic admins can read enrollments and grades" on public.enrollments
  using (section_id in (select private.accessible_section_ids()));
alter policy "Academic admins can read enrollments and grades" on public.enrollments rename to "Scoped users can read enrollments and grades";
-- Raw anonymous SETE forms stay administrator-only (policies unchanged).

-- 4) KPI metadata: advice addressed to the faculty member --------------------------
alter table public.kpi_definitions add column if not exists faculty_action text;
comment on column public.kpi_definitions.faculty_action is 'Suggested next step shown to a faculty member when their own KPI is flagged.';

create or replace function private.apply_kpi_metadata()
returns void language sql security definer set search_path = '' as $$
  update public.kpi_definitions d set
    category = m.category, objective = m.objective, data_source = m.data_source,
    warning_action = m.warning_action, critical_action = m.critical_action, faculty_action = m.faculty_action,
    description = coalesce(m.description, d.description)
  from (values
    ('sete_mean', 'Teaching effectiveness',
     'Monitor the overall quality of instruction as perceived by students, across the four SETE criteria.',
     'SETE: Student Evaluation of Teaching Effectiveness (synthetic)',
     'Program chair reviews the SETE criteria breakdown with the faculty concerned and plans targeted faculty development (workshops, peer mentoring).',
     'Dean-led instructional review that combines SETE with peer/classroom observation, course outcomes and the response rate before any conclusion is drawn; agree on a development plan.',
     'Look at your lowest-rated criterion, ask your program chair for a peer observation or mentor, and try one change in that area next term.',
     'Average rating students gave their teachers across the four SETE criteria (1 = poor, 5 = outstanding). One source of evidence only: read it together with the response rate and other evidence. Results built from too few responses are suppressed to protect anonymity.'),
    ('sete_response_rate', 'Teaching effectiveness',
     'Make sure SETE results are representative enough to be interpreted responsibly.',
     'SETE submissions + enrolment records from the Student and Faculty Portal (synthetic)',
     'Send portal reminders, extend the evaluation window and allot class time for evaluation; mark affected SETE results as low-confidence.',
     'Treat SETE results for the scope as inconclusive; investigate access or awareness problems and do not use them for performance decisions this term.',
     'Remind your classes during the evaluation window and allot a few minutes of class time; with few responses your rating is less representative.',
     null),
    ('pass_rate', 'Academic operations',
     'Monitor student success in their enrolled courses and detect courses or programs where students struggle.',
     'Final grades from the Student and Faculty Portal (synthetic)',
     'Program chair reviews course assessments and grade distribution; offer tutorial / remedial sessions and early academic advising.',
     'Academic-affairs review of the program: curriculum and prerequisite check, retention and intervention plan for at-risk students.',
     'Check which classes pull the rate down, offer consultation or remedial sessions early, and refer struggling students for advising.',
     null),
    ('mean_gwa', 'Academic operations',
     'Track overall academic achievement (General Weighted Average; 1.00 is the highest grade).',
     'Final grades and course units from the Student and Faculty Portal (synthetic)',
     'Review grading consistency and student-support services with the program chairs concerned.',
     'Program-level academic intervention: learning-support programs, review of admission/readiness and course sequencing.',
     'Compare your grade distribution with your department and review your assessments with your program chair.',
     null),
    ('faculty_standard_rate', 'Teaching effectiveness',
     'Measure the share of faculty consistently meeting the institutional teaching standard, to plan faculty development.',
     'SETE: Student Evaluation of Teaching Effectiveness (synthetic)',
     'Prioritise faculty-development programs on the weakest SETE criterion; pair faculty with mentors.',
     'College-wide teaching-improvement plan with the dean, using SETE together with peer observation and teaching portfolios.',
     null,
     null),
    ('ontime_grades', 'Academic operations',
     'Make sure final grades reach students and the registrar on time, so enrolment and advising are not delayed.',
     'Grade submission dates from the Student and Faculty Portal (synthetic)',
     'Program chair reminds faculty of the grade deadline and checks for workload or system problems.',
     'Dean follows up on repeated late submissions and agrees on a submission schedule.',
     'Plan grade encoding before the deadline; tell your program chair early if a class will be late.',
     null)
  ) as m (code, category, objective, data_source, warning_action, critical_action, faculty_action, description)
  where d.code = m.code;
$$;
revoke all on function private.apply_kpi_metadata() from public;

-- 5) Fact view gains on-time grade submission ---------------------------------------
drop materialized view if exists private.section_facts;
create materialized view private.section_facts as
with enr as (
  select e.section_id,
         count(*)::int                                                     as enrolled,
         count(*) filter (where e.remark = 'dropped')::int                 as dropped,
         count(*) filter (where e.remark = 'incomplete')::int              as incomplete,
         count(*) filter (where e.remark = 'passed')::int                  as passed,
         count(*) filter (where e.remark = 'failed')::int                  as failed,
         coalesce(sum(e.final_grade) filter (where e.remark in ('passed', 'failed')), 0)::numeric as grade_sum,
         count(*) filter (where e.final_grade between 1.00 and 1.50)::int  as g_excellent,
         count(*) filter (where e.final_grade between 1.75 and 2.25)::int  as g_very_good,
         count(*) filter (where e.final_grade between 2.50 and 2.75)::int  as g_good,
         count(*) filter (where e.final_grade = 3.00)::int                 as g_passing
  from public.enrollments e
  group by e.section_id
),
ev as (
  select v.section_id,
         count(distinct v.id)::int          as evaluations,
         coalesce(sum(s.score), 0)::numeric as score_sum,
         count(s.score)::int                as score_count
  from public.sete_evaluations v
  left join public.sete_scores s on s.evaluation_id = v.id
  group by v.section_id
)
select cs.id as section_id, cs.term_id, t.academic_year_id, t.semester_id,
       c.department_id, d.college_id, cs.faculty_id, cs.course_id, c.units,
       coalesce(enr.enrolled, 0) as enrolled, coalesce(enr.dropped, 0) as dropped,
       coalesce(enr.incomplete, 0) as incomplete, coalesce(enr.passed, 0) as passed,
       coalesce(enr.failed, 0) as failed, coalesce(enr.grade_sum, 0) as grade_sum,
       coalesce(enr.g_excellent, 0) as g_excellent, coalesce(enr.g_very_good, 0) as g_very_good,
       coalesce(enr.g_good, 0) as g_good, coalesce(enr.g_passing, 0) as g_passing,
       coalesce(ev.evaluations, 0) as evaluations, coalesce(ev.score_sum, 0) as score_sum,
       coalesce(ev.score_count, 0) as score_count,
       (cs.grades_submitted_on is not null and cs.grades_submitted_on <= t.grade_deadline)::int as on_time
from public.class_sections cs
join public.terms t        on t.id = cs.term_id
join public.courses c      on c.id = cs.course_id
join public.departments d  on d.id = c.department_id
left join enr              on enr.section_id = cs.id
left join ev               on ev.section_id = cs.id;

create unique index section_facts_section_id_idx on private.section_facts (section_id);
create index section_facts_term_dept_idx on private.section_facts (term_id, department_id);
create index section_facts_faculty_idx on private.section_facts (faculty_id);
revoke all on private.section_facts from public, anon, authenticated;
grant select on private.section_facts to service_role;

-- 6) Authorization: resolve the caller's effective scope ------------------------------
drop function if exists private.authorize_scope(smallint, smallint);
create function private.authorize_scope(p_college_id smallint, p_department_id smallint)
returns table (role public.app_role, college_id smallint, department_id smallint, faculty_id integer)
language plpgsql stable security definer set search_path = '' as $$
declare
  v_profile      public.user_profiles%rowtype;
  v_dept_college smallint;
  v_own_dept     smallint;
  v_own_college  smallint;
begin
  select * into v_profile from public.user_profiles up where up.user_id = (select auth.uid());
  if not found then
    raise exception 'Access denied: this account is not authorized to view the dashboard' using errcode = '42501';
  end if;

  if p_college_id is not null and not exists (select 1 from public.colleges c where c.id = p_college_id) then
    raise exception 'Unknown college %', p_college_id using errcode = '22023';
  end if;
  if p_department_id is not null then
    select d.college_id into v_dept_college from public.departments d where d.id = p_department_id;
    if not found then
      raise exception 'Unknown department %', p_department_id using errcode = '22023';
    end if;
    if p_college_id is not null and p_college_id <> v_dept_college then
      raise exception 'Department % does not belong to college %', p_department_id, p_college_id using errcode = '22023';
    end if;
  end if;

  -- NOTE: RETURN QUERY only appends rows; the bare RETURN is what exits.
  if v_profile.role = 'admin' then
    return query select v_profile.role, coalesce(p_college_id, v_dept_college), p_department_id, null::integer;
    return;

  elsif v_profile.role = 'dean' then
    if coalesce(p_college_id, v_dept_college, v_profile.college_id) <> v_profile.college_id then
      raise exception 'Access denied: deans can only view their own college' using errcode = '42501';
    end if;
    return query select v_profile.role, v_profile.college_id, p_department_id, null::integer;
    return;

  elsif v_profile.role in ('chair', 'faculty') then
    if v_profile.role = 'chair' then
      v_own_dept := v_profile.department_id;
    else
      select f.department_id into v_own_dept from public.faculty f where f.id = v_profile.faculty_id;
    end if;
    select d.college_id into v_own_college from public.departments d where d.id = v_own_dept;
    if (p_department_id is not null and p_department_id <> v_own_dept)
       or (p_college_id is not null and p_college_id <> v_own_college) then
      raise exception 'Access denied: you can only view your own %',
        case when v_profile.role = 'chair' then 'program' else 'classes' end using errcode = '42501';
    end if;
    return query select v_profile.role, v_own_college, v_own_dept,
                        case when v_profile.role = 'faculty' then v_profile.faculty_id end;
    return;
  end if;

  raise exception 'Access denied: unknown role' using errcode = '42501';
end;
$$;
revoke all on function private.authorize_scope(smallint, smallint) from public;

-- 7) KPI engine: optional faculty scope + on-time grade submission --------------------
drop function if exists private.kpi_values(smallint[], smallint, smallint);
create function private.kpi_values(p_term_ids smallint[], p_college_id smallint, p_department_id smallint, p_faculty_id integer default null)
returns table (kpi_code text, value numeric, sample_size integer)
language sql stable security definer set search_path = '' as $$
  with params as (
    select coalesce(private.setting_value('faculty_rating_standard'), 4.00)    as standard,
           coalesce(private.setting_value('min_evaluations_reported'), 5)::int as min_n
  ),
  f as (
    select sf.*
    from private.section_facts sf
    where sf.term_id = any (p_term_ids)
      and (p_college_id is null or sf.college_id = p_college_id)
      and (p_department_id is null or sf.department_id = p_department_id)
      and (p_faculty_id is null or sf.faculty_id = p_faculty_id)
  ),
  totals as (
    select coalesce(sum(f.evaluations), 0)::int              as evaluations,
           coalesce(sum(f.score_sum), 0)                     as score_sum,
           coalesce(sum(f.score_count), 0)                   as score_count,
           coalesce(sum(f.enrolled - f.dropped), 0)::int     as eligible,
           coalesce(sum(f.passed), 0)::int                   as passed,
           coalesce(sum(f.passed + f.failed), 0)::int        as graded,
           coalesce(sum(f.units * f.grade_sum), 0)           as weighted_grade_sum,
           coalesce(sum(f.units * (f.passed + f.failed)), 0) as weighted_units,
           count(*)::int                                     as sections,
           coalesce(sum(f.on_time), 0)::int                  as on_time
    from f
  ),
  fac as (
    select f.faculty_id,
           sum(f.score_sum) / nullif(sum(f.score_count), 0) as mean_rating,
           sum(f.evaluations)                               as n
    from f group by f.faculty_id
  ),
  fac_tot as (
    select count(*) filter (where fac.n >= p.min_n)::int                                             as rated,
           count(*) filter (where fac.n >= p.min_n and round(fac.mean_rating, 2) >= p.standard)::int as meeting
    from fac cross join params p
  )
  select k.kpi_code, k.value, k.sample_size
  from totals t cross join fac_tot ft cross join params p
  cross join lateral (values
    ('sete_mean',             case when t.evaluations >= p.min_n then t.score_sum / nullif(t.score_count, 0) end, t.evaluations),
    ('sete_response_rate',    100.0 * t.evaluations / nullif(t.eligible, 0),      t.eligible),
    ('pass_rate',             100.0 * t.passed / nullif(t.eligible, 0),           t.eligible),
    ('mean_gwa',              t.weighted_grade_sum / nullif(t.weighted_units, 0), t.graded),
    ('faculty_standard_rate', 100.0 * ft.meeting / nullif(ft.rated, 0),           ft.rated),
    ('ontime_grades',         100.0 * t.on_time / nullif(t.sections, 0),          t.sections)
  ) as k (kpi_code, value, sample_size);
$$;
revoke all on function private.kpi_values(smallint[], smallint, smallint, integer) from public;

-- Each role sees five KPIs: faculty members get on-time grade submission in
-- place of "faculty meeting the SETE standard", which only makes sense for a group.
create or replace function private.kpi_visible(p_role public.app_role, p_code text)
returns boolean language sql immutable set search_path = '' as $$
  select case when p_role = 'faculty' then p_code <> 'faculty_standard_rate' else p_code <> 'ontime_grades' end;
$$;
revoke all on function private.kpi_visible(public.app_role, text) from public;

-- 8) Dashboard RPCs ---------------------------------------------------------------------
create or replace function public.get_kpi_summary(
  p_academic_year_id smallint default null, p_semester_id smallint default null,
  p_college_id smallint default null, p_department_id smallint default null)
returns table (
  kpi_code text, kpi_name text, short_name text, description text, formula text, data_source text,
  unit public.kpi_unit, direction public.kpi_direction, decimals smallint,
  value numeric, previous_value numeric, previous_label text,
  target numeric, warning_threshold numeric, critical_threshold numeric, college_specific_target boolean,
  status text, sample_size integer, sort_order smallint)
language plpgsql stable security definer set search_path = '' as $$
declare
  v_scope       record;
  v_terms       smallint[];
  v_prev_terms  smallint[] := '{}';
  v_prev_label  text;
  v_ay          public.academic_years%rowtype;
  v_term        record;
begin
  select * into v_scope from private.authorize_scope(p_college_id, p_department_id);
  v_terms := private.filter_terms(p_academic_year_id, p_semester_id);

  if p_academic_year_id is not null and p_semester_id is not null then
    select t.id, s.name || ' ' || ay.label as label into v_term
    from public.terms t
    join public.semesters s on s.id = t.semester_id
    join public.academic_years ay on ay.id = t.academic_year_id
    where t.start_date < (select t2.start_date from public.terms t2
                          where t2.academic_year_id = p_academic_year_id and t2.semester_id = p_semester_id)
    order by t.start_date desc limit 1;
    if found then
      v_prev_terms := array[v_term.id];
      v_prev_label := v_term.label;
    end if;
  elsif p_academic_year_id is not null then
    select * into v_ay from public.academic_years ay
    where ay.start_year = (select a.start_year - 1 from public.academic_years a where a.id = p_academic_year_id);
    if found then
      v_prev_terms := private.filter_terms(v_ay.id, null);
      v_prev_label := 'AY ' || v_ay.label;
    end if;
  end if;

  return query
  with cur as (select * from private.kpi_values(v_terms, v_scope.college_id, v_scope.department_id, v_scope.faculty_id)),
       prev as (select * from private.kpi_values(v_prev_terms, v_scope.college_id, v_scope.department_id, v_scope.faculty_id))
  select d.code, d.name, d.short_name, d.description, d.formula, d.data_source,
         d.unit, d.direction, d.decimals,
         round(cur.value, d.decimals),
         case when cardinality(v_prev_terms) > 0 then round(prev.value, d.decimals) end,
         v_prev_label,
         t.target, t.warning, t.critical, t.college_specific,
         private.kpi_status(round(cur.value, d.decimals), t.target, t.warning, t.critical, d.direction),
         cur.sample_size, d.sort_order
  from public.kpi_definitions d
  join cur on cur.kpi_code = d.code
  left join prev on prev.kpi_code = d.code
  join private.resolve_targets(v_scope.college_id) t on t.kpi_id = d.id
  where private.kpi_visible(v_scope.role, d.code)
  order by d.sort_order;
end;
$$;

create or replace function public.get_kpi_trend(
  p_academic_year_id smallint default null, p_semester_id smallint default null,
  p_college_id smallint default null, p_department_id smallint default null)
returns table (
  term_id smallint, term_label text, academic_year_label text, semester_name text, term_start date,
  in_selected_period boolean, kpi_code text, value numeric, sample_size integer)
language plpgsql stable security definer set search_path = '' as $$
declare v_scope record;
begin
  select * into v_scope from private.authorize_scope(p_college_id, p_department_id);
  return query
  select t.id, s.code || ' ' || ay.label, ay.label, s.name, t.start_date,
         (p_academic_year_id is null or t.academic_year_id = p_academic_year_id),
         k.kpi_code, round(k.value, d.decimals), k.sample_size
  from public.terms t
  join public.academic_years ay on ay.id = t.academic_year_id
  join public.semesters s on s.id = t.semester_id
  cross join lateral private.kpi_values(array[t.id], v_scope.college_id, v_scope.department_id, v_scope.faculty_id) k
  join public.kpi_definitions d on d.code = k.kpi_code
  where (p_semester_id is null or t.semester_id = p_semester_id)
    and private.kpi_visible(v_scope.role, d.code)
  order by t.start_date, d.sort_order;
end;
$$;

create or replace function public.get_department_kpis(
  p_academic_year_id smallint default null, p_semester_id smallint default null,
  p_college_id smallint default null, p_department_id smallint default null)
returns table (
  department_id smallint, department_code text, department_name text,
  college_id smallint, college_code text, college_name text,
  kpi_code text, value numeric, sample_size integer,
  target numeric, warning_threshold numeric, critical_threshold numeric, status text)
language plpgsql stable security definer set search_path = '' as $$
declare
  v_scope record;
  v_terms smallint[];
begin
  select * into v_scope from private.authorize_scope(p_college_id, p_department_id);
  if v_scope.role = 'faculty' then
    raise exception 'Access denied: department comparisons are not available to faculty members' using errcode = '42501';
  end if;
  v_terms := private.filter_terms(p_academic_year_id, p_semester_id);

  return query
  select dp.id, dp.code, dp.name, c.id, c.code, c.name,
         k.kpi_code, round(k.value, kd.decimals), k.sample_size,
         t.target, t.warning, t.critical,
         private.kpi_status(round(k.value, kd.decimals), t.target, t.warning, t.critical, kd.direction)
  from public.departments dp
  join public.colleges c on c.id = dp.college_id
  cross join lateral private.kpi_values(v_terms, dp.college_id, dp.id) k
  join public.kpi_definitions kd on kd.code = k.kpi_code
  cross join lateral private.resolve_targets(dp.college_id) t
  where t.kpi_id = kd.id
    and private.kpi_visible(v_scope.role, kd.code)
    and (v_scope.college_id is null or dp.college_id = v_scope.college_id)
    and (v_scope.department_id is null or dp.id = v_scope.department_id)
  order by c.code, dp.code, kd.sort_order;
end;
$$;

-- Criteria breakdown. The benchmark is the institution, except for a faculty
-- member, whose own results are compared with their department.
create or replace function public.get_sete_criteria(
  p_academic_year_id smallint default null, p_semester_id smallint default null,
  p_college_id smallint default null, p_department_id smallint default null)
returns table (
  criterion_id smallint, criterion_code text, criterion_name text, description text,
  scope_mean numeric, institution_mean numeric, responses integer)
language plpgsql stable security definer set search_path = '' as $$
declare
  v_scope record;
  v_terms smallint[];
  v_min   integer;
begin
  select * into v_scope from private.authorize_scope(p_college_id, p_department_id);
  v_terms := private.filter_terms(p_academic_year_id, p_semester_id);
  v_min := coalesce(private.setting_value('min_evaluations_reported'), 5)::int;

  return query
  with scoped as (
    select cf.criterion_id, sum(cf.score_sum) as s, sum(cf.score_count)::int as n
    from private.section_criterion_facts cf
    join private.section_facts sf on sf.section_id = cf.section_id
    where sf.term_id = any (v_terms)
      and (v_scope.college_id is null or sf.college_id = v_scope.college_id)
      and (v_scope.department_id is null or sf.department_id = v_scope.department_id)
      and (v_scope.faculty_id is null or sf.faculty_id = v_scope.faculty_id)
    group by cf.criterion_id
  ),
  inst as (
    select cf.criterion_id, sum(cf.score_sum) as s, sum(cf.score_count)::int as n
    from private.section_criterion_facts cf
    join private.section_facts sf on sf.section_id = cf.section_id
    where sf.term_id = any (v_terms)
      and (v_scope.role <> 'faculty' or sf.department_id = v_scope.department_id)
    group by cf.criterion_id
  )
  select c.id, c.code::text, c.name, c.description,
         case when coalesce(sc.n, 0) >= v_min then round(sc.s / sc.n, 2) end,
         case when coalesce(i.n, 0) >= v_min then round(i.s / i.n, 2) end,
         coalesce(sc.n, 0)
  from public.sete_criteria c
  left join scoped sc on sc.criterion_id = c.id
  left join inst i on i.criterion_id = c.id
  order by c.sort_order;
end;
$$;

create or replace function public.get_grade_distribution(
  p_academic_year_id smallint default null, p_semester_id smallint default null,
  p_college_id smallint default null, p_department_id smallint default null)
returns table (band_code text, band_label text, grade_range text, sort_order integer, students integer, percentage numeric)
language plpgsql stable security definer set search_path = '' as $$
declare
  v_scope record;
  v_terms smallint[];
begin
  select * into v_scope from private.authorize_scope(p_college_id, p_department_id);
  v_terms := private.filter_terms(p_academic_year_id, p_semester_id);

  return query
  with t as (
    select coalesce(sum(sf.g_excellent), 0)::int as g_excellent, coalesce(sum(sf.g_very_good), 0)::int as g_very_good,
           coalesce(sum(sf.g_good), 0)::int as g_good, coalesce(sum(sf.g_passing), 0)::int as g_passing,
           coalesce(sum(sf.failed), 0)::int as failed, coalesce(sum(sf.incomplete), 0)::int as incomplete,
           coalesce(sum(sf.dropped), 0)::int as dropped, coalesce(sum(sf.enrolled), 0)::int as total
    from private.section_facts sf
    where sf.term_id = any (v_terms)
      and (v_scope.college_id is null or sf.college_id = v_scope.college_id)
      and (v_scope.department_id is null or sf.department_id = v_scope.department_id)
      and (v_scope.faculty_id is null or sf.faculty_id = v_scope.faculty_id)
  )
  select b.code, b.label, b.grade_range, b.ord, b.n,
         case when t.total > 0 then round(100.0 * b.n / t.total, 1) end
  from t
  cross join lateral (values
    ('excellent', 'Excellent',  '1.00-1.50', 1, t.g_excellent),
    ('very_good', 'Very good',  '1.75-2.25', 2, t.g_very_good),
    ('good',      'Good',       '2.50-2.75', 3, t.g_good),
    ('passing',   'Passing',    '3.00',      4, t.g_passing),
    ('failed',    'Failed',     '5.00',      5, t.failed),
    ('incomplete','Incomplete', 'INC',       6, t.incomplete),
    ('dropped',   'Dropped',    'DRP',       7, t.dropped)
  ) as b (code, label, grade_range, ord, n)
  order by b.ord;
end;
$$;

-- Faculty-level SETE results within the caller's scope (a faculty member gets only their own row).
create or replace function public.get_faculty_performance(
  p_academic_year_id smallint default null, p_semester_id smallint default null,
  p_college_id smallint default null, p_department_id smallint default null)
returns table (
  faculty_id integer, pseudonym text, employee_no text, academic_rank text, employment_status text,
  department_code text, college_code text, sections integer, evaluations integer,
  response_rate numeric, mean_rating numeric, rating_band text,
  target numeric, warning_threshold numeric, critical_threshold numeric, status text,
  criterion_means jsonb)
language plpgsql stable security definer set search_path = '' as $$
declare
  v_scope record;
  v_terms smallint[];
  v_min   integer;
begin
  select * into v_scope from private.authorize_scope(p_college_id, p_department_id);
  v_terms := private.filter_terms(p_academic_year_id, p_semester_id);
  v_min := coalesce(private.setting_value('min_evaluations_reported'), 5)::int;

  return query
  with f as (
    select sf.*
    from private.section_facts sf
    where sf.term_id = any (v_terms)
      and (v_scope.college_id is null or sf.college_id = v_scope.college_id)
      and (v_scope.department_id is null or sf.department_id = v_scope.department_id)
      and (v_scope.faculty_id is null or sf.faculty_id = v_scope.faculty_id)
  ),
  agg as (
    select f.faculty_id, count(*)::int as sections, sum(f.evaluations)::int as evaluations,
           sum(f.enrolled - f.dropped)::int as eligible,
           sum(f.score_sum) / nullif(sum(f.score_count), 0) as mean_rating
    from f group by f.faculty_id
  ),
  crit as (
    select x.faculty_id, jsonb_object_agg(c.code::text, round(x.s / nullif(x.n, 0), 2)) as means
    from (
      select f.faculty_id, cf.criterion_id, sum(cf.score_sum) as s, sum(cf.score_count) as n
      from f join private.section_criterion_facts cf on cf.section_id = f.section_id
      group by f.faculty_id, cf.criterion_id
    ) x
    join public.sete_criteria c on c.id = x.criterion_id
    group by x.faculty_id
  ),
  sete_def as (select kd.id, kd.direction from public.kpi_definitions kd where kd.code = 'sete_mean')
  select fa.id, fa.pseudonym, fa.employee_no, fa.academic_rank, fa.employment_status, dp.code, co.code,
         a.sections, a.evaluations,
         round(100.0 * a.evaluations / nullif(a.eligible, 0), 1),
         case when a.evaluations >= v_min then round(a.mean_rating, 2) end,
         case when a.evaluations >= v_min then (
           select rs.label from public.sete_rating_scale rs
           where round(a.mean_rating, 2) between rs.min_score and rs.max_score
           order by rs.sort_order limit 1) end,
         t.target, t.warning, t.critical,
         case when a.evaluations >= v_min
              then private.kpi_status(round(a.mean_rating, 2), t.target, t.warning, t.critical, sd.direction)
              else 'insufficient_data' end,
         case when a.evaluations >= v_min then cr.means end
  from agg a
  join public.faculty fa on fa.id = a.faculty_id
  join public.departments dp on dp.id = fa.department_id
  join public.colleges co on co.id = dp.college_id
  cross join sete_def sd
  cross join lateral private.resolve_targets(dp.college_id) t
  left join crit cr on cr.faculty_id = a.faculty_id
  where t.kpi_id = sd.id
  order by (a.evaluations >= v_min) desc, a.mean_rating asc nulls last, fa.pseudonym;
end;
$$;

-- Per-class results for a faculty member (own classes) or a program chair (own program).
create or replace function public.get_class_results(
  p_academic_year_id smallint default null, p_semester_id smallint default null,
  p_college_id smallint default null, p_department_id smallint default null)
returns table (
  section_id integer, term_label text, term_start date, course_code text, course_title text, section_code text,
  faculty_pseudonym text, students integer, evaluations integer, response_rate numeric,
  mean_rating numeric, pass_rate numeric, mean_grade numeric, grades_on_time boolean)
language plpgsql stable security definer set search_path = '' as $$
declare
  v_scope record;
  v_terms smallint[];
  v_min   integer;
begin
  select * into v_scope from private.authorize_scope(p_college_id, p_department_id);
  if v_scope.role not in ('faculty', 'chair') then
    raise exception 'Access denied: class-level results are available to faculty members and program chairs' using errcode = '42501';
  end if;
  v_terms := private.filter_terms(p_academic_year_id, p_semester_id);
  v_min := coalesce(private.setting_value('min_evaluations_reported'), 5)::int;

  return query
  select sf.section_id, s.code || ' ' || ay.label, t.start_date, c.code, c.title, cs.section_code, fa.pseudonym,
         (sf.enrolled - sf.dropped),
         sf.evaluations,
         round(100.0 * sf.evaluations / nullif(sf.enrolled - sf.dropped, 0), 1),
         case when sf.evaluations >= v_min then round(sf.score_sum / nullif(sf.score_count, 0), 2) end,
         round(100.0 * sf.passed / nullif(sf.enrolled - sf.dropped, 0), 1),
         round(sf.grade_sum / nullif(sf.passed + sf.failed, 0), 2),
         sf.on_time = 1
  from private.section_facts sf
  join public.class_sections cs on cs.id = sf.section_id
  join public.courses c on c.id = sf.course_id
  join public.faculty fa on fa.id = sf.faculty_id
  join public.terms t on t.id = sf.term_id
  join public.semesters s on s.id = t.semester_id
  join public.academic_years ay on ay.id = t.academic_year_id
  where sf.term_id = any (v_terms)
    and sf.department_id = v_scope.department_id
    and (v_scope.faculty_id is null or sf.faculty_id = v_scope.faculty_id)
  order by t.start_date, c.code, cs.section_code;
end;
$$;

revoke all on function public.get_class_results(smallint, smallint, smallint, smallint) from public, anon;
grant execute on function public.get_class_results(smallint, smallint, smallint, smallint) to authenticated;
grant execute on all functions in schema public to service_role;
grant execute on all functions in schema private to service_role;
