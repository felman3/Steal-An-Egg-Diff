import { ChevronDown, RotateCcw } from 'lucide-react';
import { useId } from 'react';
import { useFilters } from '../filters/FiltersProvider';

function FilterSelect({ label, value, onChange, options, allLabel, testId }: {
  label: string;
  value: number | null;
  onChange: (value: number | null) => void;
  options: { id: number; label: string }[];
  allLabel: string;
  testId: string;
}) {
  const id = useId();
  return (
    <div className="min-w-0">
      <label htmlFor={id} className="mb-1 block text-xs font-medium text-ink-2">{label}</label>
      <span className="relative block">
        <select
          id={id}
          className="field !min-h-9 cursor-pointer appearance-none truncate !rounded-lg !px-2.5 !py-1.5 !pr-7 text-[13px] font-medium hover:border-accent"
          value={value === null ? 'all' : String(value)}
          data-testid={testId}
          onChange={(event) => onChange(event.target.value === 'all' ? null : Number(event.target.value))}
        >
          <option value="all">{allLabel}</option>
          {options.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
        </select>
        <ChevronDown size={14} className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-ink-2" aria-hidden />
      </span>
    </div>
  );
}

export function FilterBar() {
  const { reference, filters, setFilters, resetFilters, collegeOptions, departmentOptions } = useFilters();
  if (!reference) return null;

  return (
    <div
      className="grid items-end gap-x-3 gap-y-2.5 min-[360px]:grid-cols-2 md:grid-cols-[repeat(4,minmax(0,1fr))_auto]"
      role="group"
      aria-label="Dashboard filters"
      data-testid="filter-bar"
    >
      <FilterSelect
        label="Academic Year"
        value={filters.academicYearId}
        onChange={(value) => setFilters({ academicYearId: value })}
        options={reference.academicYears.map((year) => ({ id: year.id, label: `AY ${year.label}` }))}
        allLabel="All years"
        testId="filter-ay"
      />
      <FilterSelect
        label="Semester"
        value={filters.semesterId}
        onChange={(value) => setFilters({ semesterId: value })}
        options={reference.semesters.map((semester) => ({ id: semester.id, label: semester.name }))}
        allLabel="All semesters"
        testId="filter-semester"
      />
      <FilterSelect
        label="College"
        value={filters.collegeId}
        onChange={(value) => setFilters({ collegeId: value, departmentId: null })}
        options={collegeOptions.map((college) => ({ id: college.id, label: `${college.code} · ${college.name.replace('College of ', '')}` }))}
        allLabel="All colleges"
        testId="filter-college"
      />
      <FilterSelect
        label="Department"
        value={filters.departmentId}
        onChange={(value) => setFilters({ departmentId: value })}
        options={departmentOptions.map((department) => ({ id: department.id, label: `${department.code} · ${department.name.replace('Department of ', '')}` }))}
        allLabel="All departments"
        testId="filter-department"
      />
      <button type="button" className="btn btn-ghost !min-h-9 justify-self-start !rounded-lg !border-transparent !px-2.5 !py-1 !text-xs text-ink-2" onClick={resetFilters}>
        <RotateCcw size={14} aria-hidden /> Reset filters
      </button>
    </div>
  );
}
