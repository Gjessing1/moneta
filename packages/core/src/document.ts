// The archive's domain model: one document (a receipt, an invoice, or anything
// else worth keeping) and the original files it was filed from.

export const DOCUMENT_SOURCES = ['maily', 'camera', 'upload', 'share'] as const;
export type DocumentSource = (typeof DOCUMENT_SOURCES)[number];

export const DOCUMENT_KINDS = ['invoice', 'receipt', 'other'] as const;
export type DocumentKind = (typeof DOCUMENT_KINDS)[number];

// Fields that extraction (maily's classifier, OCR later) can fill in. A field
// stays "guessed" until the user edits or confirms it, and only guessed fields
// may be overwritten when maily re-emits a message (A13).
export const GUESSABLE_FIELDS = [
  'kind',
  'merchant',
  'amountMinor',
  'currency',
  'issuedOn',
  'dueOn',
  'kid',
  'account',
  'iban',
] as const;
export type GuessableField = (typeof GUESSABLE_FIELDS)[number];

export interface ArchiveDocument {
  // Internal UUID. For captures it is generated on the phone (A12).
  id: string;
  source: DocumentSource;
  kind: DocumentKind;
  merchant: string | null;
  // Integer minor units (øre, cents), so sums never pick up float error.
  amountMinor: number | null;
  // ISO 4217 code. Required whenever there is an amount.
  currency: string | null;
  // Calendar dates as YYYY-MM-DD, not local midnight in some time zone.
  issuedOn: string | null;
  dueOn: string | null;
  // Norwegian payment reference (KID), bank account and IBAN, as printed.
  kid: string | null;
  account: string | null;
  iban: string | null;
  paidAt: string | null;
  notes: string;
  // Unique per upstream item, e.g. `maily:<messageId>` (A8). Null for captures
  // and uploads, which are deduplicated on `id` instead (A12).
  dedupKey: string | null;
  guessed: GuessableField[];
  // UTC ISO 8601 timestamps. `capturedAt` is when the photo was taken or the
  // document was filed, not when the upload arrived (A12).
  capturedAt: string;
  createdAt: string;
  updatedAt: string;
  // Set on soft delete; the document can be restored until it is purged.
  deletedAt: string | null;
}

export interface DocumentFile {
  id: string;
  documentId: string;
  // Page order within the document, starting at 0.
  position: number;
  contentType: string;
  sizeBytes: number;
  // Lowercase hex. The stored bytes live at a path derived from it (A15).
  sha256: string;
  fileName: string | null;
  mailyAttachmentId: string | null;
  createdAt: string;
}

export function mailyDedupKey(messageId: string): string {
  return `maily:${messageId}`;
}

export function isDocumentSource(value: unknown): value is DocumentSource {
  return DOCUMENT_SOURCES.some(function matches(source) {
    return source === value;
  });
}

export function isDocumentKind(value: unknown): value is DocumentKind {
  return DOCUMENT_KINDS.some(function matches(kind) {
    return kind === value;
  });
}

export function isGuessableField(value: unknown): value is GuessableField {
  return GUESSABLE_FIELDS.some(function matches(field) {
    return field === value;
  });
}

export function isCurrencyCode(value: string): boolean {
  return /^[A-Z]{3}$/.test(value);
}

// True for a real calendar day in YYYY-MM-DD form. Rejects 2026-02-30, which
// Date would silently roll over into March.
export function isCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}
