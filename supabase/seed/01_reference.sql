-- =============================================================================
-- SYNTHETIC DEMONSTRATION DATA (1/5): reference data, KPI targets, settings
-- No real students, faculty, grades or evaluations are represented anywhere.
-- College names mirror the case-study university's structure; every person,
-- grade and evaluation is synthetic. Not an official university data source.
-- =============================================================================

-- Deterministic pseudo-random helpers used only while seeding (dropped in 05).
-- Uniform [0,1) from a stable 64-bit hash of the key; normal(0,1) via Box-Muller.
-- No SET clause on purpose: that would block inlining and make seeding ~100x
-- slower. They only call pg_catalog built-ins, which always resolve first.
create or replace function private.seed_rand(p_key text)
returns double precision
language sql immutable parallel safe
as $$
  select (hashtextextended(p_key, 20261106) & 4503599627370495)::double precision / 4503599627370496.0
$$;

create or replace function private.seed_normal(p_key text)
returns double precision
language sql immutable parallel safe
as $$
  select sqrt(-2.0 * ln(greatest(private.seed_rand(p_key || '#u1'), 1e-12)))
         * cos(2.0 * pi() * private.seed_rand(p_key || '#u2'))
$$;

insert into public.semesters (id, code, name, sort_order) values
  (1, '1st Sem', '1st Semester', 1),
  (2, '2nd Sem', '2nd Semester', 2);

insert into public.academic_years (start_year, label, start_date, end_date)
select y, y || '-' || (y + 1), make_date(y, 8, 1), make_date(y + 1, 7, 31)
from generate_series(2022, 2025) as y;

insert into public.terms (academic_year_id, semester_id, start_date, end_date, sete_open_date, sete_close_date, grade_deadline)
select ay.id, s.id,
       case s.id when 1 then make_date(ay.start_year, 8, 18)     else make_date(ay.start_year + 1, 1, 12) end,
       case s.id when 1 then make_date(ay.start_year, 12, 19)    else make_date(ay.start_year + 1, 5, 22) end,
       case s.id when 1 then make_date(ay.start_year, 11, 24)    else make_date(ay.start_year + 1, 4, 27) end,
       case s.id when 1 then make_date(ay.start_year, 12, 12)    else make_date(ay.start_year + 1, 5, 15) end,
       case s.id when 1 then make_date(ay.start_year + 1, 1, 9)  else make_date(ay.start_year + 1, 6, 12) end
from public.academic_years ay
cross join public.semesters s;

insert into public.colleges (code, name) values
  ('CICS', 'College of Informatics and Computing Sciences'),
  ('COE',  'College of Engineering'),
  ('CAS',  'College of Arts and Sciences'),
  ('CTE',  'College of Teacher Education');

insert into public.departments (college_id, code, name, established_year)
select c.id, d.code, d.name, d.est
from (values
  ('CICS', 'CS',   'Department of Computer Science',        2001),
  ('CICS', 'IT',   'Department of Information Technology',  2003),
  ('CICS', 'DS',   'Department of Data Science',            2024),
  ('COE',  'CE',   'Department of Civil Engineering',       1985),
  ('COE',  'EE',   'Department of Electrical Engineering',  1987),
  ('COE',  'ME',   'Department of Mechanical Engineering',  1990),
  ('CAS',  'MATH', 'Department of Mathematics',             1978),
  ('CAS',  'PSY',  'Department of Psychology',              1995),
  ('CAS',  'COMM', 'Department of Communication',           1998),
  ('CTE',  'ELED', 'Department of Elementary Education',    1975),
  ('CTE',  'SEED', 'Department of Secondary Education',     1975)
) as d (college_code, code, name, est)
join public.colleges c on c.code = d.college_code;

insert into public.programs (department_id, code, name)
select d.id, p.code, p.name
from (values
  ('CS',   'BSCS',    'Bachelor of Science in Computer Science'),
  ('IT',   'BSIT',    'Bachelor of Science in Information Technology'),
  ('DS',   'BSDS',    'Bachelor of Science in Data Science'),
  ('CE',   'BSCE',    'Bachelor of Science in Civil Engineering'),
  ('EE',   'BSEE',    'Bachelor of Science in Electrical Engineering'),
  ('ME',   'BSME',    'Bachelor of Science in Mechanical Engineering'),
  ('MATH', 'BSMath',  'Bachelor of Science in Mathematics'),
  ('PSY',  'BSPsych', 'Bachelor of Science in Psychology'),
  ('COMM', 'BAComm',  'Bachelor of Arts in Communication'),
  ('ELED', 'BEEd',    'Bachelor of Elementary Education'),
  ('SEED', 'BSEd',    'Bachelor of Secondary Education')
) as p (dept, code, name)
join public.departments d on d.code = p.dept;

-- 5 courses per year level and semester for every department (synthetic titles).
insert into public.courses (department_id, code, title, units, year_level, semester_id)
select d.id,
       d.code || ' ' || y || s || lpad(n::text, 2, '0'),
       replace(d.name, 'Department of ', '') || ' '
         || (array['Core Lecture', 'Laboratory', 'Professional Course', 'Methods and Research', 'Integrative Seminar'])[n]
         || ' ' || y || '-' || s,
       (array[3.0, 2.0, 3.0, 3.0, 2.0])[n],
       y, s
from public.departments d
cross join generate_series(1, 4) as y
cross join generate_series(1, 2) as s
cross join generate_series(1, 5) as n;

insert into public.sete_criteria (id, code, name, description, sort_order) values
  (1, 'A', 'Commitment',
      'Sensitivity to students, availability for consultation, punctuality and fair, prompt feedback.', 1),
  (2, 'B', 'Knowledge of Subject',
      'Mastery of the subject matter and the ability to relate it to current developments and practice.', 2),
  (3, 'C', 'Teaching for Independent Learning',
      'Strategies that build self-direction, critical thinking and responsibility for one''s own learning.', 3),
  (4, 'D', 'Management of Learning',
      'Structuring the learning environment, encouraging interaction and using materials effectively.', 4);

insert into public.sete_rating_scale (id, label, min_score, max_score, sort_order) values
  (1, 'Outstanding',       4.50, 5.00, 1),
  (2, 'Very Satisfactory', 4.00, 4.49, 2),
  (3, 'Satisfactory',      3.50, 3.99, 3),
  (4, 'Fair',              3.00, 3.49, 4),
  (5, 'Needs Improvement', 1.00, 2.99, 5);

insert into public.kpi_definitions
  (id, code, name, short_name, description, formula, unit, direction, decimals, data_source, min_value, max_value, sort_order)
values
  (1, 'sete_mean', 'Mean SETE Rating', 'SETE rating',
   'Average rating students gave their teachers across the four SETE criteria (1 = poor, 5 = outstanding). Results built from too few responses are suppressed to protect anonymity.',
   'Sum of all criterion scores / number of criterion scores',
   'rating', 'higher_is_better', 2, 'SETE responses (synthetic)', 1, 5, 1),
  (2, 'sete_response_rate', 'SETE Response Rate', 'Response rate',
   'Share of eligible enrolments (officially dropped excluded) for which an evaluation was submitted. Low participation makes SETE results less representative.',
   'Evaluations submitted / eligible enrolments x 100',
   'percent', 'higher_is_better', 1, 'SETE responses and enrolment records (synthetic)', 0, 100, 2),
  (3, 'pass_rate', 'Course Pass Rate', 'Pass rate',
   'Share of eligible enrolments (officially dropped excluded) that earned a passing final grade of 1.00-3.00. Failed (5.00) and incomplete (INC) count against the rate.',
   'Passing final grades / eligible enrolments x 100',
   'percent', 'higher_is_better', 1, 'Final grades (synthetic student records)', 0, 100, 3),
  (4, 'mean_gwa', 'Mean General Weighted Average', 'Mean GWA',
   'Unit-weighted average of numeric final grades on the 1.00 (highest) to 5.00 (failed) scale. Lower is better.',
   'Sum(final grade x course units) / Sum(course units), graded enrolments only',
   'grade', 'lower_is_better', 2, 'Final grades (synthetic student records)', 1, 5, 4),
  (5, 'faculty_standard_rate', 'Faculty Meeting SETE Standard', 'Faculty at standard',
   'Share of evaluated faculty whose mean SETE rating is at or above the institutional standard (see analytics settings). Faculty with too few responses are excluded.',
   'Faculty with mean rating >= standard / faculty with enough responses x 100',
   'percent', 'higher_is_better', 1, 'SETE responses (synthetic)', 0, 100, 5);

insert into private.kpi_target_baseline (kpi_id, college_id, target_value, warning_threshold, critical_threshold, notes)
select k.id, c.id, v.target, v.warning, v.critical, v.notes
from (values
  ('sete_mean',             null,   4.30, 4.10, 3.90, 'Institution-wide standard'),
  ('sete_response_rate',    null,   90,   80,   70,   'Institution-wide standard'),
  ('pass_rate',             null,   93,   88,   83,   'Institution-wide standard'),
  ('mean_gwa',              null,   2.00, 2.20, 2.40, 'Institution-wide standard (lower is better)'),
  ('faculty_standard_rate', null,   90,   80,   70,   'Institution-wide standard'),
  ('pass_rate',             'COE',  88,   83,   78,   'Licensure-exam programs: differentiated target'),
  ('mean_gwa',              'COE',  2.20, 2.40, 2.60, 'Licensure-exam programs: differentiated target')
) as v (kpi, college, target, warning, critical, notes)
join public.kpi_definitions k on k.code = v.kpi
left join public.colleges c on c.code = v.college;

insert into public.kpi_targets (kpi_id, college_id, target_value, warning_threshold, critical_threshold, notes)
select kpi_id, college_id, target_value, warning_threshold, critical_threshold, notes
from private.kpi_target_baseline;

insert into public.analytics_settings (key, value, default_value, min_value, max_value, label, description) values
  ('faculty_rating_standard', 4.00, 4.00, 1.00, 5.00, 'Faculty SETE standard',
   'Minimum mean SETE rating for a faculty member to count as meeting the institutional standard.'),
  ('min_evaluations_reported', 5, 5, 1, 50, 'Minimum responses before reporting',
   'SETE averages built from fewer responses than this are suppressed to protect respondent anonymity.');
