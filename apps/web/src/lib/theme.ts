'use client';

import { useSyncExternalStore } from 'react';
import { THEME_KEY } from './theme-key';
import { tg } from './telegram';

/** 'system' follows Telegram's colorScheme (or the OS setting in a plain browser). */
export type ThemePref = 'system' | 'light' | 'dark';

// Stored per device, like Telegram's own theme setting. app/layout.tsx applies it
// before the first paint with an inline script.
const listeners = new Set<() => void>();

export function getThemePref(): ThemePref {
  try {
    const v = localStorage.getItem(THEME_KEY);
    return v === 'light' || v === 'dark' ? v : 'system';
  } catch {
    return 'system';
  }
}

export function setThemePref(pref: ThemePref) {
  try {
    if (pref === 'system') localStorage.removeItem(THEME_KEY);
    else localStorage.setItem(THEME_KEY, pref);
  } catch {
    // storage blocked: the choice still applies until reload
  }
  applyTheme(pref);
  listeners.forEach((l) => l());
}

/** Sets data-theme on <html> and paints Telegram's header/background to match. */
export function applyTheme(pref: ThemePref = getThemePref()) {
  const app = tg();
  const root = document.documentElement;
  const scheme = pref === 'system' ? app?.colorScheme : pref;
  // no data-theme ⇒ globals.css falls back to prefers-color-scheme
  if (scheme) root.dataset.theme = scheme;
  else delete root.dataset.theme;
  if (!app) return;
  const bg = getComputedStyle(root).getPropertyValue('--bg').trim();
  if (bg && app.isVersionAtLeast?.('6.1')) {
    app.setHeaderColor?.(bg);
    app.setBackgroundColor?.(bg);
  }
  if (bg && app.isVersionAtLeast?.('7.10')) app.setBottomBarColor?.(bg);
}

export function useThemePref(): ThemePref {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    getThemePref,
    () => 'system',
  );
}
