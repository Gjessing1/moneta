// Editing a document's facts: what a PATCH body may contain, and how applying
// it moves fields out of "guessed" (the user has now vouched for them).
import {
  isCalendarDate,
  isCurrencyCode,
  isDocumentKind,
  type ArchiveDocument,
  type ParseResult,
} from './document.js';

export const EDITABLE_FIELDS = [
  'kind',
  'merchant',
  'amountMinor',
  'currency',
  'issuedOn',
  'dueOn',
  'kid',
  'account',
  'iban',
  'notes',
] as const;
export type EditableField = (typeof EDITABLE_FIELDS)[number];

export type DocumentPatch = Partial<Pick<ArchiveDocument, EditableField>>;

// Long enough for any shop name, account or note someone types by hand, short
// enough that a runaway client can't fill the database through one field.
const MAX_TEXT_LENGTH = 500;
const MAX_NOTES_LENGTH = 10_000;

function isEditableField(value: string): value is EditableField {
  return EDITABLE_FIELDS.some(function matches(field) {
    return field === value;
  });
}

// Accepts a JSON body with any subset of the editable fields. Unknown keys are
// an error rather than ignored, so a typo can't look like a successful save.
export function parseDocumentPatch(body: unknown): ParseResult<DocumentPatch> {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return { ok: false, error: 'body must be a JSON object' };
  }
  const patch: DocumentPatch = {};
  for (const [key, value] of Object.entries(body)) {
    if (!isEditableField(key)) {
      return { ok: false, error: `${key} cannot be edited` };
    }
    const error = setField(patch, key, value);
    if (error !== null) {
      return { ok: false, error };
    }
  }
  return { ok: true, value: patch };
}

function setField(patch: DocumentPatch, field: EditableField, value: unknown): string | null {
  switch (field) {
    case 'kind':
      if (!isDocumentKind(value)) {
        return 'kind must be invoice, receipt or other';
      }
      patch.kind = value;
      return null;
    case 'merchant':
    case 'kid':
    case 'account':
    case 'iban': {
      const text = readOptionalText(value, MAX_TEXT_LENGTH);
      if (text === undefined) {
        return `${field} must be text of at most ${MAX_TEXT_LENGTH} characters, or null`;
      }
      patch[field] = text;
      return null;
    }
    case 'amountMinor':
      if (value !== null && !Number.isSafeInteger(value)) {
        return 'amountMinor must be a whole number of minor units (øre, cents), or null';
      }
      patch.amountMinor = value as number | null;
      return null;
    case 'currency': {
      if (value === null) {
        patch.currency = null;
        return null;
      }
      if (typeof value !== 'string' || !isCurrencyCode(value.trim().toUpperCase())) {
        return 'currency must be an ISO 4217 code such as NOK, or null';
      }
      patch.currency = value.trim().toUpperCase();
      return null;
    }
    case 'issuedOn':
    case 'dueOn':
      if (value !== null && (typeof value !== 'string' || !isCalendarDate(value))) {
        return `${field} must be a date as YYYY-MM-DD, or null`;
      }
      patch[field] = value as string | null;
      return null;
    case 'notes':
      if (typeof value !== 'string' || value.length > MAX_NOTES_LENGTH) {
        return `notes must be text of at most ${MAX_NOTES_LENGTH} characters`;
      }
      patch.notes = value;
      return null;
  }
}

// Trimmed text, with blank meaning "not set". undefined means invalid.
function readOptionalText(value: unknown, maxLength: number): string | null | undefined {
  if (value === null) {
    return null;
  }
  if (typeof value !== 'string') {
    return undefined;
  }
  const trimmed = value.trim();
  if (trimmed.length > maxLength) {
    return undefined;
  }
  if (trimmed === '') {
    return null;
  }
  return trimmed;
}

// Every field in the patch counts as confirmed, even when its value is
// unchanged: saving the edit form is how a user confirms a guess, and a
// re-import may then no longer overwrite it (A13).
export function applyDocumentPatch(
  doc: ArchiveDocument,
  patch: DocumentPatch,
  now: string,
): ParseResult<ArchiveDocument> {
  const next: ArchiveDocument = { ...doc, ...patch, updatedAt: now };
  next.guessed = doc.guessed.filter(function stillGuessed(field) {
    return !(field in patch);
  });
  if (next.amountMinor !== null && next.currency === null) {
    return { ok: false, error: 'an amount needs a currency' };
  }
  return { ok: true, value: next };
}
