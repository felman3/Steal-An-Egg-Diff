import { CircleCheck } from 'lucide-react';
import { Link, useLocation } from 'react-router';
import { formatValue, STATUS_LABEL, STATUS_RANK } from '../lib/format';
import type { DepartmentKpiRow, KpiSummaryRow } from '../lib/types';
import { StatusIcon } from './StatusBadge';

interface Alert {
  key: string;
  scope: string;
  kpi: KpiSummaryRow;
  value: number;
  status: 'warning' | 'critical';
  threshold: number;
}

/** Warning indicators: every KPI that crossed a stored alert threshold. */
export function AlertsPanel({ summary, departments, scopeLabel }: { summary: KpiSummaryRow[]; departments: DepartmentKpiRow[]; scopeLabel: string }) {
  const location = useLocation();
  const byCode = new Map(summary.map((k) => [k.kpi_code, k]));
  const alerts: Alert[] = [];

  for (const k of summary) {
    if ((k.status === 'warning' || k.status === 'critical') && k.value !== null) {
      alerts.push({ key: `all-${k.kpi_code}`, scope: scopeLabel, kpi: k, value: k.value, status: k.status, threshold: k.status === 'critical' ? k.critical_threshold : k.warning_threshold });
    }
  }
  for (const d of departments) {
    const k = byCode.get(d.kpi_code);
    if (k && (d.status === 'warning' || d.status === 'critical') && d.value !== null) {
      alerts.push({
        key: `${d.department_code}-${d.kpi_code}`,
        scope: `${d.department_code} · ${d.department_name.replace('Department of ', '')}`,
        kpi: k,
        value: d.value,
        status: d.status,
        threshold: d.status === 'critical' ? d.critical_threshold : d.warning_threshold,
      });
    }
  }
  alerts.sort((a, b) => STATUS_RANK[a.status] - STATUS_RANK[b.status] || a.scope.localeCompare(b.scope));
  const critical = alerts.filter((a) => a.status === 'critical').length;
  const shown = alerts.slice(0, 6);

  return (
    <section className="card flex flex-col p-4 sm:p-5" aria-labelledby="alerts-heading" data-testid="alerts-panel">
      <header className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h2 id="alerts-heading" className="text-[15px] font-semibold text-ink">
            Alerts
          </h2>
          <p className="mt-0.5 text-[13px] text-ink-2">KPIs past a stored warning or critical threshold</p>
        </div>
        <span
          className="tabular shrink-0 whitespace-nowrap rounded-full bg-sunken px-2.5 py-1 text-xs font-semibold text-ink"
          aria-label={`${alerts.length} alerts, ${critical} critical`}
          data-testid="alert-count"
        >
          {alerts.length} alert{alerts.length === 1 ? '' : 's'} · {critical} critical
        </span>
      </header>
      {alerts.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 py-8 text-center">
          <CircleCheck className="text-good" size={26} aria-hidden />
          <p className="text-sm font-medium text-ink">No warnings or critical alerts</p>
          <p className="text-xs text-ink-2">Every KPI in this selection is within its alert thresholds.</p>
        </div>
      ) : (
        <ul className="flex flex-1 flex-col divide-y divide-line">
          {shown.map((a) => (
            <li key={a.key} className="flex items-start gap-2.5 py-2.5 first:pt-0">
              <StatusIcon status={a.status} size={17} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-ink">{a.scope}</p>
                <p className="text-xs text-ink-2">
                  {a.kpi.short_name} <strong className="tabular text-ink">{formatValue(a.value, a.kpi.unit, a.kpi.decimals)}</strong> · {STATUS_LABEL[a.status]}{' '}
                  {a.kpi.direction === 'higher_is_better' ? 'below' : 'above'} {formatValue(a.threshold, a.kpi.unit, a.kpi.decimals)}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
      {alerts.length > shown.length && (
        <Link to={{ pathname: '/departments', search: location.search }} className="mt-3 text-sm font-medium text-accent hover:underline">
          View all {alerts.length} alerts in the scorecard →
        </Link>
      )}
    </section>
  );
}
