export type AppErrorKind = 'forbidden' | 'unauthenticated' | 'network' | 'invalid' | 'unknown';

export class AppError extends Error {
  kind: AppErrorKind;
  code?: string;
  constructor(kind: AppErrorKind, message: string, code?: string) {
    super(message);
    this.kind = kind;
    this.code = code;
  }
}

interface PgLikeError {
  code?: string;
  message?: string;
  status?: number;
  name?: string;
}

/** Normalise Supabase/PostgREST/fetch errors into something the UI can explain. */
export function toAppError(err: unknown): AppError {
  if (err instanceof AppError) return err;
  const e = (err ?? {}) as PgLikeError;
  const message = e.message ?? String(err);

  if (e.code === '42501' || e.status === 403) {
    return new AppError('forbidden', message.replace(/^Access denied:?\s*/i, '') || 'You do not have access to this data.', e.code);
  }
  if (e.code === 'PGRST301' || e.code === 'PGRST303' || e.status === 401) {
    return new AppError('unauthenticated', 'Your session has expired. Please sign in again.', e.code);
  }
  if (e.code === '22023' || e.code === '23514' || e.code?.startsWith('22')) {
    return new AppError('invalid', message, e.code);
  }
  if (e.name === 'TypeError' || /fetch|network|Failed to fetch|NetworkError|timed out/i.test(message)) {
    return new AppError('network', 'Could not reach the database. Check your connection and try again.');
  }
  return new AppError('unknown', message || 'Something went wrong.', e.code);
}
