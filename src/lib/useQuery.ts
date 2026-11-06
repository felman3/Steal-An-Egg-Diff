import { useCallback, useEffect, useEffectEvent, useState, useSyncExternalStore } from 'react';
import { AppError, toAppError } from './errors';

/**
 * Tiny query cache implemented as an external store (read with
 * useSyncExternalStore), so components never set state from effects.
 */
type Entry =
  | { status: 'loading' }
  | { status: 'success'; data: unknown }
  | { status: 'error'; error: AppError };

const entries = new Map<string, Entry>();
const subscribers = new Set<() => void>();

function emit() {
  for (const notify of subscribers) notify();
}

function subscribe(cb: () => void) {
  subscribers.add(cb);
  return () => {
    subscribers.delete(cb);
  };
}

function start(key: string, fetcher: () => Promise<unknown>) {
  const existing = entries.get(key);
  if (existing && existing.status !== 'error') return;
  entries.set(key, { status: 'loading' });
  emit();
  fetcher()
    .then((data) => {
      entries.set(key, { status: 'success', data });
      emit();
    })
    .catch((err: unknown) => {
      entries.set(key, { status: 'error', error: toAppError(err) });
      emit();
    });
}

/** Drop every cached result (on sign-in/sign-out so scopes never leak between users). */
export function clearQueryCache() {
  entries.clear();
  emit();
}

/** Invalidate entries whose key starts with the prefix; mounted queries refetch. */
export function invalidateQueries(prefix: string) {
  let changed = false;
  for (const key of [...entries.keys()]) {
    if (key.startsWith(prefix)) {
      entries.delete(key);
      changed = true;
    }
  }
  if (changed) emit();
}

export interface QueryState<T> {
  data: T | undefined;
  error: AppError | undefined;
  /** First load with nothing to show yet. */
  isLoading: boolean;
  /** Reloading while the previous result stays on screen (dimmed, no skeleton flash). */
  isRefreshing: boolean;
  refetch: () => void;
}

/** Fetch + cache by key. Pass key = null to skip (e.g. when the role is not allowed). */
export function useQuery<T>(key: string | null, fetcher: () => Promise<T>): QueryState<T> {
  const entry = useSyncExternalStore(
    subscribe,
    () => (key ? entries.get(key) : undefined),
    () => undefined,
  );
  const [attempt, setAttempt] = useState(0);
  const runFetcher = useEffectEvent(() => fetcher());
  const missing = key !== null && entry === undefined;

  useEffect(() => {
    if (key) start(key, runFetcher);
  }, [key, attempt, missing]);

  // Keep the last successful result so a refetch (new filters) can hold the frame.
  const [last, setLast] = useState<{ data: T | undefined }>({ data: undefined });
  if (entry?.status === 'success' && last.data !== entry.data) {
    setLast({ data: entry.data as T });
  }

  const refetch = useCallback(() => {
    if (!key) return;
    entries.delete(key);
    emit();
    setAttempt((a) => a + 1);
  }, [key]);

  if (!key) return { data: undefined, error: undefined, isLoading: false, isRefreshing: false, refetch };
  if (entry?.status === 'success') return { data: entry.data as T, error: undefined, isLoading: false, isRefreshing: false, refetch };
  // Never keep showing data from another scope after an error (e.g. a refusal).
  if (entry?.status === 'error') return { data: undefined, error: entry.error, isLoading: false, isRefreshing: false, refetch };
  return { data: last.data, error: undefined, isLoading: last.data === undefined, isRefreshing: last.data !== undefined, refetch };
}
