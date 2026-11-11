import { ArrowDown, ArrowUp, Minus } from 'lucide-react';
import { formatDelta, formatInt, formatValue, isImprovement } from '../lib/format';
import type { KpiDefinition, KpiSummaryRow } from '../lib/types';
import { Sparkline } from './charts/Sparkline';
import { StatusBadge } from './StatusBadge';

interface Props {
  kpi: KpiSummaryRow;
  trend: (number | null)[];
  selected: boolean;
  onSelect: () => void;
  /** Case-study metadata (category, objective, actions) from kpi_definitions. */
  def?: KpiDefinition;
  /** Responsible-interpretation caution, e.g. low SETE response rate. */
  caution?: string | null;
}

/** Stat tile: label · value · delta vs a named period · target · sparkline. */
export function KpiCard({ kpi, trend, selected, onSelect, def, caution }: Props) {
  const delta = kpi.value !== null && kpi.previous_value !== null ? kpi.value - kpi.previous_value : null;
  const improved = delta === null ? null : isImprovement(Number(delta.toFixed(kpi.decimals)), kpi.direction);
  const DeltaIcon = delta === null || improved === null ? Minus : delta > 0 ? ArrowUp : ArrowDown;

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      data-testid={`kpi-${kpi.kpi_code}`}
      className={`card group flex h-full min-w-0 flex-col p-4 text-left transition-shadow hover:shadow-md ${selected ? 'ring-2 ring-accent ring-offset-0' : ''}`}
      title={`${def?.objective ? `Objective: ${def.objective}\n` : ''}${kpi.description}\nFormula: ${kpi.formula}\nSource: ${kpi.data_source}`}
    >
      {def?.category && (
        <span className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-ink-muted" data-testid={`kpi-category-${kpi.kpi_code}`}>
          {def.category}
        </span>
      )}
      <span className="min-h-9 text-[13px] font-medium leading-snug text-ink-2">{kpi.kpi_name}</span>
      <span className="mt-1.5 text-[28px] font-semibold leading-none tracking-tight text-ink" data-testid={`kpi-value-${kpi.kpi_code}`}>
        {formatValue(kpi.value, kpi.unit, kpi.decimals)}
      </span>
      <span className="mt-2">
        <StatusBadge status={kpi.status} compact />
      </span>
      <div className="mt-2 flex min-h-5 flex-wrap items-center gap-x-1.5 text-xs">
        {delta !== null ? (
          <>
            <span className={`inline-flex items-center gap-0.5 font-semibold ${improved === null ? 'text-ink-2' : improved ? 'text-delta-good' : 'text-delta-bad'}`}>
              <DeltaIcon size={13} aria-hidden strokeWidth={2.5} />
              {formatDelta(delta, kpi.unit, kpi.decimals)}
            </span>
            <span className="text-ink-muted">vs {kpi.previous_label}</span>
          </>
        ) : (
          <span className="text-ink-muted">No comparison period</span>
        )}
      </div>
      <div className="mt-1 text-xs text-ink-muted">
        Target {kpi.direction === 'lower_is_better' ? '≤' : '≥'} {formatValue(kpi.target, kpi.unit, kpi.decimals)}
        {kpi.college_specific_target && ' (college)'} · n {formatInt(kpi.sample_size)}
      </div>
      {caution && (
        <p className="mt-2 rounded-md bg-warning-bg px-2 py-1 text-[11px] leading-snug text-ink" data-testid={`kpi-caution-${kpi.kpi_code}`}>
          {caution}
        </p>
      )}
      <div className="mt-auto pt-2">
        <Sparkline values={trend} />
      </div>
    </button>
  );
}
