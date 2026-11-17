import { supabase } from './supabase';
import { toAppError } from './errors';
import type {
  AcademicYear,
  AnalyticsSetting,
  AuditRow,
  College,
  CriterionRow,
  Department,
  DepartmentKpiRow,
  FacultyRow,
  Filters,
  GradeBandRow,
  KpiDefinition,
  KpiSummaryRow,
  KpiTargetRow,
  RatingBand,
  Semester,
  SeteCriterion,
  TrendRow,
} from './types';

/** Arguments every analytics RPC accepts (null = "all"). */
function scopeArgs(f: Filters) {
  return {
    p_academic_year_id: f.academicYearId,
    p_semester_id: f.semesterId,
    p_college_id: f.collegeId,
    p_department_id: f.departmentId,
  };
}

/** PostgREST returns numerics as JSON numbers, but be defensive about strings. */
function num(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T[]> {
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw toAppError(error);
  return (data ?? []) as T[];
}

export async function fetchKpiSummary(f: Filters): Promise<KpiSummaryRow[]> {
  const rows = await rpc<KpiSummaryRow>('get_kpi_summary', scopeArgs(f));
  return rows.map((r) => ({
    ...r,
    value: num(r.value),
    previous_value: num(r.previous_value),
    target: num(r.target) ?? 0,
    warning_threshold: num(r.warning_threshold) ?? 0,
    critical_threshold: num(r.critical_threshold) ?? 0,
  }));
}

export async function fetchKpiTrend(f: Filters): Promise<TrendRow[]> {
  const rows = await rpc<TrendRow>('get_kpi_trend', scopeArgs(f));
  return rows.map((r) => ({ ...r, value: num(r.value) }));
}

export async function fetchDepartmentKpis(f: Filters): Promise<DepartmentKpiRow[]> {
  const rows = await rpc<DepartmentKpiRow>('get_department_kpis', scopeArgs(f));
  return rows.map((r) => ({
    ...r,
    value: num(r.value),
    target: num(r.target) ?? 0,
    warning_threshold: num(r.warning_threshold) ?? 0,
    critical_threshold: num(r.critical_threshold) ?? 0,
  }));
}

export async function fetchSeteCriteria(f: Filters): Promise<CriterionRow[]> {
  const rows = await rpc<CriterionRow>('get_sete_criteria', scopeArgs(f));
  return rows.map((r) => ({ ...r, scope_mean: num(r.scope_mean), institution_mean: num(r.institution_mean) }));
}

export async function fetchGradeDistribution(f: Filters): Promise<GradeBandRow[]> {
  const rows = await rpc<GradeBandRow>('get_grade_distribution', scopeArgs(f));
  return rows.map((r) => ({ ...r, percentage: num(r.percentage) }));
}

export async function fetchFacultyPerformance(f: Filters): Promise<FacultyRow[]> {
  const rows = await rpc<FacultyRow>('get_faculty_performance', scopeArgs(f));
  return rows.map((r) => ({
    ...r,
    response_rate: num(r.response_rate),
    mean_rating: num(r.mean_rating),
    target: num(r.target) ?? 0,
    warning_threshold: num(r.warning_threshold) ?? 0,
    critical_threshold: num(r.critical_threshold) ?? 0,
  }));
}

// ---------------------------------------------------------------------------
// Reference data (plain table reads; RLS allows any signed-in user)
// ---------------------------------------------------------------------------
export interface ReferenceData {
  academicYears: AcademicYear[];
  semesters: Semester[];
  colleges: College[];
  departments: Department[];
}

export async function fetchReferenceData(): Promise<ReferenceData> {
  const [ay, sem, col, dep] = await Promise.all([
    supabase.from('academic_years').select('id, label, start_year').order('start_year', { ascending: false }),
    supabase.from('semesters').select('id, code, name, sort_order').order('sort_order'),
    supabase.from('colleges').select('id, code, name').order('code'),
    supabase.from('departments').select('id, code, name, college_id, established_year').order('code'),
  ]);
  for (const r of [ay, sem, col, dep]) if (r.error) throw toAppError(r.error);
  return {
    academicYears: (ay.data ?? []) as AcademicYear[],
    semesters: (sem.data ?? []) as Semester[],
    colleges: (col.data ?? []) as College[],
    departments: (dep.data ?? []) as Department[],
  };
}

export interface MethodologyData {
  kpis: KpiDefinition[];
  criteria: SeteCriterion[];
  ratingScale: RatingBand[];
  settings: AnalyticsSetting[];
}

export async function fetchMethodology(): Promise<MethodologyData> {
  const [k, c, r, s] = await Promise.all([
    supabase.from('kpi_definitions').select('*').order('sort_order'),
    supabase.from('sete_criteria').select('id, code, name, description').order('sort_order'),
    supabase.from('sete_rating_scale').select('id, label, min_score, max_score').order('sort_order'),
    supabase.from('analytics_settings').select('*').order('key'),
  ]);
  for (const x of [k, c, r, s]) if (x.error) throw toAppError(x.error);
  return {
    kpis: (k.data ?? []).map((d) => ({ ...d, min_value: Number(d.min_value), max_value: Number(d.max_value) })) as KpiDefinition[],
    criteria: (c.data ?? []) as SeteCriterion[],
    ratingScale: (r.data ?? []).map((d) => ({ ...d, min_score: Number(d.min_score), max_score: Number(d.max_score) })) as RatingBand[],
    settings: (s.data ?? []).map((d) => ({
      ...d,
      value: Number(d.value),
      default_value: Number(d.default_value),
      min_value: Number(d.min_value),
      max_value: Number(d.max_value),
    })) as AnalyticsSetting[],
  };
}

// ---------------------------------------------------------------------------
// KPI targets & thresholds (writes are admin-only, enforced by RLS + triggers)
// ---------------------------------------------------------------------------
export async function fetchKpiTargets(): Promise<KpiTargetRow[]> {
  const { data, error } = await supabase
    .from('kpi_targets')
    .select('id, kpi_id, college_id, target_value, warning_threshold, critical_threshold, notes, updated_at, updated_by')
    .order('kpi_id')
    .order('college_id', { nullsFirst: true });
  if (error) throw toAppError(error);
  return (data ?? []).map((t) => ({
    ...t,
    target_value: Number(t.target_value),
    warning_threshold: Number(t.warning_threshold),
    critical_threshold: Number(t.critical_threshold),
  })) as KpiTargetRow[];
}

export interface TargetInput {
  target_value: number;
  warning_threshold: number;
  critical_threshold: number;
  notes: string | null;
}

export async function updateKpiTarget(id: number, input: TargetInput): Promise<void> {
  const { data, error } = await supabase.from('kpi_targets').update(input).eq('id', id).select('id');
  if (error) throw toAppError(error);
  if (!data || data.length === 0) throw toAppError({ code: '42501', message: 'Only administrators can change KPI targets.' });
}

export async function createCollegeOverride(kpiId: number, collegeId: number, input: TargetInput): Promise<void> {
  const { error } = await supabase.from('kpi_targets').insert({ kpi_id: kpiId, college_id: collegeId, ...input });
  if (error) throw toAppError(error);
}

export async function deleteCollegeOverride(id: number): Promise<void> {
  const { data, error } = await supabase.from('kpi_targets').delete().eq('id', id).select('id');
  if (error) throw toAppError(error);
  if (!data || data.length === 0) throw toAppError({ code: '42501', message: 'Only administrators can remove overrides.' });
}

export async function resetKpiTargets(): Promise<void> {
  const { error } = await supabase.rpc('reset_kpi_targets');
  if (error) throw toAppError(error);
}

export async function updateAnalyticsSetting(key: string, value: number): Promise<void> {
  const { data, error } = await supabase.from('analytics_settings').update({ value }).eq('key', key).select('key');
  if (error) throw toAppError(error);
  if (!data || data.length === 0) throw toAppError({ code: '42501', message: 'Only administrators can change settings.' });
}

export async function fetchTargetAudit(limit = 25): Promise<AuditRow[]> {
  const { data, error } = await supabase
    .from('kpi_target_audit')
    .select('id, kpi_id, college_id, action, old_values, new_values, changed_at, changed_by_profile:user_profiles(full_name, role)')
    .order('changed_at', { ascending: false })
    .limit(limit);
  if (error) throw toAppError(error);
  return (data ?? []) as unknown as AuditRow[];
}
