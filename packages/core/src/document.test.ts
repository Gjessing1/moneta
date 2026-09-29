import { describe, expect, it } from 'vitest';
import {
  isCalendarDate,
  isCurrencyCode,
  isDocumentId,
  isDocumentKind,
  isDocumentSource,
  isGuessableField,
  isStorableContentType,
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

describe('isDocumentId', () => {
  it('accepts only the canonical lowercase UUID spelling (A12)', () => {
    expect(isDocumentId('0d6f1c1e-6a3b-4c8e-9a52-2f0c4b1e7a10')).toBe(true);
    expect(isDocumentId('0D6F1C1E-6A3B-4C8E-9A52-2F0C4B1E7A10')).toBe(false);
    expect(isDocumentId('0d6f1c1e6a3b4c8e9a522f0c4b1e7a10')).toBe(false);
    expect(isDocumentId('../../etc')).toBe(false);
  });
});

describe('isStorableContentType', () => {
  it('keeps PDFs and photos, never anything that can run script', () => {
    expect(isStorableContentType('application/pdf')).toBe(true);
    expect(isStorableContentType('image/heic')).toBe(true);
    expect(isStorableContentType('image/svg+xml')).toBe(false);
    expect(isStorableContentType('text/html')).toBe(false);
  });
});
