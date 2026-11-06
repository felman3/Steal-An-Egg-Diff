import { LoaderCircle, Lock, RefreshCw, SearchX, ServerCrash } from 'lucide-react';
import type { ReactNode } from 'react';
import type { AppError } from '../lib/errors';

export function LoadingState({ label = 'Loading data…', minHeight = 220 }: { label?: string; minHeight?: number }) {
  return (
    <div role="status" aria-live="polite" className="flex flex-col items-center justify-center gap-3 text-ink-2" style={{ minHeight }}>
      <LoaderCircle className="animate-spin text-accent" size={22} aria-hidden />
      <span className="text-sm">{label}</span>
    </div>
  );
}

export function EmptyState({
  title = 'No data for this selection',
  message = 'Try a different academic year, semester, college or department.',
  minHeight = 220,
  action,
}: {
  title?: string;
  message?: ReactNode;
  minHeight?: number;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 text-center" style={{ minHeight }} data-testid="empty-state">
      <SearchX className="text-ink-muted" size={26} aria-hidden />
      <p className="font-semibold text-ink">{title}</p>
      <p className="max-w-md text-sm text-ink-2">{message}</p>
      {action}
    </div>
  );
}

export function RestrictedState({ message, minHeight = 220 }: { message: ReactNode; minHeight?: number }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 text-center" style={{ minHeight }} data-testid="restricted-state">
      <span className="flex size-11 items-center justify-center rounded-full bg-sunken">
        <Lock className="text-ink-2" size={20} aria-hidden />
      </span>
      <p className="font-semibold text-ink">Restricted</p>
      <p className="max-w-md text-sm text-ink-2">{message}</p>
    </div>
  );
}

export function ErrorState({ error, onRetry, minHeight = 220 }: { error: AppError; onRetry?: () => void; minHeight?: number }) {
  if (error.kind === 'forbidden') return <RestrictedState message={error.message} minHeight={minHeight} />;
  return (
    <div role="alert" className="flex flex-col items-center justify-center gap-2 px-6 text-center" style={{ minHeight }} data-testid="error-state">
      <ServerCrash className="text-critical" size={26} aria-hidden />
      <p className="font-semibold text-ink">{error.kind === 'network' ? 'Connection problem' : 'Could not load this data'}</p>
      <p className="max-w-md text-sm text-ink-2">{error.message}</p>
      {onRetry && (
        <button type="button" className="btn btn-ghost mt-2" onClick={onRetry}>
          <RefreshCw size={15} aria-hidden /> Try again
        </button>
      )}
    </div>
  );
}
