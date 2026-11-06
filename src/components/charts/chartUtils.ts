import { formatValue } from '../../lib/format';
import type { KpiDirection, KpiUnit } from '../../lib/types';

/** Bars must grow from the scale's true floor: 0 % / rating 1 / grade 1.00. */
export function barDomain(unit: KpiUnit, values: number[]): [number, number] {
  if (unit === 'percent') return [0, 100];
  if (unit === 'rating') return [1, 5];
  const max = Math.max(3, ...values.filter(Number.isFinite));
  return [1, Math.ceil(max * 2) / 2];
}

/** Lines may zoom: pad around data and thresholds, clamped to the scale. */
export function lineDomain(unit: KpiUnit, values: number[], thresholds: number[]): [number, number] {
  const all = [...values, ...thresholds].filter(Number.isFinite);
  const [lo, hi] = unit === 'percent' ? [0, 100] : [1, 5];
  if (all.length === 0) return [lo, hi];
  const min = Math.min(...all);
  const max = Math.max(...all);
  const pad = Math.max((max - min) * 0.18, unit === 'percent' ? 2 : 0.05);
  const step = unit === 'percent' ? 5 : 0.1;
  return [Math.max(lo, Math.floor((min - pad) / step) * step), Math.min(hi, Math.ceil((max + pad) / step) * step)];
}

export function tickFormatter(unit: KpiUnit) {
  return (v: number) => (unit === 'percent' ? `${Math.round(v)}%` : v.toFixed(unit === 'rating' ? 1 : 2));
}

/** Status zones (warning / critical bands) expressed in axis units. */
export function statusZones(
  domain: [number, number],
  warning: number,
  critical: number,
  direction: KpiDirection,
): { critical: [number, number]; warning: [number, number] } | null {
  const [lo, hi] = domain;
  if (direction === 'higher_is_better') {
    return { critical: [lo, Math.max(lo, Math.min(critical, hi))], warning: [Math.max(lo, Math.min(critical, hi)), Math.max(lo, Math.min(warning, hi))] };
  }
  return { critical: [Math.min(hi, Math.max(critical, lo)), hi], warning: [Math.min(hi, Math.max(warning, lo)), Math.min(hi, Math.max(critical, lo))] };
}

export function fmt(v: number | null | undefined, unit: KpiUnit, decimals: number) {
  return formatValue(v ?? null, unit, decimals);
}

export const CRITERION_SHORT: Record<string, string> = {
  A: 'Commitment',
  B: 'Knowledge of subject',
  C: 'Independent learning',
  D: 'Management of learning',
};
