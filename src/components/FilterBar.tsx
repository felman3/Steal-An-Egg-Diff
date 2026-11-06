import { Lock, RotateCcw } from 'lucide-react';
import { useId } from 'react';
import { useFilters } from '../filters/FiltersProvider';

function Select({
  label,
  value,
  onChange,
  options,
  allLabel,
  locked,
  allowAll = true,
  testId,
}: {
  label: string;
  value: number | null;
  onChange: (v: number | null) => void;
  options: { id: number; label: string }[];
  allLabel: string;
  locked?: boolean;
  allowAll?: boolean;
  testId: string;
}) {
  const id = useId();
  return (
    <div className="min-w-0 flex-1 basis-[calc(50%-0.5rem)] sm:basis-40">
      <label htmlFor={id} className="mb-1 flex items-center gap-1 text-xs font-medium text-ink-2">
        {label}
        {locked && <Lock size={11} aria-label="locked to your scope" />}
      </label>
      <select
        id={id}
        className="field pr-8 text-sm"
        value={value === null ? 'all' : String(value)}
        disabled={locked}
        data-testid={testId}
        onChange={(e) => onChange(e.target.value === 'all' ? null : Number(e.target.value))}
      >
        {allowAll && <option value="all">{allLabel}</option>}
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

/** One filter row above everything it scopes; every chart re-renders against it. */
export function FilterBar() {
  const { reference, filters, setFilters, resetFilters, locks, collegeOptions, departmentOptions } = useFilters();
  if (!reference) return null;

  return (
    <div className="flex flex-wrap items-end gap-x-4 gap-y-3" role="search" aria-label="Dashboard filters" data-testid="filter-bar">
      <Select
        label="Academic year"
        value={filters.academicYearId}
        onChange={(v) => setFilters({ academicYearId: v })}
        options={reference.academicYears.map((a) => ({ id: a.id, label: `AY ${a.label}` }))}
        allLabel="All academic years"
        testId="filter-ay"
      />
      <Select
        label="Semester"
        value={filters.semesterId}
        onChange={(v) => setFilters({ semesterId: v })}
        options={reference.semesters.map((s) => ({ id: s.id, label: s.name }))}
        allLabel="All semesters"
        testId="filter-semester"
      />
      <Select
        label="College"
        value={filters.collegeId}
        onChange={(v) => setFilters({ collegeId: v, departmentId: null })}
        options={collegeOptions.map((c) => ({ id: c.id, label: `${c.code} · ${c.name.replace('College of ', '')}` }))}
        allLabel="All colleges"
        locked={locks.college}
        allowAll={!locks.college}
        testId="filter-college"
      />
      <Select
        label="Department"
        value={filters.departmentId}
        onChange={(v) => setFilters({ departmentId: v })}
        options={departmentOptions.map((d) => ({ id: d.id, label: `${d.code} · ${d.name.replace('Department of ', '')}` }))}
        allLabel={filters.collegeId ? 'All departments in college' : 'All departments'}
        locked={locks.department}
        allowAll={!locks.department}
        testId="filter-department"
      />
      <button type="button" className="btn btn-ghost shrink-0" onClick={resetFilters} title="Reset filters">
        <RotateCcw size={15} aria-hidden />
        <span className="sm:sr-only lg:not-sr-only">Reset</span>
      </button>
    </div>
  );
}
