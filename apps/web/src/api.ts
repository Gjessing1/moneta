import type { DocumentDetail } from '@moneta/core/document';
import type { DocumentPage } from '@moneta/core/document-list';

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

export function fetchDocumentPage(after: string | null): Promise<DocumentPage> {
  let path = '/api/documents';
  if (after !== null) {
    path = `${path}?after=${encodeURIComponent(after)}`;
  }
  return request<DocumentPage>(path);
}

export function fetchDocument(id: string): Promise<DocumentDetail> {
  return request<DocumentDetail>(`/api/documents/${encodeURIComponent(id)}`);
}

// Where a stored original is served; the position is its page order.
export function fileUrl(documentId: string, position: number): string {
  return `/api/documents/${encodeURIComponent(documentId)}/file/${position}`;
}

export function describeError(err: unknown): string {
  if (err instanceof ApiError) {
    return err.message;
  }
  // fetch() rejects only when the request never got an answer.
  return 'Moneta could not be reached. Check the connection and try again.';
}
