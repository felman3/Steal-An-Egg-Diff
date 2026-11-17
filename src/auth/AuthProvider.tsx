import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { AppError, toAppError } from '../lib/errors';
import { clearQueryCache } from '../lib/useQuery';
import type { Profile } from '../lib/types';

type AuthStatus = 'loading' | 'signed_out' | 'ready' | 'no_profile' | 'error';

interface AuthContextValue {
  status: AuthStatus;
  session: Session | null;
  profile: Profile | null;
  error: AppError | null;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  retry: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [sessionLoaded, setSessionLoaded] = useState(false);
  // Result of the latest profile lookup, tagged with the user + attempt it belongs to,
  // so "loading" is derived instead of being set synchronously inside an effect.
  const [lookup, setLookup] = useState<{ userId: string; attempt: number; profile: Profile | null; error: AppError | null } | null>(null);
  const [attempt, setAttempt] = useState(0);

  // Session bootstrap + subscription. The callback only sets state (calling
  // other Supabase methods inside it can deadlock the auth client).
  useEffect(() => {
    let mounted = true;
    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!mounted) return;
        setSession(data.session);
        setSessionLoaded(true);
      })
      .catch(() => {
        if (mounted) setSessionLoaded(true);
      });
    const { data: sub } = supabase.auth.onAuthStateChange((event, next) => {
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'USER_UPDATED') clearQueryCache();
      setSession(next);
      setSessionLoaded(true);
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const userId = session?.user.id ?? null;

  // Load the role/scope profile whenever the signed-in user changes.
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    supabase
      .from('user_profiles')
      .select(
        'user_id, full_name, role, title, is_demo, college:colleges(id, code, name), department:departments(id, code, name, college:colleges(id, code, name))',
      )
      .eq('user_id', userId)
      .maybeSingle()
      .then(({ data, error: err }) => {
        if (cancelled) return;
        setLookup({
          userId,
          attempt,
          profile: err ? null : ((data ?? null) as unknown as Profile | null),
          error: err ? toAppError(err) : null,
        });
      });
    return () => {
      cancelled = true;
    };
  }, [userId, attempt]);

  const current = lookup && lookup.userId === userId && lookup.attempt === attempt ? lookup : null;
  const profile = current?.profile ?? null;
  const error = current?.error ?? null;
  const profileState: 'loading' | 'ready' | 'missing' | 'error' = !current ? 'loading' : current.error ? 'error' : current.profile ? 'ready' : 'missing';

  const signIn = useCallback(async (email: string, password: string) => {
    const { error: err } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (err) {
      if (err.code === 'invalid_credentials' || /invalid login/i.test(err.message)) {
        throw new AppError('unauthenticated', 'Incorrect email or password.');
      }
      throw toAppError(err);
    }
  }, []);

  const signOut = useCallback(async () => {
    clearQueryCache();
    await supabase.auth.signOut();
  }, []);

  const retry = useCallback(() => setAttempt((a) => a + 1), []);

  const status: AuthStatus = !sessionLoaded
    ? 'loading'
    : !session
      ? 'signed_out'
      : profileState === 'ready'
        ? 'ready'
        : profileState === 'missing'
          ? 'no_profile'
          : profileState === 'error'
            ? 'error'
            : 'loading';

  const value = useMemo<AuthContextValue>(
    () => ({ status, session, profile, error, signIn, signOut, retry }),
    [status, session, profile, error, signIn, signOut, retry],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
