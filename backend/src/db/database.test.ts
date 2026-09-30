import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { migrate, openDatabase } from './database.js';
import { MIGRATIONS } from './migrations.js';

describe('migrate', () => {
  const dirs: string[] = [];
  afterEach(() => {
    for (const dir of dirs.splice(0)) {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('brings an empty database to the latest version, once', () => {
    const dir = mkdtempSync(join(tmpdir(), 'moneta-db-'));
    dirs.push(dir);
    const file = join(dir, 'nested', 'moneta.sqlite');

    const first = openDatabase(file);
    expect(migrate(first)).toEqual({ from: 0, to: MIGRATIONS.length, known: MIGRATIONS.length });
    first.close();

    const second = openDatabase(file);
    expect(migrate(second)).toEqual({
      from: MIGRATIONS.length,
      to: MIGRATIONS.length,
      known: MIGRATIONS.length,
    });
    expect(second.pragma('journal_mode', { simple: true })).toBe('wal');
    second.close();
  });

  it('leaves a database from a newer build alone', () => {
    const db = openDatabase(':memory:');
    db.pragma(`user_version = ${MIGRATIONS.length + 1}`);
    expect(migrate(db)).toEqual({
      from: MIGRATIONS.length + 1,
      to: MIGRATIONS.length + 1,
      known: MIGRATIONS.length,
    });
  });

  it('adds the purchase field to an existing archive without losing its documents', () => {
    const db = openDatabase(':memory:');
    db.exec(MIGRATIONS[0] as string);
    db.exec(MIGRATIONS[1] as string);
    db.pragma('user_version = 2');
    db.prepare(
      `INSERT INTO documents
      (id, source, kind, captured_at, created_at, updated_at)
      VALUES (?, 'camera', 'receipt', ?, ?, ?)`,
    ).run(
      '0d6f1c1e-6a3b-4c8e-9a52-2f0c4b1e7a10',
      '2026-09-29T08:00:00.000Z',
      '2026-09-29T08:00:00.000Z',
      '2026-09-29T08:00:00.000Z',
    );

    expect(migrate(db)).toEqual({ from: 2, to: MIGRATIONS.length, known: MIGRATIONS.length });
    expect(db.prepare('SELECT kind, purchased_item FROM documents').get()).toEqual({
      kind: 'receipt',
      purchased_item: null,
    });
    db.close();
  });
});
