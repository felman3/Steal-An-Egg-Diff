import { ArrowRight, CircleCheck, ListChecks } from 'lucide-react';
import { useState } from 'react';
import { formatValue, STATUS_LABEL, STATUS_RANK } from '../lib/format';
import { STATUS_FILL } from '../lib/status';
import type { DepartmentKpiRow, KpiCode, KpiDefinition, KpiSummaryRow } from '../lib/types';
import { StatusIcon } from './StatusBadge';

const VISIBLE_ALERTS = 2;

interface Alert {
  key: string;
  scope: string;
  kpi: KpiSummaryRow;
  value: number;
  status: 'warning' | 'critical';
  threshold: number;
  departmentId?: number;
}

/** Warning indicators: every KPI that crossed a stored alert threshold. */
export function AlertsPanel({
  summary,
  departments,
  scopeLabel,
  departmentSelected,
  onReview,
  definitions = [],
}: {
  summary: KpiSummaryRow[];
  departments: DepartmentKpiRow[];
  scopeLabel: string;
  departmentSelected: boolean;
  onReview: (code: KpiCode, departmentId?: number) => void;
  definitions?: KpiDefinition[];
}) {
  const actionFor = (code: string, status: 'warning' | 'critical') => {
    const d = definitions.find((x) => x.code === code);
    return status === 'critical' ? d?.critical_action : d?.warning_action;
  };
  const [expanded, setExpanded] = useState(false);
  const byCode = new Map(summary.map((k) => [k.kpi_code, k]));
  const alerts: Alert[] = [];

  for (const k of summary) {
    if ((k.status === 'warning' || k.status === 'critical') && k.value !== null) {
      alerts.push({ key: `all-${k.kpi_code}`, scope: scopeLabel, kpi: k, value: k.value, status: k.status, threshold: k.status === 'critical' ? k.critical_threshold : k.warning_threshold });
    }
  }
  for (const d of departmentSelected ? [] : departments) {
    const k = byCode.get(d.kpi_code);
    if (k && (d.status === 'warning' || d.status === 'critical') && d.value !== null) {
      alerts.push({
        key: `${d.department_code}-${d.kpi_code}`,
        scope: `${d.department_code} · ${d.department_name.replace('Department of ', '')}`,
        kpi: k,
        value: d.value,
        status: d.status,
        threshold: d.status === 'critical' ? d.critical_threshold : d.warning_threshold,
        departmentId: d.department_id,
      });
    }
  }
  alerts.sort((a, b) => STATUS_RANK[a.status] - STATUS_RANK[b.status] || a.scope.localeCompare(b.scope));
  const critical = alerts.filter((a) => a.status === 'critical').length;
  const shown = expanded ? alerts : alerts.slice(0, VISIBLE_ALERTS);

  return (
    <section className="card flex min-w-0 flex-col p-4 shadow-xs sm:p-5" aria-labelledby="alerts-heading" data-testid="alerts-panel">
      <header className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 id="alerts-heading" className="flex items-center gap-2 text-[17px] font-semibold text-ink">
            <ListChecks size={17} className="text-accent" aria-hidden /> Priority Alerts
          </h2>
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
          <p className="text-xs text-ink-2">No reported KPI crossed an alert threshold for this selection.</p>
        </div>
      ) : (
        <ul id="priority-alerts" aria-label="Priority alert list" tabIndex={0} className="grid max-h-[22rem] gap-2 overflow-y-auto pr-1">
          {shown.map((a) => (
            <li key={a.key} className="flex items-start gap-2.5 rounded-lg border border-line border-s-4 bg-page/75 p-3" style={{ borderInlineStartColor: STATUS_FILL[a.status] }}>
              <StatusIcon status={a.status} size={17} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-ink">{a.scope}</p>
                <p className="text-[13px] text-ink-2">
                  {a.kpi.short_name} <strong className="tabular text-ink">{formatValue(a.value, a.kpi.unit, a.kpi.decimals)}</strong> · {STATUS_LABEL[a.status]}{' '}
                  {a.kpi.direction === 'higher_is_better' ? 'below' : 'above'} {formatValue(a.threshold, a.kpi.unit, a.kpi.decimals)}
                </p>
                {actionFor(a.kpi.kpi_code, a.status) && (
                  <p className="mt-1.5 text-[13px] leading-relaxed text-ink-2" data-testid="alert-action">
                    <strong className="block font-semibold text-ink">Recommended Action</strong>
                    {actionFor(a.kpi.kpi_code, a.status)}
                  </p>
                )}
                <button
                  type="button"
                  className="mt-1 inline-flex min-h-7 cursor-pointer items-center gap-1 text-[13px] font-semibold text-accent hover:underline"
                  onClick={() => onReview(a.kpi.kpi_code, a.departmentId)}
                  aria-label={`Review ${a.kpi.short_name} for ${a.scope}`}
                >
                  {a.departmentId ? 'Review department' : 'Review trend'} <ArrowRight size={13} aria-hidden />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {alerts.length > VISIBLE_ALERTS && (
        <button
          type="button"
          aria-controls="priority-alerts"
          aria-expanded={expanded}
          className="mt-2 min-h-7 cursor-pointer self-start text-xs font-semibold text-accent hover:underline"
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? `Show top ${VISIBLE_ALERTS} alerts` : `Show all ${alerts.length} alerts`}
        </button>
      )}
    </section>
  );
}
