import { CircleCheck, CircleMinus, CircleSlash, OctagonAlert, TriangleAlert } from 'lucide-react';
import { STATUS_LABEL } from '../lib/format';
import type { KpiStatus } from '../lib/types';

const STYLE: Record<KpiStatus, { bg: string; icon: string }> = {
  on_target: { bg: 'bg-good-bg', icon: 'text-good' },
  below_target: { bg: 'bg-neutral-bg', icon: 'text-neutral' },
  warning: { bg: 'bg-warning-bg', icon: 'text-warning' },
  critical: { bg: 'bg-critical-bg', icon: 'text-critical' },
  no_data: { bg: 'bg-neutral-bg', icon: 'text-neutral' },
  insufficient_data: { bg: 'bg-neutral-bg', icon: 'text-neutral' },
};

export function StatusIcon({ status, size = 16 }: { status: KpiStatus; size?: number }) {
  const cls = `${STYLE[status].icon} shrink-0`;
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
      className={`inline-flex items-center gap-1.5 rounded-full ${STYLE[status].bg} ${compact ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs'} font-semibold text-ink whitespace-nowrap`}
      data-status={status}
    >
      <StatusIcon status={status} size={compact ? 13 : 14} />
      {STATUS_LABEL[status]}
    </span>
  );
}
