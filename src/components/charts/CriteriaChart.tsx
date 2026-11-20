import type { CriterionRow } from '../../lib/types';
import { magnitudeBlue } from '../../lib/status';
import { CRITERION_SHORT } from './chartUtils';

function ScoreTrack({ value, benchmark = false }: { value: number | null; benchmark?: boolean }) {
  return (
    <div className={`relative h-1.5 rounded-full ${benchmark ? 'bg-accent-soft' : 'bg-sunken'}`}>
      {value !== null && (
        <span
          className={`absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full ${benchmark ? 'border-2 border-accent bg-surface' : 'border border-accent/35'}`}
          style={{ left: `${((value - 1) / 4) * 100}%`, background: benchmark ? undefined : magnitudeBlue(value - 1, 4) }}
        />
      )}
    </div>
  );
}

export function CriteriaChart({ rows, scopeLabel, compare }: { rows: CriterionRow[]; scopeLabel: string; compare: boolean }) {
  const summary = rows.map((row) => {
    const scope = row.scope_mean?.toFixed(2) ?? 'suppressed';
    const benchmark = compare ? `, institution ${row.institution_mean?.toFixed(2) ?? 'unavailable'}` : '';
    return `${row.criterion_name} ${scope}${benchmark}`;
  }).join('. ');
  const rated = rows.filter((row) => row.scope_mean !== null);
  const lowest = rated.reduce<CriterionRow | undefined>(
    (min, row) => !min || Number(row.scope_mean) < Number(min.scope_mean) ? row : min,
    undefined,
  );
  const uniqueLowest = lowest && rated.length > 1 && rated.filter((row) => row.scope_mean === lowest.scope_mean).length === 1;

  return (
    <div data-testid="criteria-chart" className="flex flex-1 flex-col">
      {compare && (
        <ul className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-2" aria-label="Legend">
          <li className="flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-accent" aria-hidden /> {scopeLabel}</li>
          <li className="flex items-center gap-1.5"><span className="size-2.5 rounded-full border-2 border-accent" aria-hidden /> Institution</li>
        </ul>
      )}
      <div role="img" className="flex flex-1 flex-col" aria-label={`Mean SETE criterion scores for ${scopeLabel} on a scale from 1 to 5. ${summary}.`}>
        <ul className="flex flex-1 flex-col justify-evenly gap-4" aria-hidden>
          {rows.map((row) => (
            <li key={row.criterion_code}>
              <div className="mb-1.5 flex items-baseline justify-between gap-2 text-sm">
                <span className="font-medium text-ink">{row.criterion_code}. {CRITERION_SHORT[row.criterion_code] ?? row.criterion_name}</span>
                <span className="tabular font-semibold text-ink" data-testid="criterion-score">{row.scope_mean?.toFixed(2) ?? 'Suppressed'}</span>
              </div>
              <ScoreTrack value={row.scope_mean} />
              {compare && (
                <div className="mt-1.5">
                  <ScoreTrack value={row.institution_mean} benchmark />
                  <p className="tabular mt-0.5 text-right text-[11px] text-ink-2">Institution {row.institution_mean?.toFixed(2) ?? '—'}</p>
                </div>
              )}
            </li>
          ))}
        </ul>
        <div className="tabular mt-2 flex justify-between text-[11px] text-ink-muted" aria-hidden>
          {[1, 2, 3, 4, 5].map((tick) => <span key={tick}>{tick}</span>)}
        </div>
      </div>
      {uniqueLowest && (
        <p className="mt-3 rounded-lg bg-sunken px-3 py-2 text-[13px] leading-relaxed text-ink-2" data-testid="criteria-insight">
          <strong className="text-ink">Lowest observed score</strong> · {CRITERION_SHORT[lowest.criterion_code] ?? lowest.criterion_name} ({lowest.scope_mean?.toFixed(2)}).
          Review participation and course context before setting a development priority.
        </p>
      )}
    </div>
  );
}
