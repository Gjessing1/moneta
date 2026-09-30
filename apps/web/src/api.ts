import type { DocumentDetail } from '@moneta/core/document';
import type { DocumentPatch } from '@moneta/core/document-patch';
import type { DocumentPage } from '@moneta/core/document-list';
import type { DocumentKind, DocumentSource } from '@moneta/core/document';
import type { UploadSource } from '@moneta/core/document-upload';

// A failed API call, carrying the server's own explanation when it sent one.
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, init);
  if (!res.ok) {
    let message = `The server answered ${res.status}`;
    try {
      const body = (await res.json()) as { error?: unknown };
      if (typeof body.error === 'string') {
        message = body.error;
      }
    } catch {
      // Not JSON (a proxy error page): keep the status line.
    }
    throw new ApiError(res.status, message);
  }
  return (await res.json()) as T;
}

export function fetchDocumentPage(
  after: string | null,
  q: string | null = null,
  filters: {
    shop?: string;
    tag?: string;
    starred?: boolean;
    bills?: boolean;
    deleted?: boolean;
    kind?: DocumentKind;
    source?: DocumentSource;
    from?: string;
    to?: string;
    sort?: 'oldest';
  } = {},
): Promise<DocumentPage> {
  const params = new URLSearchParams();
  if (after !== null) {
    params.set('after', after);
  }
  if (q !== null) {
    params.set('q', q);
  }
  if (filters.shop) params.set('shop', filters.shop);
  if (filters.tag) params.set('tag', filters.tag);
  if (filters.starred) params.set('starred', 'true');
  if (filters.bills) params.set('bills', 'true');
  if (filters.deleted) params.set('deleted', 'true');
  if (filters.kind) params.set('kind', filters.kind);
  if (filters.source) params.set('source', filters.source);
  if (filters.from) params.set('from', filters.from);
  if (filters.to) params.set('to', filters.to);
  if (filters.sort) params.set('sort', filters.sort);
  const suffix = params.size > 0 ? `?${params}` : '';
  return request<DocumentPage>(`/api/documents${suffix}`);
}

export interface ArchiveMonth {
  month: string;
  count: number;
}

export function fetchArchiveMonths(filters: {
  kind?: DocumentKind;
  source?: DocumentSource;
  shop?: string;
}): Promise<ArchiveMonth[]> {
  const params = new URLSearchParams();
  if (filters.kind) params.set('kind', filters.kind);
  if (filters.source) params.set('source', filters.source);
  if (filters.shop) params.set('shop', filters.shop);
  return request(`/api/archive/months?${params}`);
}

export interface ArchiveFacet {
  name: string;
  count: number;
}
export function fetchArchiveFacets(): Promise<{ shops: ArchiveFacet[]; tags: ArchiveFacet[] }> {
  return request('/api/archive/facets');
}

export function renameShop(from: string, to: string): Promise<{ count: number }> {
  return request('/api/shops/rename', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ from, to }),
  });
}

export function fetchDocument(id: string): Promise<DocumentDetail> {
  return request<DocumentDetail>(`/api/documents/${encodeURIComponent(id)}`);
}

export function saveDocument(id: string, patch: DocumentPatch): Promise<DocumentDetail> {
  return request<DocumentDetail>(`/api/documents/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(patch),
  });
}

export function deleteDocument(id: string): Promise<DocumentDetail> {
  return request(`/api/documents/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

export function restoreDocument(id: string): Promise<DocumentDetail> {
  return request(`/api/documents/${encodeURIComponent(id)}/restore`, { method: 'POST' });
}

export function deleteDocumentNow(id: string): Promise<{ ok: true }> {
  return request(`/api/documents/${encodeURIComponent(id)}/permanent`, { method: 'DELETE' });
}

export function uploadDocumentFile(
  id: string,
  file: File,
  contentType: string,
  source: UploadSource,
  capturedAt: string,
  kind?: 'invoice' | 'receipt' | 'other',
): Promise<DocumentDetail> {
  const params = new URLSearchParams({ source, capturedAt, fileName: file.name });
  if (kind !== undefined) {
    params.set('kind', kind);
  }
  return request<DocumentDetail>(`/api/documents/${encodeURIComponent(id)}/file?${params}`, {
    method: 'PUT',
    headers: { 'content-type': contentType },
    body: file,
  });
}

// Where a stored original is served; the position is its page order.
export function fileUrl(documentId: string, position: number): string {
  return `/api/documents/${encodeURIComponent(documentId)}/file/${position}`;
}

export function describeError(err: unknown): string {
  if (err instanceof ApiError) {
    return err.message;
  }
  if (err instanceof Error && !(err instanceof TypeError)) {
    return err.message;
  }
  // fetch() rejects only when the request never got an answer.
  return 'Moneta could not be reached. Check the connection and try again.';
}
