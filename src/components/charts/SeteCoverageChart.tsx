import { CartesianGrid, Cell, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis } from 'recharts';
import { formatInt, STATUS_LABEL } from '../../lib/format';
import { STATUS_FILL } from '../../lib/status';
import type { KpiStatus } from '../../lib/types';
import { TooltipBox, TooltipRow } from './ChartTooltip';

export interface SeteCoveragePoint {
  id: number;
  department: string;
  score: number;
  rate: number;
  responses: number;
  status: KpiStatus;
}

const legend: KpiStatus[] = ['on_target', 'below_target', 'warning', 'critical'];

export function SeteCoverageChart({ points, scalePoints }: { points: SeteCoveragePoint[]; scalePoints: SeteCoveragePoint[] }) {
  const summary = points.map((point) => `${point.department}, score ${point.score.toFixed(2)} out of 5, participation ${point.rate.toFixed(1)} percent`).join('. ');
  const minRate = Math.min(100, ...scalePoints.map((point) => point.rate));
  const minScore = Math.min(5, ...scalePoints.map((point) => point.score));
  const maxScore = Math.max(1, ...scalePoints.map((point) => point.score));
  const rateFloor = Math.max(0, Math.min(80, Math.floor((minRate - 3) / 10) * 10));
  const scoreFloor = Math.max(1, Math.floor((minScore - 0.1) * 5) / 5);
  const scoreCeiling = Math.min(5, Math.ceil((maxScore + 0.1) * 5) / 5);

  return (
    <div data-testid="sete-coverage-chart" className="flex flex-1 flex-col">
      <div role="img" className="relative min-h-[246px] flex-1" aria-label={`SETE score and participation by department. ${summary}.`}>
      <ResponsiveContainer width="100%" height="100%" className="!absolute inset-0">
        <ScatterChart margin={{ top: 10, right: 18, bottom: 21, left: 0 }}>
          <CartesianGrid />
          <XAxis
            type="number" dataKey="rate" domain={[rateFloor, 100]}
            tickLine={false} tick={{ fontSize: 11 }} tickFormatter={(value: number) => `${value}%`}
            label={{ value: 'SETE participation', position: 'insideBottom', offset: -12, fill: 'var(--ink-2)', fontSize: 11 }}
          />
          <YAxis type="number" dataKey="score" domain={[scoreFloor, scoreCeiling]} tickLine={false} axisLine={false} width={32} tick={{ fontSize: 11 }} />
          <Tooltip
            content={({ active, payload }) => {
              const point = payload?.[0]?.payload as SeteCoveragePoint | undefined;
              if (!active || !point) return null;
              return (
                <TooltipBox title={point.department}>
                  <TooltipRow label="Mean SETE score" value={`${point.score.toFixed(2)} / 5`} />
                  <TooltipRow label="Participation" value={`${point.rate.toFixed(1)}%`} keyColor={STATUS_FILL[point.status]} />
                  <TooltipRow label="Participation status" value={STATUS_LABEL[point.status]} />
                  <TooltipRow label="SETE responses" value={formatInt(point.responses)} />
                </TooltipBox>
              );
            }}
          />
          <Scatter data={points} isAnimationActive={false}>
            {points.map((point) => <Cell key={point.id} fill={STATUS_FILL[point.status]} stroke="var(--axis-ink)" strokeWidth={0.75} />)}
          </Scatter>
        </ScatterChart>
      </ResponsiveContainer>
      </div>
      <ul className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[13px] text-ink-2" aria-label="Participation status legend">
        {legend.map((status) => (
          <li key={status} className="flex items-center gap-1.5">
            <span aria-hidden className="size-2.5 rounded-full border border-line-strong" style={{ background: STATUS_FILL[status] }} />
            {STATUS_LABEL[status]}
          </li>
        ))}
      </ul>
    </div>
  );
}
