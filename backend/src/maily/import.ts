import { randomUUID } from 'node:crypto';
import { Readable } from 'node:stream';
import type { ReadableStream as NodeReadableStream } from 'node:stream/web';
import type { FastifyInstance } from 'fastify';
import {
  importedDocument,
  refreshImportedDocument,
  type BillingExportItem,
  type BillingExportPage,
} from '@moneta/core/maily-import';
import { mailyDedupKey, MAX_ORIGINAL_BYTES, type DocumentFile } from '@moneta/core/document';
import type { Config } from '../config.js';
import type { Db } from '../db/database.js';
import {
  getDocument,
  insertDocument,
  insertFile,
  isDeletedImport,
  listFiles,
  nextFilePosition,
  purgeDocument,
  updateDocument,
} from '../db/documents.js';
import { storeOriginal } from '../storage/originals.js';

const INTERVAL_MS = 5 * 60 * 1000;
const RECONCILE_MS = 60 * 60 * 1000;
const PAGE_SIZE = 100;

function getCursor(db: Db): string | null {
  const row = db.prepare("SELECT cursor FROM import_cursors WHERE source = 'maily'").get() as
    { cursor: string } | undefined;
  return row?.cursor ?? null;
}

function findByDedupKey(db: Db, key: string): string | null {
  const row = db.prepare('SELECT id FROM documents WHERE dedup_key = ?').get(key) as
    { id: string } | undefined;
  return row?.id ?? null;
}

function recordSuccess(db: Db, now: string): void {
  db.prepare(
    "INSERT INTO import_status (source, last_success_at, last_error) VALUES ('maily', ?, NULL) ON CONFLICT(source) DO UPDATE SET last_success_at = excluded.last_success_at, last_error = NULL",
  ).run(now);
}

function recordError(db: Db, error: string): void {
  db.prepare(
    "INSERT INTO import_status (source, last_success_at, last_error) VALUES ('maily', NULL, ?) ON CONFLICT(source) DO UPDATE SET last_error = excluded.last_error",
  ).run(error.slice(0, 1000));
}

async function fetchPage(baseUrl: string, cursor: string | null): Promise<BillingExportPage> {
  const url = new URL('/api/export/billing', `${baseUrl}/`);
  url.searchParams.set('limit', String(PAGE_SIZE));
  if (cursor !== null) url.searchParams.set('after', cursor);
  const response = await fetch(url, { signal: AbortSignal.timeout(30_000) });
  if (!response.ok) throw new Error(`maily billing feed returned HTTP ${response.status}`);
  const page = (await response.json()) as BillingExportPage;
  if (
    !Array.isArray(page.items) ||
    (page.cursor !== null && typeof page.cursor !== 'string') ||
    typeof page.hasMore !== 'boolean'
  ) {
    throw new Error('maily billing feed returned an invalid page');
  }
  return page;
}

async function fetchNewFiles(
  baseUrl: string,
  dataDir: string,
  item: BillingExportItem,
  existing: DocumentFile[],
  documentId: string,
  now: string,
): Promise<DocumentFile[]> {
  const files: DocumentFile[] = [];
  const seen = new Set(
    existing.map(function attachmentId(file) {
      return file.mailyAttachmentId;
    }),
  );
  for (const attachment of item.documents) {
    if (seen.has(attachment.attachmentId)) continue;
    seen.add(attachment.attachmentId);
    const url = new URL(
      `/api/messages/${encodeURIComponent(item.messageId)}/attachments/${encodeURIComponent(attachment.attachmentId)}`,
      `${baseUrl}/`,
    );
    const response = await fetch(url, { signal: AbortSignal.timeout(120_000) });
    if (!response.ok || response.body === null)
      throw new Error(
        `maily attachment ${attachment.attachmentId} returned HTTP ${response.status}`,
      );
    const body = Readable.fromWeb(response.body as unknown as NodeReadableStream);
    const stored = await storeOriginal(dataDir, body, MAX_ORIGINAL_BYTES);
    files.push({
      id: randomUUID(),
      documentId,
      position: existing.length + files.length,
      contentType: (
        attachment.mimeType ??
        response.headers.get('content-type') ??
        'application/octet-stream'
      )
        .split(';')[0]!
        .trim()
        .toLowerCase(),
      sizeBytes: stored.sizeBytes,
      sha256: stored.sha256,
      fileName: attachment.filename,
      mailyAttachmentId: attachment.attachmentId,
      createdAt: now,
    });
  }
  return files;
}

export async function runMailyImport(
  db: Db,
  config: Pick<Config, 'mailyUrl' | 'dataDir'>,
  fromStart = false,
): Promise<number> {
  if (config.mailyUrl === '') throw new Error('MAILY_URL is not configured');
  let cursor = fromStart ? null : getCursor(db);
  let imported = 0;
  while (true) {
    const page = await fetchPage(config.mailyUrl, cursor);
    const prepared: (
      | { kind: 'import'; item: BillingExportItem; id: string; files: DocumentFile[] }
      | { kind: 'remove'; id: string }
    )[] = [];
    const now = new Date().toISOString();
    for (const item of page.items) {
      if (
        typeof item.messageId !== 'string' ||
        !Array.isArray(item.documents) ||
        (item.kind !== 'invoice' && item.kind !== 'receipt') ||
        typeof item.trashed !== 'boolean'
      ) {
        throw new Error('maily billing feed returned an invalid item');
      }
      const key = mailyDedupKey(item.messageId);
      const foundId = findByDedupKey(db, key);
      if (item.trashed) {
        if (foundId !== null) prepared.push({ kind: 'remove', id: foundId });
        continue;
      }
      if (isDeletedImport(db, key)) continue;
      const id = foundId ?? randomUUID();
      const existing = getDocument(db, id);
      if (existing?.deletedAt !== null && existing?.deletedAt !== undefined) continue;
      const files = await fetchNewFiles(
        config.mailyUrl,
        config.dataDir,
        item,
        existing ? listFiles(db, id) : [],
        id,
        now,
      );
      prepared.push({ kind: 'import', item, id, files });
    }
    db.transaction(function commitPage() {
      for (const entry of prepared) {
        if (entry.kind === 'remove') {
          const existing = getDocument(db, entry.id);
          if (existing?.deletedAt !== null && existing?.deletedAt !== undefined) {
            purgeDocument(db, entry.id, now);
          } else {
            db.prepare("DELETE FROM documents WHERE id = ? AND source = 'maily'").run(entry.id);
          }
          continue;
        }
        const incoming = importedDocument(entry.id, entry.item, now);
        const existing = getDocument(db, entry.id);
        if (existing === undefined) insertDocument(db, incoming);
        else updateDocument(db, refreshImportedDocument(existing, incoming));
        for (const file of entry.files) {
          insertFile(db, { ...file, position: nextFilePosition(db, entry.id) });
        }
      }
      if (!fromStart && page.cursor !== null) {
        db.prepare(
          "INSERT INTO import_cursors (source, cursor, updated_at) VALUES ('maily', ?, ?) ON CONFLICT(source) DO UPDATE SET cursor = excluded.cursor, updated_at = excluded.updated_at",
        ).run(page.cursor, now);
      }
    })();
    for (const entry of prepared) {
      if (entry.kind === 'import') imported += 1;
    }
    if (!page.hasMore) {
      recordSuccess(db, new Date().toISOString());
      return imported;
    }
    if (page.cursor === null || page.cursor === cursor)
      throw new Error('maily billing feed did not advance its cursor');
    cursor = page.cursor;
  }
}

export function scheduleMailyImport(
  app: FastifyInstance,
  db: Db,
  config: Pick<Config, 'mailyUrl' | 'dataDir'>,
): void {
  let timer: NodeJS.Timeout | undefined;
  let running: Promise<void> | null = null;
  let closing = false;
  let lastReconcile = 0;
  function start() {
    if (closing) return;
    running = runMailyImport(db, config)
      .then(async function completed(count) {
        // Moving mail to Trash does not reclassify it, so the forward cursor
        // alone cannot notice that transition.
        if (Date.now() - lastReconcile >= RECONCILE_MS) {
          await runMailyImport(db, config, true);
          lastReconcile = Date.now();
        }
        app.log.info({ count }, 'maily import completed');
      })
      .catch(function failed(error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        recordError(db, message);
        app.log.error({ error }, 'maily import failed');
      })
      .finally(function scheduleNext() {
        running = null;
        if (!closing) timer = setTimeout(start, INTERVAL_MS);
      });
  }
  app.addHook('onClose', async function stop() {
    closing = true;
    if (timer !== undefined) clearTimeout(timer);
    await running;
  });
  // Start after the HTTP listener is ready, so a long backfill never delays health.
  app.addHook('onListen', start);
}
