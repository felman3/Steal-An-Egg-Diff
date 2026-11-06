import type { ReactNode } from 'react';

export function TooltipBox({ title, children }: { title: ReactNode; children: ReactNode }) {
  return (
    <div className="min-w-44 rounded-lg border border-line-strong bg-surface px-3 py-2 text-xs shadow-lg">
      <div className="mb-1.5 font-medium text-ink-2">{title}</div>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

export function TooltipRow({ label, value, keyColor, keyShape = 'line' }: { label: string; value: ReactNode; keyColor?: string; keyShape?: 'line' | 'square' }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="flex items-center gap-1.5 text-ink-2">
        {keyColor && (
          <span
            aria-hidden
            className={keyShape === 'line' ? 'inline-block h-0.5 w-3 rounded' : 'inline-block size-2.5 rounded-sm'}
            style={{ background: keyColor }}
          />
        )}
        {label}
      </span>
      <span className="tabular font-semibold text-ink">{value}</span>
    </div>
  );
}
