import { useCallback, useEffect, useState } from 'react';

export type ThemePreference = 'light' | 'dark' | 'system';
const KEY = 'sete-dashboard-theme';

function read(): ThemePreference {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'dark' || v === 'system' ? v : 'light';
  } catch {
    return 'light';
  }
}

function apply(pref: ThemePreference) {
  const root = document.documentElement;
  if (pref === 'system') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', pref);

  const darkThemeMedia = pref === 'dark' ? 'all' : pref === 'system' ? '(prefers-color-scheme: dark)' : 'not all';
  document.getElementById('dark-theme-color')?.setAttribute('media', darkThemeMedia);
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
      const next: ThemePreference = p === 'light' ? 'dark' : p === 'dark' ? 'system' : 'light';
      try {
        localStorage.setItem(KEY, next);
      } catch {
        /* storage unavailable: preference lasts for this session only */
      }
      return next;
    });
  }, []);
  return { pref, cycle };
}
