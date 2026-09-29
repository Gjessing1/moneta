import { describe, expect, it } from 'vitest';
import { describeDocument, groupByMonth } from './archive-list.js';
import type { ArchiveDocument } from './document.js';

const OSLO = 'Europe/Oslo';

function doc(overrides: Partial<ArchiveDocument>): ArchiveDocument {
  return {
    id: '0d6f1c1e-6a3b-4c8e-9a52-2f0c4b1e7a10',
    source: 'maily',
    kind: 'invoice',
    merchant: 'Fjordkraft',
    amountMinor: 118400,
    currency: 'NOK',
    issuedOn: '2026-09-25',
    dueOn: null,
    kid: null,
    account: null,
    iban: null,
    notes: '',
    dedupKey: null,
    guessed: [],
    capturedAt: '2026-09-26T08:00:00.000Z',
    createdAt: '2026-09-26T08:00:00.000Z',
    updatedAt: '2026-09-26T08:00:00.000Z',
    deletedAt: null,
    mail: null,
    ...overrides,
  };
}

describe('describeDocument', () => {
  it('shows merchant, kind, source, date and amount', () => {
    expect(describeDocument(doc({}), OSLO)).toEqual({
      id: doc({}).id,
      source: 'maily',
      title: 'Fjordkraft',
      detail: 'Invoice from mail, 25 Sep',
      amount: '1 184,00 kr',
    });
  });

  it('names a fresh capture by what is missing, dated by its local capture day', () => {
    const capture = doc({
      source: 'camera',
      kind: 'receipt',
      merchant: null,
      amountMinor: null,
      currency: null,
      issuedOn: null,
      capturedAt: '2026-09-30T23:30:00.000Z',
    });
    expect(describeDocument(capture, OSLO)).toMatchObject({
      title: 'Receipt awaiting details',
      detail: 'Receipt photographed, 1 Oct',
      amount: null,
    });
  });
});

describe('groupByMonth', () => {
  it('groups consecutive documents by month, keeping their order', () => {
    const docs = [
      doc({ id: 'a', issuedOn: '2026-10-02' }),
      doc({ id: 'b', issuedOn: null, capturedAt: '2026-09-30T23:30:00.000Z' }),
      doc({ id: 'c', issuedOn: '2026-09-30' }),
      doc({ id: 'd', issuedOn: '2026-08-31' }),
    ];
    const groups = groupByMonth(docs, OSLO);
    const shape = groups.map(function summarize(group) {
      return [
        group.label,
        group.rows
          .map(function id(row) {
            return row.id;
          })
          .join(''),
      ];
    });
    expect(shape).toEqual([
      ['October 2026', 'ab'],
      ['September 2026', 'c'],
      ['August 2026', 'd'],
    ]);
  });

  it('returns nothing for an empty archive', () => {
    expect(groupByMonth([], OSLO)).toEqual([]);
  });
});
