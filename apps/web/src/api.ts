import type { DocumentDetail } from '@moneta/core/document';
import type { DocumentPatch } from '@moneta/core/document-patch';
import type { DocumentPage } from '@moneta/core/document-list';
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
): Promise<DocumentPage> {
  const params = new URLSearchParams();
  if (after !== null) {
    params.set('after', after);
  }
  if (q !== null) {
    params.set('q', q);
  }
  const suffix = params.size > 0 ? `?${params}` : '';
  return request<DocumentPage>(`/api/documents${suffix}`);
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
