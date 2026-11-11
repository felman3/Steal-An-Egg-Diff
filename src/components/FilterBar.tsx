import { Building2, CalendarDays, CalendarRange, Network, RotateCcw, type LucideIcon } from 'lucide-react';
import { useId } from 'react';
import { useFilters } from '../filters/FiltersProvider';

function Select({
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
  options: { id: number; label: string }[];
  allLabel: string;
  testId: string;
}) {
  const id = useId();
  return (
    <div className="min-w-0 flex-1 basis-[calc(50%-0.5rem)] sm:basis-44">
      <label htmlFor={id} className="mb-1 block text-xs font-medium opacity-85">
        {label}
      </label>
      <div className="relative">
        <Icon size={15} className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-ink-2" aria-hidden />
        <select
          id={id}
          className="field pr-8 !pl-8 text-sm"
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
    </div>
  );
}

/** Filter row shown inside the page header; every card, chart and alert re-renders against it. */
export function FilterBar() {
  const { reference, filters, setFilters, resetFilters, collegeOptions, departmentOptions } = useFilters();
  if (!reference) return null;

  return (
    <div className="flex flex-wrap items-end gap-x-3 gap-y-3" role="search" aria-label="Dashboard filters" data-testid="filter-bar">
      <Select
        label="Academic year"
        icon={CalendarDays}
        value={filters.academicYearId}
        onChange={(v) => setFilters({ academicYearId: v })}
        options={reference.academicYears.map((a) => ({ id: a.id, label: `AY ${a.label}` }))}
        allLabel="All academic years"
        testId="filter-ay"
      />
      <Select
        label="Semester"
        icon={CalendarRange}
        value={filters.semesterId}
        onChange={(v) => setFilters({ semesterId: v })}
        options={reference.semesters.map((s) => ({ id: s.id, label: s.name }))}
        allLabel="All semesters"
        testId="filter-semester"
      />
      <Select
        label="College"
        icon={Building2}
        value={filters.collegeId}
        onChange={(v) => setFilters({ collegeId: v, departmentId: null })}
        options={collegeOptions.map((c) => ({ id: c.id, label: `${c.code} · ${c.name.replace('College of ', '')}` }))}
        allLabel="All colleges"
        testId="filter-college"
      />
      <Select
        label="Department"
        icon={Network}
        value={filters.departmentId}
        onChange={(v) => setFilters({ departmentId: v })}
        options={departmentOptions.map((d) => ({ id: d.id, label: `${d.code} · ${d.name.replace('Department of ', '')}` }))}
        allLabel={filters.collegeId ? 'All departments in college' : 'All departments'}
        testId="filter-department"
      />
      <button type="button" className="btn btn-ghost shrink-0" onClick={resetFilters} title="Reset filters">
        <RotateCcw size={15} aria-hidden />
        <span className="sm:sr-only lg:not-sr-only">Reset</span>
      </button>
    </div>
  );
}
