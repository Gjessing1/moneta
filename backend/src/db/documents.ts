// Row mapping between the SQLite tables and the @moneta/core model. Column
// names are snake_case in SQL and camelCase in the domain.
import type {
  ArchiveDocument,
  DocumentFile,
  DocumentKind,
  DocumentSource,
  GuessableField,
} from '@moneta/core/document';
import type { Db } from './database.js';

interface DocumentRow {
  id: string;
  source: DocumentSource;
  kind: DocumentKind;
  merchant: string | null;
  amount_minor: number | null;
  currency: string | null;
  issued_on: string | null;
  due_on: string | null;
  kid: string | null;
  account: string | null;
  iban: string | null;
  paid_at: string | null;
  notes: string;
  dedup_key: string | null;
  guessed: string;
  captured_at: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
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
    amountMinor: row.amount_minor,
    currency: row.currency,
    issuedOn: row.issued_on,
    dueOn: row.due_on,
    kid: row.kid,
    account: row.account,
    iban: row.iban,
    paidAt: row.paid_at,
    notes: row.notes,
    dedupKey: row.dedup_key,
    guessed: JSON.parse(row.guessed) as GuessableField[],
    capturedAt: row.captured_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
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
       id, source, kind, merchant, amount_minor, currency, issued_on, due_on,
       kid, account, iban, paid_at, notes, dedup_key, guessed,
       captured_at, created_at, updated_at, deleted_at
     ) VALUES (
       @id, @source, @kind, @merchant, @amountMinor, @currency, @issuedOn, @dueOn,
       @kid, @account, @iban, @paidAt, @notes, @dedupKey, @guessed,
       @capturedAt, @createdAt, @updatedAt, @deletedAt
     )`,
  ).run({ ...doc, guessed: JSON.stringify(doc.guessed) });
}

export function getDocument(db: Db, id: string): ArchiveDocument | undefined {
  const row = db.prepare('SELECT * FROM documents WHERE id = ?').get(id) as DocumentRow | undefined;
  if (row === undefined) {
    return undefined;
  }
  return toDocument(row);
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
