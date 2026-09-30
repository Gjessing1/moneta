// Listing the archive: the query GET /api/documents accepts, its order, and the
// cursor that pages through it.
import {
  isDocumentId,
  isDocumentKind,
  isDocumentSource,
  type ArchiveDocument,
  type DocumentKind,
  type DocumentSource,
  type ParseResult,
} from './document.js';

export interface DocumentListCursor {
  sortKey: string;
  id: string;
}

export interface DocumentListQuery {
  kind: DocumentKind | null;
  source: DocumentSource | null;
  // A simple text lookup until full document-text search is added.
  q: string | null;
  shop: string | null;
  tag: string | null;
  starred: boolean;
  bills: boolean;
  // true lists only soft-deleted documents (Recently deleted); false hides them.
  deleted: boolean;
  limit: number;
  after: DocumentListCursor | null;
}

export interface DocumentPage {
  items: ArchiveDocument[];
  // Pass back as `after` for the next page; null on the last page.
  nextCursor: string | null;
}

export const DEFAULT_PAGE_SIZE = 50;
export const MAX_PAGE_SIZE = 200;

// Newest first by the document's own date: the day on the receipt when it is
// known, otherwise the moment it was captured. A date sorts just below the
// timestamps of the same day, because it is a prefix of them. The backend's
// SQL orders by the same expression, COALESCE(issued_on, captured_at).
export function documentSortKey(doc: ArchiveDocument): string {
  return doc.issuedOn ?? doc.capturedAt;
}

// Keyset paging instead of an offset, so an inserted document cannot shift
// pages. Recently deleted uses deletion time rather than the document date.
export function encodeListCursor(doc: ArchiveDocument, deleted = false): string {
  const sortKey = deleted ? doc.deletedAt : documentSortKey(doc);
  return `${sortKey}|${doc.id}`;
}

export function decodeListCursor(cursor: string): DocumentListCursor | null {
  const separator = cursor.lastIndexOf('|');
  if (separator === -1) {
    return null;
  }
  const sortKey = cursor.slice(0, separator);
  const id = cursor.slice(separator + 1);
  if (!isDocumentId(id) || !/^\d{4}-\d{2}-\d{2}(T[\d:.]+Z)?$/.test(sortKey)) {
    return null;
  }
  return { sortKey, id };
}

export function parseDocumentListQuery(
  params: Record<string, unknown>,
): ParseResult<DocumentListQuery> {
  const query: DocumentListQuery = {
    kind: null,
    source: null,
    q: null,
    shop: null,
    tag: null,
    starred: false,
    bills: false,
    deleted: false,
    limit: DEFAULT_PAGE_SIZE,
    after: null,
  };
  for (const [key, value] of Object.entries(params)) {
    if (typeof value !== 'string') {
      return { ok: false, error: `${key} must be given once` };
    }
    if (key === 'kind') {
      if (!isDocumentKind(value)) {
        return { ok: false, error: 'kind must be invoice, receipt or other' };
      }
      query.kind = value;
    } else if (key === 'source') {
      if (!isDocumentSource(value)) {
        return { ok: false, error: 'source must be maily, camera, upload or share' };
      }
      query.source = value;
    } else if (key === 'q') {
      const text = value.trim();
      if (text.length > 200) {
        return { ok: false, error: 'q must be at most 200 characters' };
      }
      query.q = text === '' ? null : text;
    } else if (key === 'shop' || key === 'tag') {
      const text = value.trim();
      if (text.length < 1 || text.length > 500) {
        return { ok: false, error: `${key} must be 1 to 500 characters` };
      }
      query[key] = text;
    } else if (key === 'starred' || key === 'bills') {
      if (value !== 'true' && value !== 'false') {
        return { ok: false, error: `${key} must be true or false` };
      }
      query[key] = value === 'true';
    } else if (key === 'deleted') {
      if (value !== 'true' && value !== 'false') {
        return { ok: false, error: 'deleted must be true or false' };
      }
      query.deleted = value === 'true';
    } else if (key === 'limit') {
      const limit = Number(value);
      if (!Number.isInteger(limit) || limit < 1 || limit > MAX_PAGE_SIZE) {
        return { ok: false, error: `limit must be a whole number from 1 to ${MAX_PAGE_SIZE}` };
      }
      query.limit = limit;
    } else if (key === 'after') {
      const cursor = decodeListCursor(value);
      if (cursor === null) {
        return { ok: false, error: 'after is not a cursor this server returned' };
      }
      query.after = cursor;
    } else {
      return { ok: false, error: `unknown parameter ${key}` };
    }
  }
  return { ok: true, value: query };
}
