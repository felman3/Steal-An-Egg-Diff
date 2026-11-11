/** The dashboard serves one user type: the authorized academic administrator. */
export type AppRole = 'admin';

export type KpiCode = 'sete_mean' | 'sete_response_rate' | 'pass_rate' | 'mean_gwa' | 'faculty_standard_rate';
export type KpiUnit = 'rating' | 'percent' | 'grade';
export type KpiDirection = 'higher_is_better' | 'lower_is_better';
export type KpiStatus = 'on_target' | 'below_target' | 'warning' | 'critical' | 'no_data' | 'insufficient_data';

export interface OrgRef {
  id: number;
  code: string;
  name: string;
}

export interface Profile {
  user_id: string;
  full_name: string;
  role: AppRole;
  title: string | null;
  is_demo: boolean;
  college: OrgRef | null;
  department: (OrgRef & { college: OrgRef | null }) | null;
}

export interface AcademicYear {
  id: number;
  label: string;
  start_year: number;
}
export interface Semester {
  id: number;
  code: string;
  name: string;
  sort_order: number;
}
export type College = OrgRef;
export interface Department extends OrgRef {
  college_id: number;
  established_year: number;
}

export interface Filters {
  academicYearId: number | null;
  semesterId: number | null;
  collegeId: number | null;
  departmentId: number | null;
}

export interface KpiSummaryRow {
  kpi_code: KpiCode;
  kpi_name: string;
  short_name: string;
  description: string;
  formula: string;
  data_source: string;
  unit: KpiUnit;
  direction: KpiDirection;
  decimals: number;
  value: number | null;
  previous_value: number | null;
  previous_label: string | null;
  target: number;
  warning_threshold: number;
  critical_threshold: number;
  college_specific_target: boolean;
  status: KpiStatus;
  sample_size: number;
  sort_order: number;
}

export interface TrendRow {
  term_id: number;
  term_label: string;
  academic_year_label: string;
  semester_name: string;
  term_start: string;
  in_selected_period: boolean;
  kpi_code: KpiCode;
  value: number | null;
  sample_size: number;
}

export interface DepartmentKpiRow {
  department_id: number;
  department_code: string;
  department_name: string;
  college_id: number;
  college_code: string;
  college_name: string;
  kpi_code: KpiCode;
  value: number | null;
  sample_size: number;
  target: number;
  warning_threshold: number;
  critical_threshold: number;
  status: KpiStatus;
}

export interface CriterionRow {
  criterion_id: number;
  criterion_code: string;
  criterion_name: string;
  description: string;
  scope_mean: number | null;
  institution_mean: number | null;
  responses: number;
}

export interface GradeBandRow {
  band_code: string;
  band_label: string;
  grade_range: string;
  sort_order: number;
  students: number;
  percentage: number | null;
}

export interface FacultyRow {
  faculty_id: number;
  pseudonym: string;
  employee_no: string;
  academic_rank: string;
  employment_status: string;
  department_code: string;
  college_code: string;
  sections: number;
  evaluations: number;
  response_rate: number | null;
  mean_rating: number | null;
  rating_band: string | null;
  target: number;
  warning_threshold: number;
  critical_threshold: number;
  status: KpiStatus;
  criterion_means: Record<string, number> | null;
}

export interface KpiDefinition {
  id: number;
  code: KpiCode;
  name: string;
  short_name: string;
  description: string;
  formula: string;
  unit: KpiUnit;
  direction: KpiDirection;
  decimals: number;
  data_source: string;
  min_value: number;
  max_value: number;
  sort_order: number;
  category: KpiCategory | null;
  objective: string | null;
  warning_action: string | null;
  critical_action: string | null;
}

export type KpiCategory = 'Academic operations' | 'Teaching effectiveness';

export interface KpiTargetRow {
  id: number;
  kpi_id: number;
  college_id: number | null;
  target_value: number;
  warning_threshold: number;
  critical_threshold: number;
  notes: string | null;
  updated_at: string;
  updated_by: string | null;
}

export interface AuditRow {
  id: number;
  kpi_id: number;
  college_id: number | null;
  action: 'INSERT' | 'UPDATE' | 'DELETE';
  old_values: Record<string, unknown> | null;
  new_values: Record<string, unknown> | null;
  changed_at: string;
  changed_by_profile: { full_name: string; role: AppRole } | null;
}

export interface AnalyticsSetting {
  key: string;
  value: number;
  default_value: number;
  min_value: number;
  max_value: number;
  label: string;
  description: string;
  updated_at: string;
}

export interface SeteCriterion {
  id: number;
  code: string;
  name: string;
  description: string;
}

export interface RatingBand {
  id: number;
  label: string;
  min_score: number;
  max_score: number;
}
