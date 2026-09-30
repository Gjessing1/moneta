import { describe, expect, it } from 'vitest';
import type { ArchiveDocument } from './document.js';
import { applyDocumentPatch, parseDocumentPatch } from './document-patch.js';

const NOW = '2026-09-29T20:00:00.000Z';
const LATER = '2026-09-30T08:00:00.000Z';

function invoice(overrides: Partial<ArchiveDocument> = {}): ArchiveDocument {
  return {
    id: '0d6f1c1e-6a3b-4c8e-9a52-2f0c4b1e7a10',
    source: 'maily',
    kind: 'invoice',
    merchant: 'Hafslund',
    purchasedItem: null,
    tags: [],
    starred: false,
    amountMinor: 149950,
    currency: 'NOK',
    issuedOn: '2026-09-01',
    dueOn: '2026-09-20',
    kid: null,
    account: null,
    iban: null,
    notes: '',
    dedupKey: 'maily:42',
    guessed: ['merchant', 'amountMinor', 'dueOn'],
    capturedAt: NOW,
    createdAt: NOW,
    updatedAt: NOW,
    deletedAt: null,
    mail: null,
    ...overrides,
  };
}

describe('parseDocumentPatch', () => {
  it('accepts any subset of the editable fields', () => {
    const result = parseDocumentPatch({
      merchant: '  Kiwi Majorstuen ',
      purchasedItem: '  Headphones ',
      tags: [],
      starred: false,
      amountMinor: 4990,
      currency: 'nok',
      issuedOn: '2026-09-28',
      notes: 'Middag',
    });
    expect(result).toEqual({
      ok: true,
      value: {
        merchant: 'Kiwi Majorstuen',
        purchasedItem: 'Headphones',
        tags: [],
        starred: false,
        amountMinor: 4990,
        currency: 'NOK',
        issuedOn: '2026-09-28',
        notes: 'Middag',
      },
    });
  });

  it('reads blank text as not set', () => {
    expect(parseDocumentPatch({ merchant: '  ', kid: null })).toEqual({
      ok: true,
      value: { merchant: null, kid: null },
    });
  });

  it('refuses fields that are not editable, instead of ignoring a typo', () => {
    expect(parseDocumentPatch({ merchnat: 'Kiwi' })).toMatchObject({ ok: false });
    expect(parseDocumentPatch({ id: 'x' })).toMatchObject({ ok: false });
    expect(parseDocumentPatch({ paidAt: NOW })).toMatchObject({ ok: false });
    expect(parseDocumentPatch({ guessed: [] })).toMatchObject({ ok: false });
  });

  it('refuses values of the wrong shape', () => {
    expect(parseDocumentPatch({ amountMinor: 49.9 })).toMatchObject({ ok: false });
    expect(parseDocumentPatch({ amountMinor: '4990' })).toMatchObject({ ok: false });
    expect(parseDocumentPatch({ currency: 'kr' })).toMatchObject({ ok: false });
    expect(parseDocumentPatch({ issuedOn: '2026-02-30' })).toMatchObject({ ok: false });
    expect(parseDocumentPatch({ kind: 'bill' })).toMatchObject({ ok: false });
    expect(parseDocumentPatch({ notes: null })).toMatchObject({ ok: false });
    expect(parseDocumentPatch({ merchant: 'x'.repeat(501) })).toMatchObject({ ok: false });
    expect(parseDocumentPatch({ purchasedItem: 'x'.repeat(501) })).toMatchObject({ ok: false });
    expect(parseDocumentPatch([])).toMatchObject({ ok: false });
    expect(parseDocumentPatch(null)).toMatchObject({ ok: false });
    expect(parseDocumentPatch({ tags: ['ok', ''] })).toMatchObject({ ok: false });
    expect(parseDocumentPatch({ starred: 'true' })).toMatchObject({ ok: false });
  });

  it('normalizes tags and accepts a star', () => {
    expect(parseDocumentPatch({ tags: [' Jobb ', 'jobb', 'Bolig'], starred: true })).toEqual({
      ok: true,
      value: { tags: ['Jobb', 'Bolig'], starred: true },
    });
  });
});

describe('applyDocumentPatch', () => {
  it('confirms every field it touches, even an unchanged one (A13)', () => {
    const result = applyDocumentPatch(invoice(), { merchant: 'Hafslund', notes: 'strøm' }, LATER);
    expect(result).toEqual({
      ok: true,
      value: invoice({ notes: 'strøm', guessed: ['amountMinor', 'dueOn'], updatedAt: LATER }),
    });
  });

  it('refuses to leave an amount without a currency', () => {
    expect(applyDocumentPatch(invoice(), { currency: null }, LATER)).toMatchObject({ ok: false });
    const cleared = applyDocumentPatch(invoice(), { amountMinor: null, currency: null }, LATER);
    expect(cleared).toMatchObject({ ok: true, value: { amountMinor: null, currency: null } });
  });
});
