import type { FastifyInstance } from 'fastify';
import type { Db } from './db/database.js';
import { originalIsReferenced, purgeExpiredDocuments } from './db/documents.js';
import { removeUnreferencedOriginals } from './storage/originals.js';

const DAY = 24 * 60 * 60 * 1000;

export async function runPurge(
  db: Db,
  dataDir: string,
  now = new Date(),
): Promise<{
  documents: number;
  originals: number;
}> {
  const documents = purgeExpiredDocuments(
    db,
    new Date(now.getTime() - 30 * DAY).toISOString(),
    now.toISOString(),
  );
  const originals = await removeUnreferencedOriginals(
    dataDir,
    function referenced(hash) {
      return originalIsReferenced(db, hash);
    },
    now.getTime() - 60 * 60 * 1000,
  );
  return { documents, originals };
}

// Backrest snapshots the database at 07:00 Oslo time. Running at 02:00 UTC
// keeps scheduled deletion outside that window in both summer and winter.
export function schedulePurge(app: FastifyInstance, db: Db, dataDir: string): void {
  let timer: NodeJS.Timeout;
  let running: Promise<void> | null = null;
  let closing = false;
  function scheduleNext() {
    if (closing) return;
    const now = new Date();
    const next = new Date(now);
    next.setUTCHours(2, 0, 0, 0);
    if (next <= now) next.setUTCDate(next.getUTCDate() + 1);
    timer = setTimeout(function scheduled() {
      running = runPurge(db, dataDir)
        .then(function done(result) {
          app.log.info(result, 'archive purge completed');
        })
        .catch(function failed(error: unknown) {
          app.log.error({ error }, 'archive purge failed');
        })
        .finally(function finish() {
          running = null;
          scheduleNext();
        });
    }, next.getTime() - now.getTime());
  }
  scheduleNext();
  app.addHook('onClose', async function stop() {
    closing = true;
    clearTimeout(timer);
    await running;
  });
}
