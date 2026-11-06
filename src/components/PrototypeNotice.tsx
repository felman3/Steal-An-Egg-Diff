import { FlaskConical } from 'lucide-react';

/** Persistent disclosure: prototype + synthetic data + no official integration. */
export function PrototypeNotice() {
  return (
    <div className="border-b border-line bg-warning-bg px-4 py-1.5 text-center text-xs text-ink sm:text-[13px]" role="note" data-testid="prototype-notice">
      <FlaskConical size={13} className="mr-1.5 inline -translate-y-px" aria-hidden />
      <strong className="font-semibold">Academic prototype</strong> · all figures are <strong className="font-semibold">synthetic demonstration data</strong>.
      Not connected to any official Student and Faculty Portal or SETE system.
    </div>
  );
}
