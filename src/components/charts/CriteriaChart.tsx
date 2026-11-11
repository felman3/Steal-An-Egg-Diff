import { PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart, ResponsiveContainer, Tooltip } from 'recharts';
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
  // Ratings cluster between 3.5 and 4.6, so the radial axis starts at 3.0 to make differences visible (labelled below the chart).
  const allValues = data.flatMap((d) => [d.scope, d.institution]).filter((v): v is number => v !== null);
  const floor = allValues.length && Math.min(...allValues) < 3.1 ? 1 : 3;
  const summary = `Mean SETE score by criterion for ${scopeLabel}: ${data.map((d) => `${d.full} ${d.scope?.toFixed(2) ?? 'suppressed'}`).join('; ')}.`;

  return (
    <div data-testid="criteria-chart" className="flex flex-1 flex-col">
      <div role="img" aria-label={summary} className="relative flex-1" style={{ minHeight: 280 }}>
        <ResponsiveContainer width="100%" height="100%" className="!absolute inset-0">
          <RadarChart data={data} outerRadius="78%" margin={{ top: 8, right: 24, bottom: 8, left: 24 }}>
            <PolarGrid stroke="var(--grid)" />
            <PolarAngleAxis dataKey="label" tick={{ fontSize: 12, fill: 'var(--ink-2)' }} />
            <PolarRadiusAxis domain={[floor, 5]} tickCount={floor === 3 ? 5 : 5} angle={90} tick={{ fontSize: 10, fill: 'var(--axis-ink)' }} axisLine={false} />
            {compare && (
              <Radar
                name="Institution"
                dataKey="institution"
                stroke="var(--series-muted)"
                strokeDasharray="4 3"
                strokeWidth={1.5}
                fill="var(--series-muted)"
                fillOpacity={0.12}
                isAnimationActive={false}
              />
            )}
            <Radar
              name={scopeLabel}
              dataKey="scope"
              stroke="var(--series-1)"
              strokeWidth={2}
              fill="var(--series-1)"
              fillOpacity={0.22}
              dot={{ r: 3.5, fill: 'var(--series-1)', stroke: 'var(--surface)', strokeWidth: 1.5 }}
              isAnimationActive={false}
            />
            <Tooltip
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
          </RadarChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-ink-2">
        {floor === 3 && <span className="order-last w-full text-ink-muted">Radial axis starts at 3.0 so differences between criteria are visible.</span>}
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
