-- =============================================================================
-- SYNTHETIC DEMONSTRATION DATA (2/5): faculty and students
-- Faculty are pseudonymous ("Faculty CS-07"); students have synthetic numbers only.
-- =============================================================================

-- Generation parameters per department (seed-only; dropped in 05).
--   difficulty    : shifts grade performance down (harder programmes)
--   response_base : typical SETE participation
--   sete_effect   : shifts the latent teaching-quality distribution
create table if not exists private.seed_dept_params (
  dept_code     text primary key,
  faculty_count int not null,
  blocks        int not null,
  female_share  numeric not null,
  difficulty    numeric not null,
  drop_rate     numeric not null,
  response_base numeric not null,
  sete_effect   numeric not null
);

truncate private.seed_dept_params;
insert into private.seed_dept_params values
  ('CS',   12, 2, 0.38,  0.05, 0.020, 0.80,  0.00),
  ('IT',   14, 2, 0.40, -0.05, 0.020, 0.82,  0.02),
  ('ACC',  10, 1, 0.66,  0.50, 0.030, 0.75, -0.06),
  ('BA',   12, 2, 0.60, -0.05, 0.020, 0.83,  0.03),
  ('HM',   10, 2, 0.62, -0.12, 0.020, 0.85,  0.05),
  ('TM',    8, 1, 0.68, -0.15, 0.015, 0.84,  0.04),
  ('ELED', 10, 1, 0.82, -0.25, 0.010, 0.88,  0.10),
  ('SEED', 11, 2, 0.70, -0.10, 0.015, 0.85,  0.05),
  ('NUR',  12, 2, 0.78,  0.40, 0.025, 0.77, -0.05),
  ('ND',    6, 1, 0.80,  0.00, 0.015, 0.87,  0.08),
  ('CRIM', 12, 2, 0.35,  0.42, 0.035, 0.70, -0.12),
  ('MATH', 11, 1, 0.55,  0.55, 0.035, 0.66, -0.15),
  ('PSY',   9, 1, 0.75, -0.10, 0.015, 0.84,  0.06),
  ('COMM',  8, 1, 0.62, -0.15, 0.015, 0.83,  0.04);

insert into public.faculty (employee_no, pseudonym, department_id, academic_rank, employment_status, hired_on)
select 'SYN-F-' || lpad((row_number() over (order by d.id, g.n))::text, 4, '0'),
       'Faculty ' || d.code || '-' || lpad(g.n::text, 2, '0'),
       d.id,
       case when r.rank_r < 0.33 then 'Instructor'
            when r.rank_r < 0.63 then 'Assistant Professor'
            when r.rank_r < 0.87 then 'Associate Professor'
            else 'Professor' end,
       case when r.status_r < 0.66 then 'Permanent'
            when r.status_r < 0.86 then 'Temporary'
            else 'Part-time' end,
       make_date(greatest(d.established_year, 1995 + floor(r.hire_r * 27)::int), 6, 1)
from public.departments d
join private.seed_dept_params sp on sp.dept_code = d.code
cross join lateral generate_series(1, sp.faculty_count) as g (n)
cross join lateral (
  select private.seed_rand('fac-rank:'   || d.code || ':' || g.n) as rank_r,
         private.seed_rand('fac-status:' || d.code || ':' || g.n) as status_r,
         private.seed_rand('fac-hire:'   || d.code || ':' || g.n) as hire_r
) as r;

-- Block sections of 32-42 students per programme cohort (entry years 2019-2025).
insert into public.students (student_no, program_id, entry_year, block_no, sex)
select 'SYN-' || e.y || '-' || lpad((row_number() over (partition by e.y order by p.id, b.n, s.n))::text, 5, '0'),
       p.id,
       e.y,
       b.n,
       case when private.seed_rand('stu-sex:' || p.code || ':' || e.y || ':' || b.n || ':' || s.n) < sp.female_share
            then 'F' else 'M' end
from public.programs p
join public.departments d on d.id = p.department_id
join private.seed_dept_params sp on sp.dept_code = d.code
cross join lateral generate_series(greatest(2019, d.established_year), 2025) as e (y)
cross join lateral generate_series(1, sp.blocks) as b (n)
cross join lateral generate_series(
  1, 32 + floor(private.seed_rand('block-size:' || p.code || ':' || e.y || ':' || b.n) * 11)::int
) as s (n);
