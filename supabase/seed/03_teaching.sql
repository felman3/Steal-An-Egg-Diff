-- =============================================================================
-- SYNTHETIC DEMONSTRATION DATA (3/5): class sections and final grades
-- Each block section takes the 5 courses for its year level and semester.
-- =============================================================================

with blocks as (
  select distinct p.department_id, st.entry_year, st.block_no
  from public.students st
  join public.programs p on p.id = st.program_id
),
offerings as (
  select t.id as term_id, t.semester_id, t.grade_deadline, ay.start_year,
         b.department_id, b.entry_year, b.block_no,
         ay.start_year - b.entry_year + 1 as year_level
  from public.terms t
  join public.academic_years ay on ay.id = t.academic_year_id
  join blocks b on ay.start_year - b.entry_year + 1 between 1 and 4
),
sections as (
  select o.term_id, o.grade_deadline, c.id as course_id, o.department_id,
         d.code || '-' || o.year_level || lpad(o.block_no::text, 2, '0') as section_code,
         row_number() over (partition by o.term_id, o.department_id order by c.code, o.block_no) as rn
  from offerings o
  join public.courses c
    on c.department_id = o.department_id and c.year_level = o.year_level and c.semester_id = o.semester_id
  join public.departments d on d.id = o.department_id
),
fac as (
  select f.id, f.department_id,
         row_number() over (partition by f.department_id order by f.id) - 1 as idx,
         count(*) over (partition by f.department_id) as n
  from public.faculty f
)
insert into public.class_sections (term_id, course_id, faculty_id, section_code, grades_submitted_on)
select s.term_id,
       s.course_id,
       fac.id,
       s.section_code,
       s.grade_deadline + (floor(private.seed_rand('gsub:' || s.term_id || ':' || s.course_id || ':' || s.section_code) * 18)::int - 10)
from sections s
join fac on fac.department_id = s.department_id
        and fac.idx = (s.rn + s.term_id * 3) % fac.n;

-- @@split

-- Final grades. Latent performance combines student ability, section difficulty,
-- a small teacher effect, a gentle improvement trend and noise; it is then
-- mapped to the 1.00-3.00 / 5.00 grading scale. Students may leave the
-- programme after a year level (attrition), drop a course or receive INC.
insert into public.enrollments (section_id, student_id, final_grade, remark)
select x.section_id,
       x.student_id,
       case x.remark
         when 'failed' then 5.00
         when 'passed' then
           case when x.perf >= 1.90 then 1.00
                when x.perf >= 1.45 then 1.25
                when x.perf >= 1.00 then 1.50
                when x.perf >= 0.55 then 1.75
                when x.perf >= 0.15 then 2.00
                when x.perf >= -0.25 then 2.25
                when x.perf >= -0.65 then 2.50
                when x.perf >= -1.05 then 2.75
                else 3.00 end
       end,
       x.remark::public.grade_remark
from (
  select y.*,
         case when y.drop_r < y.drop_rate then 'dropped'
              when y.inc_r < 0.015 then 'incomplete'
              when y.perf < -1.45 then 'failed'
              else 'passed' end as remark
  from (
    select cs.id as section_id,
           st.id as student_id,
           sp.drop_rate,
           private.seed_rand('drop:' || cs.id || ':' || st.id) as drop_r,
           private.seed_rand('inc:'  || cs.id || ':' || st.id) as inc_r,
           0.25
             + 0.85 * private.seed_normal('ability:' || st.id)
             - (sp.difficulty + 0.30 * private.seed_normal('secdiff:' || cs.id))
             + 0.18 * private.seed_normal('facq:' || cs.faculty_id)
             + 0.05 * (ay.start_year - 2022)
             + 0.55 * private.seed_normal('enr:' || cs.id || ':' || st.id) as perf
    from public.class_sections cs
    join public.terms t on t.id = cs.term_id
    join public.academic_years ay on ay.id = t.academic_year_id
    join public.courses c on c.id = cs.course_id
    join public.departments d on d.id = c.department_id
    join private.seed_dept_params sp on sp.dept_code = d.code
    join public.programs p on p.department_id = d.id
    join public.students st
      on st.program_id = p.id
     and st.entry_year = ay.start_year - c.year_level + 1
     and st.block_no = right(cs.section_code, 2)::int
    cross join lateral (select private.seed_rand('exit:' || st.id) as r) ex
    where c.year_level <= case when ex.r < 0.07 then 1
                               when ex.r < 0.12 then 2
                               when ex.r < 0.15 then 3
                               else 4 end
  ) y
) x;
