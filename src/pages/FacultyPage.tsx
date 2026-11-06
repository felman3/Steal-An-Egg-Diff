import { useId, useState } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { PageHeader } from '../components/AppShell';
import { StatusBadge } from '../components/StatusBadge';
import { EmptyState, ErrorState, LoadingState, RestrictedState } from '../components/States';
import { useFilters } from '../filters/FiltersProvider';
import { fetchFacultyPerformance } from '../lib/api';
import { formatInt } from '../lib/format';
import { useQuery } from '../lib/useQuery';

export function FacultyPage() {
  const { profile } = useAuth();
  const { filters, filterKey, describe } = useFilters();
  const allowed = profile?.role === 'admin' || profile?.role === 'dean' || profile?.role === 'chair';
  // Viewers never even send the request; the database would refuse it anyway (42501).
  const faculty = useQuery(allowed ? `faculty|${filterKey}` : null, () => fetchFacultyPerformance(filters));
  const [mode, setMode] = useState<'watchlist' | 'all'>('watchlist');
  const [search, setSearch] = useState('');
  const searchId = useId();

  const all = faculty.data ?? [];
  const flagged = all.filter((f) => f.status === 'warning' || f.status === 'critical');
  const list = (mode === 'watchlist' ? flagged : all).filter((f) =>
    `${f.pseudonym} ${f.department_code} ${f.academic_rank}`.toLowerCase().includes(search.trim().toLowerCase()),
  );

  return (
    <>
      <PageHeader title="Faculty SETE results" />
      <section className="card p-4 sm:p-5" aria-labelledby="faculty-heading" data-testid="faculty-page">
        <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 id="faculty-heading" className="text-[15px] font-semibold text-ink">
              {mode === 'watchlist' ? 'Faculty watchlist' : 'All evaluated faculty'}
            </h2>
            <p className="mt-0.5 max-w-3xl text-[13px] text-ink-2">
              Confidential, faculty-level SETE results for {describe.scope} · {describe.period}. Faculty are pseudonymised in this demonstration;
              averages based on fewer responses than the reporting minimum are suppressed.
            </p>
          </div>
          {allowed && faculty.data && (
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex rounded-lg border border-line-strong p-0.5" role="group" aria-label="Show">
                {(['watchlist', 'all'] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    aria-pressed={mode === m}
                    onClick={() => setMode(m)}
                    className={`rounded-md px-2.5 py-1 text-xs font-medium ${mode === m ? 'bg-accent-soft text-ink' : 'text-ink-2 hover:text-ink'}`}
                  >
                    {m === 'watchlist' ? `Watchlist (${flagged.length})` : `All (${all.length})`}
                  </button>
                ))}
              </div>
              <label htmlFor={searchId} className="sr-only">
                Search faculty
              </label>
              <input id={searchId} className="field !min-h-8 !w-44 !py-1 text-xs" placeholder="Search…" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
          )}
        </header>

        {!allowed ? (
          <RestrictedState
            minHeight={320}
            message={
              <>
                Individual faculty evaluation results are confidential. Your role (<strong>Viewer</strong>) can see aggregated KPIs only. Deans,
                department chairs and administrators can view faculty-level results within their scope.
              </>
            }
          />
        ) : faculty.error ? (
          <ErrorState error={faculty.error} onRetry={faculty.refetch} minHeight={320} />
        ) : faculty.isLoading ? (
          <LoadingState minHeight={320} />
        ) : all.length === 0 ? (
          <EmptyState minHeight={320} />
        ) : list.length === 0 ? (
          <EmptyState
            minHeight={260}
            title={mode === 'watchlist' ? 'No faculty on the watchlist' : 'No matching faculty'}
            message={mode === 'watchlist' ? 'No faculty member is below the warning threshold for this selection.' : 'Try a different search.'}
          />
        ) : (
          <div className={`relative overflow-x-auto rounded-lg border border-line ${faculty.isRefreshing ? 'refreshing' : ''}`}>
            <table className="w-full min-w-[880px] border-collapse text-sm" data-testid="faculty-table">
              <caption className="sr-only">Faculty-level SETE results</caption>
              <thead className="bg-sunken text-left text-xs text-ink-2">
                <tr>
                  <th scope="col" className="px-3 py-2.5 font-semibold">Faculty (pseudonym)</th>
                  <th scope="col" className="px-3 py-2.5 font-semibold">Rank</th>
                  <th scope="col" className="px-3 py-2.5 text-right font-semibold">Sections</th>
                  <th scope="col" className="px-3 py-2.5 text-right font-semibold">Responses</th>
                  <th scope="col" className="px-3 py-2.5 text-right font-semibold">Response rate</th>
                  <th scope="col" className="px-3 py-2.5 text-right font-semibold">Mean rating</th>
                  <th scope="col" className="px-3 py-2.5 font-semibold">Descriptive rating</th>
                  <th scope="col" className="px-3 py-2.5 text-right font-semibold" title="A Commitment · B Knowledge · C Independent learning · D Management">
                    A / B / C / D
                  </th>
                  <th scope="col" className="px-3 py-2.5 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="tabular">
                {list.map((f) => (
                  <tr key={f.faculty_id} className="border-t border-line">
                    <th scope="row" className="px-3 py-2.5 text-left font-medium text-ink">
                      {f.pseudonym}
                      <span className="ml-1.5 text-xs font-normal text-ink-muted">{f.college_code}</span>
                    </th>
                    <td className="px-3 py-2.5 text-ink-2">{f.academic_rank}</td>
                    <td className="px-3 py-2.5 text-right">{f.sections}</td>
                    <td className="px-3 py-2.5 text-right">{formatInt(f.evaluations)}</td>
                    <td className="px-3 py-2.5 text-right">{f.response_rate === null ? '—' : `${f.response_rate.toFixed(1)}%`}</td>
                    <td className="px-3 py-2.5 text-right font-semibold">{f.mean_rating?.toFixed(2) ?? '—'}</td>
                    <td className="px-3 py-2.5 text-ink-2">{f.rating_band ?? 'Suppressed'}</td>
                    <td className="px-3 py-2.5 text-right text-ink-2">
                      {f.criterion_means ? ['A', 'B', 'C', 'D'].map((c) => f.criterion_means?.[c]?.toFixed(2) ?? '—').join(' / ') : '—'}
                    </td>
                    <td className="px-3 py-2.5">
                      <StatusBadge status={f.status} compact />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {allowed && faculty.data && all.length > 0 && (
          <p className="mt-3 text-xs text-ink-muted">
            Status compares each mean rating with the SETE rating target for the faculty member's college (target {all[0].target.toFixed(2)},
            warning below {all[0].warning_threshold.toFixed(2)}, critical below {all[0].critical_threshold.toFixed(2)} unless overridden).
          </p>
        )}
      </section>
    </>
  );
}
