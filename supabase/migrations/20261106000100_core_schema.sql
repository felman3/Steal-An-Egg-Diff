-- =============================================================================
-- Academic & SETE Analytics Dashboard -- core relational schema
-- -----------------------------------------------------------------------------
-- ACADEMIC PROTOTYPE. Every row loaded into these tables is synthetic
-- demonstration data. This schema is NOT connected to any official university
-- Student and Faculty Portal or SETE system.
--
-- Normalisation notes (3NF):
--   * Organisation hierarchy: colleges 1--* departments 1--* programs.
--   * Calendar: academic_years 1--* terms *--1 semesters.
--   * Teaching: courses (owned by a department) are offered as class_sections
--     in a term and taught by one faculty member.
--   * Grades live on enrollments (student x section).
--   * SETE responses are anonymous: sete_evaluations carry NO student id; each
--     evaluation has one score per criterion in sete_scores.
--   * KPI metadata, targets and alert thresholds are data (kpi_definitions,
--     kpi_targets, analytics_settings), never hard-coded in the client.
-- =============================================================================

create schema if not exists private;
comment on schema private is
  'Internal helper functions and analytics materialized views. Not exposed through the Supabase Data API.';
revoke all on schema private from public;

-- ---------------------------------------------------------------------------
-- Enumerated types
-- ---------------------------------------------------------------------------
create type public.app_role as enum ('admin', 'dean', 'chair', 'viewer');
comment on type public.app_role is
  'admin = QA office (all data); dean = one college; chair = one department; viewer = aggregate KPIs only.';

create type public.grade_remark as enum ('passed', 'failed', 'incomplete', 'dropped');
create type public.kpi_direction as enum ('higher_is_better', 'lower_is_better');
create type public.kpi_unit as enum ('rating', 'percent', 'grade');

-- ---------------------------------------------------------------------------
-- Organisation
-- ---------------------------------------------------------------------------
create table public.colleges (
  id          smallint generated always as identity primary key,
  code        text not null unique check (code ~ '^[A-Z]{2,8}$'),
  name        text not null unique check (length(name) between 3 and 120),
  created_at  timestamptz not null default now()
);
comment on table public.colleges is 'Academic colleges (synthetic).';

create table public.departments (
  id                smallint generated always as identity primary key,
  college_id        smallint not null references public.colleges (id) on update cascade on delete restrict,
  code              text not null unique check (code ~ '^[A-Z]{2,8}$'),
  name              text not null check (length(name) between 3 and 120),
  established_year  smallint not null check (established_year between 1900 and 2100),
  created_at        timestamptz not null default now(),
  unique (college_id, name)
);
create index departments_college_id_idx on public.departments (college_id);
comment on table public.departments is 'Departments within a college (synthetic).';

create table public.programs (
  id             smallint generated always as identity primary key,
  department_id  smallint not null references public.departments (id) on update cascade on delete restrict,
  code           text not null unique check (code ~ '^[A-Za-z]{3,12}$'),
  name           text not null check (length(name) between 3 and 160)
);
create index programs_department_id_idx on public.programs (department_id);
comment on table public.programs is 'Degree programs offered by a department (synthetic).';

-- ---------------------------------------------------------------------------
-- Academic calendar
-- ---------------------------------------------------------------------------
create table public.academic_years (
  id          smallint generated always as identity primary key,
  start_year  smallint not null unique check (start_year between 2000 and 2100),
  label       text not null unique,
  start_date  date not null,
  end_date    date not null,
  check (end_date > start_date),
  check (label = start_year::text || '-' || (start_year + 1)::text)
);
comment on table public.academic_years is 'Academic years, e.g. 2025-2026.';

create table public.semesters (
  id          smallint primary key,
  code        text not null unique,
  name        text not null unique,
  sort_order  smallint not null unique
);
comment on table public.semesters is 'Semester lookup (1st Semester, 2nd Semester).';

create table public.terms (
  id                smallint generated always as identity primary key,
  academic_year_id  smallint not null references public.academic_years (id) on update cascade on delete restrict,
  semester_id       smallint not null references public.semesters (id) on update cascade on delete restrict,
  start_date        date not null,
  end_date          date not null,
  sete_open_date    date not null,
  sete_close_date   date not null,
  grade_deadline    date not null,
  unique (academic_year_id, semester_id),
  check (end_date > start_date),
  check (sete_open_date <= sete_close_date),
  check (sete_open_date between start_date and end_date),
  check (grade_deadline >= end_date)
);
create index terms_semester_id_idx on public.terms (semester_id);
comment on table public.terms is 'One semester of one academic year; the unit SETE evaluations and grades are reported in.';

-- ---------------------------------------------------------------------------
-- People (synthetic, pseudonymous)
-- ---------------------------------------------------------------------------
create table public.faculty (
  id                 integer generated always as identity primary key,
  employee_no        text not null unique check (employee_no ~ '^SYN-F-[0-9]{4}$'),
  pseudonym          text not null unique,
  department_id      smallint not null references public.departments (id) on update cascade on delete restrict,
  academic_rank      text not null check (academic_rank in ('Instructor', 'Assistant Professor', 'Associate Professor', 'Professor')),
  employment_status  text not null check (employment_status in ('Permanent', 'Temporary', 'Part-time')),
  hired_on           date not null,
  created_at         timestamptz not null default now()
);
create index faculty_department_id_idx on public.faculty (department_id);
comment on table public.faculty is
  'Synthetic teaching staff. Names are deliberately pseudonymous (e.g. "Faculty CS-07") so no real person can be identified.';

create table public.students (
  id          integer generated always as identity primary key,
  student_no  text not null unique check (student_no ~ '^SYN-[0-9]{4}-[0-9]{5}$'),
  program_id  smallint not null references public.programs (id) on update cascade on delete restrict,
  entry_year  smallint not null check (entry_year between 2000 and 2100),
  block_no    smallint not null check (block_no between 1 and 9),
  sex         char(1) not null check (sex in ('F', 'M')),
  created_at  timestamptz not null default now()
);
create index students_program_cohort_idx on public.students (program_id, entry_year, block_no);
comment on table public.students is 'Synthetic students identified only by a synthetic student number.';

-- ---------------------------------------------------------------------------
-- Curriculum and teaching
-- ---------------------------------------------------------------------------
create table public.courses (
  id             integer generated always as identity primary key,
  department_id  smallint not null references public.departments (id) on update cascade on delete restrict,
  code           text not null unique,
  title          text not null,
  units          numeric(3, 1) not null check (units > 0 and units <= 6),
  year_level     smallint not null check (year_level between 1 and 5),
  semester_id    smallint not null references public.semesters (id) on update cascade on delete restrict
);
create index courses_department_id_idx on public.courses (department_id);
create index courses_semester_id_idx on public.courses (semester_id);

create table public.class_sections (
  id                   integer generated always as identity primary key,
  term_id              smallint not null references public.terms (id) on update cascade on delete restrict,
  course_id            integer not null references public.courses (id) on update cascade on delete restrict,
  faculty_id           integer not null references public.faculty (id) on update cascade on delete restrict,
  section_code         text not null,
  grades_submitted_on  date,
  unique (term_id, course_id, section_code)
);
create index class_sections_course_id_idx on public.class_sections (course_id);
create index class_sections_faculty_id_idx on public.class_sections (faculty_id);
comment on table public.class_sections is 'A course offered in a term to one block section, taught by one faculty member.';

create table public.enrollments (
  id           bigint generated always as identity primary key,
  section_id   integer not null references public.class_sections (id) on update cascade on delete cascade,
  student_id   integer not null references public.students (id) on update cascade on delete restrict,
  final_grade  numeric(3, 2),
  remark       public.grade_remark not null,
  unique (section_id, student_id),
  check (final_grade is null or final_grade in (1.00, 1.25, 1.50, 1.75, 2.00, 2.25, 2.50, 2.75, 3.00, 5.00)),
  check (
       (remark = 'passed'     and final_grade between 1.00 and 3.00)
    or (remark = 'failed'     and final_grade = 5.00)
    or (remark in ('incomplete', 'dropped') and final_grade is null)
  )
);
create index enrollments_student_id_idx on public.enrollments (student_id);
comment on table public.enrollments is
  'Final grades on the 1.00 (highest) to 3.00 (passing) scale; 5.00 = failed; INC/DRP have no numeric grade.';

-- ---------------------------------------------------------------------------
-- SETE: Student Evaluation of Teaching Effectiveness (anonymous)
-- ---------------------------------------------------------------------------
create table public.sete_criteria (
  id           smallint primary key,
  code         char(1) not null unique,
  name         text not null unique,
  description  text not null,
  sort_order   smallint not null unique
);
comment on table public.sete_criteria is 'SETE instrument criteria (A-D), each rated 1-5.';

create table public.sete_rating_scale (
  id          smallint primary key,
  label       text not null unique,
  min_score   numeric(3, 2) not null check (min_score between 1 and 5),
  max_score   numeric(3, 2) not null check (max_score between 1 and 5),
  sort_order  smallint not null unique,
  check (min_score < max_score)
);
comment on table public.sete_rating_scale is 'Descriptive interpretation bands for mean SETE ratings.';

create table public.sete_evaluations (
  id            bigint generated always as identity primary key,
  section_id    integer not null references public.class_sections (id) on update cascade on delete cascade,
  submitted_at  timestamptz not null
);
create index sete_evaluations_section_id_idx on public.sete_evaluations (section_id);
comment on table public.sete_evaluations is
  'One anonymous evaluation form. Deliberately stores no student identifier to protect respondent anonymity.';

create table public.sete_scores (
  evaluation_id  bigint not null references public.sete_evaluations (id) on update cascade on delete cascade,
  criterion_id   smallint not null references public.sete_criteria (id) on update cascade on delete restrict,
  score          numeric(3, 2) not null check (score between 1 and 5),
  primary key (evaluation_id, criterion_id)
);
create index sete_scores_criterion_id_idx on public.sete_scores (criterion_id);
comment on table public.sete_scores is 'Mean of the items in one criterion for one evaluation (1-5).';

-- ---------------------------------------------------------------------------
-- Users, roles and scopes
-- ---------------------------------------------------------------------------
create table public.user_profiles (
  user_id        uuid primary key references auth.users (id) on delete cascade,
  full_name      text not null check (length(full_name) between 1 and 120),
  role           public.app_role not null default 'viewer',
  college_id     smallint references public.colleges (id) on update cascade on delete restrict,
  department_id  smallint references public.departments (id) on update cascade on delete restrict,
  title          text,
  is_demo        boolean not null default false,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  -- Scope must match the role (a chair's college is derived from the department).
  check (
       (role in ('admin', 'viewer') and college_id is null and department_id is null)
    or (role = 'dean'  and college_id is not null and department_id is null)
    or (role = 'chair' and college_id is null and department_id is not null)
  )
);
create index user_profiles_college_id_idx on public.user_profiles (college_id);
create index user_profiles_department_id_idx on public.user_profiles (department_id);
comment on table public.user_profiles is 'Dashboard role and data scope for each Supabase Auth user.';

-- ---------------------------------------------------------------------------
-- KPI metadata, targets and alert thresholds
-- ---------------------------------------------------------------------------
create table public.kpi_definitions (
  id           smallint primary key,
  code         text not null unique check (code ~ '^[a-z_]{3,40}$'),
  name         text not null unique,
  short_name   text not null,
  description  text not null,
  formula      text not null,
  unit         public.kpi_unit not null,
  direction    public.kpi_direction not null,
  decimals     smallint not null default 2 check (decimals between 0 and 4),
  data_source  text not null,
  min_value    numeric(6, 3) not null,
  max_value    numeric(6, 3) not null,
  sort_order   smallint not null unique,
  check (min_value < max_value)
);
comment on table public.kpi_definitions is 'The five dashboard KPIs: meaning, formula, unit and which direction is good.';

create table public.kpi_targets (
  id                  integer generated always as identity primary key,
  kpi_id              smallint not null references public.kpi_definitions (id) on update cascade on delete cascade,
  college_id          smallint references public.colleges (id) on update cascade on delete cascade,
  target_value        numeric(6, 3) not null,
  warning_threshold   numeric(6, 3) not null,
  critical_threshold  numeric(6, 3) not null,
  notes               text check (notes is null or length(notes) <= 500),
  updated_at          timestamptz not null default now(),
  updated_by          uuid references public.user_profiles (user_id) on delete set null,
  -- One institution-wide default (college_id is null) plus at most one override per college.
  constraint kpi_targets_kpi_college_key unique nulls not distinct (kpi_id, college_id)
);
create index kpi_targets_college_id_idx on public.kpi_targets (college_id);
create index kpi_targets_updated_by_idx on public.kpi_targets (updated_by);
comment on table public.kpi_targets is
  'Target and alert thresholds per KPI. college_id NULL = institution default; non-null = college override.';

create table public.kpi_target_audit (
  id             bigint generated always as identity primary key,
  kpi_target_id  integer,
  kpi_id         smallint not null references public.kpi_definitions (id) on update cascade on delete cascade,
  college_id     smallint references public.colleges (id) on update cascade on delete set null,
  action         text not null check (action in ('INSERT', 'UPDATE', 'DELETE')),
  old_values     jsonb,
  new_values     jsonb,
  changed_by     uuid references public.user_profiles (user_id) on delete set null,
  changed_at     timestamptz not null default now()
);
create index kpi_target_audit_kpi_id_idx on public.kpi_target_audit (kpi_id);
create index kpi_target_audit_college_id_idx on public.kpi_target_audit (college_id);
create index kpi_target_audit_changed_by_idx on public.kpi_target_audit (changed_by);
create index kpi_target_audit_changed_at_idx on public.kpi_target_audit (changed_at desc);
comment on table public.kpi_target_audit is 'Append-only history of every change to KPI targets/thresholds.';

create table public.analytics_settings (
  key            text primary key check (key ~ '^[a-z_]{3,60}$'),
  value          numeric(8, 3) not null,
  default_value  numeric(8, 3) not null,
  min_value      numeric(8, 3) not null,
  max_value      numeric(8, 3) not null,
  label          text not null,
  description    text not null,
  updated_at     timestamptz not null default now(),
  updated_by     uuid references public.user_profiles (user_id) on delete set null,
  check (min_value <= max_value),
  check (value between min_value and max_value),
  check (default_value between min_value and max_value)
);
create index analytics_settings_updated_by_idx on public.analytics_settings (updated_by);
comment on table public.analytics_settings is
  'Tunable analytic parameters (faculty rating standard, minimum responses before results are reported).';

-- Baseline copy of the seeded targets, used by the admin "restore defaults" action.
create table private.kpi_target_baseline (
  kpi_id              smallint not null references public.kpi_definitions (id) on delete cascade,
  college_id          smallint references public.colleges (id) on delete cascade,
  target_value        numeric(6, 3) not null,
  warning_threshold   numeric(6, 3) not null,
  critical_threshold  numeric(6, 3) not null,
  notes               text,
  constraint kpi_target_baseline_key unique nulls not distinct (kpi_id, college_id)
);
