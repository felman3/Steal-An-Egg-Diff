import { formatValue, STATUS_LABEL } from '../../lib/format';
import { STATUS_FILL } from '../../lib/status';
import type { DepartmentKpiRow, KpiStatus, KpiSummaryRow } from '../../lib/types';
import { StatusIcon } from '../StatusBadge';

const legend: KpiStatus[] = ['on_target', 'below_target', 'warning', 'critical'];

export function DepartmentStatusMatrix({ rows, kpis, order, onSelect }: {
  rows: DepartmentKpiRow[];
  kpis: KpiSummaryRow[];
  order: 'name' | 'priority';
  onSelect?: (departmentId: number) => void;
}) {
  const departments = new Map<number, { code: string; name: string; critical: number; warnings: number; cells: Map<string, DepartmentKpiRow> }>();
  for (const row of rows) {
    const department = departments.get(row.department_id) ?? {
      code: row.department_code,
      name: row.department_name.replace(/^Department of /, ''),
      critical: 0,
      warnings: 0,
      cells: new Map(),
    };
    department.cells.set(row.kpi_code, row);
    if (row.status === 'critical') department.critical += 1;
    if (row.status === 'warning') department.warnings += 1;
    departments.set(row.department_id, department);
  }
  const ordered = [...departments].sort(([, a], [, b]) => {
    const byName = a.name.localeCompare(b.name);
    return order === 'priority' ? b.critical - a.critical || b.warnings - a.warnings || byName : byName;
  });

  return (
    <div data-testid="department-matrix" className="space-y-2.5">
      <div className="relative max-h-[452px] overflow-auto rounded-lg border border-line" tabIndex={0} role="region" aria-label="Scrollable department KPI matrix">
        <table className="w-full min-w-[600px] table-fixed text-[13px]">
          <caption className="sr-only">Five calculated indicators, with status relative to each department's own targets</caption>
          <thead className="sticky top-0 z-20 bg-sunken text-ink-2">
            <tr>
              <th scope="col" className="sticky left-0 z-10 w-[27%] bg-sunken px-2.5 py-2 text-left">Department</th>
              {kpis.map((kpi) => <th key={kpi.kpi_code} scope="col" className="px-1.5 py-2 leading-tight" title={kpi.kpi_name}>{kpi.short_name}</th>)}
            </tr>
          </thead>
          <tbody>
            {ordered.map(([id, department]) => (
              <tr key={id} className="border-t border-line">
                <th scope="row" className="sticky left-0 z-10 bg-surface px-2.5 py-1.5 text-left font-medium text-ink">
                  {onSelect ? (
                    <button type="button" onClick={() => onSelect(id)} className="w-full cursor-pointer truncate text-left text-accent hover:underline" title={`${department.code} · ${department.name}`}>
                      {department.name}
                    </button>
                  ) : <span className="block truncate" title={department.name}>{department.name}</span>}
                </th>
                {kpis.map((kpi) => {
                  const cell = department.cells.get(kpi.kpi_code);
                  const status = cell?.status ?? 'no_data';
                  const target = cell && formatValue(cell.target, kpi.unit, kpi.decimals);
                  return (
                    <td key={kpi.kpi_code} className="p-0.5 text-center" title={target ? `${STATUS_LABEL[status]} · Target ${target}` : STATUS_LABEL[status]}>
                      <span className="matrix-cell status-tone tabular flex min-h-7 items-center justify-center gap-1 rounded text-ink" data-status={status}>
                        <StatusIcon status={status} size={13} />
                        {formatValue(cell?.value ?? null, kpi.unit, kpi.decimals)}
                        <span className="sr-only">{STATUS_LABEL[status]}</span>
                      </span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-ink-2 sm:hidden">Scroll the table horizontally to see all five KPIs.</p>
      <ul className="flex flex-wrap gap-x-3 gap-y-1 text-[13px] text-ink-2" aria-label="Matrix status legend">
        {legend.map((status) => (
          <li key={status} className="inline-flex items-center gap-1.5">
            <span aria-hidden className="size-3 rounded-sm border border-line-strong" style={{ background: STATUS_FILL[status] }} />
            {STATUS_LABEL[status]}
          </li>
        ))}
      </ul>
    </div>
  );
}
