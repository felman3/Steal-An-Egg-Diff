import type { KpiStatus } from './types';

/** Fill colours for status-encoded marks (paired with labels in every chart). */
export const STATUS_FILL: Record<KpiStatus, string> = {
  on_target: 'var(--status-fill-good)',
  below_target: 'var(--status-fill-off-target)',
  warning: 'var(--status-fill-warning)',
  critical: 'var(--status-fill-critical)',
  no_data: 'var(--grid)',
  insufficient_data: 'var(--grid)',
};

export function magnitudeBlue(value: number, max: number) {
  const intensity = max > 0 ? Math.min(100, Math.max(0, value / max * 100)) : 0;
  return `color-mix(in srgb, var(--chart-tone-high) ${intensity}%, var(--chart-tone-low))`;
}
