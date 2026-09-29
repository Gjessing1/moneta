#!/bin/sh
# Nightly consistent copy of Moneta's SQLite database, run by Backrest's
# snapshot-start hook inside an SQLite-capable container with:
#   /source  the live data dir (MONETA_DATA_DIR), mounted writable, because
#            SQLite creates a shared-memory sidecar next to a WAL database even
#            when it only reads it
#   /backup  the dump directory Backrest snapshots
# The originals need no dump: they are immutable, content-addressed files
# (A15) that Backrest snapshots in place. Dump the database first, so every
# original it references is already on disk when the snapshot reads them.
set -eu

source_db=/source/moneta.sqlite
backup_db=/backup/moneta.sqlite

if [ ! -f "$source_db" ]; then
  echo "Moneta database is missing: $source_db" >&2
  exit 1
fi

temporary_db=$(mktemp /backup/.moneta.sqlite.XXXXXXXX)
# The copy inherits WAL mode from the source, so opening it creates -wal and
# -shm sidecars. Remove those too, or failed runs litter the dump directory.
trap 'rm -f "$temporary_db" "$temporary_db-wal" "$temporary_db-shm"' EXIT

# The backup API includes committed data still in the live WAL file.
sqlite3 -readonly "$source_db" ".backup $temporary_db"
# A single self-contained file: nothing to lose if only the .sqlite is restored.
sqlite3 "$temporary_db" 'PRAGMA journal_mode = DELETE;' >/dev/null
check=$(sqlite3 -readonly "$temporary_db" 'PRAGMA quick_check;')
if [ "$check" != ok ]; then
  echo "Moneta database backup failed quick_check: $check" >&2
  exit 1
fi

chmod 644 "$temporary_db"
mv -f "$temporary_db" "$backup_db"
