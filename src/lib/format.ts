import type { KpiDirection, KpiStatus, KpiUnit } from './types';

export function formatValue(value: number | null | undefined, unit: KpiUnit, decimals = 2): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  const n = value.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  return unit === 'percent' ? `${n}%` : n;
}

/** Signed difference, e.g. "+2.4 pts" / "−0.03". */
export function formatDelta(delta: number, unit: KpiUnit, decimals = 2): string {
  const sign = delta > 0 ? '+' : delta < 0 ? '−' : '±';
  const abs = Math.abs(delta).toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  return unit === 'percent' ? `${sign}${abs} pts` : `${sign}${abs}`;
}

/** Whether a change is an improvement, given which direction is good. */
export function isImprovement(delta: number, direction: KpiDirection): boolean | null {
  if (delta === 0) return null;
  return direction === 'higher_is_better' ? delta > 0 : delta < 0;
}

export function formatInt(n: number | null | undefined): string {
  if (n === null || n === undefined) return '—';
  return n.toLocaleString('en-US');
}

export const STATUS_LABEL: Record<KpiStatus, string> = {
  on_target: 'On target',
  below_target: 'Below target',
  warning: 'Warning',
  critical: 'Critical',
  no_data: 'No data',
  insufficient_data: 'Too few responses',
};

export const STATUS_RANK: Record<KpiStatus, number> = {
  critical: 0,
  warning: 1,
  below_target: 2,
  on_target: 3,
  insufficient_data: 4,
  no_data: 5,
};

export const ROLE_LABEL = {
  admin: 'Academic Administrator',
} as const;

/** Short x-axis label: "1st Sem 2022-2023" -> "1S '22". */
export function shortTermLabel(semesterName: string, academicYearLabel: string): string {
  const sem = semesterName.startsWith('1') ? '1S' : semesterName.startsWith('2') ? '2S' : semesterName.slice(0, 2);
  return `${sem} ’${academicYearLabel.slice(2, 4)}`;
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });
}
