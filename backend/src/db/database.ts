import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import Database from 'better-sqlite3';
import { MIGRATIONS } from './migrations.js';

export type Db = Database.Database;

export interface MigrationResult {
  from: number;
  to: number;
  // Versions this build knows. A database ahead of it means an older image
  // was rolled back onto a newer schema.
  known: number;
}

export function openDatabase(file: string): Db {
  if (file !== ':memory:') {
    mkdirSync(dirname(file), { recursive: true });
  }
  const db = new Database(file);
  // WAL so reads keep flowing while the import job writes.
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.pragma('busy_timeout = 5000');
  return db;
}

// Each migration and its version bump commit together, so a crash mid-way
// leaves the database at the previous version, not half-migrated.
export function migrate(db: Db): MigrationResult {
  const from = db.pragma('user_version', { simple: true }) as number;
  let version = from;
  while (version < MIGRATIONS.length) {
    const sql = MIGRATIONS[version] as string;
    const next = version + 1;
    db.transaction(function applyMigration() {
      db.exec(sql);
      db.pragma(`user_version = ${next}`);
    })();
    version = next;
  }
  return { from, to: version, known: MIGRATIONS.length };
}
