// The archive's facts: list, read, edit, delete and restore documents. The
// rules for what is valid live in @moneta/core (A1); this file is HTTP only.
import type { FastifyInstance } from 'fastify';
import type { DocumentDetail } from '@moneta/core/document';
import type { DocumentPage } from '@moneta/core/document-list';
import { parseDocumentListQuery } from '@moneta/core/document-list';
import { applyDocumentPatch, parseDocumentPatch } from '@moneta/core/document-patch';
import { parseShopRename } from '@moneta/core/shop-name';
import type { Db } from '../db/database.js';
import {
  getDocument,
  getDocumentDetail,
  listArchiveFacets,
  listArchiveMonths,
  listDocuments,
  purgeDocument,
  renameShop,
  updateDocument,
} from '../db/documents.js';

interface IdParams {
  id: string;
}

interface ErrorBody {
  error: string;
}

const NOT_FOUND: ErrorBody = { error: 'no document with that id' };

export function registerDocumentRoutes(app: FastifyInstance, db: Db, mailyPublicUrl: string): void {
  app.get('/api/archive/facets', async function facets() {
    return listArchiveFacets(db);
  });
  app.get('/api/archive/months', async function months(request, reply) {
    const parsed = parseDocumentListQuery(request.query as Record<string, unknown>);
    if (!parsed.ok) return reply.code(400).send({ error: parsed.error });
    return listArchiveMonths(db, parsed.value);
  });
  app.post('/api/shops/rename', async function rename(request, reply) {
    const parsed = parseShopRename(request.body);
    if (!parsed.ok) return reply.code(400).send({ error: parsed.error });
    const count = renameShop(db, parsed.value.from, parsed.value.to, new Date().toISOString());
    if (count === 0) return reply.code(404).send({ error: 'no documents from that shop' });
    return { count };
  });
  app.get('/api/documents', async function list(request, reply): Promise<DocumentPage | ErrorBody> {
    const parsed = parseDocumentListQuery(request.query as Record<string, unknown>);
    if (!parsed.ok) {
      return reply.code(400).send({ error: parsed.error });
    }
    return listDocuments(db, parsed.value);
  });

  // Deleted documents are still readable, so an undo bar or a link from
  // Recently deleted can show what it is about to restore.
  app.get<{ Params: IdParams }>('/api/documents/:id', async function read(request, reply): Promise<
    DocumentDetail | ErrorBody
  > {
    const detail = getDocumentDetail(db, request.params.id, mailyPublicUrl);
    if (detail === undefined) {
      return reply.code(404).send(NOT_FOUND);
    }
    return detail;
  });

  app.patch<{ Params: IdParams }>(
    '/api/documents/:id',
    async function edit(request, reply): Promise<DocumentDetail | ErrorBody> {
      const doc = getDocument(db, request.params.id);
      if (doc === undefined) {
        return reply.code(404).send(NOT_FOUND);
      }
      const patch = parseDocumentPatch(request.body);
      if (!patch.ok) {
        return reply.code(400).send({ error: patch.error });
      }
      const next = applyDocumentPatch(doc, patch.value, new Date().toISOString());
      if (!next.ok) {
        return reply.code(400).send({ error: next.error });
      }
      updateDocument(db, next.value);
      return getDocumentDetail(db, doc.id, mailyPublicUrl) as DocumentDetail;
    },
  );

  // A soft delete: the document leaves the archive but can be restored. Both
  // calls are idempotent, and a repeated delete keeps the first deletedAt.
  app.delete<{ Params: IdParams }>(
    '/api/documents/:id',
    async function softDelete(request, reply): Promise<DocumentDetail | ErrorBody> {
      const doc = getDocument(db, request.params.id);
      if (doc === undefined) {
        return reply.code(404).send(NOT_FOUND);
      }
      if (doc.deletedAt === null) {
        const now = new Date().toISOString();
        updateDocument(db, { ...doc, deletedAt: now, updatedAt: now });
      }
      return getDocumentDetail(db, doc.id, mailyPublicUrl) as DocumentDetail;
    },
  );

  app.post<{ Params: IdParams }>(
    '/api/documents/:id/restore',
    async function restore(request, reply): Promise<DocumentDetail | ErrorBody> {
      const doc = getDocument(db, request.params.id);
      if (doc === undefined) {
        return reply.code(404).send(NOT_FOUND);
      }
      if (doc.deletedAt !== null) {
        updateDocument(db, { ...doc, deletedAt: null, updatedAt: new Date().toISOString() });
      }
      return getDocumentDetail(db, doc.id, mailyPublicUrl) as DocumentDetail;
    },
  );

  app.delete<{ Params: IdParams }>(
    '/api/documents/:id/permanent',
    async function deleteNow(request, reply): Promise<{ ok: true } | ErrorBody> {
      const doc = getDocument(db, request.params.id);
      if (doc === undefined) return reply.code(404).send(NOT_FOUND);
      if (doc.deletedAt === null) {
        return reply
          .code(409)
          .send({ error: 'delete the document before deleting it permanently' });
      }
      purgeDocument(db, doc.id, new Date().toISOString());
      return { ok: true };
    },
  );
}
