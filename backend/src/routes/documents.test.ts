import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import type { ArchiveDocument, DocumentDetail } from '@moneta/core/document';
import type { DocumentPage } from '@moneta/core/document-list';
import { buildApp } from '../app.js';
import { loadConfig } from '../config.js';
import { migrate, openDatabase, type Db } from '../db/database.js';
import { insertDocument, insertFile } from '../db/documents.js';
import { originalPath } from '../storage/originals.js';

const ID = '0d6f1c1e-6a3b-4c8e-9a52-2f0c4b1e7a10';
const PDF = Buffer.from('%PDF-1.7\n% a tiny stand-in for a real invoice\n');
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4]);

const open: { close(): Promise<unknown> }[] = [];
const dirs: string[] = [];
afterEach(async () => {
  for (const app of open.splice(0)) {
    await app.close();
  }
  for (const dir of dirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

async function setup(env: Record<string, string> = {}) {
  const dataDir = mkdtempSync(join(tmpdir(), 'moneta-api-'));
  dirs.push(dataDir);
  const db = openDatabase(':memory:');
  migrate(db);
  const config = loadConfig({ LOG_LEVEL: 'silent', MONETA_DATA_DIR: dataDir, ...env });
  const app = await buildApp({ ...config, webRoot: '/nonexistent' }, db);
  open.push(app);
  return { app, db, dataDir };
}

function sha256(bytes: Buffer): string {
  return createHash('sha256').update(bytes).digest('hex');
}

function stored(overrides: Partial<ArchiveDocument>): ArchiveDocument {
  return {
    id: ID,
    source: 'maily',
    kind: 'invoice',
    merchant: 'Hafslund',
    purchasedItem: null,
    tags: [],
    starred: false,
    amountMinor: 149950,
    currency: 'NOK',
    issuedOn: '2026-09-01',
    dueOn: null,
    kid: null,
    account: null,
    iban: null,
    notes: '',
    dedupKey: null,
    guessed: ['merchant'],
    capturedAt: '2026-09-02T08:00:00.000Z',
    createdAt: '2026-09-02T08:00:00.000Z',
    updatedAt: '2026-09-02T08:00:00.000Z',
    deletedAt: null,
    mail: null,
    ...overrides,
  };
}

function seed(db: Db, count: number): string[] {
  const ids: string[] = [];
  for (let i = 0; i < count; i++) {
    const id = `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`;
    const day = String((i % 28) + 1).padStart(2, '0');
    insertDocument(db, stored({ id, issuedOn: `2026-08-${day}` }));
    ids.push(id);
  }
  return ids;
}

describe('PUT /api/documents/:id/file', () => {
  it('files a capture, and a retry of the same bytes is a no-op (A12)', async () => {
    const { app, dataDir } = await setup();
    const url = `/api/documents/${ID}/file?source=camera&capturedAt=2026-09-29T21:30:00%2B02:00&fileName=kvittering.jpg`;
    const headers = { 'content-type': 'image/jpeg' };

    const first = await app.inject({ method: 'PUT', url, headers, payload: JPEG });
    expect(first.statusCode).toBe(201);
    const detail = first.json<DocumentDetail>();
    expect(detail.document).toMatchObject({
      id: ID,
      source: 'camera',
      kind: 'receipt',
      guessed: ['kind'],
      capturedAt: '2026-09-29T19:30:00.000Z',
    });
    expect(detail.files).toMatchObject([
      {
        position: 0,
        contentType: 'image/jpeg',
        sizeBytes: JPEG.length,
        sha256: sha256(JPEG),
        fileName: 'kvittering.jpg',
      },
    ]);
    expect(existsSync(originalPath(dataDir, sha256(JPEG)))).toBe(true);

    const retry = await app.inject({ method: 'PUT', url, headers, payload: JPEG });
    expect(retry.statusCode).toBe(200);
    expect(retry.json<DocumentDetail>()).toEqual(detail);
  });

  it('appends different bytes as the next page', async () => {
    const { app } = await setup();
    const url = `/api/documents/${ID}/file?source=camera`;
    await app.inject({
      method: 'PUT',
      url,
      headers: { 'content-type': 'image/jpeg' },
      payload: JPEG,
    });
    const second = await app.inject({
      method: 'PUT',
      url,
      headers: { 'content-type': 'application/pdf' },
      payload: PDF,
    });
    expect(second.statusCode).toBe(201);
    const positions = second.json<DocumentDetail>().files.map(function position(file) {
      return [file.position, file.contentType];
    });
    expect(positions).toEqual([
      [0, 'image/jpeg'],
      [1, 'application/pdf'],
    ]);
  });

  it('stores identical bytes once on disk, even across documents (A15)', async () => {
    const { app, dataDir } = await setup();
    const other = '5b1f3a2e-0000-4000-8000-000000000001';
    for (const id of [ID, other]) {
      const res = await app.inject({
        method: 'PUT',
        url: `/api/documents/${id}/file`,
        headers: { 'content-type': 'application/pdf' },
        payload: PDF,
      });
      expect(res.statusCode).toBe(201);
    }
    expect(readdirSync(join(dataDir, 'originals', sha256(PDF).slice(0, 2)))).toEqual([sha256(PDF)]);
    expect(readdirSync(join(dataDir, 'tmp'))).toEqual([]);
  });

  it('refuses what it cannot keep, and leaves nothing behind', async () => {
    const { app, dataDir } = await setup();
    const url = `/api/documents/${ID}/file`;
    const cases = [
      { url: `/api/documents/${ID.toUpperCase()}/file`, type: 'application/pdf', status: 400 },
      { url, type: 'image/svg+xml', status: 415 },
      { url, type: 'text/html', status: 415 },
      { url: `${url}?source=maily`, type: 'application/pdf', status: 400 },
      { url: `${url}?capturedAt=yesterday`, type: 'application/pdf', status: 400 },
    ];
    for (const c of cases) {
      const res = await app.inject({
        method: 'PUT',
        url: c.url,
        headers: { 'content-type': c.type },
        payload: PDF,
      });
      expect(res.statusCode, `${c.url} ${c.type}`).toBe(c.status);
    }
    const empty = await app.inject({
      method: 'PUT',
      url,
      headers: { 'content-type': 'application/pdf' },
      payload: Buffer.alloc(0),
    });
    expect(empty.statusCode).toBe(400);
    expect(existsSync(join(dataDir, 'originals'))).toBe(false);
    expect((await app.inject({ method: 'GET', url: `/api/documents/${ID}` })).statusCode).toBe(404);
  });

  it('accepts files larger than the JSON body limit', async () => {
    const { app } = await setup();
    const big = Buffer.alloc(3 * 1024 * 1024, 7);
    const res = await app.inject({
      method: 'PUT',
      url: `/api/documents/${ID}/file`,
      headers: { 'content-type': 'image/png' },
      payload: big,
    });
    expect(res.statusCode).toBe(201);
    expect(res.json<DocumentDetail>().files[0]?.sizeBytes).toBe(big.length);
  });

  it('will not add a page to a deleted document', async () => {
    const { app, db } = await setup();
    insertDocument(db, stored({ deletedAt: '2026-09-03T08:00:00.000Z' }));
    const res = await app.inject({
      method: 'PUT',
      url: `/api/documents/${ID}/file`,
      headers: { 'content-type': 'application/pdf' },
      payload: PDF,
    });
    expect(res.statusCode).toBe(409);
  });
});

describe('GET /api/documents/:id/file/:n', () => {
  it('streams the original with its stored type and a validator', async () => {
    const { app } = await setup();
    await app.inject({
      method: 'PUT',
      url: `/api/documents/${ID}/file?fileName=Faktura%20sept%C3%A6mber.pdf`,
      headers: { 'content-type': 'application/pdf' },
      payload: PDF,
    });
    const res = await app.inject({ method: 'GET', url: `/api/documents/${ID}/file/0` });
    expect(res.statusCode).toBe(200);
    expect(res.rawPayload.equals(PDF)).toBe(true);
    expect(res.headers['content-type']).toBe('application/pdf');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['content-disposition']).toBe(
      `inline; filename="Faktura sept_mber.pdf"; filename*=UTF-8''Faktura%20sept%C3%A6mber.pdf`,
    );

    const etag = res.headers.etag as string;
    expect(etag).toBe(`"${sha256(PDF)}"`);
    const again = await app.inject({
      method: 'GET',
      url: `/api/documents/${ID}/file/0`,
      headers: { 'if-none-match': etag },
    });
    expect(again.statusCode).toBe(304);
  });

  it('answers 404 for pages that do not exist', async () => {
    const { app } = await setup();
    for (const n of ['0', '-1', 'x', '1.5']) {
      const res = await app.inject({ method: 'GET', url: `/api/documents/${ID}/file/${n}` });
      expect(res.statusCode, n).toBe(404);
    }
  });
});

describe('GET /api/documents', () => {
  it('lists shops and tags and filters starred documents and attachment-free bills', async () => {
    const { app, db } = await setup();
    const bill = stored({
      id: `${ID.slice(0, -1)}1`,
      merchant: 'Kiwi',
      tags: ['House'],
      starred: true,
    });
    const attached = stored({ id: `${ID.slice(0, -1)}2`, merchant: 'Kiwi', tags: ['house'] });
    const receipt = stored({
      id: `${ID.slice(0, -1)}3`,
      merchant: 'Rema',
      kind: 'receipt',
      tags: ['Work'],
    });
    for (const doc of [bill, attached, receipt]) insertDocument(db, doc);
    insertFile(db, {
      id: 'f0000000-0000-4000-8000-000000000000',
      documentId: attached.id,
      position: 0,
      contentType: 'application/pdf',
      sizeBytes: 10,
      sha256: 'a'.repeat(64),
      fileName: null,
      mailyAttachmentId: 'a',
      createdAt: attached.createdAt,
    });
    const facets = (await app.inject({ method: 'GET', url: '/api/archive/facets' })).json();
    expect(facets).toEqual({
      shops: [
        { name: 'Kiwi', count: 2 },
        { name: 'Rema', count: 1 },
      ],
      tags: [
        { name: 'House', count: 2 },
        { name: 'Work', count: 1 },
      ],
    });
    async function ids(query: string) {
      const res = await app.inject({ method: 'GET', url: `/api/documents?${query}` });
      return res.json<DocumentPage>().items.map(function id(item) {
        return item.id;
      });
    }
    expect(await ids('shop=kiwi')).toEqual([attached.id, bill.id]);
    expect(await ids('tag=HOUSE')).toEqual([attached.id, bill.id]);
    expect(await ids('starred=true')).toEqual([bill.id]);
    expect(await ids('bills=true')).toEqual([bill.id]);
  });

  it('pages newest first without repeating or skipping anything', async () => {
    const { app, db } = await setup();
    const ids = seed(db, 45);
    const seen: string[] = [];
    const dates: string[] = [];
    let url = '/api/documents?limit=20';
    for (let guard = 0; guard < 10; guard++) {
      const page = (await app.inject({ method: 'GET', url })).json<DocumentPage>();
      for (const doc of page.items) {
        seen.push(doc.id);
        dates.push(doc.issuedOn as string);
      }
      if (page.nextCursor === null) {
        break;
      }
      url = `/api/documents?limit=20&after=${encodeURIComponent(page.nextCursor)}`;
    }
    expect(seen.length).toBe(45);
    expect(new Set(seen)).toEqual(new Set(ids));
    expect(dates).toEqual([...dates].sort().reverse());
  });

  it('orders by the document date, or the capture moment when there is none', async () => {
    const { app, db } = await setup();
    insertDocument(db, stored({ id: `${ID.slice(0, -1)}1`, issuedOn: '2026-09-01' }));
    insertDocument(
      db,
      stored({ id: `${ID.slice(0, -1)}2`, issuedOn: null, capturedAt: '2026-09-01T12:00:00.000Z' }),
    );
    insertDocument(db, stored({ id: `${ID.slice(0, -1)}3`, issuedOn: '2026-09-02' }));
    const page = (await app.inject({ method: 'GET', url: '/api/documents' })).json<DocumentPage>();
    const order = page.items.map(function lastDigit(doc) {
      return doc.id.slice(-1);
    });
    expect(order).toEqual(['3', '2', '1']);
    expect(page.nextCursor).toBeNull();
  });

  it('filters by kind and source, and keeps deleted documents apart', async () => {
    const { app, db } = await setup();
    insertDocument(db, stored({ id: `${ID.slice(0, -1)}1`, kind: 'receipt', source: 'camera' }));
    insertDocument(db, stored({ id: `${ID.slice(0, -1)}2`, kind: 'invoice', source: 'maily' }));
    insertDocument(
      db,
      stored({ id: `${ID.slice(0, -1)}3`, deletedAt: '2026-09-03T08:00:00.000Z' }),
    );
    async function ids(query: string) {
      const res = await app.inject({ method: 'GET', url: `/api/documents${query}` });
      return res.json<DocumentPage>().items.map(function id(doc) {
        return doc.id.slice(-1);
      });
    }
    expect(await ids('')).toEqual(['2', '1']);
    expect(await ids('?kind=receipt')).toEqual(['1']);
    expect(await ids('?source=maily')).toEqual(['2']);
    expect(await ids('?deleted=true')).toEqual(['3']);
  });

  it('refuses a malformed query', async () => {
    const { app } = await setup();
    for (const query of ['?limit=0', '?kind=bill', '?after=nonsense', '?kind=a&kind=b']) {
      const res = await app.inject({ method: 'GET', url: `/api/documents${query}` });
      expect(res.statusCode, query).toBe(400);
    }
  });
});

describe('PATCH /api/documents/:id', () => {
  it('saves the fields and confirms them', async () => {
    const { app, db } = await setup();
    insertDocument(db, stored({ guessed: ['merchant', 'amountMinor'] }));
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/documents/${ID}`,
      payload: {
        merchant: 'Hafslund Strøm',
        purchasedItem: 'Heater',
        tags: ['Energy'],
        starred: true,
        notes: 'august',
      },
    });
    expect(res.statusCode).toBe(200);
    const doc = res.json<DocumentDetail>().document;
    expect(doc).toMatchObject({
      merchant: 'Hafslund Strøm',
      purchasedItem: 'Heater',
      tags: ['Energy'],
      starred: true,
      notes: 'august',
      guessed: ['amountMinor'],
    });
    expect(doc.updatedAt > stored({}).updatedAt).toBe(true);
    const reread = await app.inject({ method: 'GET', url: `/api/documents/${ID}` });
    expect(reread.json<DocumentDetail>().document).toEqual(doc);
    const found = await app.inject({ method: 'GET', url: '/api/documents?q=heater' });
    expect(
      found.json<DocumentPage>().items.map(function id(item) {
        return item.id;
      }),
    ).toEqual([ID]);
    const tagged = await app.inject({
      method: 'GET',
      url: '/api/documents?tag=energy&starred=true',
    });
    expect(
      tagged.json<DocumentPage>().items.map(function id(item) {
        return item.id;
      }),
    ).toEqual([ID]);
  });

  it('refuses invalid edits and leaves the document as it was', async () => {
    const { app, db } = await setup();
    insertDocument(db, stored({}));
    for (const payload of [{ amountMinor: 1.5 }, { currency: null }, { paidAt: null }]) {
      const res = await app.inject({ method: 'PATCH', url: `/api/documents/${ID}`, payload });
      expect(res.statusCode, JSON.stringify(payload)).toBe(400);
      expect(res.json()).toHaveProperty('error');
    }
    const reread = await app.inject({ method: 'GET', url: `/api/documents/${ID}` });
    expect(reread.json<DocumentDetail>().document).toEqual(stored({}));
  });

  it('answers 404 for an unknown document', async () => {
    const { app } = await setup();
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/documents/${ID}`,
      payload: { notes: 'x' },
    });
    expect(res.statusCode).toBe(404);
  });
});

describe('GET /api/documents/:id', () => {
  it('links a maily document to its mail when maily has a public address', async () => {
    const { app, db } = await setup({ MAILY_PUBLIC_URL: 'https://mail.example/' });
    insertDocument(db, stored({ dedupKey: 'maily:4f2a' }));
    const res = await app.inject({ method: 'GET', url: `/api/documents/${ID}` });
    expect(res.statusCode).toBe(200);
    expect(res.json<DocumentDetail>().mailUrl).toBe('https://mail.example/m/4f2a');
  });

  it('has no mail link when the address is not configured', async () => {
    const { app, db } = await setup();
    insertDocument(db, stored({ dedupKey: 'maily:4f2a' }));
    const res = await app.inject({ method: 'GET', url: `/api/documents/${ID}` });
    expect(res.json<DocumentDetail>()).toMatchObject({ files: [], mailUrl: null });
  });

  it('answers 404 for an unknown document', async () => {
    const { app } = await setup();
    const res = await app.inject({ method: 'GET', url: `/api/documents/${ID}` });
    expect(res.statusCode).toBe(404);
    expect(res.json()).toEqual({ error: 'no document with that id' });
  });
});

describe('DELETE /api/documents/:id and restore', () => {
  it('hides a document until it is restored, idempotently', async () => {
    const { app, db } = await setup();
    insertDocument(db, stored({}));

    const deleted = await app.inject({ method: 'DELETE', url: `/api/documents/${ID}` });
    expect(deleted.statusCode).toBe(200);
    const deletedAt = deleted.json<DocumentDetail>().document.deletedAt;
    expect(deletedAt).not.toBeNull();

    const again = await app.inject({ method: 'DELETE', url: `/api/documents/${ID}` });
    expect(again.json<DocumentDetail>().document.deletedAt).toBe(deletedAt);
    const list = await app.inject({ method: 'GET', url: '/api/documents' });
    expect(list.json<DocumentPage>().items).toEqual([]);
    const read = await app.inject({ method: 'GET', url: `/api/documents/${ID}` });
    expect(read.statusCode).toBe(200);

    const restored = await app.inject({ method: 'POST', url: `/api/documents/${ID}/restore` });
    expect(restored.statusCode).toBe(200);
    expect(restored.json<DocumentDetail>().document.deletedAt).toBeNull();
    const back = await app.inject({ method: 'GET', url: '/api/documents' });
    expect(back.json<DocumentPage>().items.length).toBe(1);
  });

  it('answers 404 for an unknown document', async () => {
    const { app } = await setup();
    expect((await app.inject({ method: 'DELETE', url: `/api/documents/${ID}` })).statusCode).toBe(
      404,
    );
    const restore = await app.inject({ method: 'POST', url: `/api/documents/${ID}/restore` });
    expect(restore.statusCode).toBe(404);
  });
});
