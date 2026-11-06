import { BadgeCheck, Building2, ChartLine, Eye, EyeOff, GraduationCap, KeyRound, LoaderCircle, LogIn, ShieldCheck, UserRound } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router';
import { useAuth } from '../auth/AuthProvider';
import { PrototypeNotice } from '../components/PrototypeNotice';
import { demoPassword, supabaseConfigured } from '../lib/supabase';

const DEMO_ACCOUNTS = [
  { email: 'demo.admin@example.com', role: 'Administrator', scope: 'QA office · every college, can edit targets', icon: ShieldCheck },
  { email: 'demo.dean.ccis@example.com', role: 'Dean', scope: 'College of Computing and Information Sciences only', icon: Building2 },
  { email: 'demo.chair.math@example.com', role: 'Department chair', scope: 'Department of Mathematics only', icon: GraduationCap },
  { email: 'demo.viewer@example.com', role: 'Viewer', scope: 'Aggregate KPIs only · no faculty-level results', icon: UserRound },
];

export function LoginPage() {
  const { status, signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? '/';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (status === 'ready') navigate(from, { replace: true });
  }, [status, from, navigate]);

  if (status === 'ready') return <Navigate to={from} replace />;

  async function submit(e: FormEvent) {
    e.preventDefault();
    await attempt(email, password, 'form');
  }

  async function attempt(em: string, pw: string, source: string) {
    setError(null);
    setBusy(source);
    try {
      await signIn(em, pw);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign-in failed.');
      setBusy(null);
    }
  }

  const waiting = busy !== null && status !== 'signed_out';

  return (
    <div className="flex min-h-dvh flex-col">
      <PrototypeNotice />
      <div className="mx-auto grid w-full max-w-6xl flex-1 gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[1.05fr_1fr] lg:items-center lg:gap-14 lg:py-12">
        <section className="order-2 lg:order-1">
          <div className="flex items-center gap-3">
            <span className="flex size-11 items-center justify-center rounded-2xl bg-accent text-accent-ink">
              <GraduationCap size={22} aria-hidden />
            </span>
            <div>
              <p className="text-lg font-semibold text-ink">Academic Quality Dashboard</p>
              <p className="text-sm text-ink-2">SETE &amp; academic performance analytics</p>
            </div>
          </div>
          <h1 className="mt-8 text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
            Monitor teaching effectiveness and student outcomes in one place.
          </h1>
          <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-ink-2">
            Five database-backed KPIs — mean SETE rating, SETE response rate, course pass rate, mean GWA and the share of faculty
            meeting the SETE standard — compared against targets and alert thresholds stored in the database, filterable by academic
            year, semester, college and department.
          </p>
          <ul className="mt-6 grid max-w-xl gap-3 text-sm text-ink-2 sm:grid-cols-2">
            <li className="flex gap-2">
              <ChartLine size={17} className="mt-0.5 shrink-0 text-accent" aria-hidden /> Trends, department comparisons and SETE criteria
            </li>
            <li className="flex gap-2">
              <ShieldCheck size={17} className="mt-0.5 shrink-0 text-accent" aria-hidden /> Role-based access enforced by Row-Level Security
            </li>
            <li className="flex gap-2">
              <BadgeCheck size={17} className="mt-0.5 shrink-0 text-accent" aria-hidden /> Warning and critical indicators from stored thresholds
            </li>
            <li className="flex gap-2">
              <KeyRound size={17} className="mt-0.5 shrink-0 text-accent" aria-hidden /> Faculty-level results restricted and pseudonymised
            </li>
          </ul>
          <p className="mt-8 max-w-xl rounded-xl border border-line bg-surface p-4 text-[13px] leading-relaxed text-ink-2">
            <strong className="text-ink">About this prototype.</strong> Built for an academic case study. Every student, faculty member,
            grade and evaluation shown is <strong className="text-ink">synthetic demonstration data</strong> generated for this project.
            It is not integrated with any university Student and Faculty Portal or SETE system.
          </p>
        </section>

        <section className="order-1 lg:order-2">
          <div className="card p-5 shadow-sm sm:p-7">
            <h2 className="text-xl font-semibold text-ink">Sign in</h2>
            <p className="mt-1 text-sm text-ink-2">Use your dashboard account or one of the demonstration accounts below.</p>

            {!supabaseConfigured && (
              <p role="alert" className="mt-4 rounded-lg bg-critical-bg px-3 py-2 text-sm text-ink">
                This deployment is missing its Supabase configuration (VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY).
              </p>
            )}

            <form className="mt-5 space-y-4" onSubmit={submit} noValidate>
              <div>
                <label htmlFor="email" className="mb-1 block text-sm font-medium text-ink">
                  Email
                </label>
                <input id="email" type="email" autoComplete="username" required className="field" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div>
                <label htmlFor="password" className="mb-1 block text-sm font-medium text-ink">
                  Password
                </label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPw ? 'text' : 'password'}
                    autoComplete="current-password"
                    required
                    className="field pr-11"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-ink-2 hover:text-ink"
                    onClick={() => setShowPw((s) => !s)}
                    aria-label={showPw ? 'Hide password' : 'Show password'}
                  >
                    {showPw ? <EyeOff size={17} aria-hidden /> : <Eye size={17} aria-hidden />}
                  </button>
                </div>
              </div>
              {error && (
                <p role="alert" className="rounded-lg bg-critical-bg px-3 py-2 text-sm text-ink" data-testid="login-error">
                  {error}
                </p>
              )}
              <button type="submit" className="btn btn-primary w-full" disabled={!email || !password || busy !== null} data-testid="login-submit">
                {busy === 'form' ? <LoaderCircle size={16} className="animate-spin" aria-hidden /> : <LogIn size={16} aria-hidden />}
                {busy === 'form' ? 'Signing in…' : 'Sign in'}
              </button>
            </form>

            {demoPassword && (
              <div className="mt-7 border-t border-line pt-6" data-testid="demo-accounts">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold text-ink">Demonstration accounts</h3>
                  <span className="rounded-full bg-warning-bg px-2 py-0.5 text-[11px] font-semibold text-ink">Synthetic data only</span>
                </div>
                <p className="mt-1 text-xs leading-relaxed text-ink-2">
                  Shared, read-mostly accounts for evaluating the prototype. Password for all four:{' '}
                  <code className="rounded bg-sunken px-1.5 py-0.5 font-mono text-[12px] text-ink">{demoPassword}</code>. Their credentials
                  cannot be changed and public sign-up is disabled.
                </p>
                <ul className="mt-3 space-y-2">
                  {DEMO_ACCOUNTS.map((a) => {
                    const Icon = a.icon;
                    return (
                      <li key={a.email}>
                        <button
                          type="button"
                          disabled={busy !== null}
                          onClick={() => {
                            setEmail(a.email);
                            setPassword(demoPassword);
                            void attempt(a.email, demoPassword, a.email);
                          }}
                          className="flex w-full items-center gap-3 rounded-xl border border-line px-3 py-2.5 text-left transition-colors hover:border-line-strong hover:bg-sunken disabled:opacity-60"
                          data-testid={`demo-${a.email.split('@')[0].split('.')[1]}`}
                        >
                          <Icon size={18} className="shrink-0 text-accent" aria-hidden />
                          <span className="min-w-0 flex-1">
                            <span className="block text-sm font-semibold text-ink">{a.role}</span>
                            <span className="block truncate text-xs text-ink-2">{a.scope}</span>
                            <span className="block truncate font-mono text-[11px] text-ink-muted">{a.email}</span>
                          </span>
                          {busy === a.email ? (
                            <LoaderCircle size={16} className="animate-spin text-ink-2" aria-label="Signing in" />
                          ) : (
                            <LogIn size={16} className="text-ink-2" aria-hidden />
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
            {waiting && <p className="sr-only" role="status">Signing in…</p>}
          </div>
        </section>
      </div>
    </div>
  );
}
