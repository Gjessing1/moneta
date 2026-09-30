// The Recent view's model: documents as month groups of ready-to-show rows.
import type { ArchiveDocument, DocumentKind, DocumentSource } from './document.js';
import { formatAmount, formatDayShort, formatMonth, localDate } from './format.js';

export interface ArchiveRow {
  id: string;
  source: DocumentSource;
  title: string;
  // "Invoice from mail, 25 Sep"
  detail: string;
  amount: string | null;
}

export interface MonthGroup {
  // "2026-09"
  key: string;
  label: string;
  rows: ArchiveRow[];
}

export const KIND_LABELS: Record<DocumentKind, string> = {
  invoice: 'Invoice',
  receipt: 'Receipt',
  other: 'Document',
};

export const SOURCE_PHRASES: Record<DocumentSource, string> = {
  maily: 'from mail',
  camera: 'photographed',
  upload: 'uploaded',
  share: 'shared',
};

// The day the document belongs to: the date printed on it when known,
// otherwise the local day it was captured. Matches the list's sort order
// (documentSortKey), apart from captures near midnight UTC.
export function documentDay(doc: ArchiveDocument, timeZone: string): string {
  if (doc.issuedOn !== null) {
    return doc.issuedOn;
  }
  return localDate(doc.capturedAt, timeZone);
}

// The merchant, or what the document is while it has none yet.
export function documentTitle(doc: ArchiveDocument): string {
  if (doc.merchant === null) {
    return `${KIND_LABELS[doc.kind]} awaiting details`;
  }
  return doc.merchant;
}

export function describeDocument(doc: ArchiveDocument, timeZone: string): ArchiveRow {
  const kind = KIND_LABELS[doc.kind];
  const title = documentTitle(doc);
  let amount: string | null = null;
  if (doc.amountMinor !== null && doc.currency !== null) {
    amount = formatAmount(doc.amountMinor, doc.currency);
  }
  const day = formatDayShort(documentDay(doc, timeZone));
  let detail = `${kind} ${SOURCE_PHRASES[doc.source]}, ${day}`;
  if (doc.purchasedItem !== null) {
    detail = `${detail} · ${doc.purchasedItem}`;
  }
  return {
    id: doc.id,
    source: doc.source,
    title,
    detail,
    amount,
  };
}

// Expects documents newest first, as the API returns them, and keeps that
// order. Consecutive documents from the same month share a group.
export function groupByMonth(docs: readonly ArchiveDocument[], timeZone: string): MonthGroup[] {
  const groups: MonthGroup[] = [];
  for (const doc of docs) {
    const key = documentDay(doc, timeZone).slice(0, 7);
    let group = groups[groups.length - 1];
    if (group === undefined || group.key !== key) {
      group = { key, label: formatMonth(key), rows: [] };
      groups.push(group);
    }
    group.rows.push(describeDocument(doc, timeZone));
  }
  return groups;
}
