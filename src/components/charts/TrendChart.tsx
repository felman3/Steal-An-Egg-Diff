import { Area, CartesianGrid, ComposedChart, Line, ReferenceArea, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { formatInt, shortTermLabel } from '../../lib/format';
import type { KpiSummaryRow, TrendRow } from '../../lib/types';
import { fmt, lineDomain, statusZones, tickFormatter } from './chartUtils';
import { TooltipBox, TooltipRow } from './ChartTooltip';

interface Point {
  label: string;
  full: string;
  value: number | null;
  n: number;
  selected: boolean;
}

export function TrendChart({ rows, kpi, minHeight = 250 }: { rows: TrendRow[]; kpi: KpiSummaryRow; minHeight?: number }) {
  const data: Point[] = rows
    .slice()
    .sort((a, b) => a.term_start.localeCompare(b.term_start))
    .map((r) => ({
      label: shortTermLabel(r.semester_name, r.academic_year_label),
      full: `${r.semester_name} · AY ${r.academic_year_label}`,
      value: r.value,
      n: r.sample_size,
      selected: r.in_selected_period,
    }));

  const values = data.map((d) => d.value).filter((v): v is number => v !== null);
  const domain = lineDomain(kpi.unit, values, [kpi.target, kpi.warning_threshold, kpi.critical_threshold]);
  const zones = statusZones(domain, kpi.warning_threshold, kpi.critical_threshold, kpi.direction);
  const selected = data.filter((d) => d.selected);
  const highlight = selected.length > 0 && selected.length < data.length;
  const latest = [...data].reverse().find((d) => d.value !== null);

  const summary = `${kpi.kpi_name} by term: ${data.map((d) => `${d.full} ${fmt(d.value, kpi.unit, kpi.decimals)}`).join('; ')}. Target ${fmt(kpi.target, kpi.unit, kpi.decimals)}.`;

  return (
    <div role="img" aria-label={summary} data-testid="trend-chart" className="relative flex-1" style={{ minHeight }}>
      <ResponsiveContainer width="100%" height="100%" className="!absolute inset-0">
        <ComposedChart data={data} margin={{ top: 18, right: 20, bottom: 4, left: 0 }}>
          <defs>
            <linearGradient id="trend-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--series-1)" stopOpacity={0.28} />
              <stop offset="100%" stopColor="var(--series-1)" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} strokeWidth={1} />
          {zones && (
            <>
              <ReferenceArea y1={zones.critical[0]} y2={zones.critical[1]} fill="var(--zone-critical)" fillOpacity={1} ifOverflow="hidden" />
              <ReferenceArea y1={zones.warning[0]} y2={zones.warning[1]} fill="var(--zone-warning)" fillOpacity={1} ifOverflow="hidden" />
            </>
          )}
          {highlight && selected.length > 1 && (
            <ReferenceArea x1={selected[0].label} x2={selected[selected.length - 1].label} fill="var(--wash-1)" fillOpacity={1} />
          )}
          {highlight && selected.length === 1 && <ReferenceLine x={selected[0].label} stroke="var(--series-1)" strokeOpacity={0.35} strokeWidth={10} />}
          <XAxis dataKey="label" tickLine={false} axisLine={{ stroke: 'var(--axis)' }} tick={{ fontSize: 12 }} interval="preserveStartEnd" minTickGap={8} />
          <YAxis domain={domain} tickLine={false} axisLine={false} width={46} tick={{ fontSize: 12 }} tickFormatter={tickFormatter(kpi.unit)} tickCount={5} />
          <ReferenceLine
            y={kpi.target}
            stroke="var(--ink-2)"
            strokeDasharray="5 4"
            strokeWidth={1}
            ifOverflow="extendDomain"
            label={{ value: `Target ${fmt(kpi.target, kpi.unit, kpi.decimals)}`, position: 'insideTopLeft', fill: 'var(--ink-2)', fontSize: 11, offset: 6 }}
          />
          <Tooltip
            cursor={{ stroke: 'var(--axis-ink)', strokeWidth: 1 }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const p = payload[0].payload as Point;
              return (
                <TooltipBox title={p.full}>
                  <TooltipRow label={kpi.short_name} value={fmt(p.value, kpi.unit, kpi.decimals)} keyColor="var(--series-1)" />
                  <TooltipRow label="Target" value={fmt(kpi.target, kpi.unit, kpi.decimals)} />
                  <TooltipRow label="Sample size" value={formatInt(p.n)} />
                </TooltipBox>
              );
            }}
          />
          <Area type="linear" dataKey="value" stroke="none" fill="url(#trend-fill)" connectNulls={false} isAnimationActive={false} activeDot={false} tooltipType="none" />
          <Line
            type="linear"
            dataKey="value"
            stroke="var(--series-1)"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            connectNulls={false}
            isAnimationActive={false}
            dot={{ r: 4, fill: 'var(--series-1)', stroke: 'var(--surface)', strokeWidth: 2 }}
            activeDot={{ r: 6, fill: 'var(--series-1)', stroke: 'var(--surface)', strokeWidth: 2 }}
            label={(props: { x?: number | string; y?: number | string; index?: number }) => {
              // Direct-label only the latest point.
              if (!latest || props.index !== data.indexOf(latest)) return <g />;
              return (
                <text x={Number(props.x)} y={Number(props.y) - 12} textAnchor="middle" fontSize={12} fontWeight={600} fill="var(--ink)">
                  {fmt(latest.value, kpi.unit, kpi.decimals)}
                </text>
              );
            }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
