import { describe, expect, it } from 'vitest';
import { parseAmount, patchFromValues, valuesFromDocument } from './document-edit.js';
import type { ArchiveDocument } from './document.js';

const doc: ArchiveDocument = {
  id: '0d6f1c1e-6a3b-4c8e-9a52-2f0c4b1e7a10',
  source: 'maily',
  kind: 'invoice',
  merchant: 'Hafslund',
  purchasedItem: 'Heater',
  tags: [],
  starred: false,
  amountMinor: 149950,
  currency: 'NOK',
  issuedOn: '2026-09-01',
  dueOn: '2026-09-20',
  kid: null,
  account: null,
  iban: null,
  notes: 'Keep this',
  dedupKey: 'maily:1',
  guessed: ['merchant', 'amountMinor'],
  capturedAt: '2026-09-01T08:00:00.000Z',
  createdAt: '2026-09-01T08:00:00.000Z',
  updatedAt: '2026-09-01T08:00:00.000Z',
  deletedAt: null,
  mail: null,
};

describe('document edit values', () => {
  it('round-trips every editable field through the form', () => {
    const values = valuesFromDocument(doc);
    expect(values.amount).toBe('1499,50');
    expect(patchFromValues(values)).toEqual({
      ok: true,
      value: {
        kind: 'invoice',
        merchant: 'Hafslund',
        purchasedItem: 'Heater',
        amountMinor: 149950,
        currency: 'NOK',
        issuedOn: '2026-09-01',
        dueOn: '2026-09-20',
        kid: '',
        account: '',
        iban: '',
        notes: 'Keep this',
      },
    });
  });

  it('accepts comma or point decimals and refuses ambiguous amounts', () => {
    expect(parseAmount('1 499,50')).toEqual({ ok: true, value: 149950 });
    expect(parseAmount('1499.5')).toEqual({ ok: true, value: 149950 });
    expect(parseAmount('')).toEqual({ ok: true, value: null });
    expect(parseAmount('1.499,50')).toMatchObject({ ok: false });
    expect(parseAmount('12,345')).toMatchObject({ ok: false });
  });

  it('can clear an unused currency along with the amount', () => {
    expect(patchFromValues({ ...valuesFromDocument(doc), amount: '', currency: '' })).toMatchObject(
      {
        ok: true,
        value: { amountMinor: null, currency: null },
      },
    );
  });
});
