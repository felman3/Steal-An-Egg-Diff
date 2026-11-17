import { Check, Minus } from 'lucide-react';
import { PageHeader } from '../components/AppShell';
import { DataTable } from '../components/ChartCard';
import { ErrorState, LoadingState } from '../components/States';
import { fetchMethodology } from '../lib/api';
import { useQuery } from '../lib/useQuery';

const yes = <Check size={16} className="text-good" aria-label="Yes" />;
const no = <Minus size={16} className="text-ink-muted" aria-label="No" />;

export function AboutPage() {
  const m = useQuery('methodology', fetchMethodology);

  return (
    <>
      <PageHeader title="About the data" description="What the dashboard measures, where the numbers come from and who can see what." showFilters={false} />

      <section className="card mb-5 border-l-4 !border-l-[var(--status-warning)] p-4 sm:p-5" data-testid="data-notice">
        <h2 className="text-[15px] font-semibold text-ink">Prototype and data notice</h2>
        <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-ink-2">
          <li>
            This is an <strong className="text-ink">academic prototype</strong> for the BAT 405 case study “Enhancing the University Student and
            Faculty Portal Through Analytics and Decision Support”, set in the context of Batangas State University (The National Engineering
            University). It is not an official university system and is not affiliated with or endorsed by the university.
          </li>
          <li>
            Every college, department, student, faculty member, grade and SETE response is <strong className="text-ink">synthetic demonstration data</strong>,
            generated deterministically by SQL seed scripts. College names follow the case-study structure; faculty are pseudonyms such as
            “Faculty CS-07” and students have synthetic numbers only.
          </li>
          <li>
            <strong className="text-ink">Primary user:</strong> the authorized academic administrator (e.g. the Office of the Vice President for
            Academic Affairs). No other role has access.
          </li>
          <li>
            <strong className="text-ink">Existing vs. proposed:</strong> today the Student and Faculty Portal (enrolment, schedules, grades) and SETE
            (Student Evaluation of Teaching Effectiveness) are separate systems. Integrating them, as this dashboard does with synthetic data, is
            the <strong className="text-ink">proposed enhancement</strong>; no real integration exists.
          </li>
        </ul>
      </section>

      {m.error ? (
        <div className="card">
          <ErrorState error={m.error} onRetry={m.refetch} />
        </div>
      ) : m.isLoading || !m.data ? (
        <div className="card">
          <LoadingState />
        </div>
      ) : (
        <div className="space-y-5">
          <section className="card p-4 sm:p-5" aria-labelledby="kpi-defs">
            <h2 id="kpi-defs" className="mb-1 text-[15px] font-semibold text-ink">
              The five KPIs
            </h2>
            <p className="mb-3 text-[13px] text-ink-2">Loaded from the kpi_definitions table. Targets and the two warning thresholds (warning, critical) live in kpi_targets — see Targets &amp; thresholds.</p>
            <DataTable
              spec={{
                caption: 'KPI definitions',
                columns: [
                  { key: 'name', label: 'KPI' },
                  { key: 'objective', label: 'Objective' },
                  { key: 'formula', label: 'Formula' },
                  { key: 'action', label: 'Management action' },
                ],
                rows: m.data.kpis.map((k) => ({
                  name: (
                    <span className="block max-w-[12rem] whitespace-normal">
                      <strong className="text-ink">{k.name}</strong>
                      <span className="mt-0.5 block text-xs text-ink-2">
                        {k.category} · {k.direction === 'higher_is_better' ? 'higher is better' : 'lower is better'}
                      </span>
                      <span className="mt-0.5 block text-xs text-ink-muted">{k.data_source}</span>
                    </span>
                  ),
                  objective: <span className="block max-w-xs whitespace-normal text-ink-2">{k.objective}</span>,
                  formula: <span className="block max-w-[14rem] whitespace-normal text-ink-2">{k.formula}</span>,
                  action: (
                    <span className="block max-w-sm whitespace-normal text-xs text-ink-2">
                      <strong className="text-ink">Warning:</strong> {k.warning_action}
                      <span className="mt-1 block">
                        <strong className="text-ink">Critical:</strong> {k.critical_action}
                      </span>
                    </span>
                  ),
                })),
              }}
            />
          </section>

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <section className="card p-4 sm:p-5" aria-labelledby="sete-criteria">
              <h2 id="sete-criteria" className="mb-3 text-[15px] font-semibold text-ink">
                SETE instrument
              </h2>
              <ul className="space-y-2.5">
                {m.data.criteria.map((c) => (
                  <li key={c.id} className="text-sm">
                    <strong className="text-ink">
                      {c.code}. {c.name}
                    </strong>
                    <span className="block text-ink-2">{c.description}</span>
                  </li>
                ))}
              </ul>
              <h3 className="mt-5 mb-2 text-sm font-semibold text-ink">Descriptive rating scale</h3>
              <DataTable
                spec={{
                  caption: 'Rating scale',
                  columns: [
                    { key: 'label', label: 'Rating' },
                    { key: 'range', label: 'Mean score', align: 'right' },
                  ],
                  rows: m.data.ratingScale.map((r) => ({ label: r.label, range: `${r.min_score.toFixed(2)} – ${r.max_score.toFixed(2)}` })),
                }}
              />
            </section>

            <section className="card p-4 sm:p-5" aria-labelledby="status-logic">
              <h2 id="status-logic" className="mb-3 text-[15px] font-semibold text-ink">
                How statuses and alerts are computed
              </h2>
              <ol className="list-decimal space-y-1.5 pl-5 text-sm text-ink-2">
                <li>
                  <strong className="text-ink">On target</strong> — meets or beats the target.
                </li>
                <li>
                  <strong className="text-ink">Below target</strong> — misses the target but is within the warning threshold (no alert).
                </li>
                <li>
                  <strong className="text-ink">Warning</strong> — worse than the warning threshold.
                </li>
                <li>
                  <strong className="text-ink">Critical</strong> — worse than the critical threshold.
                </li>
              </ol>
              <p className="mt-3 text-sm text-ink-2">
                “Worse” respects each KPI's direction (a higher GWA is worse). A college override replaces the institution default for that
                college's departments. Values are rounded to their display precision before comparison.
              </p>
              <h3 className="mt-5 mb-2 text-sm font-semibold text-ink">Analytics settings</h3>
              <ul className="space-y-1.5 text-sm text-ink-2">
                {m.data.settings.map((s) => (
                  <li key={s.key}>
                    <strong className="text-ink">{s.label}:</strong> {s.value} — {s.description}
                  </li>
                ))}
              </ul>
            </section>
          </div>

          <section className="card p-4 sm:p-5" aria-labelledby="access">
            <h2 id="access" className="mb-1 text-[15px] font-semibold text-ink">
              Who can see what
            </h2>
            <p className="mb-3 text-[13px] text-ink-2">
              One user type. Enforced in PostgreSQL by Row-Level Security policies and an authorization check in every analytics function — not
              just hidden in the interface.
            </p>
            <DataTable
              spec={{
                caption: 'Access control',
                columns: [
                  { key: 'what', label: 'Data' },
                  { key: 'admin', label: 'Authorized academic administrator' },
                  { key: 'other', label: 'Any other signed-in account' },
                  { key: 'anon', label: 'Signed out' },
                ],
                rows: [
                  { what: 'KPIs, trends, charts, alerts', admin: yes, other: no, anon: no },
                  { what: 'Faculty-level SETE results (pseudonymised)', admin: yes, other: no, anon: no },
                  { what: 'Student records & final grades', admin: yes, other: no, anon: no },
                  { what: 'Raw SETE forms (anonymous, no student ID)', admin: yes, other: no, anon: no },
                  { what: 'Change targets, thresholds, settings', admin: yes, other: no, anon: no },
                  { what: 'Target change history (audit trail)', admin: yes, other: no, anon: no },
                ],
              }}
            />
            <p className="mt-3 text-xs text-ink-muted">
              Accounts are provisioned (public sign-up is disabled) and get no access until an academic administrator profile is granted. SETE
              averages built from fewer responses than the reporting minimum are suppressed so respondents cannot be identified.
            </p>
          </section>
        </div>
      )}
    </>
  );
}
