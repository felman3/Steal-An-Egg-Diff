import type { FacultyRatingBandRow, RatingBand } from '../../lib/types';

/** Descriptive SETE rating bands in score order. */
const RATING_BANDS = [
  { label: 'Outstanding', color: '#123a70' },
  { label: 'Very Satisfactory', color: '#2268b7' },
  { label: 'Satisfactory', color: '#5295d6' },
  { label: 'Fair', color: '#8cb9e5' },
  { label: 'Needs Improvement', color: '#c3dcf4' },
] as const;

export interface BandCount {
  label: string;
  color: string;
  scoreRange: string | null;
  count: number;
  pct: number;
}

/** Count evaluated faculty per descriptive rating band (faculty with too few responses are reported separately). */
export function countRatingBands(rows: FacultyRatingBandRow[], ratingScale: RatingBand[] = []) {
  const rated = rows.filter((r) => r.rating_band !== null);
  const scale = ratingScale.length > 0
    ? ratingScale.map(({ label, min_score, max_score }) => ({
        label,
        color: RATING_BANDS.find((band) => band.label === label)?.color ?? 'var(--accent)',
        scoreRange: `${min_score.toFixed(2)}–${max_score.toFixed(2)}`,
      }))
    : RATING_BANDS.map((band) => ({ ...band, scoreRange: null }));
  const bands: BandCount[] = scale.map((band) => {
    const count = rated.filter((row) => row.rating_band === band.label).length;
    return { ...band, count, pct: rated.length ? (100 * count) / rated.length : 0 };
  });
  return { bands, rated: rated.length, insufficient: rows.length - rated.length };
}
