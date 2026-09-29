import { describe, expect, it } from 'vitest';
import { formatAmount, formatDayLong, formatDayShort, formatMonth, localDate } from './format.js';

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
