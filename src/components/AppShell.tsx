import { Outlet } from 'react-router';
import { useFilters } from '../filters/FiltersProvider';
import { SpectraMasthead } from './DashboardHeader';
import { ErrorState, LoadingState } from './States';

export function AppShell() {
  const { referenceError, referenceLoading, retryReference, ready } = useFilters();

  return (
    <>
      <SpectraMasthead />
      <main className="w-full min-w-0 px-3 pt-3 pb-6 sm:px-4 xl:px-5">
        {referenceError ? (
          <div className="card">
            <ErrorState error={referenceError} onRetry={retryReference} minHeight={400} />
          </div>
        ) : !ready || referenceLoading ? (
          <LoadingState label="Loading dashboard…" minHeight={400} />
        ) : (
          <Outlet />
        )}
      </main>
    </>
  );
}
