import type { ReactNode } from 'react';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { formatInt } from '../../lib/format';
import type { BandCount } from './ratingBands';
import { TooltipBox, TooltipRow } from './ChartTooltip';

/** Donut with the total in the middle, a value legend and a one-line takeaway. */
export function BandDonut({
  bands,
  total,
  centerLabel,
  unitLabel,
  footer,
  testId,
}: {
  bands: BandCount[];
  total: number;
  centerLabel: string;
  /** What one unit is, for the tooltip (e.g. "Faculty", "Students"). */
  unitLabel: string;
  footer?: ReactNode;
  testId: string;
}) {
  const shown = bands.filter((b) => b.count > 0);
  const summary = `${centerLabel}: ${bands.map((b) => `${b.label} ${b.count}`).join(', ')}. Total ${total}.`;

  return (
    <div data-testid={testId} className="flex flex-1 flex-col">
      <div role="img" aria-label={summary} className="relative flex-1" style={{ minHeight: 240 }}>
        <ResponsiveContainer width="100%" height="100%" className="!absolute inset-0">
          <PieChart>
            <Pie data={shown} dataKey="count" nameKey="label" innerRadius="58%" outerRadius="85%" paddingAngle={1.5} stroke="var(--surface)" strokeWidth={2} isAnimationActive={false}>
              {shown.map((b) => (
                <Cell key={b.label} fill={b.color} />
              ))}
            </Pie>
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const b = payload[0].payload as BandCount;
                return (
                  <TooltipBox title={b.label}>
                    <TooltipRow label={unitLabel} value={formatInt(b.count)} keyColor={b.color} keyShape="square" />
                    <TooltipRow label="Share" value={`${b.pct.toFixed(1)}%`} />
                  </TooltipBox>
                );
              }}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center" aria-hidden>
          <span className="text-[26px] font-bold leading-none text-ink">{formatInt(total)}</span>
          <span className="mt-1 text-[11px] text-ink-2">{centerLabel}</span>
        </div>
      </div>
      <ul className="mt-3 space-y-1.5 text-xs" aria-label="Legend">
        {bands.map((b) => (
          <li key={b.label} className="flex items-center gap-2">
            <span aria-hidden className="inline-block size-2.5 shrink-0 rounded-sm" style={{ background: b.color }} />
            <span className="flex-1 text-ink-2">{b.label}</span>
            <span className="tabular font-semibold text-ink">{formatInt(b.count)}</span>
            <span className="tabular w-12 text-right text-ink-muted">{b.pct.toFixed(0)}%</span>
          </li>
        ))}
      </ul>
      {footer && <p className="mt-3 border-t border-line pt-2.5 text-xs text-ink-2">{footer}</p>}
    </div>
  );
}
