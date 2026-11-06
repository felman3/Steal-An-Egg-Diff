import { createContext, useCallback, useContext, useMemo, type ReactNode } from 'react';
import { useSearchParams } from 'react-router';
import { useAuth } from '../auth/AuthProvider';
import { fetchReferenceData, type ReferenceData } from '../lib/api';
import type { AppError } from '../lib/errors';
import type { College, Department, Filters } from '../lib/types';
import { useQuery } from '../lib/useQuery';

interface FiltersContextValue {
  reference: ReferenceData | undefined;
  referenceError: AppError | undefined;
  referenceLoading: boolean;
  retryReference: () => void;
  ready: boolean;
  filters: Filters;
  /** Stable string for cache keys. */
  filterKey: string;
  locks: { college: boolean; department: boolean };
  collegeOptions: College[];
  departmentOptions: Department[];
  setFilters: (patch: Partial<Filters>) => void;
  resetFilters: () => void;
  describe: { period: string; scope: string };
}

const FiltersContext = createContext<FiltersContextValue | null>(null);

function parseParam(v: string | null): number | 'all' | undefined {
  if (v === null) return undefined;
  if (v === 'all') return 'all';
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : undefined;
}

export function FiltersProvider({ children }: { children: ReactNode }) {
  const { profile } = useAuth();
  const [params, setParams] = useSearchParams();
  const ref = useQuery('reference', fetchReferenceData);
  const reference = ref.data;

  const lockedCollegeId =
    profile?.role === 'dean' ? (profile.college?.id ?? null) : profile?.role === 'chair' ? (profile.department?.college?.id ?? null) : null;
  const lockedDepartmentId = profile?.role === 'chair' ? (profile.department?.id ?? null) : null;

  const filters = useMemo<Filters>(() => {
    if (!reference) return { academicYearId: null, semesterId: null, collegeId: lockedCollegeId, departmentId: lockedDepartmentId };
    const latestAy = reference.academicYears[0]?.id ?? null;

    const ay = parseParam(params.get('ay'));
    const academicYearId =
      ay === 'all' ? null : typeof ay === 'number' && reference.academicYears.some((a) => a.id === ay) ? ay : latestAy;

    const sem = parseParam(params.get('sem'));
    const semesterId = typeof sem === 'number' && reference.semesters.some((s) => s.id === sem) ? sem : null;

    const col = parseParam(params.get('college'));
    let collegeId = typeof col === 'number' && reference.colleges.some((c) => c.id === col) ? col : null;
    if (lockedCollegeId) collegeId = lockedCollegeId;

    const dep = parseParam(params.get('dept'));
    let departmentId: number | null = null;
    if (typeof dep === 'number') {
      const d = reference.departments.find((x) => x.id === dep);
      if (d && (collegeId === null || d.college_id === collegeId)) departmentId = d.id;
    }
    if (lockedDepartmentId) departmentId = lockedDepartmentId;

    return { academicYearId, semesterId, collegeId, departmentId };
  }, [reference, params, lockedCollegeId, lockedDepartmentId]);

  const collegeOptions = useMemo(() => {
    const all = reference?.colleges ?? [];
    return lockedCollegeId ? all.filter((c) => c.id === lockedCollegeId) : all;
  }, [reference, lockedCollegeId]);

  const departmentOptions = useMemo(() => {
    let all = reference?.departments ?? [];
    if (lockedDepartmentId) return all.filter((d) => d.id === lockedDepartmentId);
    if (filters.collegeId) all = all.filter((d) => d.college_id === filters.collegeId);
    return all;
  }, [reference, lockedDepartmentId, filters.collegeId]);

  const setFilters = useCallback(
    (patch: Partial<Filters>) => {
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if ('academicYearId' in patch) next.set('ay', patch.academicYearId === null ? 'all' : String(patch.academicYearId));
          if ('semesterId' in patch) {
            if (patch.semesterId === null) next.delete('sem');
            else next.set('sem', String(patch.semesterId));
          }
          if ('collegeId' in patch) {
            if (patch.collegeId === null) next.delete('college');
            else next.set('college', String(patch.collegeId));
            // A department from another college no longer applies.
            const dept = Number(next.get('dept'));
            const d = reference?.departments.find((x) => x.id === dept);
            if (d && patch.collegeId !== null && d.college_id !== patch.collegeId) next.delete('dept');
          }
          if ('departmentId' in patch) {
            if (patch.departmentId === null) next.delete('dept');
            else next.set('dept', String(patch.departmentId));
          }
          return next;
        },
        { replace: true },
      );
    },
    [setParams, reference],
  );

  const resetFilters = useCallback(() => setParams(new URLSearchParams(), { replace: true }), [setParams]);

  const describe = useMemo(() => {
    const ay = reference?.academicYears.find((a) => a.id === filters.academicYearId);
    const sem = reference?.semesters.find((s) => s.id === filters.semesterId);
    const col = reference?.colleges.find((c) => c.id === filters.collegeId);
    const dep = reference?.departments.find((d) => d.id === filters.departmentId);
    const period = [sem ? sem.name : 'All semesters', ay ? `AY ${ay.label}` : 'All academic years'].join(' · ');
    const scope = dep ? `${col?.code ?? ''} · ${dep.name.replace('Department of ', '')}` : col ? col.name : 'All colleges';
    return { period, scope };
  }, [reference, filters]);

  const filterKey = `${filters.academicYearId ?? 'all'}|${filters.semesterId ?? 'all'}|${filters.collegeId ?? 'all'}|${filters.departmentId ?? 'all'}`;

  const value: FiltersContextValue = {
    reference,
    referenceError: ref.error,
    referenceLoading: ref.isLoading,
    retryReference: ref.refetch,
    ready: Boolean(reference),
    filters,
    filterKey,
    locks: { college: Boolean(lockedCollegeId), department: Boolean(lockedDepartmentId) },
    collegeOptions,
    departmentOptions,
    setFilters,
    resetFilters,
    describe,
  };

  return <FiltersContext.Provider value={value}>{children}</FiltersContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useFilters(): FiltersContextValue {
  const ctx = useContext(FiltersContext);
  if (!ctx) throw new Error('useFilters must be used inside <FiltersProvider>');
  return ctx;
}
