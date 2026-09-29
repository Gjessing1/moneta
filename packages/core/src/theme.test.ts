import { describe, expect, it } from 'vitest';
import { parseThemePreference, resolveTheme } from './theme.js';

describe('parseThemePreference', () => {
  it('keeps known values and falls back to system', () => {
    expect(parseThemePreference('dark')).toBe('dark');
    expect(parseThemePreference('light')).toBe('light');
    expect(parseThemePreference(null)).toBe('system');
    expect(parseThemePreference('sepia')).toBe('system');
  });
});

describe('resolveTheme', () => {
  it('follows the device only when set to system', () => {
    expect(resolveTheme('system', true)).toBe('dark');
    expect(resolveTheme('system', false)).toBe('light');
    expect(resolveTheme('light', true)).toBe('light');
    expect(resolveTheme('dark', false)).toBe('dark');
  });
});
