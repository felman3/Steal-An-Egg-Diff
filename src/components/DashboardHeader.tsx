import { ChevronDown, Database, LogOut, Monitor, Moon, SlidersHorizontal, Sun } from 'lucide-react';
import { useId, useState } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { ROLE_LABEL } from '../lib/format';
import { useTheme } from '../lib/theme';
import { FilterBar } from './FilterBar';
import { SpectraBrand } from './SpectraBrand';

export function SpectraMasthead() {
  const { profile, signOut } = useAuth();
  const { pref, cycle } = useTheme();
  const ThemeIcon = pref === 'dark' ? Moon : pref === 'light' ? Sun : Monitor;
  const name = profile?.full_name ?? ROLE_LABEL.admin;
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase();

  return (
    <header className="spectra-masthead sticky top-0 z-40" data-testid="spectra-masthead">
      <SpectraBrand className="spectra-brand--masthead" />
      <div className="relative ml-auto flex shrink-0 items-center gap-1.5 px-2 sm:gap-3 sm:px-5">
        <div className="flex min-w-0 items-center gap-2" title={name}>
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-white/15 text-xs font-bold text-white sm:size-9" aria-hidden>{initials}</span>
          <div className="sr-only min-w-0 md:not-sr-only">
            <span className="block max-w-52 truncate text-sm font-semibold text-white">{name}</span>
            <span className="block text-[11px] text-blue-100">{ROLE_LABEL.admin}</span>
          </div>
        </div>
        <button
          type="button"
          className="spectra-header-button"
          aria-label={`Change theme. Current theme ${pref}`}
          title="Change theme"
          onClick={cycle}
        >
          <ThemeIcon size={16} aria-hidden />
        </button>
        <button type="button" className="spectra-header-button" onClick={() => void signOut()} aria-label="Sign out" title="Sign out">
          <LogOut size={16} aria-hidden />
          <span className="hidden lg:inline">Sign out</span>
        </button>
      </div>
    </header>
  );
}

export function DashboardHeader({ period, scope }: { period: string; scope: string }) {
  const [filtersOpen, setFiltersOpen] = useState(false);
  const filtersId = useId();

  return (
    <header className="space-y-3" data-testid="page-header">
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-[1.625rem]">Academic Analytics</h1>
          <p className="mt-0.5 text-sm text-ink-2">Monitor academic performance and identify teaching improvement priorities.</p>
        </div>
        <p className="flex items-center gap-1.5 rounded-full border border-line bg-surface px-2.5 py-1 text-xs font-medium text-ink-2">
          <Database size={13} className="text-accent" aria-hidden /> Synthetic demonstration data
        </p>
      </div>
      <div className="card spectra-filter-strip px-3.5 py-2.5 sm:px-4">
        <button
          type="button"
          aria-expanded={filtersOpen}
          aria-controls={filtersId}
          onClick={() => setFiltersOpen(!filtersOpen)}
          className="flex min-h-8 w-full cursor-pointer items-center gap-2 text-left text-sm font-semibold text-ink md:hidden"
        >
          <SlidersHorizontal size={15} className="text-accent" aria-hidden /> Filters
          <ChevronDown size={15} className={`ml-auto text-ink-2 ${filtersOpen ? 'rotate-180' : ''}`} aria-hidden />
        </button>
        <div id={filtersId} className={filtersOpen ? 'my-2 md:my-0' : 'hidden md:block'}>
          <FilterBar />
        </div>
        <p className="sr-only" data-testid="scope-description" aria-live="polite">
          {period} · {scope}
        </p>
      </div>
    </header>
  );
}
