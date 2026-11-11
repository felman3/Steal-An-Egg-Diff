-- =============================================================================
-- SYNTHETIC DEMONSTRATION DATA (5/5): build analytics facts and clean up
-- =============================================================================

select private.apply_kpi_metadata();  -- case-study KPI metadata (migration 20261111000100)
select private.refresh_analytics();

analyze public.class_sections;
analyze public.enrollments;
analyze public.sete_evaluations;
analyze public.sete_scores;
analyze private.section_facts;
analyze private.section_criterion_facts;

drop table if exists private.seed_dept_params;
drop function if exists private.seed_normal(text);
drop function if exists private.seed_rand(text);
