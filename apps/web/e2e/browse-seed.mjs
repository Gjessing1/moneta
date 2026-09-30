import { openDatabase, migrate } from '../../../backend/dist/db/database.js';
import { insertDocument } from '../../../backend/dist/db/documents.js';
import process from 'node:process';

const dataDir = process.env.MONETA_DATA_DIR;
if (!dataDir) throw new Error('Set MONETA_DATA_DIR to a fresh temporary directory');
const db = openDatabase(`${dataDir}/moneta.sqlite`);
migrate(db);
const now = new Date().toISOString();
const samples = [
  ['00000000-0000-4000-8000-000000000001', 'Shop One', '2026-09-12', 'maily', 'invoice'],
  ['00000000-0000-4000-8000-000000000002', 'Shop One', '2026-07-10', 'upload', 'receipt'],
  ['00000000-0000-4000-8000-000000000003', 'Shop Two', '2025-02-04', 'camera', 'receipt'],
  ['00000000-0000-4000-8000-000000000004', 'Shop Two', '2024-01-03', 'share', 'other'],
];
for (const [id, merchant, issuedOn, source, kind] of samples) {
  insertDocument(db, {
    id,
    merchant,
    issuedOn,
    source,
    kind,
    purchasedItem: null,
    tags: [],
    starred: false,
    amountMinor: null,
    currency: null,
    dueOn: null,
    kid: null,
    account: null,
    iban: null,
    notes: '',
    dedupKey: null,
    guessed: [],
    capturedAt: now,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    mail: null,
  });
}
// Keep the oldest months beyond the first page, so the timeline must jump
// by date instead of scrolling through already loaded rows.
for (let index = 5; index < 65; index++) {
  insertDocument(db, {
    id: `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
    merchant: null,
    issuedOn: '2026-09-20',
    source: 'camera',
    kind: 'receipt',
    purchasedItem: null,
    tags: [],
    starred: false,
    amountMinor: null,
    currency: null,
    dueOn: null,
    kid: null,
    account: null,
    iban: null,
    notes: '',
    dedupKey: null,
    guessed: [],
    capturedAt: now,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    mail: null,
  });
}
db.close();
