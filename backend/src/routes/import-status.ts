import type { FastifyInstance } from 'fastify';
import type { Db } from '../db/database.js';
import type { MailyImportStatus } from '@moneta/core/maily-import';

export function readImportStatus(db: Db): MailyImportStatus {
  const row = db
    .prepare("SELECT last_success_at, last_error FROM import_status WHERE source = 'maily'")
    .get() as { last_success_at: string | null; last_error: string | null } | undefined;
  return { lastSuccessAt: row?.last_success_at ?? null, lastError: row?.last_error ?? null };
}

export function registerImportStatusRoute(app: FastifyInstance, db: Db): void {
  app.get('/api/import/maily/status', async function status(): Promise<MailyImportStatus> {
    return readImportStatus(db);
  });
}
