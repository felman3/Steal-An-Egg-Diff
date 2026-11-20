import { ChevronDown } from 'lucide-react';
import { useState } from 'react';
import { useFilters } from '../../filters/FiltersProvider';
import { fetchFacultyRatingBands } from '../../lib/api';
import { useQuery } from '../../lib/useQuery';
import { EmptyState, ErrorState, LoadingState } from '../States';
import { RatingDonut } from './RatingDonut';

export function FacultyRatingDistribution({ className = '' }: { className?: string }) {
  const { filters, filterKey } = useFilters();
  const [open, setOpen] = useState(false);
  const faculty = useQuery(open ? `faculty-bands|${filterKey}` : null, () => fetchFacultyRatingBands(filters));
  const rows = faculty.data ?? [];

  return (
    <details className={`card group px-4 ${className}`} onToggle={(event) => setOpen(event.currentTarget.open)}>
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 text-sm font-semibold text-ink [&::-webkit-details-marker]:hidden">
        Faculty rating distribution <ChevronDown size={16} className="text-ink-2 group-open:rotate-180" aria-hidden />
      </summary>
      {open && (
        <div className="mx-auto max-w-sm border-t border-line py-3">
          {faculty.isLoading ? <LoadingState minHeight={140} /> : faculty.error ? (
            <ErrorState error={faculty.error} onRetry={faculty.refetch} minHeight={140} />
          ) : rows.some((row) => row.rating_band !== null) ? (
            <RatingDonut rows={rows} />
          ) : <EmptyState minHeight={140} message="No reportable faculty ratings for this selection." />}
        </div>
      )}
    </details>
  );
}
