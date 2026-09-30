import { createServer } from 'node:http';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, expect, it } from 'vitest';
import type { BillingExportItem, BillingExportPage } from '@moneta/core/maily-import';
import { getDocument, listFiles, updateDocument } from '../db/documents.js';
import { migrate, openDatabase } from '../db/database.js';
import { originalPath } from '../storage/originals.js';
import { runMailyImport } from './import.js';
import { readFileSync } from 'node:fs';

const dir = mkdtempSync(join(tmpdir(), 'moneta-mail-import-'));
const db = openDatabase(join(dir, 'moneta.sqlite'));
migrate(db);
const attachment = Buffer.from('%PDF-1.4\nexample');
let failAttachment = true;
let version = 1;
let trashedOne = false;
let baseUrl = '';

function item(id: string, kind: 'invoice' | 'receipt'): BillingExportItem {
  return {
    messageId: id,
    kind,
    subject: 'Bill for June',
    from: { name: 'Power Co', address: 'bills@example.test' },
    receivedAt: '2026-06-01T12:00:00.000Z',
    classifiedAt: '2026-09-30T00:00:00.000Z',
    trashed: id === 'one' && trashedOne,
    documents:
      id === 'one'
        ? [
            {
              attachmentId: 'file-one',
              filename: 'bill.pdf',
              mimeType: 'application/pdf',
              sizeBytes: attachment.length,
            },
            ...(version === 2
              ? [
                  {
                    attachmentId: 'file-two',
                    filename: 'receipt.pdf',
                    mimeType: 'application/pdf',
                    sizeBytes: attachment.length,
                  },
                ]
              : []),
          ]
        : [],
    kids: ['123'],
    accounts: ['456'],
    ibans: [],
    amount: { value: version === 1 ? 10.5 : 12, currency: 'NOK' },
    dueDate: '2026-06-15',
  };
}

const server = createServer(function respond(request, response) {
  const url = new URL(request.url ?? '/', 'http://localhost');
  if (url.pathname.includes('/attachments/')) {
    if (failAttachment) {
      response.writeHead(503).end();
      return;
    }
    response.writeHead(200, { 'content-type': 'application/pdf' }).end(attachment);
    return;
  }
  const after = url.searchParams.get('after');
  let page: BillingExportPage;
  if (after === null) page = { items: [item('one', 'invoice')], cursor: 'first', hasMore: true };
  else if (after === 'first')
    page = { items: [item('two', 'invoice')], cursor: 'second', hasMore: version === 2 };
  else if (after === 'second' && version === 2)
    page = { items: [item('one', 'receipt')], cursor: 'third', hasMore: false };
  else page = { items: [], cursor: after, hasMore: false };
  response.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify(page));
});

beforeAll(async () => {
  await new Promise<void>(function listen(resolve) {
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  if (address === null || typeof address === 'string') throw new Error('no test server address');
  baseUrl = `http://127.0.0.1:${address.port}`;
});

afterAll(async () => {
  await new Promise<void>(function close(resolve) {
    server.close(function done() {
      resolve();
    });
  });
  db.close();
  rmSync(dir, { recursive: true, force: true });
});

it('retries an incomplete page, imports facts-only bills, and preserves confirmed fields on replay', async () => {
  const config = { mailyUrl: baseUrl, dataDir: dir };
  await expect(runMailyImport(db, config)).rejects.toThrow('HTTP 503');
  expect(db.prepare('SELECT COUNT(*) AS count FROM documents').get()).toEqual({ count: 0 });
  expect(db.prepare('SELECT COUNT(*) AS count FROM import_cursors').get()).toEqual({ count: 0 });

  failAttachment = false;
  expect(await runMailyImport(db, config)).toBe(2);
  const rows = db.prepare('SELECT id, dedup_key FROM documents ORDER BY dedup_key').all() as {
    id: string;
    dedup_key: string;
  }[];
  expect(
    rows.map(function key(row) {
      return row.dedup_key;
    }),
  ).toEqual(['maily:one', 'maily:two']);
  const stored = listFiles(db, rows[0]!.id);
  expect(stored).toHaveLength(1);
  expect(readFileSync(originalPath(dir, stored[0]!.sha256))).toEqual(attachment);
  expect(listFiles(db, rows[1]!.id)).toEqual([]);
  expect(getDocument(db, rows[1]!.id)?.mail?.subject).toBe('Bill for June');
  expect(db.prepare('SELECT cursor FROM import_cursors').get()).toEqual({ cursor: 'second' });
  expect(await runMailyImport(db, config)).toBe(0);

  const current = getDocument(db, rows[0]!.id)!;
  updateDocument(db, {
    ...current,
    amountMinor: 999,
    guessed: current.guessed.filter(function confirmed(field) {
      return field !== 'amountMinor';
    }),
  });
  version = 2;
  expect(await runMailyImport(db, config)).toBe(1);
  const updated = getDocument(db, rows[0]!.id)!;
  expect(updated.kind).toBe('receipt');
  expect(updated.amountMinor).toBe(999);
  expect(listFiles(db, rows[0]!.id)).toHaveLength(2);
  expect(db.prepare('SELECT cursor FROM import_cursors').get()).toEqual({ cursor: 'third' });
  expect(db.prepare('SELECT last_success_at, last_error FROM import_status').get()).toMatchObject({
    last_error: null,
  });

  trashedOne = true;
  expect(await runMailyImport(db, config, true)).toBe(1);
  expect(getDocument(db, rows[0]!.id)).toBeUndefined();
  expect(db.prepare('SELECT COUNT(*) AS count FROM deleted_imports').get()).toEqual({ count: 0 });
  expect(db.prepare('SELECT cursor FROM import_cursors').get()).toEqual({ cursor: 'third' });

  trashedOne = false;
  expect(await runMailyImport(db, config, true)).toBe(3);
  const restored = db.prepare("SELECT id FROM documents WHERE dedup_key = 'maily:one'").get() as {
    id: string;
  };
  expect(getDocument(db, restored.id)?.kind).toBe('receipt');
  expect(listFiles(db, restored.id)).toHaveLength(2);
});
