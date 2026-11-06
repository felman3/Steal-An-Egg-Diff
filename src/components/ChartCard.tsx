import { ChartColumn, Table2 } from 'lucide-react';
import { useId, useState, type ReactNode } from 'react';
import type { AppError } from '../lib/errors';
import { EmptyState, ErrorState, LoadingState } from './States';

export interface TableSpec {
  columns: { key: string; label: string; align?: 'left' | 'right' }[];
  rows: Record<string, ReactNode>[];
  caption: string;
}

interface ChartCardProps {
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
  isLoading?: boolean;
  isRefreshing?: boolean;
  error?: AppError;
  onRetry?: () => void;
  isEmpty?: boolean;
  emptyMessage?: ReactNode;
  table?: TableSpec;
  minHeight?: number;
  footer?: ReactNode;
  children?: ReactNode;
  testId?: string;
  className?: string;
}

/**
 * Card that owns a chart's title, its loading / empty / error states and the
 * table-view toggle (the accessible twin of every chart).
 */
export function ChartCard({
  title,
  subtitle,
  actions,
  isLoading,
  isRefreshing,
  error,
  onRetry,
  isEmpty,
  emptyMessage,
  table,
  minHeight = 260,
  footer,
  children,
  testId,
  className = '',
}: ChartCardProps) {
  const [view, setView] = useState<'chart' | 'table'>('chart');
  const headingId = useId();
  const canToggle = Boolean(table) && !isLoading && !error && !isEmpty;

  let body: ReactNode;
  if (isLoading) body = <LoadingState minHeight={minHeight} />;
  else if (error) body = <ErrorState error={error} onRetry={onRetry} minHeight={minHeight} />;
  else if (isEmpty) body = <EmptyState minHeight={minHeight} message={emptyMessage} />;
  else if (view === 'table' && table) body = <DataTable spec={table} />;
  else body = children;

  return (
    <section className={`card flex flex-col p-4 sm:p-5 ${className}`} aria-labelledby={headingId} data-testid={testId}>
      <header className="mb-3 flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <h2 id={headingId} className="text-[15px] font-semibold leading-snug text-ink">
            {title}
          </h2>
          {subtitle && <p className="mt-0.5 text-[13px] leading-snug text-ink-2">{subtitle}</p>}
        </div>
        <div className="flex items-center gap-2">
          {actions}
          {canToggle && (
            <div className="inline-flex rounded-lg border border-line-strong p-0.5" role="group" aria-label="View as">
              <button
                type="button"
                aria-pressed={view === 'chart'}
                onClick={() => setView('chart')}
                className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium ${view === 'chart' ? 'bg-accent-soft text-ink' : 'text-ink-2 hover:text-ink'}`}
              >
                <ChartColumn size={13} aria-hidden /> Chart
              </button>
              <button
                type="button"
                aria-pressed={view === 'table'}
                onClick={() => setView('table')}
                className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium ${view === 'table' ? 'bg-accent-soft text-ink' : 'text-ink-2 hover:text-ink'}`}
              >
                <Table2 size={13} aria-hidden /> Table
              </button>
            </div>
          )}
        </div>
      </header>
      <div className={`min-w-0 flex-1 ${isRefreshing ? 'refreshing' : ''}`} aria-busy={isLoading || isRefreshing}>
        {body}
      </div>
      {footer && !isLoading && !error && !isEmpty && <div className="mt-3 border-t border-line pt-3">{footer}</div>}
    </section>
  );
}

export function DataTable({ spec, maxHeight }: { spec: TableSpec; maxHeight?: number }) {
  return (
    <div className="relative overflow-x-auto rounded-lg border border-line" style={maxHeight ? { maxHeight, overflowY: 'auto' } : undefined}>
      <table className="w-full border-collapse text-sm">
        <caption className="sr-only">{spec.caption}</caption>
        <thead className="sticky top-0 bg-sunken text-left text-xs text-ink-2">
          <tr>
            {spec.columns.map((c) => (
              <th key={c.key} scope="col" className={`whitespace-nowrap px-3 py-2 font-semibold ${c.align === 'right' ? 'text-right' : ''}`}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="tabular">
          {spec.rows.map((row, i) => (
            <tr key={i} className="border-t border-line">
              {spec.columns.map((c) => (
                <td key={c.key} className={`whitespace-nowrap px-3 py-2 ${c.align === 'right' ? 'text-right' : ''}`}>
                  {row[c.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
