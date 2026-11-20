import { ArrowRight, Eye, EyeOff, LoaderCircle, LogIn, ShieldCheck } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { useAuth } from '../auth/AuthProvider';
import { SpectraBrand } from '../components/SpectraBrand';
import { demoPassword, supabaseConfigured } from '../lib/supabase';

const ADMIN_DEMO = 'demo.academic.admin@example.com';
const UNAUTHORIZED_DEMO = 'demo.unauthorized@example.com';

export function LoginPage() {
  const { status, signIn } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState(demoPassword ? ADMIN_DEMO : '');
  const [password, setPassword] = useState(demoPassword);
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    await attempt(email, password, 'form');
  }

  async function attempt(em: string, pw: string, source: string) {
    setError(null);
    setBusy(source);
    try {
      await signIn(em, pw);
      void navigate('/dashboard', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign-in failed.');
      setBusy(null);
    }
  }

  return (
    <div className="login-page flex min-h-dvh items-center px-3 py-4 sm:px-8 sm:py-10">
      <main className="login-shell mx-auto grid w-full max-w-[1120px] lg:grid-cols-[1.08fr_0.92fr]">
        <section className="login-intro relative isolate flex min-w-0 flex-col justify-center overflow-hidden px-5 py-7 sm:px-10 sm:py-10 lg:px-12 lg:py-14">
          <SpectraBrand className="spectra-brand--login" />
          <h1 className="mt-6 max-w-[16ch] text-[1.75rem] font-bold leading-[1.12] tracking-tight text-balance sm:mt-8 sm:text-[clamp(2.2rem,4vw,3.25rem)]">
            Academic Performance and Teaching Evidence
          </h1>
          <p className="mt-4 max-w-[39ch] text-sm leading-relaxed text-blue-100 sm:text-base">
            A workspace for authorized academic administrators to review outcomes, understand SETE participation, and act on threshold alerts.
          </p>
          <p className="mt-6 flex items-center gap-2 text-xs font-medium text-blue-100" data-testid="prototype-notice">
            <ShieldCheck size={15} aria-hidden /> Academic prototype with synthetic demonstration data
          </p>
        </section>

        <section className="flex min-w-0 items-center bg-surface px-5 py-6 sm:p-10 lg:p-12">
          <div className="mx-auto w-full max-w-md">
            <h2 className="text-[1.75rem] font-semibold tracking-tight text-ink">Sign In</h2>
            <p className="mt-1 text-sm text-ink-2">Access is limited to authorized academic administrators.</p>

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
            {status === 'ready' && (
              <Link to="/dashboard" className="mt-3 inline-flex min-h-8 items-center gap-1.5 text-sm font-semibold text-accent hover:underline">
                Continue to dashboard <ArrowRight size={15} aria-hidden />
              </Link>
            )}

            {demoPassword && (
              <div className="mt-5 border-t border-line pt-4" data-testid="demo-accounts">
                <h3 className="text-sm font-semibold text-ink">Demonstration Access</h3>
                <button
                  type="button"
                  disabled={busy !== null}
                  onClick={() => {
                    setEmail(ADMIN_DEMO);
                    setPassword(demoPassword);
                    void attempt(ADMIN_DEMO, demoPassword, ADMIN_DEMO);
                  }}
                  className="mt-2.5 flex w-full items-center gap-3 rounded-xl border border-line-strong px-3 py-3 text-left transition-colors hover:border-accent hover:bg-accent-soft disabled:opacity-60"
                  data-testid="demo-admin"
                >
                  <ShieldCheck size={20} className="shrink-0 text-accent" aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-ink">Sign in as the Academic Administrator</span>
                    <span className="block text-xs text-ink-2">Demo access to the institution-wide dashboard</span>
                  </span>
                  {busy === ADMIN_DEMO ? (
                    <LoaderCircle size={16} className="animate-spin text-ink-2" aria-label="Signing in" />
                  ) : (
                    <LogIn size={16} className="text-ink-2" aria-hidden />
                  )}
                </button>
                <p className="mt-3 text-xs leading-relaxed text-ink-2">
                  The email and password are prefilled for the demo administrator.
                </p>
                <p className="mt-2 text-xs leading-relaxed text-ink-2">
                  <strong className="text-ink">Access-control check:</strong> the{' '}
                  <button
                    type="button"
                    className="font-medium text-accent underline-offset-2 hover:underline disabled:opacity-60"
                    disabled={busy !== null}
                    onClick={() => {
                      setEmail(UNAUTHORIZED_DEMO);
                      setPassword(demoPassword);
                      void attempt(UNAUTHORIZED_DEMO, demoPassword, UNAUTHORIZED_DEMO);
                    }}
                    data-testid="demo-unauthorized"
                  >
                    unauthorized test account
                  </button>{' '}
                  can sign in but is not an academic administrator, so it is denied all data.
                </p>
              </div>
            )}
            {busy !== null && <p className="sr-only" role="status">Signing in…</p>}
          </div>
        </section>
      </main>
    </div>
  );
}
