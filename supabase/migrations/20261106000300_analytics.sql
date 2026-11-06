-- =============================================================================
-- Analytics layer: fact views, KPI engine and dashboard RPCs
-- -----------------------------------------------------------------------------
-- * private.section_facts / private.section_criterion_facts pre-aggregate the
--   raw grade and SETE rows per class section (refresh after loading data).
-- * Every public RPC is SECURITY DEFINER with an empty search_path and starts
--   by calling private.authorize_scope(), which enforces the caller's role and
--   college/department scope. Raw rows never leave the database through them.
-- * Aggregates built from fewer than analytics_settings.min_evaluations_reported
--   SETE responses are suppressed (returned as NULL) to protect anonymity.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Fact views
-- ---------------------------------------------------------------------------
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
         count(distinct v.id)::int    as evaluations,
         coalesce(sum(s.score), 0)::numeric as score_sum,
         count(s.score)::int          as score_count
  from public.sete_evaluations v
  left join public.sete_scores s on s.evaluation_id = v.id
  group by v.section_id
)
select cs.id                         as section_id,
       cs.term_id,
       t.academic_year_id,
       t.semester_id,
       c.department_id,
       d.college_id,
       cs.faculty_id,
       cs.course_id,
       c.units,
       coalesce(enr.enrolled, 0)     as enrolled,
       coalesce(enr.dropped, 0)      as dropped,
       coalesce(enr.incomplete, 0)   as incomplete,
       coalesce(enr.passed, 0)       as passed,
       coalesce(enr.failed, 0)       as failed,
       coalesce(enr.grade_sum, 0)    as grade_sum,
       coalesce(enr.g_excellent, 0)  as g_excellent,
       coalesce(enr.g_very_good, 0)  as g_very_good,
       coalesce(enr.g_good, 0)       as g_good,
       coalesce(enr.g_passing, 0)    as g_passing,
       coalesce(ev.evaluations, 0)   as evaluations,
       coalesce(ev.score_sum, 0)     as score_sum,
       coalesce(ev.score_count, 0)   as score_count
from public.class_sections cs
join public.terms t        on t.id = cs.term_id
join public.courses c      on c.id = cs.course_id
join public.departments d  on d.id = c.department_id
left join enr              on enr.section_id = cs.id
left join ev               on ev.section_id = cs.id;

create unique index section_facts_section_id_idx on private.section_facts (section_id);
create index section_facts_term_dept_idx on private.section_facts (term_id, department_id);
create index section_facts_faculty_idx on private.section_facts (faculty_id);

create materialized view private.section_criterion_facts as
select v.section_id,
       s.criterion_id,
       sum(s.score)::numeric as score_sum,
       count(*)::int         as score_count
from public.sete_evaluations v
join public.sete_scores s on s.evaluation_id = v.id
group by v.section_id, s.criterion_id;

create unique index section_criterion_facts_key on private.section_criterion_facts (section_id, criterion_id);

revoke all on private.section_facts, private.section_criterion_facts from public, anon, authenticated;
grant select on private.section_facts, private.section_criterion_facts to service_role;

create or replace function private.refresh_analytics()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  refresh materialized view private.section_facts;
  refresh materialized view private.section_criterion_facts;
end;
$$;
revoke all on function private.refresh_analytics() from public;
grant execute on function private.refresh_analytics() to service_role;

-- ---------------------------------------------------------------------------
-- Internal helpers
-- ---------------------------------------------------------------------------
create or replace function private.setting_value(p_key text)
returns numeric
language sql
stable
security definer
set search_path = ''
as $$
  select s.value from public.analytics_settings s where s.key = p_key;
$$;

create or replace function private.kpi_status(
  p_value numeric, p_target numeric, p_warning numeric, p_critical numeric, p_direction public.kpi_direction)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when p_value is null then 'no_data'
    when p_direction = 'higher_is_better' then
      case when p_value >= p_target   then 'on_target'
           when p_value >= p_warning  then 'below_target'
           when p_value >= p_critical then 'warning'
           else 'critical' end
    else
      case when p_value <= p_target   then 'on_target'
           when p_value <= p_warning  then 'below_target'
           when p_value <= p_critical then 'warning'
           else 'critical' end
  end;
$$;

-- Effective targets for a college (college override, else institution default).
create or replace function private.resolve_targets(p_college_id smallint)
returns table (kpi_id smallint, target numeric, warning numeric, critical numeric, college_specific boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select d.id,
         coalesce(o.target_value, g.target_value),
         coalesce(o.warning_threshold, g.warning_threshold),
         coalesce(o.critical_threshold, g.critical_threshold),
         o.id is not null
  from public.kpi_definitions d
  left join public.kpi_targets g on g.kpi_id = d.id and g.college_id is null
  left join public.kpi_targets o on o.kpi_id = d.id and o.college_id = p_college_id;
$$;

create or replace function private.filter_terms(p_academic_year_id smallint, p_semester_id smallint)
returns smallint[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(array_agg(t.id order by t.start_date), '{}'::smallint[])
  from public.terms t
  where (p_academic_year_id is null or t.academic_year_id = p_academic_year_id)
    and (p_semester_id is null or t.semester_id = p_semester_id);
$$;

-- Authorise the caller and return the effective scope.
-- Raises 42501 (insufficient_privilege) when the request is outside the caller's scope.
create or replace function private.authorize_scope(p_college_id smallint, p_department_id smallint)
returns table (role public.app_role, college_id smallint, department_id smallint)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_profile      public.user_profiles%rowtype;
  v_dept_college smallint;
  v_chair_college smallint;
begin
  select * into v_profile from public.user_profiles up where up.user_id = (select auth.uid());
  if not found then
    raise exception 'Access denied: this account has no dashboard profile' using errcode = '42501';
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
  if v_profile.role in ('admin', 'viewer') then
    return query select v_profile.role, coalesce(p_college_id, v_dept_college), p_department_id;
    return;

  elsif v_profile.role = 'dean' then
    if coalesce(p_college_id, v_dept_college, v_profile.college_id) <> v_profile.college_id then
      raise exception 'Access denied: deans can only view their own college' using errcode = '42501';
    end if;
    return query select v_profile.role, v_profile.college_id, p_department_id;
    return;

  elsif v_profile.role = 'chair' then
    select d.college_id into v_chair_college from public.departments d where d.id = v_profile.department_id;
    if (p_department_id is not null and p_department_id <> v_profile.department_id)
       or (p_college_id is not null and p_college_id <> v_chair_college) then
      raise exception 'Access denied: chairs can only view their own department' using errcode = '42501';
    end if;
    return query select v_profile.role, v_chair_college, v_profile.department_id;
    return;
  end if;

  raise exception 'Access denied: unknown role' using errcode = '42501';
end;
$$;

-- Core KPI engine: the five KPI values for a set of terms and an org scope.
create or replace function private.kpi_values(p_term_ids smallint[], p_college_id smallint, p_department_id smallint)
returns table (kpi_code text, value numeric, sample_size integer)
language sql
stable
security definer
set search_path = ''
as $$
  with params as (
    select coalesce(private.setting_value('faculty_rating_standard'), 4.00)       as standard,
           coalesce(private.setting_value('min_evaluations_reported'), 5)::int    as min_n
  ),
  f as (
    select sf.*
    from private.section_facts sf
    where sf.term_id = any (p_term_ids)
      and (p_college_id is null or sf.college_id = p_college_id)
      and (p_department_id is null or sf.department_id = p_department_id)
  ),
  totals as (
    select coalesce(sum(f.evaluations), 0)::int                  as evaluations,
           coalesce(sum(f.score_sum), 0)                         as score_sum,
           coalesce(sum(f.score_count), 0)                       as score_count,
           coalesce(sum(f.enrolled - f.dropped), 0)::int         as eligible,
           coalesce(sum(f.passed), 0)::int                       as passed,
           coalesce(sum(f.passed + f.failed), 0)::int            as graded,
           coalesce(sum(f.units * f.grade_sum), 0)               as weighted_grade_sum,
           coalesce(sum(f.units * (f.passed + f.failed)), 0)     as weighted_units
    from f
  ),
  fac as (
    select f.faculty_id,
           sum(f.score_sum) / nullif(sum(f.score_count), 0) as mean_rating,
           sum(f.evaluations)                               as n
    from f
    group by f.faculty_id
  ),
  fac_tot as (
    select count(*) filter (where fac.n >= p.min_n)::int                                     as rated,
           count(*) filter (where fac.n >= p.min_n and round(fac.mean_rating, 2) >= p.standard)::int as meeting
    from fac cross join params p
  )
  select k.kpi_code, k.value, k.sample_size
  from totals t
  cross join fac_tot ft
  cross join params p
  cross join lateral (values
    ('sete_mean',             case when t.evaluations >= p.min_n then t.score_sum / nullif(t.score_count, 0) end, t.evaluations),
    ('sete_response_rate',    100.0 * t.evaluations / nullif(t.eligible, 0),        t.eligible),
    ('pass_rate',             100.0 * t.passed / nullif(t.eligible, 0),             t.eligible),
    ('mean_gwa',              t.weighted_grade_sum / nullif(t.weighted_units, 0),   t.graded),
    ('faculty_standard_rate', 100.0 * ft.meeting / nullif(ft.rated, 0),             ft.rated)
  ) as k (kpi_code, value, sample_size);
$$;

revoke all on function private.setting_value(text) from public;
revoke all on function private.kpi_status(numeric, numeric, numeric, numeric, public.kpi_direction) from public;
revoke all on function private.resolve_targets(smallint) from public;
revoke all on function private.filter_terms(smallint, smallint) from public;
revoke all on function private.authorize_scope(smallint, smallint) from public;
revoke all on function private.kpi_values(smallint[], smallint, smallint) from public;

-- ---------------------------------------------------------------------------
-- Dashboard RPCs (callable by signed-in users only)
-- ---------------------------------------------------------------------------

-- 1) KPI cards: value, previous comparable period, target, thresholds, status.
create or replace function public.get_kpi_summary(
  p_academic_year_id smallint default null,
  p_semester_id      smallint default null,
  p_college_id       smallint default null,
  p_department_id    smallint default null)
returns table (
  kpi_code text, kpi_name text, short_name text, description text, formula text, data_source text,
  unit public.kpi_unit, direction public.kpi_direction, decimals smallint,
  value numeric, previous_value numeric, previous_label text,
  target numeric, warning_threshold numeric, critical_threshold numeric, college_specific_target boolean,
  status text, sample_size integer, sort_order smallint)
language plpgsql
stable
security definer
set search_path = ''
as $$
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
    -- previous term in chronological order
    select t.id, s.name || ' ' || ay.label as label into v_term
    from public.terms t
    join public.semesters s on s.id = t.semester_id
    join public.academic_years ay on ay.id = t.academic_year_id
    where t.start_date < (select t2.start_date from public.terms t2
                          where t2.academic_year_id = p_academic_year_id and t2.semester_id = p_semester_id)
    order by t.start_date desc
    limit 1;
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
  with cur as (select * from private.kpi_values(v_terms, v_scope.college_id, v_scope.department_id)),
       prev as (select * from private.kpi_values(v_prev_terms, v_scope.college_id, v_scope.department_id))
  select d.code, d.name, d.short_name, d.description, d.formula, d.data_source,
         d.unit, d.direction, d.decimals,
         round(cur.value, d.decimals),
         case when cardinality(v_prev_terms) > 0 then round(prev.value, d.decimals) end,
         v_prev_label,
         t.target, t.warning, t.critical, t.college_specific,
         private.kpi_status(round(cur.value, d.decimals), t.target, t.warning, t.critical, d.direction),
         cur.sample_size,
         d.sort_order
  from public.kpi_definitions d
  join cur on cur.kpi_code = d.code
  left join prev on prev.kpi_code = d.code
  join private.resolve_targets(v_scope.college_id) t on t.kpi_id = d.id
  order by d.sort_order;
end;
$$;

-- 2) Trend: KPI values for every term (optionally one semester type) in scope.
create or replace function public.get_kpi_trend(
  p_academic_year_id smallint default null,
  p_semester_id      smallint default null,
  p_college_id       smallint default null,
  p_department_id    smallint default null)
returns table (
  term_id smallint, term_label text, academic_year_label text, semester_name text, term_start date,
  in_selected_period boolean, kpi_code text, value numeric, sample_size integer)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_scope record;
begin
  select * into v_scope from private.authorize_scope(p_college_id, p_department_id);

  return query
  select t.id,
         s.code || ' ' || ay.label,
         ay.label,
         s.name,
         t.start_date,
         (p_academic_year_id is null or t.academic_year_id = p_academic_year_id),
         k.kpi_code,
         round(k.value, d.decimals),
         k.sample_size
  from public.terms t
  join public.academic_years ay on ay.id = t.academic_year_id
  join public.semesters s on s.id = t.semester_id
  cross join lateral private.kpi_values(array[t.id], v_scope.college_id, v_scope.department_id) k
  join public.kpi_definitions d on d.code = k.kpi_code
  where (p_semester_id is null or t.semester_id = p_semester_id)
  order by t.start_date, d.sort_order;
end;
$$;

-- 3) Department comparison / scorecard with per-department status.
create or replace function public.get_department_kpis(
  p_academic_year_id smallint default null,
  p_semester_id      smallint default null,
  p_college_id       smallint default null,
  p_department_id    smallint default null)
returns table (
  department_id smallint, department_code text, department_name text,
  college_id smallint, college_code text, college_name text,
  kpi_code text, value numeric, sample_size integer,
  target numeric, warning_threshold numeric, critical_threshold numeric, status text)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_scope record;
  v_terms smallint[];
begin
  select * into v_scope from private.authorize_scope(p_college_id, p_department_id);
  v_terms := private.filter_terms(p_academic_year_id, p_semester_id);

  return query
  select dp.id, dp.code, dp.name, c.id, c.code, c.name,
         k.kpi_code,
         round(k.value, kd.decimals),
         k.sample_size,
         t.target, t.warning, t.critical,
         private.kpi_status(round(k.value, kd.decimals), t.target, t.warning, t.critical, kd.direction)
  from public.departments dp
  join public.colleges c on c.id = dp.college_id
  cross join lateral private.kpi_values(v_terms, dp.college_id, dp.id) k
  join public.kpi_definitions kd on kd.code = k.kpi_code
  cross join lateral private.resolve_targets(dp.college_id) t
  where t.kpi_id = kd.id
    and (v_scope.college_id is null or dp.college_id = v_scope.college_id)
    and (v_scope.department_id is null or dp.id = v_scope.department_id)
  order by c.code, dp.code, kd.sort_order;
end;
$$;

-- 4) SETE criteria breakdown: scope mean vs institution benchmark.
create or replace function public.get_sete_criteria(
  p_academic_year_id smallint default null,
  p_semester_id      smallint default null,
  p_college_id       smallint default null,
  p_department_id    smallint default null)
returns table (
  criterion_id smallint, criterion_code text, criterion_name text, description text,
  scope_mean numeric, institution_mean numeric, responses integer)
language plpgsql
stable
security definer
set search_path = ''
as $$
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
    group by cf.criterion_id
  ),
  inst as (
    select cf.criterion_id, sum(cf.score_sum) as s, sum(cf.score_count)::int as n
    from private.section_criterion_facts cf
    join private.section_facts sf on sf.section_id = cf.section_id
    where sf.term_id = any (v_terms)
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

-- 5) Grade distribution for the scope.
create or replace function public.get_grade_distribution(
  p_academic_year_id smallint default null,
  p_semester_id      smallint default null,
  p_college_id       smallint default null,
  p_department_id    smallint default null)
returns table (band_code text, band_label text, grade_range text, sort_order integer, students integer, percentage numeric)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_scope record;
  v_terms smallint[];
begin
  select * into v_scope from private.authorize_scope(p_college_id, p_department_id);
  v_terms := private.filter_terms(p_academic_year_id, p_semester_id);

  return query
  with t as (
    select coalesce(sum(sf.g_excellent), 0)::int as g_excellent,
           coalesce(sum(sf.g_very_good), 0)::int as g_very_good,
           coalesce(sum(sf.g_good), 0)::int      as g_good,
           coalesce(sum(sf.g_passing), 0)::int   as g_passing,
           coalesce(sum(sf.failed), 0)::int      as failed,
           coalesce(sum(sf.incomplete), 0)::int  as incomplete,
           coalesce(sum(sf.dropped), 0)::int     as dropped,
           coalesce(sum(sf.enrolled), 0)::int    as total
    from private.section_facts sf
    where sf.term_id = any (v_terms)
      and (v_scope.college_id is null or sf.college_id = v_scope.college_id)
      and (v_scope.department_id is null or sf.department_id = v_scope.department_id)
  )
  select b.code, b.label, b.grade_range, b.ord, b.n,
         case when t.total > 0 then round(100.0 * b.n / t.total, 1) end
  from t
  cross join lateral (values
    ('excellent', 'Excellent',      '1.00-1.50', 1, t.g_excellent),
    ('very_good', 'Very good',      '1.75-2.25', 2, t.g_very_good),
    ('good',      'Good',           '2.50-2.75', 3, t.g_good),
    ('passing',   'Passing',        '3.00',      4, t.g_passing),
    ('failed',    'Failed',         '5.00',      5, t.failed),
    ('incomplete','Incomplete',     'INC',       6, t.incomplete),
    ('dropped',   'Dropped',        'DRP',       7, t.dropped)
  ) as b (code, label, grade_range, ord, n)
  order by b.ord;
end;
$$;

-- 6) Faculty-level SETE results (confidential: admin, dean, chair only).
create or replace function public.get_faculty_performance(
  p_academic_year_id smallint default null,
  p_semester_id      smallint default null,
  p_college_id       smallint default null,
  p_department_id    smallint default null)
returns table (
  faculty_id integer, pseudonym text, employee_no text, academic_rank text, employment_status text,
  department_code text, college_code text, sections integer, evaluations integer,
  response_rate numeric, mean_rating numeric, rating_band text,
  target numeric, warning_threshold numeric, critical_threshold numeric, status text,
  criterion_means jsonb)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_scope record;
  v_terms smallint[];
  v_min   integer;
begin
  select * into v_scope from private.authorize_scope(p_college_id, p_department_id);
  if v_scope.role not in ('admin', 'dean', 'chair') then
    raise exception 'Access denied: faculty-level SETE results are restricted to administrators, deans and department chairs'
      using errcode = '42501';
  end if;
  v_terms := private.filter_terms(p_academic_year_id, p_semester_id);
  v_min := coalesce(private.setting_value('min_evaluations_reported'), 5)::int;

  return query
  with f as (
    select sf.*
    from private.section_facts sf
    where sf.term_id = any (v_terms)
      and (v_scope.college_id is null or sf.college_id = v_scope.college_id)
      and (v_scope.department_id is null or sf.department_id = v_scope.department_id)
  ),
  agg as (
    select f.faculty_id,
           count(*)::int                                     as sections,
           sum(f.evaluations)::int                           as evaluations,
           sum(f.enrolled - f.dropped)::int                  as eligible,
           sum(f.score_sum) / nullif(sum(f.score_count), 0)  as mean_rating
    from f
    group by f.faculty_id
  ),
  crit as (
    select x.faculty_id,
           jsonb_object_agg(c.code::text, round(x.s / nullif(x.n, 0), 2)) as means
    from (
      select f.faculty_id, cf.criterion_id, sum(cf.score_sum) as s, sum(cf.score_count) as n
      from f join private.section_criterion_facts cf on cf.section_id = f.section_id
      group by f.faculty_id, cf.criterion_id
    ) x
    join public.sete_criteria c on c.id = x.criterion_id
    group by x.faculty_id
  ),
  sete_def as (select kd.id, kd.direction from public.kpi_definitions kd where kd.code = 'sete_mean')
  select fa.id,
         fa.pseudonym,
         fa.employee_no,
         fa.academic_rank,
         fa.employment_status,
         dp.code,
         co.code,
         a.sections,
         a.evaluations,
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

-- 7) Admin: restore seeded targets/thresholds and analytics settings.
create or replace function public.reset_kpi_targets()
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if not private.is_admin() then
    raise exception 'Access denied: only administrators can restore KPI targets' using errcode = '42501';
  end if;

  delete from public.kpi_targets kt
  where kt.college_id is not null
    and not exists (select 1 from private.kpi_target_baseline b
                    where b.kpi_id = kt.kpi_id and b.college_id = kt.college_id);

  insert into public.kpi_targets (kpi_id, college_id, target_value, warning_threshold, critical_threshold, notes)
  select b.kpi_id, b.college_id, b.target_value, b.warning_threshold, b.critical_threshold, b.notes
  from private.kpi_target_baseline b
  on conflict on constraint kpi_targets_kpi_college_key do update
    set target_value       = excluded.target_value,
        warning_threshold  = excluded.warning_threshold,
        critical_threshold = excluded.critical_threshold,
        notes              = excluded.notes;

  update public.analytics_settings s set value = s.default_value where s.value <> s.default_value;
end;
$$;

-- 8) Health probe for the serverless /api/health endpoint (no confidential data).
create or replace function public.app_health()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'status', 'ok',
    'database_time', now(),
    'dataset', 'synthetic-demonstration-data',
    'academic_years', (select count(*) from public.academic_years),
    'terms', (select count(*) from public.terms),
    'colleges', (select count(*) from public.colleges),
    'departments', (select count(*) from public.departments),
    'kpis', (select count(*) from public.kpi_definitions),
    'latest_term', (select s.name || ' ' || ay.label
                    from public.terms t
                    join public.semesters s on s.id = t.semester_id
                    join public.academic_years ay on ay.id = t.academic_year_id
                    order by t.start_date desc limit 1)
  );
$$;

-- ---------------------------------------------------------------------------
-- Function privileges: nothing is executable by PUBLIC/anon except the health probe.
-- ---------------------------------------------------------------------------
revoke all on function public.get_kpi_summary(smallint, smallint, smallint, smallint) from public, anon;
revoke all on function public.get_kpi_trend(smallint, smallint, smallint, smallint) from public, anon;
revoke all on function public.get_department_kpis(smallint, smallint, smallint, smallint) from public, anon;
revoke all on function public.get_sete_criteria(smallint, smallint, smallint, smallint) from public, anon;
revoke all on function public.get_grade_distribution(smallint, smallint, smallint, smallint) from public, anon;
revoke all on function public.get_faculty_performance(smallint, smallint, smallint, smallint) from public, anon;
revoke all on function public.reset_kpi_targets() from public, anon;
revoke all on function public.app_health() from public;

grant execute on function public.get_kpi_summary(smallint, smallint, smallint, smallint) to authenticated;
grant execute on function public.get_kpi_trend(smallint, smallint, smallint, smallint) to authenticated;
grant execute on function public.get_department_kpis(smallint, smallint, smallint, smallint) to authenticated;
grant execute on function public.get_sete_criteria(smallint, smallint, smallint, smallint) to authenticated;
grant execute on function public.get_grade_distribution(smallint, smallint, smallint, smallint) to authenticated;
grant execute on function public.get_faculty_performance(smallint, smallint, smallint, smallint) to authenticated;
grant execute on function public.reset_kpi_targets() to authenticated;
grant execute on function public.app_health() to anon, authenticated;

grant execute on all functions in schema public to service_role;
grant execute on all functions in schema private to service_role;
