import {
  Building2,
  GraduationCap,
  Info,
  LayoutDashboard,
  LogOut,
  Menu,
  Monitor,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Sun,
  Target,
  Users,
  X,
} from 'lucide-react';
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

const COLLAPSE_KEY = 'sete-dashboard-sidebar-collapsed';

function readCollapsed(): boolean {
  try {
    return localStorage.getItem(COLLAPSE_KEY) === '1';
  } catch {
    return false;
  }
}

function Navigation({ onNavigate, collapsed = false }: { onNavigate?: () => void; collapsed?: boolean }) {
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
            title={collapsed ? item.label : undefined}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-lg py-2 text-sm font-medium transition-colors ${collapsed ? 'justify-center px-0' : 'px-3'} ${
                isActive ? 'bg-accent-soft text-ink' : 'text-ink-2 hover:bg-sunken hover:text-ink'
              }`
            }
          >
            <Icon size={18} aria-hidden />
            <span className={collapsed ? 'sr-only' : 'flex-1'}>{item.label}</span>
          </NavLink>
        );
      })}
    </nav>
  );
}

function UserCard({ collapsed = false }: { collapsed?: boolean }) {
  const { profile, signOut } = useAuth();
  const { pref, cycle } = useTheme();
  if (!profile) return null;
  const ThemeIcon = pref === 'dark' ? Moon : pref === 'light' ? Sun : Monitor;
  const themeButton = (
    <button type="button" className="btn btn-ghost !px-2.5" onClick={cycle} aria-label={`Theme: ${pref}. Change theme`} title={`Theme: ${pref}`}>
      <ThemeIcon size={15} aria-hidden />
    </button>
  );
  if (collapsed) {
    return (
      <div className="flex flex-col items-center gap-2" data-testid="user-card">
        {themeButton}
        <button type="button" className="btn btn-ghost !px-2.5" onClick={() => void signOut()} aria-label="Sign out" title="Sign out" data-testid="sign-out">
          <LogOut size={15} aria-hidden />
        </button>
      </div>
    );
  }
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
        {themeButton}
      </div>
    </div>
  );
}

function Brand({ collapsed = false }: { collapsed?: boolean }) {
  return (
    <div className={`flex items-center gap-2.5 ${collapsed ? 'justify-center' : ''}`}>
      <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-header text-header-ink">
        <GraduationCap size={19} aria-hidden />
      </span>
      {!collapsed && (
        <div className="leading-tight">
          <p className="text-sm font-semibold text-ink">Academic Quality</p>
          <p className="text-xs text-ink-2">Academic Administrator</p>
        </div>
      )}
    </div>
  );
}

export function AppShell() {
  const location = useLocation();
  // The drawer is open only on the page where it was opened, so navigating closes it.
  const [openOn, setOpenOn] = useState<string | null>(null);
  const open = openOn === location.pathname;
  const setOpen = (v: boolean) => setOpenOn(v ? location.pathname : null);
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const toggleCollapsed = () =>
    setCollapsed((c) => {
      try {
        localStorage.setItem(COLLAPSE_KEY, c ? '0' : '1');
      } catch {
        /* storage unavailable: lasts for this visit only */
      }
      return !c;
    });
  const { referenceError, referenceLoading, retryReference, ready } = useFilters();

  return (
    <div className="flex min-h-dvh flex-col">
      <PrototypeNotice />
      <div className="flex flex-1">
        <aside
          className={`sticky top-0 hidden h-dvh shrink-0 flex-col gap-6 border-r border-line bg-page py-5 transition-[width] duration-150 lg:flex ${
            collapsed ? 'w-[72px] px-3' : 'w-64 px-4'
          }`}
          data-testid="sidebar"
          data-collapsed={collapsed}
        >
          <Brand collapsed={collapsed} />
          <Navigation collapsed={collapsed} />
          <div className="mt-auto flex flex-col gap-3">
            <UserCard collapsed={collapsed} />
            <button
              type="button"
              onClick={toggleCollapsed}
              className={`flex items-center gap-2 rounded-lg py-2 text-xs font-medium text-ink-2 hover:bg-sunken hover:text-ink ${collapsed ? 'justify-center' : 'px-3'}`}
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              data-testid="toggle-sidebar"
            >
              {collapsed ? <PanelLeftOpen size={17} aria-hidden /> : <PanelLeftClose size={17} aria-hidden />}
              {!collapsed && 'Collapse sidebar'}
            </button>
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
          <main className="mx-auto w-full max-w-[1600px] flex-1 px-4 py-5 sm:px-6 lg:px-7 lg:py-6">
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

/** Full-width coloured page header: title, current scope and the filters (with icons) in one band. */
export function PageHeader({ title, description, showFilters = true, actions }: { title: string; description?: ReactNode; showFilters?: boolean; actions?: ReactNode }) {
  const { describe } = useFilters();
  return (
    <header className="mb-5 rounded-2xl bg-header px-4 py-4 text-header-ink shadow-sm sm:px-6 sm:py-5" data-testid="page-header">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{title}</h1>
          <p className="mt-1 text-sm text-header-ink/80" data-testid="scope-description">
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
        <div className="mt-4 border-t border-white/15 pt-4">
          <FilterBar />
        </div>
      )}
    </header>
  );
}
