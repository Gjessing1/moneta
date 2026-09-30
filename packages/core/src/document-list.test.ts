import { describe, expect, it } from 'vitest';
import type { ArchiveDocument } from './document.js';
import {
  DEFAULT_PAGE_SIZE,
  decodeListCursor,
  documentSortKey,
  encodeListCursor,
  parseDocumentListQuery,
} from './document-list.js';

const ID = '0d6f1c1e-6a3b-4c8e-9a52-2f0c4b1e7a10';

function doc(issuedOn: string | null, capturedAt: string): ArchiveDocument {
  return {
    id: ID,
    source: 'camera',
    kind: 'receipt',
    merchant: null,
    purchasedItem: null,
    tags: [],
    starred: false,
    amountMinor: null,
    currency: null,
    issuedOn,
    dueOn: null,
    kid: null,
    account: null,
    iban: null,
    notes: '',
    dedupKey: null,
    guessed: [],
    capturedAt,
    createdAt: capturedAt,
    updatedAt: capturedAt,
    deletedAt: null,
    mail: null,
  };
}

describe('documentSortKey', () => {
  it('prefers the date on the document over the moment it was filed', () => {
    expect(documentSortKey(doc('2026-09-01', '2026-09-29T20:00:00.000Z'))).toBe('2026-09-01');
    expect(documentSortKey(doc(null, '2026-09-29T20:00:00.000Z'))).toBe('2026-09-29T20:00:00.000Z');
  });
});

describe('list cursor', () => {
  it('round-trips', () => {
    const cursor = encodeListCursor(doc(null, '2026-09-29T20:00:00.000Z'));
    expect(decodeListCursor(cursor)).toEqual({ sortKey: '2026-09-29T20:00:00.000Z', id: ID });
    expect(decodeListCursor(encodeListCursor(doc('2026-09-01', 'x')))).toEqual({
      sortKey: '2026-09-01',
      id: ID,
    });
  });

  it('refuses cursors it did not write', () => {
    expect(decodeListCursor('garbage')).toBeNull();
    expect(decodeListCursor(`2026-09-01|not-a-uuid`)).toBeNull();
    expect(decodeListCursor(`'; DROP TABLE documents|${ID}`)).toBeNull();
  });
});

describe('parseDocumentListQuery', () => {
  it('defaults to the first page of everything not deleted', () => {
    expect(parseDocumentListQuery({})).toEqual({
      ok: true,
      value: {
        kind: null,
        source: null,
        q: null,
        shop: null,
        tag: null,
        starred: false,
        bills: false,
        deleted: false,
        limit: DEFAULT_PAGE_SIZE,
        after: null,
      },
    });
  });

  it('reads filters, page size and cursor', () => {
    const result = parseDocumentListQuery({
      kind: 'receipt',
      source: 'camera',
      q: 'headphones',
      deleted: 'true',
      limit: '20',
      after: `2026-09-01|${ID}`,
    });
    expect(result).toEqual({
      ok: true,
      value: {
        kind: 'receipt',
        source: 'camera',
        q: 'headphones',
        shop: null,
        tag: null,
        starred: false,
        bills: false,
        deleted: true,
        limit: 20,
        after: { sortKey: '2026-09-01', id: ID },
      },
    });
  });

  it('refuses bad values and unknown parameters', () => {
    expect(parseDocumentListQuery({ kind: 'bill' })).toMatchObject({ ok: false });
    expect(parseDocumentListQuery({ limit: '0' })).toMatchObject({ ok: false });
    expect(parseDocumentListQuery({ limit: '1000' })).toMatchObject({ ok: false });
    expect(parseDocumentListQuery({ deleted: 'yes' })).toMatchObject({ ok: false });
    expect(parseDocumentListQuery({ kind: ['receipt', 'invoice'] })).toMatchObject({ ok: false });
    expect(parseDocumentListQuery({ q: 'x'.repeat(201) })).toMatchObject({ ok: false });
    expect(parseDocumentListQuery({ starred: 'yes' })).toMatchObject({ ok: false });
    expect(parseDocumentListQuery({ tag: '' })).toMatchObject({ ok: false });
  });
});
