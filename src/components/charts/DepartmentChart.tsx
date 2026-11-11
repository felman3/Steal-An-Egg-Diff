import { Bar, BarChart, CartesianGrid, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { formatInt, STATUS_LABEL } from '../../lib/format';
import type { DepartmentKpiRow, KpiStatus, KpiSummaryRow } from '../../lib/types';
import { STATUS_FILL } from '../../lib/status';
import { barDomain, fmt, tickFormatter } from './chartUtils';
import { TooltipBox, TooltipRow } from './ChartTooltip';

const BAR = 18;

interface Datum {
  id: number;
  collegeId: number;
  code: string;
  name: string;
  college: string;
  value: number;
  target: number;
  warning: number;
  critical: number;
  status: KpiStatus;
  n: number;
}

/** Thin target tick drawn at the end of an invisible bar (per-department targets may differ by college). */
function TargetTick(props: { x?: number; y?: number; width?: number; height?: number }) {
  const { x = 0, y = 0, width = 0, height = 0 } = props;
  const xe = x + width;
  return <line x1={xe} x2={xe} y1={y - 4} y2={y + height + 4} stroke="var(--ink)" strokeWidth={2} strokeLinecap="round" />;
}

export function DepartmentChart({
  rows,
  kpi,
  onSelectDepartment,
}: {
  rows: DepartmentKpiRow[];
  kpi: KpiSummaryRow;
  /** Drill-down: clicking a bar filters the whole dashboard to that department. */
  onSelectDepartment?: (departmentId: number, collegeId: number) => void;
}) {
  const better = kpi.direction === 'higher_is_better' ? -1 : 1;
  const data: Datum[] = rows
    .filter((r) => r.value !== null)
    .map((r) => ({
      id: r.department_id,
      collegeId: r.college_id,
      code: r.department_code,
      name: r.department_name.replace('Department of ', ''),
      college: r.college_code,
      value: r.value as number,
      target: r.target,
      warning: r.warning_threshold,
      critical: r.critical_threshold,
      status: r.status,
      n: r.sample_size,
    }))
    .sort((a, b) => better * (a.value - b.value));
  const missing = rows.filter((r) => r.value === null).map((r) => r.department_code);

  const domain = barDomain(kpi.unit, data.flatMap((d) => [d.value, d.target]));
  const height = Math.max(180, data.length * 34 + 48);
  const summary = `${kpi.kpi_name} by department: ${data.map((d) => `${d.name} ${fmt(d.value, kpi.unit, kpi.decimals)} (${STATUS_LABEL[d.status]})`).join('; ')}.`;

  return (
    <div data-testid="department-chart">
      <div role="img" aria-label={summary}>
        <ResponsiveContainer width="100%" height={height}>
          <BarChart data={data} layout="vertical" margin={{ top: 4, right: 104, bottom: 4, left: 4 }} barSize={BAR} barGap={-BAR}>
            <CartesianGrid horizontal={false} />
            <XAxis type="number" domain={domain} tickLine={false} axisLine={{ stroke: 'var(--axis)' }} tick={{ fontSize: 12 }} tickFormatter={tickFormatter(kpi.unit)} />
            <YAxis type="category" dataKey="code" width={46} tickLine={false} axisLine={false} tick={{ fontSize: 12, fontWeight: 600 }} />
            <Tooltip
              cursor={{ fill: 'var(--wash-1)' }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const d = payload[0].payload as Datum;
                return (
                  <TooltipBox title={`${d.name} (${d.college})`}>
                    <TooltipRow label={kpi.short_name} value={fmt(d.value, kpi.unit, kpi.decimals)} keyColor={STATUS_FILL[d.status]} keyShape="square" />
                    <TooltipRow label="Status" value={STATUS_LABEL[d.status]} />
                    <TooltipRow label="Target" value={fmt(d.target, kpi.unit, kpi.decimals)} />
                    <TooltipRow label="Warning / critical" value={`${fmt(d.warning, kpi.unit, kpi.decimals)} / ${fmt(d.critical, kpi.unit, kpi.decimals)}`} />
                    <TooltipRow label="Sample size" value={formatInt(d.n)} />
                  </TooltipBox>
                );
              }}
            />
            <Bar
              dataKey="value"
              radius={[0, 4, 4, 0]}
              isAnimationActive={false}
              cursor={onSelectDepartment ? 'pointer' : undefined}
              onClick={(entry) => {
                const d = (entry as { payload?: Datum }).payload;
                if (d && onSelectDepartment) onSelectDepartment(d.id, d.collegeId);
              }}
            >
              {data.map((d) => (
                <Cell key={d.code} fill={STATUS_FILL[d.status]} />
              ))}
              <LabelList
                dataKey="value"
                position="right"
                content={(p) => {
                  const { x = 0, y = 0, width = 0, height: h = 0, index = 0 } = p as { x?: number; y?: number; width?: number; height?: number; index?: number };
                  const d = data[index];
                  if (!d) return null;
                  const flagged = d.status === 'warning' || d.status === 'critical';
                  // Place the label past whichever is further right: the bar end or the target tick.
                  const span = d.value - domain[0];
                  const pxPerUnit = span > 0 ? Number(width) / span : 0;
                  const targetX = Number(x) + (d.target - domain[0]) * pxPerUnit;
                  const labelX = Math.max(Number(x) + Number(width), pxPerUnit > 0 ? targetX : 0) + 8;
                  return (
                    <text x={labelX} y={Number(y) + Number(h) / 2} dominantBaseline="central" fontSize={12} fill="var(--ink)">
                      <tspan fontWeight={600}>{fmt(d.value, kpi.unit, kpi.decimals)}</tspan>
                      {flagged && <tspan fill="var(--ink-2)">{`  ${d.status === 'critical' ? '⬣' : '▲'} ${STATUS_LABEL[d.status]}`}</tspan>}
                    </text>
                  );
                }}
              />
            </Bar>
            <Bar dataKey="target" shape={<TargetTick />} isAnimationActive={false} legendType="none" activeBar={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <ul className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-2" aria-label="Legend">
        {(['on_target', 'below_target', 'warning', 'critical'] as KpiStatus[]).map((s) => (
          <li key={s} className="flex items-center gap-1.5">
            <span aria-hidden className="inline-block size-2.5 rounded-sm" style={{ background: STATUS_FILL[s] }} />
            {STATUS_LABEL[s]}
          </li>
        ))}
        <li className="flex items-center gap-1.5">
          <span aria-hidden className="inline-block h-3 w-0.5 rounded bg-ink" /> Target
        </li>
        {missing.length > 0 && <li className="text-ink-muted">No data: {missing.join(', ')}</li>}
        {onSelectDepartment && data.length > 1 && <li className="text-ink-muted">Click a bar to drill down into that department</li>}
      </ul>
    </div>
  );
}
