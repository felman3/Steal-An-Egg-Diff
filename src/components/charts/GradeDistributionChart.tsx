import { Bar, BarChart, CartesianGrid, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { formatInt } from '../../lib/format';
import { magnitudeBlue } from '../../lib/status';
import type { GradeBandRow } from '../../lib/types';
import { TooltipBox, TooltipRow } from './ChartTooltip';

export function GradeDistributionChart({ rows }: { rows: GradeBandRow[] }) {
  const data = rows.map((row) => ({ ...row, pct: row.percentage ?? 0 }));
  const highestShare = Math.max(0, ...data.map((row) => row.pct));
  const max = Math.max(10, highestShare);
  const summary = data.map((row) => `${row.band_label} (${row.grade_range}) ${row.pct.toFixed(1)} percent`).join('. ');

  return (
    <div role="img" aria-label={`Final grade distribution. ${summary}.`} data-testid="grade-chart" className="relative flex-1" style={{ minHeight: Math.max(196, 27 * rows.length + 28) }}>
      <ResponsiveContainer width="100%" height="100%" className="!absolute inset-0">
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 39, bottom: 4, left: 0 }}>
          <CartesianGrid horizontal={false} />
          <XAxis
            type="number" domain={[0, Math.ceil(max / 10) * 10]} tickLine={false} tick={{ fontSize: 11 }}
            tickFormatter={(value: number) => `${value}%`}
          />
          <YAxis type="category" dataKey="band_label" width={97} tickLine={false} axisLine={false} tick={{ fontSize: 13 }} />
          <Tooltip
            cursor={{ fill: 'var(--wash-1)' }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const row = payload[0].payload as GradeBandRow & { pct: number };
              return (
                <TooltipBox title={`${row.band_label} (${row.grade_range})`}>
                  <TooltipRow label="Share of enrolments" value={`${row.pct.toFixed(1)}%`} keyColor={magnitudeBlue(row.pct, highestShare)} keyShape="square" />
                  <TooltipRow label="Enrolments" value={formatInt(row.students)} />
                </TooltipBox>
              );
            }}
          />
          <Bar dataKey="pct" barSize={16} radius={[0, 4, 4, 0]} isAnimationActive={false}>
            {data.map((row) => <Cell key={row.band_code} fill={magnitudeBlue(row.pct, highestShare)} stroke="var(--chart-tone-high)" strokeOpacity={0.28} />)}
            <LabelList dataKey="pct" position="right" fontSize={13} fill="var(--ink)" formatter={(value: unknown) => `${Number(value).toFixed(1)}%`} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
