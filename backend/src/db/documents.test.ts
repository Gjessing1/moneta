import { describe, expect, it } from 'vitest';
import type { ArchiveDocument, DocumentFile } from '@moneta/core/document';
import { migrate, openDatabase, type Db } from './database.js';
import { getDocument, insertDocument, insertFile, listFiles } from './documents.js';

const NOW = '2026-09-29T20:00:00.000Z';

function receipt(overrides: Partial<ArchiveDocument> = {}): ArchiveDocument {
  return {
    id: '0d6f1c1e-6a3b-4c8e-9a52-2f0c4b1e7a10',
    source: 'maily',
    kind: 'invoice',
    merchant: 'Hafslund',
    purchasedItem: null,
    amountMinor: 149950,
    currency: 'NOK',
    issuedOn: '2026-09-01',
    dueOn: '2026-09-20',
    kid: '1234567890123',
    account: '1234.56.78903',
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

function page(position: number, overrides: Partial<DocumentFile> = {}): DocumentFile {
  return {
    id: `f0000000-0000-4000-8000-00000000000${position}`,
    documentId: receipt().id,
    position,
    contentType: 'application/pdf',
    sizeBytes: 2048,
    sha256: 'a'.repeat(64),
    fileName: 'faktura.pdf',
    mailyAttachmentId: `att-${position}`,
    createdAt: NOW,
    ...overrides,
  };
}

function freshDb(): Db {
  const db = openDatabase(':memory:');
  migrate(db);
  return db;
}

describe('documents', () => {
  it('round-trips every field', () => {
    const db = freshDb();
    insertDocument(db, receipt());
    expect(getDocument(db, receipt().id)).toEqual(receipt());
    expect(getDocument(db, 'missing')).toBeUndefined();
  });

  it('keeps where a maily document was mailed from', () => {
    const db = freshDb();
    const mailed = receipt({
      mail: {
        fromName: 'Hafslund',
        fromAddress: 'faktura@hafslund.no',
        subject: 'Faktura september',
        receivedAt: '2026-09-01T04:12:00.000Z',
      },
    });
    insertDocument(db, mailed);
    expect(getDocument(db, mailed.id)).toEqual(mailed);
  });

  it('refuses a second document for the same upstream item (A8)', () => {
    const db = freshDb();
    insertDocument(db, receipt());
    const again = receipt({ id: '5b1f3a2e-0000-4000-8000-000000000001' });
    expect(() => insertDocument(db, again)).toThrow(
      /UNIQUE constraint failed: documents.dedup_key/,
    );
  });

  it('allows many documents without a dedup key', () => {
    const db = freshDb();
    insertDocument(db, receipt({ source: 'camera', dedupKey: null }));
    const other = receipt({ id: '5b1f3a2e-0000-4000-8000-000000000001', dedupKey: null });
    expect(() => insertDocument(db, other)).not.toThrow();
  });

  it('rejects unknown sources and kinds', () => {
    const db = freshDb();
    const badSource = receipt({ source: 'imap' as ArchiveDocument['source'] });
    expect(() => insertDocument(db, badSource)).toThrow(/CHECK constraint failed/);
    const badKind = receipt({ kind: 'bill' as ArchiveDocument['kind'] });
    expect(() => insertDocument(db, badKind)).toThrow(/CHECK constraint failed/);
  });

  it('rejects an amount without a currency', () => {
    const db = freshDb();
    expect(() => insertDocument(db, receipt({ currency: null }))).toThrow(
      /CHECK constraint failed/,
    );
  });

  it('rejects a fractional amount instead of storing a float', () => {
    const db = freshDb();
    expect(() => insertDocument(db, receipt({ amountMinor: 1499.5 }))).toThrow(
      /cannot store REAL value in INTEGER column/,
    );
  });
});

describe('files', () => {
  it('lists pages in order', () => {
    const db = freshDb();
    insertDocument(db, receipt());
    insertFile(db, page(1));
    insertFile(db, page(0));
    const positions = [];
    for (const file of listFiles(db, receipt().id)) {
      positions.push(file.position);
    }
    expect(positions).toEqual([0, 1]);
    expect(listFiles(db, receipt().id)[0]).toEqual(page(0));
  });

  it('stores each maily attachment once per document (A13)', () => {
    const db = freshDb();
    insertDocument(db, receipt());
    insertFile(db, page(0));
    const resent = page(1, { mailyAttachmentId: 'att-0' });
    expect(() => insertFile(db, resent)).toThrow(/UNIQUE constraint failed/);
  });

  it('needs an existing document', () => {
    const db = freshDb();
    expect(() => insertFile(db, page(0))).toThrow(/FOREIGN KEY constraint failed/);
  });

  it('goes away with its document on a hard purge', () => {
    const db = freshDb();
    insertDocument(db, receipt());
    insertFile(db, page(0));
    db.prepare('DELETE FROM documents WHERE id = ?').run(receipt().id);
    expect(listFiles(db, receipt().id)).toEqual([]);
  });
});
