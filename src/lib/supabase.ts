import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

/** True when the public Supabase settings were provided at build time. */
export const supabaseConfigured = Boolean(url && publishableKey);

/**
 * Browser client. It only ever holds the PUBLISHABLE key; every row it can
 * read is filtered by Row-Level Security and role-checked RPCs in Postgres.
 */
export const supabase = createClient(url ?? 'https://not-configured.supabase.co', publishableKey ?? 'not-configured', {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
    storageKey: 'sete-dashboard-auth',
  },
});

/** Shared password of the demonstration accounts (public by design). */
export const demoPassword = (import.meta.env.VITE_DEMO_PASSWORD as string | undefined) ?? '';
