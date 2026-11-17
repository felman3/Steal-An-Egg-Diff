import { History, Plus, RotateCcw, Save, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { PageHeader } from '../components/AppShell';
import { ErrorState, LoadingState } from '../components/States';
import { useFilters } from '../filters/FiltersProvider';
import {
  createCollegeOverride,
  deleteCollegeOverride,
  fetchKpiTargets,
  fetchMethodology,
  fetchTargetAudit,
  resetKpiTargets,
  updateAnalyticsSetting,
  updateKpiTarget,
  type TargetInput,
} from '../lib/api';
import { toAppError } from '../lib/errors';
import { formatDateTime } from '../lib/format';
import type { AnalyticsSetting, College, KpiDefinition, KpiTargetRow } from '../lib/types';
import { invalidateQueries, useQuery } from '../lib/useQuery';

function refreshAnalytics() {
  // Statuses everywhere depend on targets/settings.
  for (const prefix of ['summary', 'depts', 'faculty', 'trend', 'criteria', 'targets', 'audit', 'methodology']) invalidateQueries(prefix);
}

/** Mirrors the database trigger so mistakes are caught before a round-trip. */
function validate(def: KpiDefinition, v: TargetInput): string | null {
  const vals = [v.target_value, v.warning_threshold, v.critical_threshold];
  if (vals.some((x) => !Number.isFinite(x))) return 'Enter numbers for all three values.';
  if (vals.some((x) => x < def.min_value || x > def.max_value)) return `Values must be between ${def.min_value} and ${def.max_value}.`;
  if (def.direction === 'higher_is_better' && !(v.target_value >= v.warning_threshold && v.warning_threshold >= v.critical_threshold))
    return 'Higher is better: target ≥ warning ≥ critical.';
  if (def.direction === 'lower_is_better' && !(v.target_value <= v.warning_threshold && v.warning_threshold <= v.critical_threshold))
    return 'Lower is better: target ≤ warning ≤ critical.';
  return null;
}

function NumberInput({ value, onChange, disabled, label, step }: { value: string; onChange: (v: string) => void; disabled: boolean; label: string; step: number }) {
  return (
    <input
      type="number"
      inputMode="decimal"
      step={step}
      aria-label={label}
      className="field tabular !min-h-9 w-24 !px-2 !py-1 text-right text-sm"
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

function TargetRow({ def, row, scopeLabel, isAdmin, onRemove }: { def: KpiDefinition; row: KpiTargetRow; scopeLabel: string; isAdmin: boolean; onRemove?: () => void }) {
  const [t, setT] = useState(row.target_value.toFixed(def.decimals));
  const [w, setW] = useState(row.warning_threshold.toFixed(def.decimals));
  const [c, setC] = useState(row.critical_threshold.toFixed(def.decimals));
  const [notes, setNotes] = useState(row.notes ?? '');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const step = def.unit === 'percent' ? 0.5 : 0.05;
  const input: TargetInput = { target_value: Number(t), warning_threshold: Number(w), critical_threshold: Number(c), notes: notes.trim() || null };
  const dirty =
    input.target_value !== row.target_value || input.warning_threshold !== row.warning_threshold || input.critical_threshold !== row.critical_threshold || (row.notes ?? '') !== notes.trim();
  const problem = dirty ? validate(def, input) : null;

  async function save() {
    setBusy(true);
    setMsg(null);
    try {
      await updateKpiTarget(row.id, input);
      setMsg({ kind: 'ok', text: 'Saved' });
      refreshAnalytics();
    } catch (e) {
      setMsg({ kind: 'err', text: toAppError(e).message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <tr className="border-t border-line align-top" data-testid={`target-row-${def.code}-${row.college_id ?? 'default'}`}>
      <th scope="row" className="px-3 py-2.5 text-left text-sm font-medium text-ink">
        {scopeLabel}
        <span className="block text-xs font-normal text-ink-muted">Updated {formatDateTime(row.updated_at)}</span>
      </th>
      <td className="px-3 py-2.5">
        <NumberInput value={t} onChange={setT} disabled={!isAdmin || busy} label={`${scopeLabel} target`} step={step} />
      </td>
      <td className="px-3 py-2.5">
        <NumberInput value={w} onChange={setW} disabled={!isAdmin || busy} label={`${scopeLabel} warning threshold`} step={step} />
      </td>
      <td className="px-3 py-2.5">
        <NumberInput value={c} onChange={setC} disabled={!isAdmin || busy} label={`${scopeLabel} critical threshold`} step={step} />
      </td>
      <td className="px-3 py-2.5">
        <input
          aria-label={`${scopeLabel} notes`}
          className="field !min-h-9 min-w-48 !px-2 !py-1 text-sm"
          value={notes}
          maxLength={500}
          disabled={!isAdmin || busy}
          onChange={(e) => setNotes(e.target.value)}
        />
        {(problem || msg) && (
          <p role={problem || msg?.kind === 'err' ? 'alert' : 'status'} className={`mt-1 text-xs ${problem || msg?.kind === 'err' ? 'text-delta-bad' : 'text-delta-good'}`}>
            {problem ?? msg?.text}
          </p>
        )}
      </td>
      {isAdmin && (
        <td className="px-3 py-2.5">
          <div className="flex gap-1.5">
            <button type="button" className="btn btn-primary !min-h-9 !px-2.5 !py-1 text-xs" disabled={!dirty || !!problem || busy} onClick={() => void save()} data-testid="save-target">
              <Save size={14} aria-hidden /> Save
            </button>
            {onRemove && (
              <button type="button" className="btn btn-ghost !min-h-9 !px-2 !py-1" onClick={onRemove} disabled={busy} aria-label={`Remove ${scopeLabel} override`}>
                <Trash2 size={14} aria-hidden />
              </button>
            )}
          </div>
        </td>
      )}
    </tr>
  );
}

function KpiTargetsCard({ def, rows, colleges, isAdmin }: { def: KpiDefinition; rows: KpiTargetRow[]; colleges: College[]; isAdmin: boolean }) {
  const base = rows.find((r) => r.college_id === null);
  const overrides = rows.filter((r) => r.college_id !== null);
  const available = colleges.filter((c) => !overrides.some((o) => o.college_id === c.id));
  const [newCollege, setNewCollege] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  async function addOverride() {
    if (!base || !newCollege) return;
    setError(null);
    try {
      await createCollegeOverride(def.id, Number(newCollege), {
        target_value: base.target_value,
        warning_threshold: base.warning_threshold,
        critical_threshold: base.critical_threshold,
        notes: 'College-specific target',
      });
      setNewCollege('');
      refreshAnalytics();
    } catch (e) {
      setError(toAppError(e).message);
    }
  }

  async function remove(id: number) {
    setError(null);
    try {
      await deleteCollegeOverride(id);
      refreshAnalytics();
    } catch (e) {
      setError(toAppError(e).message);
    }
  }

  return (
    <section className="card p-4 sm:p-5" aria-label={def.name} data-testid={`targets-${def.code}`}>
      <header className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-[15px] font-semibold text-ink">{def.name}</h2>
          <p className="mt-0.5 max-w-3xl text-[13px] text-ink-2">{def.description}</p>
        </div>
        <span className="rounded-full bg-sunken px-2.5 py-1 text-xs font-semibold text-ink">
          {def.direction === 'higher_is_better' ? 'Higher is better' : 'Lower is better'} · {def.min_value}–{def.max_value}
          {def.unit === 'percent' ? '%' : ''}
        </span>
      </header>
      <div className="relative overflow-x-auto rounded-lg border border-line">
        <table className="w-full border-collapse text-sm">
          <thead className="bg-sunken text-left text-xs text-ink-2">
            <tr>
              <th scope="col" className="px-3 py-2 font-semibold">Applies to</th>
              <th scope="col" className="px-3 py-2 font-semibold">Target</th>
              <th scope="col" className="px-3 py-2 font-semibold">Warning</th>
              <th scope="col" className="px-3 py-2 font-semibold">Critical</th>
              <th scope="col" className="px-3 py-2 font-semibold">Notes</th>
              {isAdmin && <th scope="col" className="px-3 py-2 font-semibold"><span className="sr-only">Actions</span></th>}
            </tr>
          </thead>
          <tbody>
            {base && <TargetRow key={`${base.id}-${base.updated_at}`} def={def} row={base} scopeLabel="Institution default" isAdmin={isAdmin} />}
            {overrides.map((o) => (
              <TargetRow
                key={`${o.id}-${o.updated_at}`}
                def={def}
                row={o}
                scopeLabel={colleges.find((c) => c.id === o.college_id)?.code ?? 'College'}
                isAdmin={isAdmin}
                onRemove={() => void remove(o.id)}
              />
            ))}
          </tbody>
        </table>
      </div>
      {isAdmin && available.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <label className="sr-only" htmlFor={`add-${def.code}`}>
            Add college override
          </label>
          <select id={`add-${def.code}`} className="field !min-h-9 min-w-0 max-w-full !py-1 text-sm sm:!w-auto" value={newCollege} onChange={(e) => setNewCollege(e.target.value)}>
            <option value="">Add a college override…</option>
            {available.map((c) => (
              <option key={c.id} value={c.id}>
                {c.code} · {c.name}
              </option>
            ))}
          </select>
          <button type="button" className="btn btn-ghost !min-h-9 !py-1 text-xs" disabled={!newCollege} onClick={() => void addOverride()}>
            <Plus size={14} aria-hidden /> Add
          </button>
        </div>
      )}
      {error && (
        <p role="alert" className="mt-2 text-xs text-delta-bad">
          {error}
        </p>
      )}
    </section>
  );
}

function SettingRow({ setting, isAdmin }: { setting: AnalyticsSetting; isAdmin: boolean }) {
  const [value, setValue] = useState(String(setting.value));
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const n = Number(value);
  const invalid = !Number.isFinite(n) || n < setting.min_value || n > setting.max_value;
  async function save() {
    setMsg(null);
    try {
      await updateAnalyticsSetting(setting.key, n);
      setMsg({ kind: 'ok', text: 'Saved' });
      refreshAnalytics();
    } catch (e) {
      setMsg({ kind: 'err', text: toAppError(e).message });
    }
  }
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 border-t border-line py-3 first:border-t-0 first:pt-0">
      <div className="min-w-0 max-w-xl">
        <p className="text-sm font-medium text-ink">{setting.label}</p>
        <p className="text-xs text-ink-2">{setting.description}</p>
      </div>
      <div className="flex items-center gap-2">
        <input
          type="number"
          aria-label={setting.label}
          className="field tabular !min-h-9 w-24 !px-2 !py-1 text-right text-sm"
          value={value}
          min={setting.min_value}
          max={setting.max_value}
          step={setting.key === 'min_evaluations_reported' ? 1 : 0.05}
          disabled={!isAdmin}
          onChange={(e) => setValue(e.target.value)}
        />
        {isAdmin && (
          <button type="button" className="btn btn-primary !min-h-9 !px-2.5 !py-1 text-xs" disabled={invalid || n === setting.value} onClick={() => void save()}>
            <Save size={14} aria-hidden /> Save
          </button>
        )}
        {msg && <span className={`text-xs ${msg.kind === 'ok' ? 'text-delta-good' : 'text-delta-bad'}`}>{msg.text}</span>}
      </div>
    </li>
  );
}

export function TargetsPage() {
  const { reference } = useFilters();
  // Only authorized academic administrators can reach any page (see RequireAuth + RLS).
  const isAdmin = true;
  const methodology = useQuery('methodology', fetchMethodology);
  const targets = useQuery('targets', fetchKpiTargets);
  const audit = useQuery('audit', () => fetchTargetAudit(25));
  const [resetState, setResetState] = useState<'idle' | 'confirm' | 'busy' | 'done' | 'error'>('idle');
  const [resetError, setResetError] = useState('');

  async function reset() {
    setResetState('busy');
    try {
      await resetKpiTargets();
      setResetState('done');
      refreshAnalytics();
    } catch (e) {
      setResetError(toAppError(e).message);
      setResetState('error');
    }
  }

  const loading = methodology.isLoading || targets.isLoading;
  const error = methodology.error ?? targets.error;
  const defs = methodology.data?.kpis ?? [];
  const colleges = reference?.colleges ?? [];
  const kpiName = (id: number) => defs.find((d) => d.id === id)?.short_name ?? `KPI ${id}`;

  return (
    <>
      <PageHeader
        title="Targets & alert thresholds"
        description="Stored in the database (kpi_targets). Every KPI status, alert and warning indicator in the dashboard is computed from these values."
        showFilters={false}
        actions={
          isAdmin ? (
            <div className="flex flex-wrap items-center gap-2">
              {resetState === 'confirm' ? (
                <>
                  <span className="text-sm opacity-90">Restore all seeded targets and settings?</span>
                  <button type="button" className="btn btn-primary" onClick={() => void reset()}>
                    Restore
                  </button>
                  <button type="button" className="btn btn-ghost" onClick={() => setResetState('idle')}>
                    Cancel
                  </button>
                </>
              ) : (
                <button type="button" className="btn btn-ghost" onClick={() => setResetState('confirm')} disabled={resetState === 'busy'} data-testid="reset-targets">
                  <RotateCcw size={15} aria-hidden /> {resetState === 'busy' ? 'Restoring…' : 'Restore defaults'}
                </button>
              )}
              {resetState === 'done' && <span className="text-sm font-semibold" role="status">Defaults restored</span>}
              {resetState === 'error' && <span className="rounded bg-critical-bg px-2 py-0.5 text-sm font-semibold" role="alert">{resetError}</span>}
            </div>
          ) : undefined
        }
      />


      {error ? (
        <div className="card">
          <ErrorState error={error} onRetry={() => (methodology.refetch(), targets.refetch())} />
        </div>
      ) : loading ? (
        <div className="card">
          <LoadingState />
        </div>
      ) : (
        <div className="space-y-5">
          {defs.map((def) => (
            <KpiTargetsCard key={def.id} def={def} rows={(targets.data ?? []).filter((t) => t.kpi_id === def.id)} colleges={colleges} isAdmin={isAdmin} />
          ))}

          <section className="card p-4 sm:p-5" aria-labelledby="settings-heading">
            <h2 id="settings-heading" className="mb-3 text-[15px] font-semibold text-ink">
              Analytics settings
            </h2>
            <ul>
              {(methodology.data?.settings ?? []).map((s) => (
                <SettingRow key={`${s.key}-${s.updated_at}-${s.value}`} setting={s} isAdmin={isAdmin} />
              ))}
            </ul>
          </section>

          <section className="card p-4 sm:p-5" aria-labelledby="audit-heading" data-testid="audit-trail">
            <h2 id="audit-heading" className="mb-3 flex items-center gap-2 text-[15px] font-semibold text-ink">
              <History size={16} aria-hidden /> Change history
            </h2>
            {audit.error ? (
              <ErrorState error={audit.error} onRetry={audit.refetch} minHeight={140} />
            ) : audit.isLoading ? (
              <LoadingState minHeight={140} />
            ) : (
              <div className="relative overflow-x-auto rounded-lg border border-line">
                <table className="w-full min-w-[720px] border-collapse text-sm">
                  <thead className="bg-sunken text-left text-xs text-ink-2">
                    <tr>
                      <th scope="col" className="px-3 py-2 font-semibold">When</th>
                      <th scope="col" className="px-3 py-2 font-semibold">Who</th>
                      <th scope="col" className="px-3 py-2 font-semibold">Change</th>
                      <th scope="col" className="px-3 py-2 font-semibold">Target / warning / critical</th>
                    </tr>
                  </thead>
                  <tbody className="tabular">
                    {(audit.data ?? []).map((a) => {
                      const fmt = (v: Record<string, unknown> | null) =>
                        v ? `${Number(v.target_value)} / ${Number(v.warning_threshold)} / ${Number(v.critical_threshold)}` : '—';
                      return (
                        <tr key={a.id} className="border-t border-line">
                          <td className="whitespace-nowrap px-3 py-2 text-ink-2">{formatDateTime(a.changed_at)}</td>
                          <td className="px-3 py-2">{a.changed_by_profile?.full_name ?? 'System (seed)'}</td>
                          <td className="px-3 py-2">
                            {a.action === 'INSERT' ? 'Created' : a.action === 'UPDATE' ? 'Updated' : 'Removed'} · {kpiName(a.kpi_id)} ·{' '}
                            {a.college_id ? (colleges.find((c) => c.id === a.college_id)?.code ?? 'college') : 'institution'}
                          </td>
                          <td className="whitespace-nowrap px-3 py-2">
                            {a.action === 'UPDATE' ? `${fmt(a.old_values)} → ${fmt(a.new_values)}` : fmt(a.new_values ?? a.old_values)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      )}
    </>
  );
}
