import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import type { ArchiveDocument } from '@moneta/core/document';
import { migrate, openDatabase } from './db/database.js';
import { getDocument, insertDocument, insertFile, isDeletedImport } from './db/documents.js';
import { runPurge } from './purge.js';
import { originalPath } from './storage/originals.js';

const now = new Date('2026-09-30T12:00:00.000Z');
const dirs: string[] = [];
afterEach(function clean() {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function document(id: string, deletedAt: string | null, dedupKey: string | null): ArchiveDocument {
  return {
    id,
    source: 'maily',
    kind: 'invoice',
    merchant: null,
    purchasedItem: null,
    tags: [],
    starred: false,
    amountMinor: null,
    currency: null,
    issuedOn: null,
    dueOn: null,
    kid: null,
    account: null,
    iban: null,
    notes: '',
    dedupKey,
    guessed: [],
    capturedAt: now.toISOString(),
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    deletedAt,
    mail: null,
  };
}

function original(dir: string, bytes: string): string {
  const hash = createHash('sha256').update(bytes).digest('hex');
  const path = originalPath(dir, hash);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, bytes);
  utimesSync(path, new Date('2026-09-20'), new Date('2026-09-20'));
  return hash;
}

describe('archive purge', () => {
  it('purges after 30 days, preserves shared originals, and collects orphan bytes', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'moneta-purge-'));
    dirs.push(dir);
    const db = openDatabase(':memory:');
    migrate(db);
    const old = '00000000-0000-4000-8000-000000000001';
    const fresh = '00000000-0000-4000-8000-000000000002';
    const shared = '00000000-0000-4000-8000-000000000003';
    const boundary = '00000000-0000-4000-8000-000000000004';
    insertDocument(db, document(old, '2026-08-30T12:00:00.000Z', 'maily:old'));
    insertDocument(db, document(boundary, '2026-08-31T12:00:00.000Z', null));
    insertDocument(db, document(fresh, '2026-09-01T12:00:00.000Z', 'maily:fresh'));
    insertDocument(db, document(shared, null, null));
    const oldHash = original(dir, 'old');
    const sharedHash = original(dir, 'shared');
    const orphanHash = original(dir, 'crash orphan');
    const youngHash = original(dir, 'upload in flight');
    utimesSync(originalPath(dir, youngHash), now, now);
    for (const [id, hash] of [
      [old, oldHash],
      [old, sharedHash],
      [shared, sharedHash],
    ]) {
      insertFile(db, {
        id: crypto.randomUUID(),
        documentId: id,
        position: hash === sharedHash ? 1 : 0,
        contentType: 'application/pdf',
        sizeBytes: 3,
        sha256: hash,
        fileName: null,
        mailyAttachmentId: null,
        createdAt: now.toISOString(),
      });
    }
    expect(await runPurge(db, dir, now)).toEqual({ documents: 2, originals: 2 });
    expect(getDocument(db, old)).toBeUndefined();
    expect(getDocument(db, boundary)).toBeUndefined();
    expect(getDocument(db, fresh)).toBeDefined();
    expect(existsSync(originalPath(dir, sharedHash))).toBe(true);
    expect(existsSync(originalPath(dir, oldHash))).toBe(false);
    expect(existsSync(originalPath(dir, orphanHash))).toBe(false);
    expect(existsSync(originalPath(dir, youngHash))).toBe(true);
    expect(isDeletedImport(db, 'maily:old')).toBe(true);
    db.close();
  });
});
