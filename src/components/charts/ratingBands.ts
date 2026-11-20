import type { FacultyRatingBandRow } from '../../lib/types';

/** Descriptive SETE rating bands in score order. */
export const RATING_BANDS = [
  { label: 'Outstanding', color: '#123a70' },
  { label: 'Very Satisfactory', color: '#2268b7' },
  { label: 'Satisfactory', color: '#5295d6' },
  { label: 'Fair', color: '#8cb9e5' },
  { label: 'Needs Improvement', color: '#c3dcf4' },
] as const;

export interface BandCount {
  label: string;
  color: string;
  count: number;
  pct: number;
}

/** Count evaluated faculty per descriptive rating band (faculty with too few responses are reported separately). */
export function countRatingBands(rows: FacultyRatingBandRow[]): { bands: BandCount[]; rated: number; insufficient: number } {
  const rated = rows.filter((r) => r.rating_band !== null);
  const bands = RATING_BANDS.map((b) => {
    const count = rated.filter((r) => r.rating_band === b.label).length;
    return { label: b.label, color: b.color, count, pct: rated.length ? (100 * count) / rated.length : 0 };
  });
  return { bands, rated: rated.length, insufficient: rows.length - rated.length };
}
