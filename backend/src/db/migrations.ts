// Schema migrations, applied in order at startup. Append new ones; never edit
// or reorder a migration that has shipped, because deployed databases have
// already run it. The index + 1 is the schema version stored in user_version.
//
// Conventions: STRICT tables, UUID text keys, timestamps as UTC ISO 8601 text
// (sorts lexicographically), calendar dates as YYYY-MM-DD text, money as
// integer minor units.
export const MIGRATIONS: readonly string[] = [
  `
  CREATE TABLE documents (
    id           TEXT PRIMARY KEY,
    source       TEXT NOT NULL CHECK (source IN ('maily', 'camera', 'upload', 'share')),
    kind         TEXT NOT NULL CHECK (kind IN ('invoice', 'receipt', 'other')),
    merchant     TEXT,
    amount_minor INTEGER,
    currency     TEXT CHECK (currency IS NULL OR length(currency) = 3),
    issued_on    TEXT,
    due_on       TEXT,
    kid          TEXT,
    account      TEXT,
    iban         TEXT,
    paid_at      TEXT,
    notes        TEXT NOT NULL DEFAULT '',
    -- A8: one document per upstream item. NULLs don't collide in SQLite, so
    -- captures and uploads (keyed on their client UUID, A12) need no key.
    dedup_key    TEXT UNIQUE,
    -- JSON array of GuessableField names from @moneta/core.
    guessed      TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(guessed)),
    captured_at  TEXT NOT NULL,
    created_at   TEXT NOT NULL,
    updated_at   TEXT NOT NULL,
    deleted_at   TEXT,
    CHECK (amount_minor IS NULL OR currency IS NOT NULL)
  ) STRICT;

  CREATE TABLE files (
    id                  TEXT PRIMARY KEY,
    document_id         TEXT NOT NULL REFERENCES documents (id) ON DELETE CASCADE,
    position            INTEGER NOT NULL CHECK (position >= 0),
    content_type        TEXT NOT NULL,
    size_bytes          INTEGER NOT NULL CHECK (size_bytes >= 0),
    sha256              TEXT NOT NULL CHECK (length(sha256) = 64),
    file_name           TEXT,
    maily_attachment_id TEXT,
    created_at          TEXT NOT NULL,
    UNIQUE (document_id, position),
    -- A13: a re-emitted maily message adds only attachments not yet stored.
    UNIQUE (document_id, maily_attachment_id)
  ) STRICT;

  -- A15: an original may be deleted only when no row references its hash.
  CREATE INDEX files_sha256 ON files (sha256);

  -- A13: the opaque feed cursor, stored exactly as maily sent it.
  CREATE TABLE import_cursors (
    source     TEXT PRIMARY KEY CHECK (source IN ('maily')),
    cursor     TEXT NOT NULL,
    updated_at TEXT NOT NULL
  ) STRICT;
  `,
  // Provenance for maily documents (the Source block): who sent the mail, its
  // subject and when it arrived, copied from the export feed (A8, A14).
  `
  ALTER TABLE documents ADD COLUMN mail_from_name TEXT;
  ALTER TABLE documents ADD COLUMN mail_from_address TEXT;
  ALTER TABLE documents ADD COLUMN mail_subject TEXT;
  ALTER TABLE documents ADD COLUMN mail_received_at TEXT;
  `,
  // A plain description of the goods, kept separately from the shop and notes
  // so warranty entries can be named by what was bought.
  `ALTER TABLE documents ADD COLUMN purchased_item TEXT;`,
  `
  ALTER TABLE documents ADD COLUMN tags TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(tags));
  ALTER TABLE documents ADD COLUMN starred INTEGER NOT NULL DEFAULT 0 CHECK (starred IN (0, 1));
  CREATE INDEX documents_merchant ON documents (merchant) WHERE deleted_at IS NULL;
  CREATE INDEX documents_starred ON documents (starred) WHERE deleted_at IS NULL;
  `,
];
