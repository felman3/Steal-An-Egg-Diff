import { ArrowDown, ArrowUp, Info, Minus } from 'lucide-react';
import { useEffect, useState } from 'react';
import { formatDelta, formatInt, formatValue, isImprovement, KPI_SAMPLE_LABEL } from '../lib/format';
import { STATUS_FILL } from '../lib/status';
import type { KpiDefinition, KpiSummaryRow } from '../lib/types';
import { StatusBadge } from './StatusBadge';

interface Props {
  kpi: KpiSummaryRow;
  selected: boolean;
  onSelect: () => void;
  /** Case-study metadata (category, objective, actions) from kpi_definitions. */
  def?: KpiDefinition;
  /** Responsible-interpretation caution, e.g. low SETE response rate. */
  caution?: string | null;
}

export function KpiCard({ kpi, selected, onSelect, def, caution }: Props) {
  const delta = kpi.value !== null && kpi.previous_value !== null ? kpi.value - kpi.previous_value : null;
  const improved = delta === null ? null : isImprovement(Number(delta.toFixed(kpi.decimals)), kpi.direction);
  const DeltaIcon = delta === null || improved === null ? Minus : delta > 0 ? ArrowUp : ArrowDown;
  const [showDefinition, setShowDefinition] = useState(false);
  const [hovered, setHovered] = useState(false);
  const showTooltip = showDefinition || hovered;
  useEffect(() => {
    if (!showTooltip) return;
    function dismiss(event: KeyboardEvent) {
      if (event.key !== 'Escape') return;
      setHovered(false);
      setShowDefinition(false);
    }
    document.addEventListener('keydown', dismiss);
    return () => document.removeEventListener('keydown', dismiss);
  }, [showTooltip]);

  const tipId = `kpi-tip-${kpi.kpi_code}`;
  return (
    <div
      className="relative h-full min-w-0"
      onPointerMove={(event) => {
        if (event.pointerType === 'mouse' && !hovered) setHovered(true);
      }}
      onPointerLeave={() => setHovered(false)}
    >
      <button
        type="button"
        onClick={onSelect}
        onFocus={(event) => {
          if (event.currentTarget.matches(':focus-visible')) setShowDefinition(true);
        }}
        onBlur={() => setShowDefinition(false)}
        aria-pressed={selected}
        aria-describedby={showTooltip ? tipId : undefined}
        data-testid={`kpi-${kpi.kpi_code}`}
        className={`card relative flex h-full w-full min-w-0 cursor-pointer flex-col overflow-hidden p-3 pt-4 text-left shadow-xs transition-[border-color,box-shadow] hover:border-accent hover:ring-1 hover:ring-accent sm:p-4 sm:pt-5 ${selected ? '!border-accent ring-1 ring-accent' : ''}`}
      >
        <span aria-hidden className="absolute inset-x-0 top-0 h-1" style={{ background: STATUS_FILL[kpi.status] }} />
        <span className="min-h-9 pr-6 text-sm font-semibold leading-tight text-ink">{kpi.kpi_name}</span>
        <span className="mt-1.5 flex items-baseline gap-1.5">
          <span className="tabular text-[clamp(1.625rem,2.85cqi,2.5rem)] font-semibold leading-none tracking-tight text-ink" data-testid={`kpi-value-${kpi.kpi_code}`}>
            {formatValue(kpi.value, kpi.unit, kpi.decimals)}
          </span>
          {kpi.unit === 'rating' && kpi.value !== null && <span className="text-xs text-ink-muted">/ 5</span>}
        </span>
        <span className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-ink-2">
          <StatusBadge status={kpi.status} compact />
          <span>
            Target {kpi.direction === 'lower_is_better' ? '≤' : '≥'} {formatValue(kpi.target, kpi.unit, kpi.decimals)}
            {kpi.college_specific_target && ' (college)'}
          </span>
        </span>
        {caution && (
          <span className="mt-1.5 rounded-md bg-warning-bg px-1.5 py-1 text-[11px] leading-snug text-ink" data-testid={`kpi-caution-${kpi.kpi_code}`}>
            {caution}
          </span>
        )}
        <span className="mt-2.5 block w-full flex-1" />
        <span className="w-full border-t border-line pt-2 text-[13px] text-ink-2">
          <span className="block">{formatInt(kpi.sample_size)} {KPI_SAMPLE_LABEL[kpi.kpi_code]}</span>
          {delta !== null && kpi.previous_label && (
            <span className="mt-1 flex flex-wrap items-center gap-x-1.5">
              <span className={`inline-flex items-center gap-0.5 font-semibold ${improved === null ? 'text-ink-2' : improved ? 'text-delta-good' : 'text-delta-bad'}`}>
                <DeltaIcon size={13} aria-hidden strokeWidth={2.5} /> {formatDelta(delta, kpi.unit, kpi.decimals)}
              </span>
              <span>vs {kpi.previous_label}</span>
            </span>
          )}
        </span>
      </button>
      <button
        type="button"
        aria-label={`About ${kpi.kpi_name}`}
        aria-expanded={showTooltip}
        aria-controls={tipId}
        className="absolute top-2 right-2 inline-flex size-7 cursor-pointer items-center justify-center rounded-md text-ink-2 hover:bg-sunken hover:text-accent"
        onClick={() => {
          setHovered(false);
          setShowDefinition(!showDefinition);
        }}
        onBlur={() => setShowDefinition(false)}
      >
        <Info size={16} aria-hidden />
      </button>
      <div
        id={tipId}
        hidden={!showTooltip}
        role="tooltip"
        data-testid={`kpi-tooltip-${kpi.kpi_code}`}
        className="overview-kpi-tooltip absolute top-full z-30 w-80 max-w-[calc(100vw-1.5rem)] rounded-xl border border-line bg-surface p-3.5 text-left shadow-xl"
      >
        <span className="absolute inset-x-0 top-0 h-1 rounded-t-xl bg-header" aria-hidden />
        <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-accent">{def?.category ?? 'KPI'}</p>
        <p className="mt-0.5 text-sm font-semibold text-ink">{kpi.kpi_name}</p>
        {def?.objective && (
          <p className="mt-2 text-[13px] leading-relaxed text-ink-2">
            <strong className="block font-semibold text-ink">Objective</strong> {def.objective}
          </p>
        )}
        <p className="mt-2 rounded-lg bg-sunken px-2.5 py-1.5 text-[13px] leading-relaxed text-ink-2">
          <strong className="block font-semibold text-ink">Formula</strong> {kpi.formula}
          {kpi.unit === 'grade' && <span className="mt-1 block">Lower grades are better. 1.00 is highest and 3.00 is the passing cutoff.</span>}
        </p>
        <p className="mt-2 text-[13px] leading-relaxed text-ink-2">
          <strong className="font-semibold text-ink">Target</strong> {kpi.direction === 'lower_is_better' ? '≤' : '≥'}{' '}
          {formatValue(kpi.target, kpi.unit, kpi.decimals)} · warning {kpi.direction === 'lower_is_better' ? '>' : '<'} {formatValue(kpi.warning_threshold, kpi.unit, kpi.decimals)} · critical {kpi.direction === 'lower_is_better' ? '>' : '<'}{' '}
          {formatValue(kpi.critical_threshold, kpi.unit, kpi.decimals)}
        </p>
        <p className="mt-1.5 text-[11px] text-ink-muted">Source · {kpi.data_source}</p>
        {def?.warning_action && (
          <p className="mt-2 text-[13px] leading-relaxed text-ink-2">
            <strong className="block font-semibold text-ink">Action at warning level</strong> {def.warning_action}
          </p>
        )}
      </div>
    </div>
  );
}
