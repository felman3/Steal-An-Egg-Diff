import { Building2, CalendarDays, CalendarRange, ChevronDown, Network, type LucideIcon } from 'lucide-react';
import { useId } from 'react';
import { useFilters } from '../filters/FiltersProvider';

/**
 * Compact filter chip: icon · small label · bold current value · chevron.
 * A real <select> covers the chip (transparent), so it stays keyboard, screen
 * reader and mobile friendly while looking like a chip.
 */
function FilterChip({
  label,
  icon: Icon,
  value,
  onChange,
  options,
  allLabel,
  testId,
}: {
  label: string;
  icon: LucideIcon;
  value: number | null;
  onChange: (v: number | null) => void;
  options: { id: number; label: string; short?: string }[];
  allLabel: string;
  testId: string;
}) {
  const id = useId();
  const current = options.find((o) => o.id === value);
  return (
    <div className="relative flex min-w-0 flex-1 items-center gap-2.5 rounded-xl border border-line bg-surface py-2 pr-8 pl-2 text-ink shadow-sm transition-shadow focus-within:ring-2 focus-within:ring-accent hover:shadow-md sm:flex-none">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent" aria-hidden>
        <Icon size={16} />
      </span>
      <span className="min-w-0 leading-tight">
        <label htmlFor={id} className="block text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
          {label}
        </label>
        <span className="block max-w-[11rem] truncate text-sm font-semibold" aria-hidden>
          {current ? (current.short ?? current.label) : allLabel}
        </span>
      </span>
      <ChevronDown size={15} className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-ink-2" aria-hidden />
      <select
        id={id}
        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
        value={value === null ? 'all' : String(value)}
        data-testid={testId}
        onChange={(e) => onChange(e.target.value === 'all' ? null : Number(e.target.value))}
      >
        <option value="all">{allLabel}</option>
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

/** Filter chips shown in the page header; every card, chart and alert re-renders against them. */
export function FilterBar() {
  const { reference, filters, setFilters, collegeOptions, departmentOptions } = useFilters();
  if (!reference) return null;

  return (
    <div className="flex flex-wrap items-center gap-2.5" role="search" aria-label="Dashboard filters" data-testid="filter-bar">
      <FilterChip
        label="Academic year"
        icon={CalendarDays}
        value={filters.academicYearId}
        onChange={(v) => setFilters({ academicYearId: v })}
        options={reference.academicYears.map((a) => ({ id: a.id, label: `AY ${a.label}` }))}
        allLabel="All years"
        testId="filter-ay"
      />
      <FilterChip
        label="Semester"
        icon={CalendarRange}
        value={filters.semesterId}
        onChange={(v) => setFilters({ semesterId: v })}
        options={reference.semesters.map((s) => ({ id: s.id, label: s.name }))}
        allLabel="All"
        testId="filter-semester"
      />
      <FilterChip
        label="College"
        icon={Building2}
        value={filters.collegeId}
        onChange={(v) => setFilters({ collegeId: v, departmentId: null })}
        options={collegeOptions.map((c) => ({ id: c.id, label: `${c.code} · ${c.name.replace('College of ', '')}`, short: c.code }))}
        allLabel="All"
        testId="filter-college"
      />
      <FilterChip
        label="Department"
        icon={Network}
        value={filters.departmentId}
        onChange={(v) => setFilters({ departmentId: v })}
        options={departmentOptions.map((d) => ({ id: d.id, label: `${d.code} · ${d.name.replace('Department of ', '')}`, short: d.code }))}
        allLabel="All"
        testId="filter-department"
      />
    </div>
  );
}
