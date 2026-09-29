// Light/dark handling. The stored preference can be "system", so the theme that
// is actually painted depends on the device setting as well.

export const THEME_PREFERENCES = ['system', 'light', 'dark'] as const;
export type ThemePreference = (typeof THEME_PREFERENCES)[number];
export type Theme = 'light' | 'dark';

// Anything unknown (an old value, a hand-edited one, nothing stored) falls back
// to following the device.
export function parseThemePreference(value: unknown): ThemePreference {
  for (const preference of THEME_PREFERENCES) {
    if (preference === value) {
      return preference;
    }
  }
  return 'system';
}

export function resolveTheme(preference: ThemePreference, systemPrefersDark: boolean): Theme {
  if (preference === 'light' || preference === 'dark') {
    return preference;
  }
  if (systemPrefersDark) {
    return 'dark';
  }
  return 'light';
}
