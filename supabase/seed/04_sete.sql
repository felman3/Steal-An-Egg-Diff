-- =============================================================================
-- SYNTHETIC DEMONSTRATION DATA (4/5): anonymous SETE evaluations
-- Number of forms per section = eligible students x a section response rate.
-- Each form scores the four criteria; scores are multiples of 0.2 (the mean of
-- five 1-5 Likert items) clamped to 1.00-5.00. No student identifiers stored.
-- =============================================================================

insert into public.sete_evaluations (section_id, submitted_at)
select sec.section_id,
       ((sec.sete_open_date
          + floor(private.seed_rand('evd:' || sec.section_id || ':' || g.n)
                  * (sec.sete_close_date - sec.sete_open_date + 1))::int)::timestamp
        + make_interval(mins => 420 + floor(private.seed_rand('evm:' || sec.section_id || ':' || g.n) * 900)::int))
       at time zone 'Asia/Manila'
from (
  select cs.id as section_id,
         t.sete_open_date,
         t.sete_close_date,
         ay.start_year,
         sp.response_base,
         count(*) filter (where e.remark <> 'dropped') as eligible
  from public.class_sections cs
  join public.enrollments e on e.section_id = cs.id
  join public.terms t on t.id = cs.term_id
  join public.academic_years ay on ay.id = t.academic_year_id
  join public.courses c on c.id = cs.course_id
  join public.departments d on d.id = c.department_id
  join private.seed_dept_params sp on sp.dept_code = d.code
  group by cs.id, t.sete_open_date, t.sete_close_date, ay.start_year, sp.response_base
) sec
cross join lateral generate_series(
  1,
  round(sec.eligible * least(1.0, greatest(0.25,
        sec.response_base + 0.025 * (sec.start_year - 2022) + 0.08 * private.seed_normal('rr:' || sec.section_id))))::int
) as g (n);

-- @@split

insert into public.sete_scores (evaluation_id, criterion_id, score)
select v.id,
       cr.id,
       least(5.0, greatest(1.0,
         round((z.quality + z.term_effect + z.section_effect + z.form_effect
                + case cr.code when 'A' then 0.06 when 'B' then 0.12 when 'C' then -0.14 else -0.04 end
                + 0.22 * private.seed_normal('sc:' || v.id || ':' || cr.id))::numeric * 5) / 5))
from public.sete_evaluations v
join public.class_sections cs on cs.id = v.section_id
join public.terms t on t.id = cs.term_id
join public.academic_years ay on ay.id = t.academic_year_id
join public.courses c on c.id = cs.course_id
join public.departments d on d.id = c.department_id
join private.seed_dept_params sp on sp.dept_code = d.code
cross join public.sete_criteria cr
cross join lateral (
  select least(4.85, greatest(3.05, 4.20 + sp.sete_effect + 0.27 * private.seed_normal('facq:' || cs.faculty_id))) as quality,
         0.025 * (ay.start_year - 2022) + case when t.semester_id = 2 then 0.02 else 0 end            as term_effect,
         0.07 * private.seed_normal('secq:' || cs.id)                                                  as section_effect,
         0.30 * private.seed_normal('ev:' || v.id)                                                     as form_effect
) z;
