import { CircleCheck, CircleMinus, CircleSlash, OctagonAlert, TriangleAlert } from 'lucide-react';
import { STATUS_LABEL } from '../lib/format';
import type { KpiStatus } from '../lib/types';

const ICON_COLOR: Record<KpiStatus, string> = {
  on_target: 'text-good',
  below_target: 'text-neutral',
  warning: 'text-warning',
  critical: 'text-critical',
  no_data: 'text-neutral',
  insufficient_data: 'text-neutral',
};

export function StatusIcon({ status, size = 16 }: { status: KpiStatus; size?: number }) {
  const cls = `${ICON_COLOR[status]} shrink-0`;
  const props = { size, className: cls, 'aria-hidden': true, strokeWidth: 2.25 } as const;
  switch (status) {
    case 'on_target':
      return <CircleCheck {...props} />;
    case 'warning':
      return <TriangleAlert {...props} />;
    case 'critical':
      return <OctagonAlert {...props} />;
    case 'below_target':
      return <CircleMinus {...props} />;
    default:
      return <CircleSlash {...props} />;
  }
}

/** Status is always icon + text, never colour alone. */
export function StatusBadge({ status, compact = false }: { status: KpiStatus; compact?: boolean }) {
  return (
    <span
      className={`status-tone inline-flex items-center gap-1.5 rounded-full bg-neutral-bg ${compact ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs'} font-semibold text-ink whitespace-nowrap`}
      data-status={status}
    >
      <StatusIcon status={status} size={compact ? 13 : 14} />
      {STATUS_LABEL[status]}
    </span>
  );
}
