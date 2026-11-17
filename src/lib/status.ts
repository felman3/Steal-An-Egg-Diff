import type { KpiStatus, KpiSummaryRow } from './types';

/** Fill colours for status-encoded marks (paired with labels in every chart). */
export const STATUS_FILL: Record<KpiStatus, string> = {
  on_target: 'var(--series-1)',
  below_target: 'var(--series-1-soft)',
  warning: 'var(--status-warning)',
  critical: 'var(--status-critical)',
  no_data: 'var(--grid)',
  insufficient_data: 'var(--grid)',
};

/** Same ladder the database uses (private.kpi_status), for values compared client-side such as one class. */
export function statusOf(value: number | null, kpi: Pick<KpiSummaryRow, 'target' | 'warning_threshold' | 'critical_threshold' | 'direction'>): KpiStatus {
  if (value === null) return 'insufficient_data';
  const better = (a: number, b: number) => (kpi.direction === 'higher_is_better' ? a >= b : a <= b);
  if (better(value, kpi.target)) return 'on_target';
  if (better(value, kpi.warning_threshold)) return 'below_target';
  if (better(value, kpi.critical_threshold)) return 'warning';
  return 'critical';
}
