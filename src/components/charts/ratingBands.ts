import type { FacultyRow, GradeBandRow } from '../../lib/types';

/** Descriptive SETE rating bands, best first, on the dashboard's single blue palette (amber/red only for concern). */
export const RATING_BANDS = [
  { label: 'Outstanding', color: 'var(--header)' },
  { label: 'Very Satisfactory', color: 'var(--series-1)' },
  { label: 'Satisfactory', color: 'var(--series-1-soft)' },
  { label: 'Fair', color: 'var(--status-warning)' },
  { label: 'Needs Improvement', color: 'var(--status-critical)' },
] as const;

export interface BandCount {
  label: string;
  color: string;
  count: number;
  pct: number;
}

/** Count evaluated faculty per descriptive rating band (faculty with too few responses are reported separately). */
export function countRatingBands(rows: FacultyRow[]): { bands: BandCount[]; rated: number; insufficient: number } {
  const rated = rows.filter((r) => r.rating_band !== null);
  const bands = RATING_BANDS.map((b) => {
    const count = rated.filter((r) => r.rating_band === b.label).length;
    return { label: b.label, color: b.color, count, pct: rated.length ? (100 * count) / rated.length : 0 };
  });
  return { bands, rated: rated.length, insufficient: rows.length - rated.length };
}

const GRADE_COLORS: Record<string, string> = {
  excellent: 'var(--header)',
  very_good: 'var(--series-1)',
  good: 'var(--series-1-soft)',
  passing: 'var(--series-muted)',
  failed: 'var(--status-critical)',
  incomplete: 'var(--status-warning)',
  dropped: 'var(--status-neutral)',
};

/** Final-grade bands for a donut (a faculty member's own classes). */
export function gradeBands(rows: GradeBandRow[]): { bands: BandCount[]; total: number; passed: number } {
  const total = rows.reduce((n, r) => n + r.students, 0);
  const bands = rows.map((r) => ({
    label: `${r.band_label} (${r.grade_range})`,
    color: GRADE_COLORS[r.band_code] ?? 'var(--series-muted)',
    count: r.students,
    pct: total ? (100 * r.students) / total : 0,
  }));
  const passed = rows.filter((r) => ['excellent', 'very_good', 'good', 'passing'].includes(r.band_code)).reduce((n, r) => n + r.students, 0);
  return { bands, total, passed };
}
