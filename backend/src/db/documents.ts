// Row mapping between the SQLite tables and the @moneta/core model. Column
// names are snake_case in SQL and camelCase in the domain.
import type { DocumentListQuery, DocumentPage } from '@moneta/core/document-list';
import { encodeListCursor } from '@moneta/core/document-list';
import type {
  ArchiveDocument,
  DocumentDetail,
  DocumentFile,
  DocumentKind,
  DocumentSource,
  GuessableField,
  MailOrigin,
} from '@moneta/core/document';
import { mailyMessageUrl } from '@moneta/core/document';
import type { Db } from './database.js';

interface DocumentRow {
  id: string;
  source: DocumentSource;
  kind: DocumentKind;
  merchant: string | null;
  purchased_item: string | null;
  tags: string;
  starred: number;
  amount_minor: number | null;
  currency: string | null;
  issued_on: string | null;
  due_on: string | null;
  kid: string | null;
  account: string | null;
  iban: string | null;
  notes: string;
  dedup_key: string | null;
  guessed: string;
  captured_at: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  mail_from_name: string | null;
  mail_from_address: string | null;
  mail_subject: string | null;
  mail_received_at: string | null;
}

interface FileRow {
  id: string;
  document_id: string;
  position: number;
  content_type: string;
  size_bytes: number;
  sha256: string;
  file_name: string | null;
  maily_attachment_id: string | null;
  created_at: string;
}

function toDocument(row: DocumentRow): ArchiveDocument {
  return {
    id: row.id,
    source: row.source,
    kind: row.kind,
    merchant: row.merchant,
    purchasedItem: row.purchased_item,
    tags: JSON.parse(row.tags) as string[],
    starred: row.starred === 1,
    amountMinor: row.amount_minor,
    currency: row.currency,
    issuedOn: row.issued_on,
    dueOn: row.due_on,
    kid: row.kid,
    account: row.account,
    iban: row.iban,
    notes: row.notes,
    dedupKey: row.dedup_key,
    guessed: JSON.parse(row.guessed) as GuessableField[],
    capturedAt: row.captured_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
    mail: toMailOrigin(row),
  };
}

function toMailOrigin(row: DocumentRow): MailOrigin | null {
  const mail: MailOrigin = {
    fromName: row.mail_from_name,
    fromAddress: row.mail_from_address,
    subject: row.mail_subject,
    receivedAt: row.mail_received_at,
  };
  if (Object.values(mail).every(isNull)) {
    return null;
  }
  return mail;
}

function isNull(value: unknown): boolean {
  return value === null;
}

function toFile(row: FileRow): DocumentFile {
  return {
    id: row.id,
    documentId: row.document_id,
    position: row.position,
    contentType: row.content_type,
    sizeBytes: row.size_bytes,
    sha256: row.sha256,
    fileName: row.file_name,
    mailyAttachmentId: row.maily_attachment_id,
    createdAt: row.created_at,
  };
}

export function insertDocument(db: Db, doc: ArchiveDocument): void {
  db.prepare(
    `INSERT INTO documents (
       id, source, kind, merchant, purchased_item, tags, starred, amount_minor, currency, issued_on, due_on,
       kid, account, iban, notes, dedup_key, guessed,
       captured_at, created_at, updated_at, deleted_at,
       mail_from_name, mail_from_address, mail_subject, mail_received_at
     ) VALUES (
       @id, @source, @kind, @merchant, @purchasedItem, @tags, @starred, @amountMinor, @currency, @issuedOn, @dueOn,
       @kid, @account, @iban, @notes, @dedupKey, @guessed,
       @capturedAt, @createdAt, @updatedAt, @deletedAt,
       @mailFromName, @mailFromAddress, @mailSubject, @mailReceivedAt
     )`,
  ).run({
    ...doc,
    guessed: JSON.stringify(doc.guessed),
    tags: JSON.stringify(doc.tags),
    starred: Number(doc.starred),
    mailFromName: doc.mail?.fromName ?? null,
    mailFromAddress: doc.mail?.fromAddress ?? null,
    mailSubject: doc.mail?.subject ?? null,
    mailReceivedAt: doc.mail?.receivedAt ?? null,
  });
}

export function getDocument(db: Db, id: string): ArchiveDocument | undefined {
  const row = db.prepare('SELECT * FROM documents WHERE id = ?').get(id) as DocumentRow | undefined;
  if (row === undefined) {
    return undefined;
  }
  return toDocument(row);
}

// mailyPublicUrl is configuration (A3), passed in so the link is built by the
// same core function everywhere.
export function getDocumentDetail(
  db: Db,
  id: string,
  mailyPublicUrl: string,
): DocumentDetail | undefined {
  const document = getDocument(db, id);
  if (document === undefined) {
    return undefined;
  }
  return {
    document,
    files: listFiles(db, id),
    mailUrl: mailyMessageUrl(mailyPublicUrl, document),
  };
}

// Writes every mutable column. The identity columns (source, dedup key,
// timestamps of capture and creation, the mail it came from) never change
// after insert.
export function updateDocument(db: Db, doc: ArchiveDocument): void {
  db.prepare(
    `UPDATE documents SET
       kind = @kind, merchant = @merchant, purchased_item = @purchasedItem,
       tags = @tags, starred = @starred,
       amount_minor = @amountMinor,
       currency = @currency, issued_on = @issuedOn, due_on = @dueOn, kid = @kid,
       account = @account, iban = @iban, notes = @notes, guessed = @guessed,
       updated_at = @updatedAt, deleted_at = @deletedAt
     WHERE id = @id`,
  ).run({
    ...doc,
    guessed: JSON.stringify(doc.guessed),
    tags: JSON.stringify(doc.tags),
    starred: Number(doc.starred),
  });
}

// The ORDER BY must match encodeListCursor in @moneta/core, which writes the
// cursor this query resumes from. Deleted lists use their deletion time.
export function listDocuments(db: Db, query: DocumentListQuery): DocumentPage {
  const sortExpression = query.deleted ? 'deleted_at' : 'COALESCE(issued_on, captured_at)';
  const conditions: string[] = [];
  const params: Record<string, string | number> = { limit: query.limit + 1 };
  if (query.deleted) {
    conditions.push('deleted_at IS NOT NULL');
  } else {
    conditions.push('deleted_at IS NULL');
  }
  if (query.kind !== null) {
    conditions.push('kind = @kind');
    params.kind = query.kind;
  }
  if (query.source !== null) {
    conditions.push('source = @source');
    params.source = query.source;
  }
  if (query.shop !== null) {
    conditions.push('merchant = @shop COLLATE NOCASE');
    params.shop = query.shop;
  }
  if (query.tag !== null) {
    conditions.push(
      'EXISTS (SELECT 1 FROM json_each(documents.tags) WHERE value = @tag COLLATE NOCASE)',
    );
    params.tag = query.tag;
  }
  if (query.starred) {
    conditions.push('starred = 1');
  }
  if (query.bills) {
    conditions.push(
      "source = 'maily' AND kind = 'invoice' AND NOT EXISTS (SELECT 1 FROM files WHERE files.document_id = documents.id)",
    );
  }
  if (query.q !== null) {
    conditions.push(`(
      instr(lower(COALESCE(merchant, '')), lower(@q)) > 0 OR
      instr(lower(COALESCE(purchased_item, '')), lower(@q)) > 0 OR
      instr(lower(notes), lower(@q)) > 0
    )`);
    params.q = query.q;
  }
  if (query.after !== null) {
    conditions.push(`(${sortExpression}, id) < (@afterKey, @afterId)`);
    params.afterKey = query.after.sortKey;
    params.afterId = query.after.id;
  }
  const rows = db
    .prepare(
      `SELECT * FROM documents WHERE ${conditions.join(' AND ')}
       ORDER BY ${sortExpression} DESC, id DESC
       LIMIT @limit`,
    )
    .all(params) as DocumentRow[];

  // One row more than asked for tells whether another page exists.
  const items: ArchiveDocument[] = [];
  for (const row of rows.slice(0, query.limit)) {
    items.push(toDocument(row));
  }
  let nextCursor: string | null = null;
  const last = items[items.length - 1];
  if (rows.length > query.limit && last !== undefined) {
    nextCursor = encodeListCursor(last, query.deleted);
  }
  return { items, nextCursor };
}

export interface ArchiveFacet {
  name: string;
  count: number;
}

export function listArchiveFacets(db: Db): { shops: ArchiveFacet[]; tags: ArchiveFacet[] } {
  const shops = db
    .prepare(
      `
      SELECT MIN(merchant) AS name, COUNT(*) AS count FROM documents
    WHERE deleted_at IS NULL AND merchant IS NOT NULL AND trim(merchant) <> ''
    GROUP BY merchant COLLATE NOCASE ORDER BY count DESC, name COLLATE NOCASE
  `,
    )
    .all() as ArchiveFacet[];
  const tags = db
    .prepare(
      `
      SELECT MIN(value) AS name, COUNT(*) AS count FROM documents, json_each(documents.tags)
    WHERE deleted_at IS NULL GROUP BY value COLLATE NOCASE
    ORDER BY count DESC, name COLLATE NOCASE
  `,
    )
    .all() as ArchiveFacet[];
  return { shops, tags };
}

export function insertFile(db: Db, file: DocumentFile): void {
  db.prepare(
    `INSERT INTO files (
       id, document_id, position, content_type, size_bytes, sha256, file_name,
       maily_attachment_id, created_at
     ) VALUES (
       @id, @documentId, @position, @contentType, @sizeBytes, @sha256, @fileName,
       @mailyAttachmentId, @createdAt
     )`,
  ).run(file);
}

export function listFiles(db: Db, documentId: string): DocumentFile[] {
  const rows = db
    .prepare('SELECT * FROM files WHERE document_id = ? ORDER BY position')
    .all(documentId) as FileRow[];
  const files: DocumentFile[] = [];
  for (const row of rows) {
    files.push(toFile(row));
  }
  return files;
}

export function getFile(db: Db, documentId: string, position: number): DocumentFile | undefined {
  const row = db
    .prepare('SELECT * FROM files WHERE document_id = ? AND position = ?')
    .get(documentId, position) as FileRow | undefined;
  if (row === undefined) {
    return undefined;
  }
  return toFile(row);
}

// A12: the same bytes uploaded again to the same document are a retry.
export function findFileByHash(
  db: Db,
  documentId: string,
  sha256: string,
): DocumentFile | undefined {
  const row = db
    .prepare('SELECT * FROM files WHERE document_id = ? AND sha256 = ? ORDER BY position LIMIT 1')
    .get(documentId, sha256) as FileRow | undefined;
  if (row === undefined) {
    return undefined;
  }
  return toFile(row);
}

export function nextFilePosition(db: Db, documentId: string): number {
  const row = db
    .prepare('SELECT COALESCE(MAX(position) + 1, 0) AS next FROM files WHERE document_id = ?')
    .get(documentId) as { next: number };
  return row.next;
}

export function purgeDocument(db: Db, id: string, now: string): boolean {
  return db.transaction(function purge(): boolean {
    const doc = getDocument(db, id);
    if (doc === undefined || doc.deletedAt === null) return false;
    if (doc.dedupKey !== null) {
      db.prepare('INSERT OR IGNORE INTO deleted_imports (dedup_key, deleted_at) VALUES (?, ?)').run(
        doc.dedupKey,
        now,
      );
    }
    db.prepare('DELETE FROM documents WHERE id = ?').run(id);
    return true;
  })();
}

export function purgeExpiredDocuments(db: Db, cutoff: string, now: string): number {
  const rows = db
    .prepare('SELECT id FROM documents WHERE deleted_at IS NOT NULL AND deleted_at <= ?')
    .all(cutoff) as { id: string }[];
  let count = 0;
  for (const row of rows) {
    if (purgeDocument(db, row.id, now)) count += 1;
  }
  return count;
}

export function originalIsReferenced(db: Db, sha256: string): boolean {
  return db.prepare('SELECT 1 FROM files WHERE sha256 = ? LIMIT 1').get(sha256) !== undefined;
}

export function isDeletedImport(db: Db, dedupKey: string): boolean {
  return (
    db.prepare('SELECT 1 FROM deleted_imports WHERE dedup_key = ?').get(dedupKey) !== undefined
  );
}
