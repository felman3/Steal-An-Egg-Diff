import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { formatInt } from '../../lib/format';
import type { GradeBandRow } from '../../lib/types';
import { TooltipBox, TooltipRow } from './ChartTooltip';

export function GradeDistributionChart({ rows }: { rows: GradeBandRow[] }) {
  const data = rows.map((r) => ({ ...r, pct: r.percentage ?? 0 }));
  const max = Math.max(10, ...data.map((d) => d.pct));
  const summary = `Final grade distribution: ${data.map((d) => `${d.band_label} (${d.grade_range}) ${d.pct}%`).join('; ')}.`;
  return (
    <div role="img" aria-label={summary} data-testid="grade-chart">
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={data} margin={{ top: 22, right: 8, bottom: 4, left: 0 }}>
          <CartesianGrid vertical={false} />
          <XAxis
            dataKey="band_label"
            interval={0}
            tickLine={false}
            axisLine={{ stroke: 'var(--axis)' }}
            height={42}
            tick={(p: { x?: number | string; y?: number | string; payload?: { value: string; index: number } }) => {
              const d = data[p.payload?.index ?? 0];
              return (
                <g transform={`translate(${Number(p.x)},${Number(p.y)})`}>
                  <text textAnchor="middle" dy={12} fontSize={11} fill="var(--ink-2)">
                    {d?.band_label}
                  </text>
                  <text textAnchor="middle" dy={26} fontSize={10} fill="var(--axis-ink)">
                    {d?.grade_range}
                  </text>
                </g>
              );
            }}
          />
          <YAxis domain={[0, Math.ceil(max / 10) * 10]} tickLine={false} axisLine={false} width={40} tick={{ fontSize: 12 }} tickFormatter={(v: number) => `${v}%`} />
          <Tooltip
            cursor={{ fill: 'var(--wash-1)' }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const d = payload[0].payload as GradeBandRow & { pct: number };
              return (
                <TooltipBox title={`${d.band_label} (${d.grade_range})`}>
                  <TooltipRow label="Share of enrolments" value={`${d.pct.toFixed(1)}%`} keyColor="var(--series-1)" keyShape="square" />
                  <TooltipRow label="Enrolments" value={formatInt(d.students)} />
                </TooltipBox>
              );
            }}
          />
          <Bar dataKey="pct" fill="var(--series-1)" barSize={24} radius={[4, 4, 0, 0]} isAnimationActive={false}>
            <LabelList dataKey="pct" position="top" fontSize={11} fill="var(--ink)" formatter={(v: unknown) => `${Number(v).toFixed(1)}%`} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
