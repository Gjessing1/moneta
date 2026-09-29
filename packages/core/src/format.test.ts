import { describe, expect, it } from 'vitest';
import {
  formatAmount,
  formatBytes,
  formatDateTime,
  formatDayLong,
  formatDayShort,
  formatMonth,
  localDate,
} from './format.js';

describe('formatAmount', () => {
  it('writes Norwegian kroner with grouped thousands that never wrap', () => {
    expect(formatAmount(118400, 'NOK')).toBe('1 184,00 kr');
    expect(formatAmount(31240, 'NOK')).toBe('312,40 kr');
    expect(formatAmount(5, 'NOK')).toBe('0,05 kr');
    expect(formatAmount(123456789, 'NOK')).toBe('1 234 567,89 kr');
  });

  it('keeps the code for other currencies and a plain minus for refunds', () => {
    expect(formatAmount(1250, 'EUR')).toBe('12,50 EUR');
    expect(formatAmount(-499050, 'NOK')).toBe('-4 990,50 kr');
  });
});

describe('dates', () => {
  it('formats calendar dates without a time zone', () => {
    expect(formatDayShort('2026-09-07')).toBe('7 Sep');
    expect(formatDayLong('2026-09-27')).toBe('27 Sep 2026');
    expect(formatMonth('2026-09')).toBe('September 2026');
    expect(formatMonth('2027-01')).toBe('January 2027');
  });

  it('converts a UTC timestamp to the local day', () => {
    expect(localDate('2026-09-30T23:30:00.000Z', 'Europe/Oslo')).toBe('2026-10-01');
    expect(localDate('2026-09-30T21:30:00.000Z', 'Europe/Oslo')).toBe('2026-09-30');
    expect(localDate('2026-09-30T23:30:00.000Z', 'UTC')).toBe('2026-09-30');
  });
});

describe('formatDateTime', () => {
  it('shows the local day and a 24-hour time', () => {
    expect(formatDateTime('2026-09-25T04:12:00.000Z', 'Europe/Oslo')).toBe('25 Sep 2026, 06:12');
    expect(formatDateTime('2026-09-30T22:30:00.000Z', 'Europe/Oslo')).toBe('1 Oct 2026, 00:30');
    expect(formatDateTime('2026-01-05T13:05:00.000Z', 'UTC')).toBe('5 Jan 2026, 13:05');
  });
});

describe('formatBytes', () => {
  it('rounds to the unit a person reads', () => {
    expect(formatBytes(812)).toBe('812 bytes');
    expect(formatBytes(188_416)).toBe('184 KB');
    expect(formatBytes(2_516_582)).toBe('2.4 MB');
  });
});
