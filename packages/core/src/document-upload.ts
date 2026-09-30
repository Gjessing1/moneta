// Filing a new original: the parameters that come with PUT
// /api/documents/:id/file, and the document a first upload creates.
import {
  isStorableContentType,
  MAX_ORIGINAL_BYTES,
  isDocumentKind,
  type ArchiveDocument,
  type DocumentKind,
  type GuessableField,
  type ParseResult,
} from './document.js';

// maily documents come only through the import job (A13), never an upload.
export const UPLOAD_SOURCES = ['camera', 'upload', 'share'] as const;
export type UploadSource = (typeof UPLOAD_SOURCES)[number];

// Some file pickers (notably for HEIC) leave File.type empty. The extension is
// only a fallback for that case; the server still sends the result with nosniff.
export function uploadContentType(name: string, reportedType: string): string | null {
  const type = reportedType.toLowerCase();
  if (isStorableContentType(type)) {
    return type;
  }
  if (type !== '') {
    return null;
  }
  const extension = name.toLowerCase().split('.').at(-1);
  switch (extension) {
    case 'pdf':
      return 'application/pdf';
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'png':
      return 'image/png';
    case 'webp':
      return 'image/webp';
    case 'heic':
      return 'image/heic';
    case 'heif':
      return 'image/heif';
    default:
      return null;
  }
}

export function uploadFileError(name: string, type: string, size: number): string | null {
  if (uploadContentType(name, type) === null) {
    return `${name}: choose a PDF, JPEG, PNG, WebP or HEIC image`;
  }
  if (size === 0) {
    return `${name}: the file is empty`;
  }
  if (size > MAX_ORIGINAL_BYTES) {
    return `${name}: the file is larger than 50 MB`;
  }
  return null;
}

export interface UploadParams {
  source: UploadSource;
  // null when the client didn't say, so the new document marks it as guessed.
  kind: DocumentKind | null;
  // When the photo was taken, not when the upload arrived (A12).
  capturedAt: string;
  fileName: string | null;
}

const MAX_FILE_NAME_LENGTH = 255;

function isUploadSource(value: unknown): value is UploadSource {
  return UPLOAD_SOURCES.some(function matches(source) {
    return source === value;
  });
}

export function parseUploadParams(
  params: Record<string, unknown>,
  now: string,
): ParseResult<UploadParams> {
  const upload: UploadParams = { source: 'upload', kind: null, capturedAt: now, fileName: null };
  for (const [key, value] of Object.entries(params)) {
    if (typeof value !== 'string') {
      return { ok: false, error: `${key} must be given once` };
    }
    if (key === 'source') {
      if (!isUploadSource(value)) {
        return { ok: false, error: 'source must be camera, upload or share' };
      }
      upload.source = value;
    } else if (key === 'kind') {
      if (!isDocumentKind(value)) {
        return { ok: false, error: 'kind must be invoice, receipt or other' };
      }
      upload.kind = value;
    } else if (key === 'capturedAt') {
      const capturedAt = normalizeTimestamp(value);
      if (capturedAt === null) {
        return { ok: false, error: 'capturedAt must be an ISO 8601 timestamp with a time zone' };
      }
      upload.capturedAt = capturedAt;
    } else if (key === 'fileName') {
      upload.fileName = cleanFileName(value);
    } else {
      return { ok: false, error: `unknown parameter ${key}` };
    }
  }
  return { ok: true, value: upload };
}

// Stored in UTC whatever offset the phone sent. A timestamp without a zone is
// refused: it would be read as the server's local time.
function normalizeTimestamp(value: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/.test(value)) {
    return null;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed.toISOString();
}

// Only the last path segment, as a label. It is never used to build a path.
function cleanFileName(value: string): string | null {
  const segments = value.split(/[\\/]/);
  const last = (segments[segments.length - 1] ?? '').trim();
  if (last === '') {
    return null;
  }
  return last.slice(0, MAX_FILE_NAME_LENGTH);
}

// A capture starts as a receipt with no facts yet. Unless the client named the
// kind, it counts as a guess until the user confirms it.
export function newUploadedDocument(
  id: string,
  upload: UploadParams,
  now: string,
): ArchiveDocument {
  const guessed: GuessableField[] = [];
  let kind = upload.kind;
  if (kind === null) {
    kind = 'receipt';
    guessed.push('kind');
  }
  return {
    id,
    source: upload.source,
    kind,
    merchant: null,
    purchasedItem: null,
    amountMinor: null,
    currency: null,
    issuedOn: null,
    dueOn: null,
    kid: null,
    account: null,
    iban: null,
    notes: '',
    dedupKey: null,
    guessed,
    capturedAt: upload.capturedAt,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    mail: null,
  };
}
