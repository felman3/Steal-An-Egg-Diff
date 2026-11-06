import { PageHeader } from '../components/AppShell';
import { ChartCard } from '../components/ChartCard';
import { GradeDistributionChart } from '../components/charts/GradeDistributionChart';
import { StatusIcon } from '../components/StatusBadge';
import { EmptyState, ErrorState, LoadingState } from '../components/States';
import { useFilters } from '../filters/FiltersProvider';
import { fetchDepartmentKpis, fetchGradeDistribution, fetchKpiSummary } from '../lib/api';
import { formatInt, formatValue, STATUS_LABEL } from '../lib/format';
import type { DepartmentKpiRow, KpiSummaryRow } from '../lib/types';
import { useQuery } from '../lib/useQuery';

export function DepartmentsPage() {
  const { filters, filterKey, describe } = useFilters();
  const summary = useQuery(`summary|${filterKey}`, () => fetchKpiSummary(filters));
  const depts = useQuery(`depts|${filterKey}`, () => fetchDepartmentKpis(filters));
  const grades = useQuery(`grades|${filterKey}`, () => fetchGradeDistribution(filters));

  const kpis = summary.data ?? [];
  const byDept = new Map<number, { code: string; name: string; college: string; cells: Map<string, DepartmentKpiRow> }>();
  for (const r of depts.data ?? []) {
    const entry = byDept.get(r.department_id) ?? { code: r.department_code, name: r.department_name.replace('Department of ', ''), college: r.college_code, cells: new Map() };
    entry.cells.set(r.kpi_code, r);
    byDept.set(r.department_id, entry);
  }
  const rows = [...byDept.values()];
  const alertCount = (depts.data ?? []).filter((r) => r.status === 'warning' || r.status === 'critical').length;

  return (
    <>
      <PageHeader title="Department scorecard" />
      <section className="card mb-5 p-4 sm:p-5" aria-labelledby="scorecard-heading" data-testid="scorecard">
        <header className="mb-3 flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 id="scorecard-heading" className="text-[15px] font-semibold text-ink">
              All five KPIs by department
            </h2>
            <p className="mt-0.5 text-[13px] text-ink-2">
              {describe.period} · each cell is compared with that department's own target and thresholds (college overrides apply)
            </p>
          </div>
          {depts.data && (
            <span className="tabular rounded-full bg-sunken px-2.5 py-1 text-xs font-semibold text-ink">{alertCount} alert{alertCount === 1 ? '' : 's'}</span>
          )}
        </header>
        {depts.error || summary.error ? (
          <ErrorState error={(depts.error ?? summary.error)!} onRetry={() => (depts.refetch(), summary.refetch())} />
        ) : depts.isLoading || summary.isLoading ? (
          <LoadingState />
        ) : rows.length === 0 ? (
          <EmptyState />
        ) : (
          <div className={`relative overflow-x-auto rounded-lg border border-line ${depts.isRefreshing ? 'refreshing' : ''}`}>
            <table className="w-full min-w-[760px] border-collapse text-sm">
              <caption className="sr-only">KPI values and statuses by department</caption>
              <thead className="bg-sunken text-left text-xs text-ink-2">
                <tr>
                  <th scope="col" className="px-3 py-2.5 font-semibold">
                    Department
                  </th>
                  {kpis.map((k) => (
                    <th key={k.kpi_code} scope="col" className="px-3 py-2.5 text-right font-semibold">
                      {k.short_name}
                      <span className="block font-normal text-ink-muted">
                        target {k.direction === 'lower_is_better' ? '≤' : '≥'} {formatValue(k.target, k.unit, k.decimals)}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="tabular">
                {rows.map((d) => (
                  <tr key={d.code} className="border-t border-line" data-testid={`scorecard-row-${d.code}`}>
                    <th scope="row" className="px-3 py-2.5 text-left font-medium text-ink">
                      {d.name}
                      <span className="ml-1.5 text-xs font-normal text-ink-muted">
                        {d.code} · {d.college}
                      </span>
                    </th>
                    {kpis.map((k) => (
                      <ScoreCell key={k.kpi_code} kpi={k} cell={d.cells.get(k.kpi_code)} />
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <ChartCard
        title="Final grade distribution"
        subtitle={`${describe.period} · ${describe.scope} · share of all enrolments (1.00 highest, 3.00 passing, 5.00 failed)`}
        isLoading={grades.isLoading}
        isRefreshing={grades.isRefreshing}
        error={grades.error}
        onRetry={grades.refetch}
        isEmpty={(grades.data ?? []).every((g) => g.students === 0)}
        table={{
          caption: 'Final grade distribution',
          columns: [
            { key: 'band', label: 'Band' },
            { key: 'range', label: 'Grades' },
            { key: 'n', label: 'Enrolments', align: 'right' },
            { key: 'pct', label: 'Share', align: 'right' },
          ],
          rows: (grades.data ?? []).map((g) => ({ band: g.band_label, range: g.grade_range, n: formatInt(g.students), pct: g.percentage === null ? '—' : `${g.percentage.toFixed(1)}%` })),
        }}
      >
        <GradeDistributionChart rows={grades.data ?? []} />
      </ChartCard>
    </>
  );
}

function ScoreCell({ kpi, cell }: { kpi: KpiSummaryRow; cell?: DepartmentKpiRow }) {
  if (!cell || cell.value === null) {
    return <td className="px-3 py-2.5 text-right text-ink-muted">No data</td>;
  }
  return (
    <td className="px-3 py-2.5 text-right" title={`${STATUS_LABEL[cell.status]} · target ${formatValue(cell.target, kpi.unit, kpi.decimals)} · n ${formatInt(cell.sample_size)}`}>
      <span className="inline-flex items-center justify-end gap-1.5">
        <span className={cell.status === 'warning' || cell.status === 'critical' ? 'font-semibold text-ink' : 'text-ink'}>
          {formatValue(cell.value, kpi.unit, kpi.decimals)}
        </span>
        <StatusIcon status={cell.status} size={15} />
        <span className="sr-only">{STATUS_LABEL[cell.status]}</span>
      </span>
    </td>
  );
}
