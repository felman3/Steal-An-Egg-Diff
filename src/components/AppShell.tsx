import { Building2, GraduationCap, Info, LayoutDashboard, LogOut, Menu, Monitor, Moon, Sun, Target, Users, X } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router';
import { useAuth } from '../auth/AuthProvider';
import { useFilters } from '../filters/FiltersProvider';
import { ROLE_LABEL } from '../lib/format';
import { useTheme } from '../lib/theme';
import { FilterBar } from './FilterBar';
import { PrototypeNotice } from './PrototypeNotice';
import { ErrorState, LoadingState } from './States';

const NAV = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/departments', label: 'Department scorecard', icon: Building2 },
  { to: '/faculty', label: 'Faculty SETE results', icon: Users },
  { to: '/targets', label: 'Targets & thresholds', icon: Target },
  { to: '/about', label: 'About the data', icon: Info },
] as const;

function Navigation({ onNavigate }: { onNavigate?: () => void }) {
  const location = useLocation();
  return (
    <nav aria-label="Main" className="flex flex-col gap-1">
      {NAV.map((item) => {
        const Icon = item.icon;
        return (
          <NavLink
            key={item.to}
            to={{ pathname: item.to, search: location.search }}
            end={'end' in item ? item.end : false}
            onClick={onNavigate}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                isActive ? 'bg-accent-soft text-ink' : 'text-ink-2 hover:bg-sunken hover:text-ink'
              }`
            }
          >
            <Icon size={17} aria-hidden />
            <span className="flex-1">{item.label}</span>
          </NavLink>
        );
      })}
    </nav>
  );
}

function UserCard() {
  const { profile, signOut } = useAuth();
  const { pref, cycle } = useTheme();
  if (!profile) return null;
  const ThemeIcon = pref === 'dark' ? Moon : pref === 'light' ? Sun : Monitor;
  return (
    <div className="rounded-xl border border-line bg-surface p-3" data-testid="user-card">
      <p className="truncate text-sm font-semibold text-ink">{profile.full_name}</p>
      <p className="mt-0.5 text-xs text-ink-2" data-testid="user-role">
        {ROLE_LABEL[profile.role]} · all colleges
      </p>
      {profile.is_demo && (
        <span className="mt-2 inline-block rounded-full bg-warning-bg px-2 py-0.5 text-[11px] font-semibold text-ink">Demo account</span>
      )}
      <div className="mt-3 flex gap-2">
        <button type="button" className="btn btn-ghost flex-1 !px-2 text-xs" onClick={() => void signOut()} data-testid="sign-out">
          <LogOut size={14} aria-hidden /> Sign out
        </button>
        <button type="button" className="btn btn-ghost !px-2.5" onClick={cycle} aria-label={`Theme: ${pref}. Change theme`} title={`Theme: ${pref}`}>
          <ThemeIcon size={15} aria-hidden />
        </button>
      </div>
    </div>
  );
}

function Brand() {
  return (
    <div className="flex items-center gap-2.5">
      <span className="flex size-9 items-center justify-center rounded-xl bg-accent text-accent-ink">
        <GraduationCap size={19} aria-hidden />
      </span>
      <div className="leading-tight">
        <p className="text-sm font-semibold text-ink">Academic Quality</p>
        <p className="text-xs text-ink-2">Academic Administrator</p>
      </div>
    </div>
  );
}

export function AppShell() {
  const location = useLocation();
  // The drawer is open only on the page where it was opened, so navigating closes it.
  const [openOn, setOpenOn] = useState<string | null>(null);
  const open = openOn === location.pathname;
  const setOpen = (v: boolean) => setOpenOn(v ? location.pathname : null);
  const { referenceError, referenceLoading, retryReference, ready } = useFilters();

  return (
    <div className="flex min-h-dvh flex-col">
      <PrototypeNotice />
      <div className="flex flex-1">
        <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col gap-6 border-r border-line bg-page px-4 py-5 lg:flex">
          <Brand />
          <Navigation />
          <div className="mt-auto">
            <UserCard />
          </div>
        </aside>

        {open && (
          <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Navigation">
            <button type="button" aria-label="Close menu" className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
            <div className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col gap-6 overflow-y-auto bg-page px-4 py-5 shadow-xl">
              <div className="flex items-center justify-between">
                <Brand />
                <button type="button" className="btn btn-ghost !px-2" onClick={() => setOpen(false)} aria-label="Close menu">
                  <X size={18} aria-hidden />
                </button>
              </div>
              <Navigation onNavigate={() => setOpen(false)} />
              <div className="mt-auto">
                <UserCard />
              </div>
            </div>
          </div>
        )}

        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-center justify-between border-b border-line px-4 py-3 lg:hidden">
            <Brand />
            <button type="button" className="btn btn-ghost !px-2.5" onClick={() => setOpen(true)} aria-label="Open menu" data-testid="open-menu">
              <Menu size={18} aria-hidden />
            </button>
          </div>
          <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-5 sm:px-6 lg:px-8 lg:py-7">
            {referenceError ? (
              <ErrorState error={referenceError} onRetry={retryReference} minHeight={400} />
            ) : !ready || referenceLoading ? (
              <LoadingState label="Loading dashboard…" minHeight={400} />
            ) : (
              <Outlet />
            )}
          </main>
        </div>
      </div>
    </div>
  );
}

/** Page title + the shared filter row (one row above everything it scopes). */
export function PageHeader({ title, description, showFilters = true, actions }: { title: string; description?: ReactNode; showFilters?: boolean; actions?: ReactNode }) {
  const { describe } = useFilters();
  return (
    <div className="mb-6 flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight text-ink">{title}</h1>
          <p className="mt-1 text-sm text-ink-2" data-testid="scope-description">
            {description ?? (
              <>
                {describe.period} · {describe.scope}
              </>
            )}
          </p>
        </div>
        {actions}
      </div>
      {showFilters && (
        <div className="card p-3 sm:p-4">
          <FilterBar />
        </div>
      )}
    </div>
  );
}
