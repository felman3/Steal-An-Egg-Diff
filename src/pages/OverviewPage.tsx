import { useId, useState } from 'react';
import { AlertsPanel } from '../components/AlertsPanel';
import { PageHeader } from '../components/AppShell';
import { ChartCard } from '../components/ChartCard';
import { CriteriaChart } from '../components/charts/CriteriaChart';
import { DepartmentChart } from '../components/charts/DepartmentChart';
import { TrendChart } from '../components/charts/TrendChart';
import { KpiCard } from '../components/KpiCard';
import { StatusBadge } from '../components/StatusBadge';
import { EmptyState, ErrorState, LoadingState } from '../components/States';
import { useFilters } from '../filters/FiltersProvider';
import { fetchDepartmentKpis, fetchKpiSummary, fetchKpiTrend, fetchSeteCriteria } from '../lib/api';
import { formatInt, formatValue, STATUS_LABEL } from '../lib/format';
import type { KpiCode } from '../lib/types';
import { useQuery } from '../lib/useQuery';

export function OverviewPage() {
  const { filters, filterKey, describe, reference } = useFilters();
  const summary = useQuery(`summary|${filterKey}`, () => fetchKpiSummary(filters));
  const trend = useQuery(`trend|${filterKey}`, () => fetchKpiTrend(filters));
  const depts = useQuery(`depts|${filterKey}`, () => fetchDepartmentKpis(filters));
  const criteria = useQuery(`criteria|${filterKey}`, () => fetchSeteCriteria(filters));
  const [focus, setFocus] = useState<KpiCode>('sete_mean');
  const measureId = useId();

  const kpis = summary.data ?? [];
  const focusKpi = kpis.find((k) => k.kpi_code === focus) ?? kpis[0];
  const noData = kpis.length > 0 && kpis.every((k) => k.sample_size === 0);

  const trendRows = (trend.data ?? []).filter((r) => r.kpi_code === focusKpi?.kpi_code);
  const trendValues = (code: KpiCode) =>
    (trend.data ?? [])
      .filter((r) => r.kpi_code === code)
      .sort((a, b) => a.term_start.localeCompare(b.term_start))
      .map((r) => r.value);
  const deptRows = (depts.data ?? []).filter((r) => r.kpi_code === focusKpi?.kpi_code);
  const scopeShort = filters.departmentId
    ? (reference?.departments.find((d) => d.id === filters.departmentId)?.code ?? 'Selection')
    : filters.collegeId
      ? (reference?.colleges.find((c) => c.id === filters.collegeId)?.code ?? 'Selection')
      : 'Institution';
  const compareCriteria = filters.collegeId !== null || filters.departmentId !== null;

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
      <PageHeader title="Overview" />

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
          {kpis.map((k) => (
            <KpiCard key={k.kpi_code} kpi={k} trend={trendValues(k.kpi_code)} selected={k.kpi_code === focusKpi?.kpi_code} onSelect={() => setFocus(k.kpi_code)} />
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
            {depts.data && summary.data ? (
              <AlertsPanel summary={summary.data} departments={depts.data} scopeLabel={describe.scope} />
            ) : (
              <div className="card">{depts.error ? <ErrorState error={depts.error} onRetry={depts.refetch} /> : <LoadingState />}</div>
            )}
          </div>

          <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
            <ChartCard
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
              <DepartmentChart rows={deptRows} kpi={focusKpi} />
            </ChartCard>

            <ChartCard
              testId="card-criteria"
              title="SETE criteria breakdown"
              subtitle={
                compareCriteria
                  ? `Mean score per criterion (1–5) · ${describe.scope} vs institution · ${describe.period}`
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
                  { key: 'inst', label: 'Institution', align: 'right' },
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
          </div>

          <p className="mt-5 text-xs text-ink-muted">
            Statuses: {(['on_target', 'below_target', 'warning', 'critical'] as const).map((s) => STATUS_LABEL[s]).join(' · ')} — computed in the
            database from the stored target, warning and critical thresholds. Hover a KPI card for its definition and formula.
          </p>
        </>
      )}
    </>
  );
}
