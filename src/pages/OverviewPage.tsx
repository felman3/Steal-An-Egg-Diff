import { useId, useState } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { AlertsPanel } from '../components/AlertsPanel';
import { PageHeader } from '../components/AppShell';
import { ChartCard, DataTable } from '../components/ChartCard';
import { CriteriaChart } from '../components/charts/CriteriaChart';
import { DepartmentChart } from '../components/charts/DepartmentChart';
import { BandDonut } from '../components/charts/RatingDonut';
import { countRatingBands, gradeBands } from '../components/charts/ratingBands';
import { TrendChart } from '../components/charts/TrendChart';
import { KpiCard } from '../components/KpiCard';
import { StatusBadge } from '../components/StatusBadge';
import { EmptyState, ErrorState, LoadingState } from '../components/States';
import { useFilters } from '../filters/FiltersProvider';
import {
  fetchClassResults,
  fetchDepartmentKpis,
  fetchFacultyPerformance,
  fetchGradeDistribution,
  fetchKpiSummary,
  fetchKpiTrend,
  fetchMethodology,
  fetchSeteCriteria,
} from '../lib/api';
import { formatInt, formatValue, STATUS_LABEL } from '../lib/format';
import { STATUS_FILL, statusOf } from '../lib/status';
import type { AppRole, DepartmentKpiRow, KpiCode } from '../lib/types';
import { useQuery } from '../lib/useQuery';

const TITLE: Record<AppRole, string> = {
  admin: 'Academic Administrator Dashboard',
  dean: "Dean's Dashboard",
  chair: 'Program Chair Dashboard',
  faculty: 'My Teaching Dashboard',
};

/**
 * One dashboard layout for every user type; what fills it depends on the role:
 *   administrator / dean : KPIs for the institution or college, compared by department
 *   program chair        : KPIs for the program, compared by faculty member
 *   faculty member       : their own KPIs, compared by class, with their grade distribution
 * The database decides the scope; this page only chooses which views to show.
 */
export function OverviewPage() {
  const { profile } = useAuth();
  const role: AppRole = profile?.role ?? 'admin';
  const comparesDepartments = role === 'admin' || role === 'dean';
  const { filters, filterKey, describe, reference, setFilters } = useFilters();
  const methodology = useQuery('methodology', fetchMethodology);
  const definitions = methodology.data?.kpis ?? [];
  const summary = useQuery(`summary|${filterKey}`, () => fetchKpiSummary(filters));
  const trend = useQuery(`trend|${filterKey}`, () => fetchKpiTrend(filters));
  const criteria = useQuery(`criteria|${filterKey}`, () => fetchSeteCriteria(filters));
  const depts = useQuery(comparesDepartments ? `depts|${filterKey}` : null, () => fetchDepartmentKpis(filters));
  const faculty = useQuery(role !== 'faculty' ? `faculty|${filterKey}` : null, () => fetchFacultyPerformance(filters));
  const classes = useQuery(role === 'faculty' ? `classes|${filterKey}` : null, () => fetchClassResults(filters));
  const grades = useQuery(role === 'faculty' ? `grades|${filterKey}` : null, () => fetchGradeDistribution(filters));
  const [focus, setFocus] = useState<KpiCode>('sete_mean');
  const measureId = useId();

  const kpis = summary.data ?? [];
  const focusKpi = kpis.find((k) => k.kpi_code === focus) ?? kpis[0];
  const seteKpi = kpis.find((k) => k.kpi_code === 'sete_mean');
  const noData = kpis.length > 0 && kpis.every((k) => k.sample_size === 0);

  // Responsible SETE interpretation: a weak response rate makes SETE-based KPIs less representative.
  const response = kpis.find((k) => k.kpi_code === 'sete_response_rate');
  const lowResponse = response && (response.status === 'warning' || response.status === 'critical') && response.value !== null;
  const cautionFor = (code: KpiCode) =>
    lowResponse && (code === 'sete_mean' || code === 'faculty_standard_rate')
      ? `Interpret with caution: only ${formatValue(response.value, response.unit, response.decimals)} of students responded to SETE.`
      : null;

  const trendRows = (trend.data ?? []).filter((r) => r.kpi_code === focusKpi?.kpi_code);
  const trendValues = (code: KpiCode) =>
    (trend.data ?? [])
      .filter((r) => r.kpi_code === code)
      .sort((a, b) => a.term_start.localeCompare(b.term_start))
      .map((r) => r.value);

  const scopeShort =
    role === 'faculty'
      ? 'My classes'
      : filters.departmentId
        ? (reference?.departments.find((d) => d.id === filters.departmentId)?.code ?? 'Selection')
        : filters.collegeId
          ? (reference?.colleges.find((c) => c.id === filters.collegeId)?.code ?? 'Selection')
          : 'Institution';
  const benchmarkLabel = role === 'faculty' ? 'Department' : 'Institution';
  const compareCriteria = role !== 'admin' || filters.collegeId !== null || filters.departmentId !== null;

  // ---- Comparison chart: departments, faculty members or classes, in one row shape ----
  const deptRows = (depts.data ?? []).filter((r) => r.kpi_code === focusKpi?.kpi_code);
  const base = { college_id: 0, college_name: '', kpi_code: 'sete_mean' as KpiCode };
  const facultyBars: DepartmentKpiRow[] = seteKpi
    ? (faculty.data ?? []).map((f) => ({
        ...base,
        department_id: f.faculty_id,
        department_code: f.pseudonym.replace('Faculty ', ''),
        department_name: f.pseudonym,
        college_code: f.academic_rank,
        value: f.mean_rating,
        sample_size: f.evaluations,
        target: f.target,
        warning_threshold: f.warning_threshold,
        critical_threshold: f.critical_threshold,
        status: f.status,
      }))
    : [];
  const classBars: DepartmentKpiRow[] = seteKpi
    ? (classes.data ?? []).map((c) => ({
        ...base,
        department_id: c.section_id,
        department_code: `${c.course_code} · ${c.section_code}${filters.academicYearId === null ? ` ’${c.term_label.slice(-7, -5)}` : ''}`,
        department_name: c.course_title,
        college_code: c.term_label,
        value: c.mean_rating,
        sample_size: c.evaluations,
        target: seteKpi.target,
        warning_threshold: seteKpi.warning_threshold,
        critical_threshold: seteKpi.critical_threshold,
        status: statusOf(c.mean_rating, seteKpi),
      }))
    : [];

  const ratingBands = countRatingBands(faculty.data ?? []);
  const atStandard = ratingBands.bands.slice(0, 2).reduce((n, b) => n + b.count, 0);
  const myGrades = gradeBands(grades.data ?? []);

  const measureSelect = focusKpi && (
    <div className="flex items-center gap-2">
      <label htmlFor={measureId} className="text-xs font-medium text-ink-2">
        Measure
      </label>
      <select id={measureId} className="field !min-h-8 !w-auto !py-1 text-xs" value={focusKpi.kpi_code} onChange={(e) => setFocus(e.target.value as KpiCode)} data-testid="measure-select">
        {kpis.map((k) => (
          <option key={k.kpi_code} value={k.kpi_code}>
            {k.short_name}
          </option>
        ))}
      </select>
    </div>
  );

  return (
    <>
      <PageHeader title={TITLE[role]} />

      {summary.error ? (
        <div className="card mb-5">
          <ErrorState error={summary.error} onRetry={summary.refetch} minHeight={180} />
        </div>
      ) : summary.isLoading ? (
        <div className="card mb-5">
          <LoadingState label="Calculating KPIs…" minHeight={180} />
        </div>
      ) : noData ? (
        <div className="card mb-5">
          <EmptyState
            minHeight={200}
            title="No academic or SETE records for this selection"
            message={
              <>
                Nothing was recorded for <strong>{describe.scope}</strong> in <strong>{describe.period}</strong> (for example, a department
                that did not exist yet). Choose another period or scope.
              </>
            }
          />
        </div>
      ) : (
        <section aria-label="Key performance indicators" className={`mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5 ${summary.isRefreshing ? 'refreshing' : ''}`} data-testid="kpi-grid">
          {kpis.map((k, i) => (
            <KpiCard
              tooltipAlign={i >= 3 ? 'right' : 'left'}
              key={k.kpi_code}
              kpi={k}
              def={definitions.find((d) => d.code === k.kpi_code)}
              caution={cautionFor(k.kpi_code)}
              trend={trendValues(k.kpi_code)}
              selected={k.kpi_code === focusKpi?.kpi_code}
              onSelect={() => setFocus(k.kpi_code)}
            />
          ))}
        </section>
      )}

      {!noData && focusKpi && (
        <>
          <div className="mb-5 grid grid-cols-1 gap-5 lg:grid-cols-3">
            <ChartCard
              className="lg:col-span-2"
              testId="card-trend"
              title={`${focusKpi.kpi_name} by term`}
              subtitle={`All terms for ${describe.scope}${filters.semesterId ? ' (selected semester only)' : ''} · selected period highlighted · shaded bands mark warning and critical zones`}
              actions={measureSelect}
              isLoading={trend.isLoading}
              isRefreshing={trend.isRefreshing}
              error={trend.error}
              onRetry={trend.refetch}
              isEmpty={trendRows.every((r) => r.value === null)}
              table={{
                caption: `${focusKpi.kpi_name} by term`,
                columns: [
                  { key: 'term', label: 'Term' },
                  { key: 'value', label: focusKpi.short_name, align: 'right' },
                  { key: 'n', label: 'Sample size', align: 'right' },
                ],
                rows: trendRows.map((r) => ({
                  term: `${r.semester_name} · AY ${r.academic_year_label}`,
                  value: formatValue(r.value, focusKpi.unit, focusKpi.decimals),
                  n: formatInt(r.sample_size),
                })),
              }}
            >
              <TrendChart rows={trendRows} kpi={focusKpi} />
            </ChartCard>
            {summary.data && (!comparesDepartments || depts.data) && (role === 'faculty' || faculty.data) ? (
              <AlertsPanel
                role={role}
                summary={summary.data}
                departments={comparesDepartments ? depts.data : []}
                // The chair follows up every flagged faculty member; the dean leads the review of critical cases.
                faculty={role === 'chair' ? faculty.data : role === 'dean' ? (faculty.data ?? []).filter((f) => f.status === 'critical') : []}
                scopeLabel={describe.scope}
                definitions={definitions}
              />
            ) : (
              <div className="card">{depts.error ? <ErrorState error={depts.error} onRetry={depts.refetch} /> : <LoadingState />}</div>
            )}
          </div>

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 xl:grid-cols-12">
            {comparesDepartments && (
              <ChartCard
                className="lg:col-span-2 xl:col-span-5"
                testId="card-departments"
                title={`${focusKpi.kpi_name} by department`}
                subtitle={`${describe.period} · ${focusKpi.direction === 'lower_is_better' ? 'lower is better' : 'higher is better'} · bars coloured by status against each department's own target`}
                actions={measureSelect}
                isLoading={depts.isLoading}
                isRefreshing={depts.isRefreshing}
                error={depts.error}
                onRetry={depts.refetch}
                isEmpty={deptRows.every((r) => r.value === null)}
                table={{
                  caption: `${focusKpi.kpi_name} by department`,
                  columns: [
                    { key: 'dept', label: 'Department' },
                    { key: 'college', label: 'College' },
                    { key: 'value', label: focusKpi.short_name, align: 'right' },
                    { key: 'target', label: 'Target', align: 'right' },
                    { key: 'status', label: 'Status' },
                    { key: 'n', label: 'Sample', align: 'right' },
                  ],
                  rows: deptRows.map((r) => ({
                    dept: r.department_name.replace('Department of ', ''),
                    college: r.college_code,
                    value: formatValue(r.value, focusKpi.unit, focusKpi.decimals),
                    target: formatValue(r.target, focusKpi.unit, focusKpi.decimals),
                    status: <StatusBadge status={r.status} compact />,
                    n: formatInt(r.sample_size),
                  })),
                }}
              >
                <DepartmentChart rows={deptRows} kpi={focusKpi} onSelectDepartment={(departmentId, collegeId) => setFilters({ collegeId, departmentId })} />
                {deptRows.length > 0 && deptRows.length <= 6 && (
                  <div className="mt-4" data-testid="mini-scorecard">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">All KPIs by department</p>
                    <DataTable
                      dense
                      spec={{
                        caption: 'All KPIs by department',
                        columns: [{ key: 'dept', label: 'Dept.' }, ...kpis.map((k) => ({ key: k.kpi_code, label: k.short_name, align: 'right' as const }))],
                        rows: deptRows.map((d) => ({
                          dept: <strong className="text-ink">{d.department_code}</strong>,
                          ...Object.fromEntries(
                            kpis.map((k) => {
                              const cell = (depts.data ?? []).find((x) => x.department_id === d.department_id && x.kpi_code === k.kpi_code);
                              return [
                                k.kpi_code,
                                <span key={k.kpi_code} className="inline-flex items-center gap-1.5" title={cell ? STATUS_LABEL[cell.status] : undefined}>
                                  {formatValue(cell?.value ?? null, k.unit, k.decimals)}
                                  <span aria-hidden className="inline-block size-2 rounded-full" style={{ background: cell ? STATUS_FILL[cell.status] : 'var(--grid)' }} />
                                  <span className="sr-only">{cell ? STATUS_LABEL[cell.status] : ''}</span>
                                </span>,
                              ];
                            }),
                          ),
                        })),
                      }}
                    />
                  </div>
                )}
              </ChartCard>
            )}

            {role === 'chair' && seteKpi && (
              <ChartCard
                className="lg:col-span-2 xl:col-span-5"
                testId="card-faculty-bars"
                title="Mean SETE rating by faculty member"
                subtitle={`${describe.period} · faculty in your program · bars coloured by status against the SETE target · read together with each response rate`}
                isLoading={faculty.isLoading}
                isRefreshing={faculty.isRefreshing}
                error={faculty.error}
                onRetry={faculty.refetch}
                isEmpty={facultyBars.every((r) => r.value === null)}
                table={{
                  caption: 'Mean SETE rating by faculty member',
                  columns: [
                    { key: 'who', label: 'Faculty (pseudonym)' },
                    { key: 'value', label: 'SETE rating', align: 'right' },
                    { key: 'rr', label: 'Response rate', align: 'right' },
                    { key: 'status', label: 'Status' },
                    { key: 'n', label: 'Responses', align: 'right' },
                  ],
                  rows: (faculty.data ?? []).map((f) => ({
                    who: f.pseudonym,
                    value: f.mean_rating?.toFixed(2) ?? 'Suppressed',
                    rr: f.response_rate === null ? '—' : `${f.response_rate.toFixed(1)}%`,
                    status: <StatusBadge status={f.status} compact />,
                    n: formatInt(f.evaluations),
                  })),
                }}
              >
                <DepartmentChart rows={facultyBars} kpi={seteKpi} labelWidth={52} testId="faculty-bars" />
              </ChartCard>
            )}

            {role === 'faculty' && seteKpi && (
              <ChartCard
                className="lg:col-span-2 xl:col-span-5"
                testId="card-class-bars"
                title="My SETE rating by class"
                subtitle={`${describe.period} · each class section you handled · classes with too few responses are not rated`}
                isLoading={classes.isLoading}
                isRefreshing={classes.isRefreshing}
                error={classes.error}
                onRetry={classes.refetch}
                isEmpty={classBars.every((r) => r.value === null)}
                table={{
                  caption: 'My results by class',
                  columns: [
                    { key: 'cls', label: 'Class' },
                    { key: 'term', label: 'Term' },
                    { key: 'students', label: 'Students', align: 'right' },
                    { key: 'rating', label: 'SETE rating', align: 'right' },
                    { key: 'rr', label: 'Response rate', align: 'right' },
                    { key: 'pass', label: 'Pass rate', align: 'right' },
                    { key: 'grades', label: 'Grades submitted' },
                  ],
                  rows: (classes.data ?? []).map((c) => ({
                    cls: `${c.course_code} · ${c.section_code}`,
                    term: c.term_label,
                    students: formatInt(c.students),
                    rating: c.mean_rating?.toFixed(2) ?? 'Suppressed',
                    rr: c.response_rate === null ? '—' : `${c.response_rate.toFixed(1)}%`,
                    pass: c.pass_rate === null ? '—' : `${c.pass_rate.toFixed(1)}%`,
                    grades: c.grades_on_time ? 'On time' : 'Late',
                  })),
                }}
              >
                <DepartmentChart rows={classBars} kpi={seteKpi} labelWidth={132} testId="class-bars" />
                <div className="mt-4">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">Class details</p>
                  <DataTable
                    dense
                    maxHeight={300}
                    spec={{
                      caption: 'Details of my classes',
                      columns: [
                        { key: 'cls', label: 'Class' },
                        { key: 'students', label: 'Students', align: 'right' },
                        { key: 'rr', label: 'Resp.', align: 'right' },
                        { key: 'pass', label: 'Pass', align: 'right' },
                        { key: 'grades', label: 'Grades' },
                      ],
                      rows: (classes.data ?? []).map((c) => ({
                        cls: (
                          <span title={c.course_title}>
                            {c.course_code} · {c.section_code}
                            <span className="block text-[11px] text-ink-muted">{c.term_label}</span>
                          </span>
                        ),
                        students: formatInt(c.students),
                        rr: c.response_rate === null ? '—' : `${c.response_rate.toFixed(0)}%`,
                        pass: c.pass_rate === null ? '—' : `${c.pass_rate.toFixed(0)}%`,
                        grades: c.grades_on_time ? (
                          'On time'
                        ) : (
                          <span className="rounded bg-warning-bg px-1.5 py-0.5 text-xs font-semibold text-ink">Late</span>
                        ),
                      })),
                    }}
                  />
                </div>
              </ChartCard>
            )}

            <ChartCard
              className="xl:col-span-4"
              testId="card-criteria"
              title={role === 'faculty' ? 'My SETE criteria breakdown' : 'SETE criteria breakdown'}
              subtitle={
                compareCriteria
                  ? `Mean score per criterion (1–5) · ${role === 'faculty' ? 'my classes' : describe.scope} vs ${benchmarkLabel.toLowerCase()} · ${describe.period}`
                  : `Mean score per criterion (1–5) · whole institution · ${describe.period}. Pick a college or department to compare.`
              }
              isLoading={criteria.isLoading}
              isRefreshing={criteria.isRefreshing}
              error={criteria.error}
              onRetry={criteria.refetch}
              isEmpty={(criteria.data ?? []).every((r) => r.scope_mean === null)}
              emptyMessage="No SETE responses (or too few to report anonymously) for this selection."
              table={{
                caption: 'Mean SETE score by criterion',
                columns: [
                  { key: 'criterion', label: 'Criterion' },
                  { key: 'scope', label: scopeShort, align: 'right' },
                  { key: 'inst', label: benchmarkLabel, align: 'right' },
                  { key: 'n', label: 'Scores', align: 'right' },
                ],
                rows: (criteria.data ?? []).map((r) => ({
                  criterion: `${r.criterion_code}. ${r.criterion_name}`,
                  scope: r.scope_mean?.toFixed(2) ?? 'Suppressed',
                  inst: r.institution_mean?.toFixed(2) ?? '—',
                  n: formatInt(r.responses),
                })),
              }}
            >
              <CriteriaChart rows={criteria.data ?? []} scopeLabel={scopeShort} compare={compareCriteria} benchmarkLabel={benchmarkLabel} />
            </ChartCard>

            {role === 'faculty' ? (
              <ChartCard
                className="xl:col-span-3"
                testId="card-grade-donut"
                title="My grade distribution"
                subtitle={`Final grades given in my classes · ${describe.period}`}
                isLoading={grades.isLoading}
                isRefreshing={grades.isRefreshing}
                error={grades.error}
                onRetry={grades.refetch}
                isEmpty={myGrades.total === 0}
                table={{
                  caption: 'Final grades in my classes',
                  columns: [
                    { key: 'band', label: 'Grade' },
                    { key: 'n', label: 'Students', align: 'right' },
                    { key: 'pct', label: 'Share', align: 'right' },
                  ],
                  rows: myGrades.bands.map((b) => ({ band: b.label, n: formatInt(b.count), pct: `${b.pct.toFixed(1)}%` })),
                }}
              >
                <BandDonut
                  testId="grade-donut"
                  bands={myGrades.bands}
                  total={myGrades.total}
                  centerLabel="enrolments"
                  unitLabel="Students"
                  footer={
                    <>
                      <strong className="text-ink">{formatInt(myGrades.passed)}</strong> of {formatInt(myGrades.total)} enrolments earned a passing grade.
                    </>
                  }
                />
              </ChartCard>
            ) : (
              <ChartCard
                className="xl:col-span-3"
                testId="card-rating-donut"
                title="Faculty by SETE rating"
                subtitle={`Descriptive rating of each evaluated faculty member · ${describe.scope} · ${describe.period}`}
                isLoading={faculty.isLoading}
                isRefreshing={faculty.isRefreshing}
                error={faculty.error}
                onRetry={faculty.refetch}
                isEmpty={ratingBands.rated === 0}
                emptyMessage="No faculty have enough SETE responses to be rated for this selection."
                table={{
                  caption: 'Faculty by SETE descriptive rating',
                  columns: [
                    { key: 'band', label: 'Rating' },
                    { key: 'n', label: 'Faculty', align: 'right' },
                    { key: 'pct', label: 'Share', align: 'right' },
                  ],
                  rows: ratingBands.bands.map((b) => ({ band: b.label, n: formatInt(b.count), pct: `${b.pct.toFixed(1)}%` })),
                }}
              >
                <BandDonut
                  testId="rating-donut"
                  bands={ratingBands.bands}
                  total={ratingBands.rated}
                  centerLabel="faculty rated"
                  unitLabel="Faculty"
                  footer={
                    <>
                      <strong className="text-ink">{atStandard}</strong> of {ratingBands.rated} rated faculty are Very Satisfactory or better.
                      {ratingBands.insufficient > 0 && ` ${ratingBands.insufficient} not rated (too few responses).`}
                    </>
                  }
                />
              </ChartCard>
            )}
          </div>

          <p className="mt-5 text-xs text-ink-muted">
            Statuses: {(['on_target', 'below_target', 'warning', 'critical'] as const).map((s) => STATUS_LABEL[s]).join(' · ')} — computed in the
            database from the stored target, warning and critical thresholds. Hover a KPI card for its objective and formula. SETE is one
            source of evidence about teaching and is never, on its own, a basis for personnel decisions.
          </p>
        </>
      )}
    </>
  );
}
