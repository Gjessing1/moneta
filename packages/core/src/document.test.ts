import { describe, expect, it } from 'vitest';
import {
  isCalendarDate,
  isCurrencyCode,
  isDocumentKind,
  isDocumentSource,
  isGuessableField,
  mailyDedupKey,
} from './document.js';

describe('mailyDedupKey', () => {
  it('prefixes the maily message id with its source', () => {
    expect(mailyDedupKey('42')).toBe('maily:42');
  });
});

describe('enum guards', () => {
  it('accepts only known sources', () => {
    expect(isDocumentSource('camera')).toBe(true);
    expect(isDocumentSource('imap')).toBe(false);
    expect(isDocumentSource(undefined)).toBe(false);
  });

  it('accepts only known kinds', () => {
    expect(isDocumentKind('invoice')).toBe(true);
    expect(isDocumentKind('Invoice')).toBe(false);
  });

  it('accepts only extractable fields as guessed', () => {
    expect(isGuessableField('amountMinor')).toBe(true);
    expect(isGuessableField('notes')).toBe(false);
  });
});

describe('isCurrencyCode', () => {
  it('wants three uppercase letters', () => {
    expect(isCurrencyCode('NOK')).toBe(true);
    expect(isCurrencyCode('nok')).toBe(false);
    expect(isCurrencyCode('kr')).toBe(false);
  });
});

describe('isCalendarDate', () => {
  it('accepts real days, leap days included', () => {
    expect(isCalendarDate('2026-09-29')).toBe(true);
    expect(isCalendarDate('2028-02-29')).toBe(true);
  });

  it('rejects days that do not exist instead of rolling them over', () => {
    expect(isCalendarDate('2026-02-30')).toBe(false);
    expect(isCalendarDate('2027-02-29')).toBe(false);
    expect(isCalendarDate('2026-13-01')).toBe(false);
  });

  it('rejects timestamps and other formats', () => {
    expect(isCalendarDate('2026-09-29T00:00:00Z')).toBe(false);
    expect(isCalendarDate('29.09.2026')).toBe(false);
  });
});
