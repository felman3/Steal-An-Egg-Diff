import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import type { FacultyRow } from '../../lib/types';
import { countRatingBands, type BandCount } from './ratingBands';
import { TooltipBox, TooltipRow } from './ChartTooltip';

export function RatingDonut({ rows }: { rows: FacultyRow[] }) {
  const { bands, rated, insufficient } = countRatingBands(rows);
  const shown = bands.filter((b) => b.count > 0);
  const atStandard = bands.slice(0, 2).reduce((n, b) => n + b.count, 0);
  const summary = `Faculty by SETE descriptive rating: ${bands.map((b) => `${b.label} ${b.count}`).join(', ')}. ${rated} faculty rated.`;

  return (
    <div data-testid="rating-donut" className="flex flex-1 flex-col">
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
                    <TooltipRow label="Faculty" value={b.count} keyColor={b.color} keyShape="square" />
                    <TooltipRow label="Share" value={`${b.pct.toFixed(1)}%`} />
                  </TooltipBox>
                );
              }}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center" aria-hidden>
          <span className="text-[26px] font-bold leading-none text-ink">{rated}</span>
          <span className="mt-1 text-[11px] text-ink-2">faculty rated</span>
        </div>
      </div>
      <ul className="mt-3 space-y-1.5 text-xs" aria-label="Legend">
        {bands.map((b) => (
          <li key={b.label} className="flex items-center gap-2">
            <span aria-hidden className="inline-block size-2.5 shrink-0 rounded-sm" style={{ background: b.color }} />
            <span className="flex-1 text-ink-2">{b.label}</span>
            <span className="tabular font-semibold text-ink">{b.count}</span>
            <span className="tabular w-12 text-right text-ink-muted">{b.pct.toFixed(0)}%</span>
          </li>
        ))}
      </ul>
      <p className="mt-3 border-t border-line pt-2.5 text-xs text-ink-2">
        <strong className="text-ink">{atStandard}</strong> of {rated} rated faculty are Very Satisfactory or better.
        {insufficient > 0 && ` ${insufficient} not rated (too few responses).`}
      </p>
    </div>
  );
}
