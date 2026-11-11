-- =============================================================================
-- Remove ALL synthetic demonstration data so supabase/seed/ can be re-run.
-- Schema, RLS policies and functions are untouched. Dashboard profiles are
-- removed too (they reference colleges), so re-run scripts/db/create-demo-users.mjs.
--   node scripts/db/apply.mjs --reset-seed
-- =============================================================================
truncate table
  public.colleges,
  public.semesters,
  public.academic_years,
  public.sete_criteria,
  public.sete_rating_scale,
  public.kpi_definitions,
  public.analytics_settings,
  private.kpi_target_baseline
restart identity cascade;
