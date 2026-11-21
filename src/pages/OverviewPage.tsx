import { BookOpen, MessageSquareText, ShieldCheck } from 'lucide-react';
import { useId, useRef, useState } from 'react';
import { AlertsPanel } from '../components/AlertsPanel';
import { ChartCard } from '../components/ChartCard';
import { DashboardHeader } from '../components/DashboardHeader';
import { CriteriaChart } from '../components/charts/CriteriaChart';
import { DepartmentChart } from '../components/charts/DepartmentChart';
import { DepartmentStatusMatrix } from '../components/charts/DepartmentStatusMatrix';
import { GradeDistributionChart } from '../components/charts/GradeDistributionChart';
import { RatingDonut } from '../components/charts/RatingDonut';
import { countRatingBands } from '../components/charts/ratingBands';
import { SeteCoverageChart, type SeteCoveragePoint } from '../components/charts/SeteCoverageChart';
import { TrendChart } from '../components/charts/TrendChart';
import { KpiCard } from '../components/KpiCard';
import { StatusBadge } from '../components/StatusBadge';
import { EmptyState, ErrorState, LoadingState } from '../components/States';
import { useFilters } from '../filters/FiltersProvider';
import { fetchDepartmentKpis, fetchFacultyRatingBands, fetchGradeDistribution, fetchKpiSummary, fetchKpiTrend, fetchMethodology, fetchSeteCriteria } from '../lib/api';
import { formatInt, formatValue, KPI_SAMPLE_LABEL, STATUS_LABEL, STATUS_RANK } from '../lib/format';
import type { KpiCode } from '../lib/types';
import { useQuery } from '../lib/useQuery';

const KPI_GROUPS = [
  { title: 'Teaching Effectiveness', icon: MessageSquareText, codes: ['sete_mean', 'sete_response_rate', 'faculty_standard_rate'] },
  { title: 'Academic Operations', icon: BookOpen, codes: ['pass_rate', 'mean_gwa'] },
] as const;

type DepartmentOrder = 'performance' | 'priority' | 'name';
type CoverageFilter = 'all' | 'low' | 'on-target';

export function OverviewPage() {
  const { filters, filterKey, describe, reference, setFilters } = useFilters();
  const methodology = useQuery('methodology', fetchMethodology);
  const definitions = methodology.data?.kpis ?? [];
  const ratingScale = methodology.data?.ratingScale;
  const minResponsesSetting = methodology.data?.settings.find(({ key }) => key === 'min_evaluations_reported');
  const minSeteResponses = minResponsesSetting && Math.round(minResponsesSetting.value);
  const facultyRatingStandard = methodology.data?.settings.find(({ key }) => key === 'faculty_rating_standard')?.value
    .toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 3 });
  const facultyStandardFormula = minSeteResponses == null || facultyRatingStandard == null ? undefined : (
    `Faculty need at least ${formatInt(minSeteResponses)} SETE responses in this selection to be included. ` +
    `The KPI shows the share whose mean SETE score is ${facultyRatingStandard} or higher after rounding to two decimal places.`
  );
  const summary = useQuery(`summary|${filterKey}`, () => fetchKpiSummary(filters));
  const trend = useQuery(`trend|${filterKey}`, () => fetchKpiTrend(filters));
  const depts = useQuery(`depts|${filterKey}`, () => fetchDepartmentKpis(filters));
  const grades = useQuery(`grades|${filterKey}`, () => fetchGradeDistribution(filters));
  const faculty = useQuery(`faculty-bands|${filterKey}`, () => fetchFacultyRatingBands(filters));
  const criteria = useQuery(`criteria|${filterKey}`, () => fetchSeteCriteria(filters));
  const [focus, setFocus] = useState<KpiCode | null>(null);
  const [departmentOrder, setDepartmentOrder] = useState<DepartmentOrder>('performance');
  const [matrixOrder, setMatrixOrder] = useState<'name' | 'priority'>('name');
  const [coverageFilter, setCoverageFilter] = useState<CoverageFilter>('all');
  const measureId = useId();
  const sortId = useId();
  const matrixSortId = useId();
  const coverageFilterId = useId();
  const trendPanel = useRef<HTMLDivElement>(null);
  const metricsRegion = useRef<HTMLElement>(null);

  const kpis = summary.data ?? [];
  const focusKpi = kpis.find((k) => k.kpi_code === focus) ?? kpis[0];
  const noData = kpis.length > 0 && kpis.every((k) => k.sample_size === 0);

  // Responsible SETE interpretation: a weak response rate makes SETE-based KPIs less representative.
  const response = kpis.find((k) => k.kpi_code === 'sete_response_rate');
  const lowResponse = response && (response.status === 'warning' || response.status === 'critical') && response.value !== null;
  const cautionFor = (code: KpiCode) =>
    lowResponse && (code === 'sete_mean' || code === 'faculty_standard_rate')
      ? 'Low SETE participation. Interpret with caution.'
      : null;

  const trendRows = (trend.data ?? []).filter((r) => r.kpi_code === focusKpi?.kpi_code);
  const scoreDirection = focusKpi?.direction === 'lower_is_better' ? 1 : -1;
  const deptRows = (depts.data ?? [])
    .filter((row) => row.kpi_code === focusKpi?.kpi_code)
    .sort((a, b) => {
      const nameA = a.department_name.replace(/^Department of /, '');
      const nameB = b.department_name.replace(/^Department of /, '');
      const byName = nameA.localeCompare(nameB);
      if (departmentOrder === 'name') return byName;
      if (a.value === null) return b.value === null ? byName : 1;
      if (b.value === null) return -1;

      const bestFirst = scoreDirection * (a.value - b.value);
      if (departmentOrder === 'priority') {
        return STATUS_RANK[a.status] - STATUS_RANK[b.status] || -bestFirst || byName;
      }
      return bestFirst || byName;
    });
  const departments = depts.data ?? [];
  const responsesByDepartment = new Map(
    departments.filter((row) => row.kpi_code === 'sete_response_rate').map((row) => [row.department_id, row]),
  );
  const coveragePoints = departments.flatMap<SeteCoveragePoint>((row) => {
    if (row.kpi_code !== 'sete_mean' || row.value === null) return [];
    const participation = responsesByDepartment.get(row.department_id);
    if (participation?.value == null) return [];
    return [{
      id: row.department_id,
      department: row.department_name.replace(/^Department of /, ''),
      score: row.value,
      rate: participation.value,
      responses: row.sample_size,
      status: participation.status,
    }];
  });
  const filteredCoverage = coveragePoints.filter(({ status }) => {
    if (coverageFilter === 'low') return status === 'warning' || status === 'critical';
    if (coverageFilter === 'on-target') return status === 'on_target';
    return true;
  });
  const ratingBands = countRatingBands(faculty.data ?? [], ratingScale);
  const selectedDepartment = filters.departmentId !== null;
  const year = reference?.academicYears.find((a) => a.id === filters.academicYearId);
  const semester = reference?.semesters.find((s) => s.id === filters.semesterId);
  const reportingPeriod = [year ? `AY ${year.label}` : 'All academic years', semester?.name].filter(Boolean).join(' · ');
  const scopeLabel = filters.collegeId || selectedDepartment ? describe.scope : 'Institution-wide';
  const selectDepartment = (departmentId: number | null) => {
    setFilters({ departmentId });
    metricsRegion.current?.focus();
  };
  const scopeShort = filters.departmentId
    ? (reference?.departments.find((d) => d.id === filters.departmentId)?.code ?? 'Selection')
    : filters.collegeId
      ? (reference?.colleges.find((c) => c.id === filters.collegeId)?.code ?? 'Selection')
      : 'Institution';
  const compareCriteria = filters.collegeId !== null || filters.departmentId !== null;

  return (
    <div className="overview space-y-4">
      <DashboardHeader period={reportingPeriod} scope={scopeLabel} />

      <section
        ref={metricsRegion}
        tabIndex={-1}
        aria-label="Key performance indicators"
        aria-busy={summary.isLoading || summary.isRefreshing}
      >
        {summary.error ? (
          <div className="card">
            <ErrorState error={summary.error} onRetry={summary.refetch} minHeight={180} />
          </div>
        ) : summary.isLoading ? (
          <div className="card">
            <LoadingState label="Calculating KPIs…" minHeight={180} />
          </div>
        ) : noData ? (
          <div className="card">
            <EmptyState
              minHeight={200}
              title="No Academic or SETE Records for This Selection"
              message={
                <>
                  Nothing was recorded for <strong>{describe.scope}</strong> in <strong>{describe.period}</strong> (for example, a department
                  that did not exist yet). Choose another period or scope.
                </>
              }
            />
          </div>
        ) : (
          <div className={`overview-metrics grid gap-3 ${summary.isRefreshing ? 'refreshing' : ''}`} data-testid="kpi-grid">
            {KPI_GROUPS.map(({ icon: Icon, title, codes }) => (
              <section key={title} aria-label={title} className="min-w-0">
                <h2 className="mb-2.5 flex items-center gap-2 text-sm font-semibold text-ink">
                  <Icon size={19} className="shrink-0 text-accent" aria-hidden /> {title}
                </h2>
                <div className={`overview-kpi-group grid gap-2.5 ${codes.length === 3 ? 'overview-teaching-metrics' : 'overview-academic-metrics'}`}>
                  {kpis.filter((kpi) => codes.some((code) => code === kpi.kpi_code)).map((kpi) => (
                    <KpiCard
                      key={kpi.kpi_code}
                      kpi={kpi}
                      def={definitions.find((def) => def.code === kpi.kpi_code)}
                      formulaExplanation={kpi.kpi_code === 'faculty_standard_rate' ? facultyStandardFormula : undefined}
                      caution={cautionFor(kpi.kpi_code)}
                      selected={kpi.kpi_code === focus}
                      onSelect={() => setFocus(kpi.kpi_code)}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </section>

      {!noData && focusKpi && (
        <>
          <section aria-labelledby="performance-and-priorities" className="space-y-2.5">
            <h2 id="performance-and-priorities" className="text-lg font-semibold text-ink">Performance and Priorities</h2>
            <div className="overview-review grid gap-3">
              <div ref={trendPanel} tabIndex={-1} className="flex min-w-0 flex-col rounded-xl">
                <ChartCard
                  className="flex-1"
                  testId="card-trend"
                  title={`${focusKpi.kpi_name} by Term`}
                  subtitle={`Historical terms · ${scopeLabel}${semester ? ` · ${semester.name} only` : ''}`}
                  actions={
                    <div className="flex min-w-0 items-center gap-1.5">
                      <label htmlFor={measureId} className="text-xs font-medium text-ink-2">Measure</label>
                      <select
                        id={measureId}
                        className="field !min-h-8 !w-auto max-w-full !px-2 !py-1 text-xs"
                        value={focusKpi.kpi_code}
                        onChange={(event) => setFocus(event.target.value as KpiCode)}
                      >
                        {kpis.map((kpi) => <option key={kpi.kpi_code} value={kpi.kpi_code}>{kpi.short_name}</option>)}
                      </select>
                    </div>
                  }
                  isLoading={trend.isLoading}
                  isRefreshing={trend.isRefreshing}
                  error={trend.error}
                  onRetry={trend.refetch}
                  isEmpty={trendRows.every((r) => r.value === null)}
                  table={{
                    caption: `${focusKpi.kpi_name} by Term`,
                    columns: [
                      { key: 'term', label: 'Term' },
                      { key: 'value', label: focusKpi.short_name, align: 'right' },
                      { key: 'n', label: KPI_SAMPLE_LABEL[focusKpi.kpi_code], align: 'right' },
                    ],
                    rows: trendRows.map((r) => ({
                      term: `${r.semester_name} · AY ${r.academic_year_label}${r.in_selected_period ? ' (selected)' : ''}`,
                      value: formatValue(r.value, focusKpi.unit, focusKpi.decimals),
                      n: formatInt(r.sample_size),
                    })),
                  }}
                >
                  <TrendChart rows={trendRows} kpi={focusKpi} minHeight={260} />
                </ChartCard>
              </div>
              <ChartCard
                testId="card-grades"
                title="Final Grade Distribution"
                subtitle="Darker bars show a larger share."
                isLoading={grades.isLoading}
                isRefreshing={grades.isRefreshing}
                error={grades.error}
                onRetry={grades.refetch}
                isEmpty={(grades.data ?? []).every((band) => band.students === 0)}
                table={{
                  caption: 'Final Grade Distribution',
                  columns: [
                    { key: 'band', label: 'Outcome' },
                    { key: 'range', label: 'Grades' },
                    { key: 'n', label: 'Enrolments', align: 'right' },
                    { key: 'share', label: 'Share', align: 'right' },
                  ],
                  rows: (grades.data ?? []).map((band) => ({
                    band: band.band_label,
                    range: band.grade_range,
                    n: formatInt(band.students),
                    share: formatValue(band.percentage, 'percent', 1),
                  })),
                }}
              >
                <GradeDistributionChart rows={grades.data ?? []} />
              </ChartCard>
              <div className="overview-alerts flex min-w-0 [&>section]:w-full">
                {depts.data && summary.data ? (
                  <AlertsPanel
                    key={filterKey}
                    summary={summary.data}
                    departments={depts.data}
                    scopeLabel={scopeLabel}
                    definitions={definitions}
                    departmentSelected={selectedDepartment}
                    onReview={(code, departmentId) => {
                      setFocus(code);
                      if (departmentId !== undefined) selectDepartment(departmentId);
                      else trendPanel.current?.focus();
                    }}
                  />
                ) : (
                  <div className="card">{depts.error ? <ErrorState error={depts.error} onRetry={depts.refetch} /> : <LoadingState />}</div>
                )}
              </div>
            </div>
          </section>

          <section aria-labelledby="department-comparison" className="space-y-2.5">
            <h2 id="department-comparison" className="text-lg font-semibold text-ink">Department Comparison</h2>
            <div className="overview-comparisons grid gap-3">
              <ChartCard
                testId="card-departments"
                title={`${focusKpi.kpi_name} by Department`}
                subtitle={
                  <>
                    <span>{reportingPeriod} · {focusKpi.direction === 'lower_is_better' ? 'lower is better' : 'higher is better'}</span>
                    <span className="mt-1 block text-xs">
                      {selectedDepartment ? (
                        <button type="button" className="cursor-pointer font-semibold text-accent hover:underline" onClick={() => selectDepartment(null)}>
                          Back to department comparison
                        </button>
                      ) : 'Select a bar or a department link in Table to drill down.'}
                    </span>
                  </>
                }
                actions={deptRows.length > 1 && (
                  <div className="flex min-w-0 items-center gap-1.5">
                    <label htmlFor={sortId} className="text-xs font-medium text-ink-2">Sort</label>
                    <select
                      id={sortId}
                      className="field !min-h-8 !w-auto max-w-full !px-2 !py-1 text-xs"
                      value={departmentOrder}
                      onChange={(event) => setDepartmentOrder(event.target.value as DepartmentOrder)}
                    >
                      <option value="performance">Best performance</option>
                      <option value="priority">Needs review first</option>
                      <option value="name">Department name</option>
                    </select>
                  </div>
                )}
                isLoading={depts.isLoading}
                isRefreshing={depts.isRefreshing}
                error={depts.error}
                onRetry={depts.refetch}
                isEmpty={deptRows.every((r) => r.value === null)}
                table={{
                    caption: `${focusKpi.kpi_name} by Department`,
                  columns: [
                    { key: 'dept', label: 'Department' },
                    { key: 'college', label: 'College' },
                    { key: 'value', label: focusKpi.short_name, align: 'right' },
                    { key: 'target', label: 'Target', align: 'right' },
                    { key: 'status', label: 'Status' },
                    { key: 'n', label: KPI_SAMPLE_LABEL[focusKpi.kpi_code], align: 'right' },
                  ],
                  rows: deptRows.map((r) => ({
                    dept: selectedDepartment ? r.department_name.replace('Department of ', '') : (
                      <button
                        type="button"
                        onClick={() => selectDepartment(r.department_id)}
                        className="cursor-pointer font-medium text-accent hover:underline"
                      >
                        {r.department_name.replace('Department of ', '')}
                      </button>
                    ),
                    college: r.college_code,
                    value: formatValue(r.value, focusKpi.unit, focusKpi.decimals),
                    target: formatValue(r.target, focusKpi.unit, focusKpi.decimals),
                    status: <StatusBadge status={r.status} compact />,
                    n: formatInt(r.sample_size),
                  })),
                }}
              >
                <DepartmentChart
                  rows={deptRows}
                  kpi={focusKpi}
                  onSelectDepartment={selectedDepartment ? undefined : selectDepartment}
                />
              </ChartCard>
              <ChartCard
                testId="card-matrix"
                title="Department KPI Matrix"
                subtitle="Darker blue marks greater risk against each department’s targets."
                actions={!selectedDepartment && departments.length > kpis.length && (
                  <div className="flex items-center gap-1.5">
                    <label htmlFor={matrixSortId} className="text-[13px] font-medium text-ink-2">Order</label>
                    <select id={matrixSortId} className="field !min-h-9 !w-auto !px-2 !py-1 text-[13px]" value={matrixOrder}
                      onChange={(event) => setMatrixOrder(event.target.value as 'name' | 'priority')}>
                      <option value="name">Department name</option>
                      <option value="priority">Most critical first</option>
                    </select>
                  </div>
                )}
                isLoading={depts.isLoading}
                isRefreshing={depts.isRefreshing}
                error={depts.error}
                onRetry={depts.refetch}
                isEmpty={departments.length === 0}
              >
                <DepartmentStatusMatrix rows={departments} kpis={kpis} order={matrixOrder} onSelect={selectedDepartment ? undefined : selectDepartment} />
              </ChartCard>
            </div>
          </section>

          <section aria-labelledby="teaching-evidence" className="space-y-2.5">
            <h2 id="teaching-evidence" className="text-lg font-semibold text-ink">Teaching Evaluation Evidence</h2>
            <div className="overview-teaching-evidence grid gap-3">
              <ChartCard
                testId="card-criteria"
                title="SETE Criteria Breakdown"
                subtitle={
                  compareCriteria
                    ? `Mean score per criterion (1–5) · ${scopeShort} and institution · ${reportingPeriod}`
                    : `Mean score per criterion (1–5) · ${reportingPeriod}`
                }
                isLoading={criteria.isLoading}
                isRefreshing={criteria.isRefreshing}
                error={criteria.error}
                onRetry={criteria.refetch}
                isEmpty={(criteria.data ?? []).every((r) => r.scope_mean === null)}
                emptyMessage="No SETE responses (or too few to report anonymously) for this selection."
                table={{
                  caption: 'Mean SETE Score by Criterion',
                  columns: [
                    { key: 'criterion', label: 'Criterion' },
                    { key: 'scope', label: scopeShort, align: 'right' },
                    ...(compareCriteria ? [{ key: 'inst', label: 'Institution', align: 'right' as const }] : []),
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
                <CriteriaChart rows={criteria.data ?? []} scopeLabel={scopeShort} compare={compareCriteria} />
              </ChartCard>
              <ChartCard
                testId="card-sete-coverage"
                title="SETE Participation and Rating"
                subtitle="Each dot is a department · rating out of 5"
                inlineActions
                actions={(coveragePoints.length > 1 || coverageFilter !== 'all') && (
                  <div>
                    <label htmlFor={coverageFilterId} className="sr-only">Filter by participation status</label>
                    <select id={coverageFilterId} className="field !min-h-9 !w-auto !px-2 !py-1 text-[13px]" value={coverageFilter}
                      onChange={(event) => setCoverageFilter(event.target.value as CoverageFilter)}>
                      <option value="all">All statuses</option>
                      <option value="low">Low</option>
                      <option value="on-target">On target</option>
                    </select>
                  </div>
                )}
                isLoading={depts.isLoading}
                isRefreshing={depts.isRefreshing}
                error={depts.error}
                onRetry={depts.refetch}
                isEmpty={filteredCoverage.length === 0}
                emptyMessage={coveragePoints.length === 0 ? 'No departments have both a reportable score and a participation rate.' : 'No departments match this participation filter.'}
                footer={<p className="text-[13px] text-ink-2">Darker dots flag higher participation risk. Low participation can make SETE ratings less representative.</p>}
                table={{
                  caption: 'SETE Participation and Rating by Department',
                  columns: [
                    { key: 'dept', label: 'Department' },
                    { key: 'score', label: 'Score / 5', align: 'right' },
                    { key: 'rate', label: 'Participation', align: 'right' },
                    { key: 'status', label: 'Participation status' },
                  ],
                  rows: filteredCoverage.map((point) => ({
                    dept: point.department,
                    score: point.score.toFixed(2),
                    rate: `${point.rate.toFixed(1)}%`,
                    status: STATUS_LABEL[point.status],
                  })),
                }}
              >
                <SeteCoverageChart points={filteredCoverage} scalePoints={coveragePoints} />
              </ChartCard>
              <ChartCard
                testId="card-faculty-rating"
                title="Faculty Rating Distribution"
                subtitle="Faculty grouped by mean SETE score, rounded to two decimal places."
                inlineActions
                isLoading={faculty.isLoading}
                isRefreshing={faculty.isRefreshing}
                error={faculty.error}
                onRetry={faculty.refetch}
                isEmpty={ratingBands.rated === 0}
                emptyMessage="No reportable faculty ratings for this selection."
                table={{
                  caption: 'Faculty Rating Distribution',
                  columns: [
                    { key: 'band', label: 'Rating band' },
                    { key: 'scoreRange', label: 'Mean SETE score', align: 'right' },
                    { key: 'n', label: 'Faculty', align: 'right' },
                    { key: 'share', label: 'Share of rated faculty', align: 'right' },
                  ],
                  rows: ratingBands.bands.map((band) => ({
                    band: band.label,
                    scoreRange: band.scoreRange ?? '—',
                    n: formatInt(band.count),
                    share: `${band.pct.toFixed(1)}%`,
                  })),
                }}
              >
                <RatingDonut rows={faculty.data ?? []} ratingScale={ratingScale} />
              </ChartCard>
            </div>
            <aside className="flex items-start gap-2.5 rounded-xl border border-line bg-surface px-3.5 py-3 shadow-xs" aria-labelledby="sete-interpretation" data-testid="overview-responsible-use">
              <ShieldCheck size={18} className="mt-0.5 shrink-0 text-accent" aria-hidden />
              <div className="space-y-1 text-sm leading-relaxed text-ink-2">
                <h2 id="sete-interpretation" className="font-semibold text-ink">Interpreting SETE</h2>
                {response?.value != null && (
                  <p>
                    SETE responses cover <strong className="text-ink">{formatValue(response.value, response.unit, response.decimals)}</strong> of eligible enrolments.
                    {lowResponse && ' Low participation may make the scores less representative.'}
                  </p>
                )}
                <p>
                  Use SETE as one input alongside course context and peer observations. Faculty results are shown in aggregate.{' '}
                  {minSeteResponses != null
                    ? `A faculty member needs at least ${formatInt(minSeteResponses)} SETE responses in this scope for their rating to be included.`
                    : 'Ratings based on too few responses are suppressed.'}
                </p>
              </div>
            </aside>
          </section>
        </>
      )}
      <footer className="grid gap-2.5 border-t border-line py-3 text-[13px] leading-relaxed text-ink-2 sm:grid-cols-2">
        <p><strong className="text-ink">Source records</strong> · Synthetic portal enrolments and final grades, plus anonymous SETE responses.</p>
        <p><strong className="text-ink">Calculated analytics</strong> · KPIs, comparisons and alerts use the selected scope. Portal–SETE integration is a proposed enhancement.</p>
      </footer>
    </div>
  );
}
