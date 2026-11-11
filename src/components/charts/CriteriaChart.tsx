import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { formatInt } from '../../lib/format';
import type { CriterionRow } from '../../lib/types';
import { CRITERION_SHORT } from './chartUtils';
import { TooltipBox, TooltipRow } from './ChartTooltip';

interface Datum {
  label: string;
  full: string;
  scope: number | null;
  institution: number | null;
  n: number;
}

const valueLabel = (p: unknown) => {
  const { x = 0, y = 0, width = 0, height = 0, value } = p as { x?: number; y?: number; width?: number; height?: number; value?: number | null };
  if (value === null || value === undefined) return null;
  return (
    <text x={Number(x) + Number(width) + 6} y={Number(y) + Number(height) / 2} dominantBaseline="central" fontSize={12} fontWeight={600} fill="var(--ink)">
      {Number(value).toFixed(2)}
    </text>
  );
};

export function CriteriaChart({ rows, scopeLabel, compare }: { rows: CriterionRow[]; scopeLabel: string; compare: boolean }) {
  const data: Datum[] = rows.map((r) => ({
    label: `${r.criterion_code}. ${CRITERION_SHORT[r.criterion_code] ?? r.criterion_name}`,
    full: `${r.criterion_code}. ${r.criterion_name}`,
    scope: r.scope_mean,
    institution: r.institution_mean,
    n: r.responses,
  }));
  const rated = data.filter((d) => d.scope !== null).sort((a, b) => (a.scope as number) - (b.scope as number));
  const weakest = rated[0];
  const strongest = rated[rated.length - 1];
  const summary = `Mean SETE score by criterion for ${scopeLabel}: ${data.map((d) => `${d.full} ${d.scope?.toFixed(2) ?? 'suppressed'}`).join('; ')}.`;

  return (
    <div data-testid="criteria-chart" className="flex flex-1 flex-col">
      <div role="img" aria-label={summary} className="relative flex-1" style={{ minHeight: compare ? 250 : 210 }}>
        <ResponsiveContainer width="100%" height="100%" className="!absolute inset-0">
          <BarChart data={data} layout="vertical" margin={{ top: 4, right: 44, bottom: 4, left: 4 }} barGap={2} barCategoryGap="22%">
            <CartesianGrid horizontal={false} />
            <XAxis type="number" domain={[1, 5]} ticks={[1, 2, 3, 4, 5]} tickLine={false} axisLine={{ stroke: 'var(--axis)' }} tick={{ fontSize: 12 }} />
            <YAxis type="category" dataKey="label" width={150} tickLine={false} axisLine={false} tick={{ fontSize: 12 }} />
            <Tooltip
              cursor={{ fill: 'var(--wash-1)' }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const d = payload[0].payload as Datum;
                return (
                  <TooltipBox title={d.full}>
                    <TooltipRow label={scopeLabel} value={d.scope?.toFixed(2) ?? 'Suppressed'} keyColor="var(--series-1)" keyShape="square" />
                    {compare && <TooltipRow label="Institution" value={d.institution?.toFixed(2) ?? '—'} keyColor="var(--series-muted)" keyShape="square" />}
                    <TooltipRow label="Criterion scores" value={formatInt(d.n)} />
                  </TooltipBox>
                );
              }}
            />
            <Bar dataKey="scope" name={scopeLabel} fill="var(--series-1)" barSize={14} radius={[0, 4, 4, 0]} isAnimationActive={false}>
              <LabelList dataKey="scope" content={valueLabel} />
            </Bar>
            {compare && (
              <Bar dataKey="institution" name="Institution" fill="var(--series-muted)" barSize={14} radius={[0, 4, 4, 0]} isAnimationActive={false}>
                <LabelList dataKey="institution" content={valueLabel} />
              </Bar>
            )}
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-ink-2">
        {compare ? (
          <ul className="flex items-center gap-4" aria-label="Legend">
            <li className="flex items-center gap-1.5">
              <span aria-hidden className="inline-block size-2.5 rounded-sm" style={{ background: 'var(--series-1)' }} /> {scopeLabel}
            </li>
            <li className="flex items-center gap-1.5">
              <span aria-hidden className="inline-block size-2.5 rounded-sm" style={{ background: 'var(--series-muted)' }} /> Institution benchmark
            </li>
          </ul>
        ) : (
          <span>Scale: 1 = poor · 5 = outstanding</span>
        )}
      </div>
      {weakest && strongest && weakest !== strongest && (
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2" data-testid="criteria-insight">
          <div className="rounded-lg bg-sunken px-3 py-2.5">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted">Development focus</p>
            <p className="mt-0.5 text-sm font-semibold text-ink">{weakest.full}</p>
            <p className="text-xs text-ink-2">
              Lowest-rated criterion ({weakest.scope?.toFixed(2)}
              {compare && weakest.institution !== null ? `; institution ${weakest.institution.toFixed(2)}` : ''}). A candidate theme for faculty
              development.
            </p>
          </div>
          <div className="rounded-lg bg-sunken px-3 py-2.5">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted">Strength</p>
            <p className="mt-0.5 text-sm font-semibold text-ink">{strongest.full}</p>
            <p className="text-xs text-ink-2">
              Highest-rated criterion ({strongest.scope?.toFixed(2)}). Gap to the focus area: {((strongest.scope ?? 0) - (weakest.scope ?? 0)).toFixed(2)}.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
