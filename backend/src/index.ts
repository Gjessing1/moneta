import { join } from 'node:path';
import { buildApp } from './app.js';
import { loadConfig } from './config.js';
import { migrate, openDatabase } from './db/database.js';
import { scheduleMailyImport } from './maily/import.js';

const config = loadConfig();
// A6: the database lives in the data dir, so it survives redeploys.
const db = openDatabase(join(config.dataDir, 'moneta.sqlite'));
const migration = migrate(db);
const app = await buildApp(config, db);
scheduleMailyImport(app, db, config);

if (migration.from > migration.known) {
  // Additive migrations keep an older build working on a newer schema, which is
  // what a rollback (DEPLOYMENT.md) produces. Say so rather than refuse to start.
  app.log.warn(migration, 'database schema is newer than this build');
} else if (migration.from !== migration.to) {
  app.log.info(migration, 'database migrated');
}

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, function shutdown() {
    void app.close().then(function exitCleanly() {
      db.close();
      process.exit(0);
    });
  });
}

await app.listen({ port: config.port, host: config.host });
