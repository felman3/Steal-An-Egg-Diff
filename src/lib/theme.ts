import { useCallback, useEffect, useState } from 'react';

export type ThemePreference = 'light' | 'dark' | 'system';
const KEY = 'sete-dashboard-theme';

function read(): ThemePreference {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'light' || v === 'dark' ? v : 'system';
  } catch {
    return 'system';
  }
}

function apply(pref: ThemePreference) {
  const root = document.documentElement;
  if (pref === 'system') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', pref);
}

/** Apply the stored preference before React renders (avoids a flash). */
export function initTheme() {
  apply(read());
}

export function useTheme() {
  const [pref, setPref] = useState<ThemePreference>(read);
  useEffect(() => apply(pref), [pref]);
  const cycle = useCallback(() => {
    setPref((p) => {
      const next: ThemePreference = p === 'system' ? 'dark' : p === 'dark' ? 'light' : 'system';
      try {
        if (next === 'system') localStorage.removeItem(KEY);
        else localStorage.setItem(KEY, next);
      } catch {
        /* storage unavailable: preference lasts for this session only */
      }
      return next;
    });
  }, []);
  return { pref, cycle };
}
