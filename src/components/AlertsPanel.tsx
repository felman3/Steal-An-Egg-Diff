import { CircleCheck } from 'lucide-react';
import { Link, useLocation } from 'react-router';
import { formatValue, STATUS_LABEL, STATUS_RANK } from '../lib/format';
import type { AppRole, DepartmentKpiRow, FacultyRow, KpiDefinition, KpiSummaryRow } from '../lib/types';
import { StatusIcon } from './StatusBadge';

interface Alert {
  key: string;
  scope: string;
  kpi: KpiSummaryRow;
  value: number;
  status: 'warning' | 'critical';
  threshold: number;
}

/**
 * Warning indicators: every KPI that crossed a stored alert threshold, with the next step.
 * - administrator / dean: the scope overall, then each department
 * - program chair: the program overall, then each faculty member below the SETE threshold
 * - faculty member: their own KPIs, with advice addressed to them
 */
export function AlertsPanel({
  role,
  summary,
  departments = [],
  faculty = [],
  scopeLabel,
  definitions = [],
}: {
  role: AppRole;
  summary: KpiSummaryRow[];
  departments?: DepartmentKpiRow[];
  faculty?: FacultyRow[];
  scopeLabel: string;
  definitions?: KpiDefinition[];
}) {
  const location = useLocation();
  const actionFor = (code: string, status: 'warning' | 'critical') => {
    const d = definitions.find((x) => x.code === code);
    if (role === 'faculty') return d?.faculty_action;
    return status === 'critical' ? d?.critical_action : d?.warning_action;
  };
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
  const sete = byCode.get('sete_mean');
  if (sete) {
    for (const f of faculty) {
      if ((f.status === 'warning' || f.status === 'critical') && f.mean_rating !== null) {
        alerts.push({
          key: `fac-${f.faculty_id}`,
          scope: f.pseudonym,
          kpi: sete,
          value: f.mean_rating,
          status: f.status,
          threshold: f.status === 'critical' ? f.critical_threshold : f.warning_threshold,
        });
      }
    }
  }
  alerts.sort((a, b) => STATUS_RANK[a.status] - STATUS_RANK[b.status] || a.scope.localeCompare(b.scope));
  const critical = alerts.filter((a) => a.status === 'critical').length;
  const shown = alerts.slice(0, 3);
  const more = role === 'chair' || role === 'dean' ? { to: '/faculty', label: 'faculty results' } : role === 'faculty' ? null : { to: '/departments', label: 'the scorecard' };

  return (
    <section className="card flex flex-col p-4 sm:p-5" aria-labelledby="alerts-heading" data-testid="alerts-panel">
      <header className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h2 id="alerts-heading" className="text-[15px] font-semibold text-ink">
            Alerts
          </h2>
          <p className="mt-0.5 text-[13px] text-ink-2">
            {role === 'faculty' ? 'Your KPIs past a stored threshold, with a suggested next step' : 'KPIs past a stored threshold, with the recommended management action'}
          </p>
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
                {actionFor(a.kpi.kpi_code, a.status) && (
                  <p className="mt-1 text-xs leading-snug text-ink-2" data-testid="alert-action">
                    <strong className="font-semibold text-ink">{role === 'faculty' ? 'Next step:' : 'Action:'}</strong> {actionFor(a.kpi.kpi_code, a.status)}
                  </p>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      {alerts.length > shown.length &&
        (more ? (
          <Link to={{ pathname: more.to, search: location.search }} className="mt-3 text-sm font-medium text-accent hover:underline">
            View all {alerts.length} alerts in {more.label} →
          </Link>
        ) : (
          <p className="mt-3 text-xs text-ink-muted">+ {alerts.length - shown.length} more alert(s) shown on the KPI cards above.</p>
        ))}
    </section>
  );
}
