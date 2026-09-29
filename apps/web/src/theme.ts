import { useEffect, useState, useSyncExternalStore } from 'react';
import {
  parseThemePreference,
  resolveTheme,
  type Theme,
  type ThemePreference,
} from '@moneta/core/theme';

// index.html reads the same key before the first paint, so a reload never
// flashes the wrong theme. Keep the two in step.
const STORAGE_KEY = 'moneta.theme';

// The browser chrome (Android status bar, PWA title bar) follows the page.
const CHROME_COLORS: Record<Theme, string> = { light: '#F3F4F1', dark: '#15141B' };

const darkQuery = window.matchMedia('(prefers-color-scheme: dark)');

function subscribeToSystem(onChange: () => void): () => void {
  darkQuery.addEventListener('change', onChange);
  return function unsubscribe() {
    darkQuery.removeEventListener('change', onChange);
  };
}

function systemPrefersDark(): boolean {
  return darkQuery.matches;
}

// Storage can be missing or throw (private windows, blocked site data); the app
// then simply follows the device.
function readStoredPreference(): ThemePreference {
  try {
    return parseThemePreference(window.localStorage.getItem(STORAGE_KEY));
  } catch {
    return 'system';
  }
}

function storePreference(preference: ThemePreference): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, preference);
  } catch {
    // Not persisted; the choice still holds until the page is reloaded.
  }
}

function applyTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) {
    meta.setAttribute('content', CHROME_COLORS[theme]);
  }
}

export function useThemePreference(): [ThemePreference, (preference: ThemePreference) => void] {
  const [preference, setPreference] = useState(readStoredPreference);
  const prefersDark = useSyncExternalStore(subscribeToSystem, systemPrefersDark);

  useEffect(
    function paintTheme() {
      applyTheme(resolveTheme(preference, prefersDark));
    },
    [preference, prefersDark],
  );

  function choose(next: ThemePreference) {
    storePreference(next);
    setPreference(next);
  }

  return [preference, choose];
}
