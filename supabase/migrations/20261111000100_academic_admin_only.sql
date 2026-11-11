-- =============================================================================
-- Single-user focus: the AUTHORIZED ACADEMIC ADMINISTRATOR
-- -----------------------------------------------------------------------------
-- The dashboard now serves exactly one user type: the authorized academic
-- administrator (e.g. the Office of the Vice President for Academic Affairs /
-- quality-assurance office in the Batangas State University case study).
--
--   * Only users whose profile has role = 'admin' (labelled "Academic
--     Administrator" in the UI) can read ANY dashboard data.
--   * Every other signed-in account is "unauthorized": it has no profile, every
--     table returns 0 rows and every analytics function raises 42501.
--   * Profiles are never created automatically; an existing academic
--     administrator (or the service role) must grant access.
--   * College names follow the case-study university's college structure.
--     All data remains SYNTHETIC; this is not an official university system.
-- =============================================================================

-- 1) Case-study college structure ------------------------------------------------
update public.colleges set code = 'CICS', name = 'College of Informatics and Computing Sciences' where code = 'CCIS';
update public.colleges set code = 'COE',  name = 'College of Engineering'                       where code = 'CENG';
update public.colleges set code = 'CTE',  name = 'College of Teacher Education'                 where code = 'CTED';

-- 2) Retire the other roles ---------------------------------------------------------
-- Former dean / chair / viewer accounts lose their profile (and demo users are removed).
delete from auth.users u
using public.user_profiles p
where p.user_id = u.id and p.role <> 'admin' and p.is_demo;
delete from public.user_profiles where role <> 'admin';

alter table public.user_profiles drop constraint if exists user_profiles_check;
alter table public.user_profiles add constraint user_profiles_academic_admin_only
  check (role = 'admin' and college_id is null and department_id is null);
comment on table public.user_profiles is
  'Authorized academic administrators. A row here IS the authorization; accounts without one cannot read any dashboard data.';
comment on type public.app_role is
  'Only ''admin'' (Academic Administrator) is used. Other values are retained for migration history but rejected by user_profiles_academic_admin_only.';

-- No automatic profile: new auth users start with NO access.
drop trigger if exists on_auth_user_created on auth.users;
drop function if exists private.handle_new_auth_user();

-- 3) Row-Level Security: every dashboard table is academic-administrator only ---------
alter policy "Signed-in users can read colleges"          on public.colleges          using ((select private.is_admin()));
alter policy "Signed-in users can read departments"       on public.departments       using ((select private.is_admin()));
alter policy "Signed-in users can read programs"          on public.programs          using ((select private.is_admin()));
alter policy "Signed-in users can read academic years"    on public.academic_years    using ((select private.is_admin()));
alter policy "Signed-in users can read semesters"         on public.semesters         using ((select private.is_admin()));
alter policy "Signed-in users can read terms"             on public.terms             using ((select private.is_admin()));
alter policy "Signed-in users can read courses"           on public.courses           using ((select private.is_admin()));
alter policy "Signed-in users can read SETE criteria"     on public.sete_criteria     using ((select private.is_admin()));
alter policy "Signed-in users can read rating scale"      on public.sete_rating_scale using ((select private.is_admin()));
alter policy "Signed-in users can read KPI definitions"   on public.kpi_definitions   using ((select private.is_admin()));
alter policy "Signed-in users can read KPI targets"       on public.kpi_targets       using ((select private.is_admin()));
alter policy "Signed-in users can read analytics settings" on public.analytics_settings using ((select private.is_admin()));

alter policy "Signed-in users can read colleges"          on public.colleges          rename to "Academic admins can read colleges";
alter policy "Signed-in users can read departments"       on public.departments       rename to "Academic admins can read departments";
alter policy "Signed-in users can read programs"          on public.programs          rename to "Academic admins can read programs";
alter policy "Signed-in users can read academic years"    on public.academic_years    rename to "Academic admins can read academic years";
alter policy "Signed-in users can read semesters"         on public.semesters         rename to "Academic admins can read semesters";
alter policy "Signed-in users can read terms"             on public.terms             rename to "Academic admins can read terms";
alter policy "Signed-in users can read courses"           on public.courses           rename to "Academic admins can read courses";
alter policy "Signed-in users can read SETE criteria"     on public.sete_criteria     rename to "Academic admins can read SETE criteria";
alter policy "Signed-in users can read rating scale"      on public.sete_rating_scale rename to "Academic admins can read rating scale";
alter policy "Signed-in users can read KPI definitions"   on public.kpi_definitions   rename to "Academic admins can read KPI definitions";
alter policy "Signed-in users can read KPI targets"       on public.kpi_targets       rename to "Academic admins can read KPI targets";
alter policy "Signed-in users can read analytics settings" on public.analytics_settings rename to "Academic admins can read analytics settings";

alter policy "Scoped users can read faculty"                on public.faculty        using ((select private.is_admin()));
alter policy "Scoped users can read students"               on public.students       using ((select private.is_admin()));
alter policy "Scoped users can read class sections"         on public.class_sections using ((select private.is_admin()));
alter policy "Scoped users can read enrollments and grades" on public.enrollments    using ((select private.is_admin()));
alter policy "Scoped users can read faculty"                on public.faculty        rename to "Academic admins can read faculty";
alter policy "Scoped users can read students"               on public.students       rename to "Academic admins can read students";
alter policy "Scoped users can read class sections"         on public.class_sections rename to "Academic admins can read class sections";
alter policy "Scoped users can read enrollments and grades" on public.enrollments    rename to "Academic admins can read enrollments and grades";

alter policy "Admins can read SETE evaluations" on public.sete_evaluations rename to "Academic admins can read SETE evaluations";
alter policy "Admins can read SETE scores"      on public.sete_scores      rename to "Academic admins can read SETE scores";

drop function if exists private.accessible_section_ids();
drop function if exists private.accessible_department_ids();

-- 4) Analytics functions: one gate, academic administrators only ---------------------
create or replace function private.authorize_scope(p_college_id smallint, p_department_id smallint)
returns table (role public.app_role, college_id smallint, department_id smallint)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_dept_college smallint;
begin
  if not private.is_admin() then
    raise exception 'Access denied: only authorized academic administrators can view this dashboard'
      using errcode = '42501';
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

  return query select 'admin'::public.app_role, coalesce(p_college_id, v_dept_college), p_department_id;
end;
$$;
revoke all on function private.authorize_scope(smallint, smallint) from public;

-- 5) Case-study KPI design (Part II): category, objective, management actions -------
-- Each KPI documents its objective, its formula (existing column), its target
-- (kpi_targets) and the management action triggered at each warning threshold.
alter table public.kpi_definitions
  add column if not exists category text check (category in ('Academic operations', 'Teaching effectiveness')),
  add column if not exists objective text,
  add column if not exists warning_action text,
  add column if not exists critical_action text;

comment on column public.kpi_definitions.warning_action  is 'Management action when the KPI crosses its WARNING threshold.';
comment on column public.kpi_definitions.critical_action is 'Management action when the KPI crosses its CRITICAL threshold.';

create or replace function private.apply_kpi_metadata()
returns void
language sql
security definer
set search_path = ''
as $$
  update public.kpi_definitions d set
    category = m.category, objective = m.objective, data_source = m.data_source,
    warning_action = m.warning_action, critical_action = m.critical_action, description = coalesce(m.description, d.description)
  from (values
    ('sete_mean', 'Teaching effectiveness',
     'Monitor the overall quality of instruction as perceived by students, across the four SETE criteria.',
     'SETE: Student Evaluation of Teaching Effectiveness (synthetic)',
     'Program chair reviews the SETE criteria breakdown with the faculty concerned and plans targeted faculty development (workshops, peer mentoring).',
     'Dean-led instructional review that combines SETE with peer/classroom observation, course outcomes and the response rate before any conclusion is drawn; agree on a development plan.',
     'Average rating students gave their teachers across the four SETE criteria (1 = poor, 5 = outstanding). One source of evidence only: read it together with the response rate and other evidence. Results built from too few responses are suppressed to protect anonymity.'),
    ('sete_response_rate', 'Teaching effectiveness',
     'Make sure SETE results are representative enough to be interpreted responsibly.',
     'SETE submissions + enrolment records from the Student and Faculty Portal (synthetic)',
     'Send portal reminders, extend the evaluation window and allot class time for evaluation; mark affected SETE results as low-confidence.',
     'Treat SETE results for the scope as inconclusive; investigate access or awareness problems and do not use them for performance decisions this term.',
     null),
    ('pass_rate', 'Academic operations',
     'Monitor student success in their enrolled courses and detect courses or programs where students struggle.',
     'Final grades from the Student and Faculty Portal (synthetic)',
     'Program chair reviews course assessments and grade distribution; offer tutorial / remedial sessions and early academic advising.',
     'Academic-affairs review of the program: curriculum and prerequisite check, retention and intervention plan for at-risk students.',
     null),
    ('mean_gwa', 'Academic operations',
     'Track overall academic achievement (General Weighted Average; 1.00 is the highest grade).',
     'Final grades and course units from the Student and Faculty Portal (synthetic)',
     'Review grading consistency and student-support services with the program chairs concerned.',
     'Program-level academic intervention: learning-support programs, review of admission/readiness and course sequencing.',
     null),
    ('faculty_standard_rate', 'Teaching effectiveness',
     'Measure the share of faculty consistently meeting the institutional teaching standard, to plan faculty development.',
     'SETE: Student Evaluation of Teaching Effectiveness (synthetic)',
     'Prioritise faculty-development programs on the weakest SETE criterion; pair faculty with mentors.',
     'College-wide teaching-improvement plan with the dean, using SETE together with peer observation and teaching portfolios.',
     null)
  ) as m (code, category, objective, data_source, warning_action, critical_action, description)
  where d.code = m.code;
$$;
revoke all on function private.apply_kpi_metadata() from public;

select private.apply_kpi_metadata();

comment on table public.sete_evaluations is
  'One anonymous SETE (Student Evaluation of Teaching Effectiveness) form. Deliberately stores no student identifier.';
