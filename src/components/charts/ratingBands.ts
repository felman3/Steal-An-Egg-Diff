import type { FacultyRow } from '../../lib/types';

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
