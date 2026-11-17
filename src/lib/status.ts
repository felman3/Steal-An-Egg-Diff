import type { KpiStatus } from './types';

/** Fill colours for status-encoded marks (paired with labels in every chart). */
export const STATUS_FILL: Record<KpiStatus, string> = {
  on_target: 'var(--series-1)',
  below_target: 'var(--series-1-soft)',
  warning: 'var(--status-warning)',
  critical: 'var(--status-critical)',
  no_data: 'var(--grid)',
  insufficient_data: 'var(--grid)',
};
