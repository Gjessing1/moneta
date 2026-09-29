// Original files: upload one into a document, and stream one back out.
import { randomUUID } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { Readable } from 'node:stream';
import type { FastifyInstance } from 'fastify';
import {
  isDocumentId,
  isStorableContentType,
  MAX_ORIGINAL_BYTES,
  STORABLE_CONTENT_TYPES,
  type DocumentDetail,
  type DocumentFile,
} from '@moneta/core/document';
import { newUploadedDocument, parseUploadParams } from '@moneta/core/document-upload';
import type { Db } from '../db/database.js';
import {
  findFileByHash,
  getDocument,
  getDocumentDetail,
  getFile,
  insertDocument,
  insertFile,
  nextFilePosition,
  updateDocument,
} from '../db/documents.js';
import {
  OriginalRejectedError,
  originalPath,
  storeOriginal,
  type StoredOriginal,
} from '../storage/originals.js';

interface ErrorBody {
  error: string;
}

export function registerDocumentFileRoutes(app: FastifyInstance, db: Db, dataDir: string): void {
  // Hand the raw request stream to the handler, so an upload is hashed and
  // written to disk as it arrives instead of buffered in memory (A15).
  app.addContentTypeParser(
    [...STORABLE_CONTENT_TYPES],
    function passThrough(_request, payload, done) {
      done(null, payload);
    },
  );

  // A12: the client picks the document id when the photo is taken, and
  // repeating an upload is a no-op. A first upload creates the document; the
  // same bytes again are a retry (200); different bytes add the next page (201).
  app.put<{ Params: { id: string } }>(
    '/api/documents/:id/file',
    async function upload(request, reply): Promise<DocumentDetail | ErrorBody> {
      const { id } = request.params;
      if (!isDocumentId(id)) {
        return reply.code(400).send({ error: 'the id must be a lowercase UUID' });
      }
      const contentType = mediaType(request.headers['content-type']);
      if (!isStorableContentType(contentType) || !(request.body instanceof Readable)) {
        return reply.code(415).send({ error: 'send a PDF or an image as the request body' });
      }
      const now = new Date().toISOString();
      const params = parseUploadParams(request.query as Record<string, unknown>, now);
      if (!params.ok) {
        return reply.code(400).send({ error: params.error });
      }
      if (Number(request.headers['content-length'] ?? 0) > MAX_ORIGINAL_BYTES) {
        return reply
          .code(413)
          .send({ error: `the file is larger than ${MAX_ORIGINAL_BYTES} bytes` });
      }
      if (getDocument(db, id)?.deletedAt) {
        return reply.code(409).send({ error: 'that document is deleted; restore it first' });
      }

      let stored: StoredOriginal;
      try {
        stored = await storeOriginal(dataDir, request.body, MAX_ORIGINAL_BYTES);
      } catch (err) {
        if (err instanceof OriginalRejectedError) {
          return reply.code(err.statusCode).send({ error: err.message });
        }
        throw err;
      }

      const created = db.transaction(function fileOriginal(): boolean {
        const existing = getDocument(db, id);
        if (existing === undefined) {
          insertDocument(db, newUploadedDocument(id, params.value, now));
        } else if (findFileByHash(db, id, stored.sha256) !== undefined) {
          return false;
        } else {
          updateDocument(db, { ...existing, updatedAt: now });
        }
        insertFile(db, {
          id: randomUUID(),
          documentId: id,
          position: nextFilePosition(db, id),
          contentType,
          sizeBytes: stored.sizeBytes,
          sha256: stored.sha256,
          fileName: params.value.fileName,
          mailyAttachmentId: null,
          createdAt: now,
        });
        return true;
      })();

      if (created) {
        reply.code(201);
      }
      return getDocumentDetail(db, id) as DocumentDetail;
    },
  );

  // :n is the page's position. The content type comes from the files row,
  // never from sniffing the bytes (A15).
  app.get<{ Params: { id: string; n: string } }>(
    '/api/documents/:id/file/:n',
    async function download(request, reply) {
      const position = Number(request.params.n);
      let file: DocumentFile | undefined;
      if (Number.isInteger(position) && position >= 0) {
        file = getFile(db, request.params.id, position);
      }
      if (file === undefined) {
        return reply.code(404).send({ error: 'no such file' });
      }

      const etag = `"${file.sha256}"`;
      reply
        .header('ETag', etag)
        .header('Cache-Control', 'private, no-cache')
        .header('X-Content-Type-Options', 'nosniff');
      if (request.headers['if-none-match'] === etag) {
        return reply.code(304).send();
      }

      const path = originalPath(dataDir, file.sha256);
      try {
        await stat(path);
      } catch (err) {
        request.log.error({ err, file }, 'stored original is missing');
        return reply.code(500).send({ error: 'the original is missing from storage' });
      }
      return reply
        .header('Content-Type', file.contentType)
        .header('Content-Length', file.sizeBytes)
        .header('Content-Disposition', contentDisposition(file))
        .send(createReadStream(path));
    },
  );
}

// "image/JPEG; charset=binary" → "image/jpeg"
function mediaType(header: string | undefined): string {
  return (header ?? '').split(';')[0]?.trim().toLowerCase() ?? '';
}

// Types the archive accepts are shown in the browser; anything else a future
// import brings in is offered as a download rather than rendered same-origin.
function contentDisposition(file: DocumentFile): string {
  let disposition = 'attachment';
  if (isStorableContentType(file.contentType)) {
    disposition = 'inline';
  }
  if (file.fileName === null) {
    return disposition;
  }
  // RFC 6266: an ASCII fallback for old clients, the real name in filename*.
  const ascii = file.fileName.replace(/[^\x20-\x7e]|["\\]/g, '_');
  const encoded = encodeURIComponent(file.fileName).replace(/['()*]/g, function escape(c) {
    return `%${c.charCodeAt(0).toString(16).toUpperCase()}`;
  });
  return `${disposition}; filename="${ascii}"; filename*=UTF-8''${encoded}`;
}
