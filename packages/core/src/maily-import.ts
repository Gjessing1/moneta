import type { ArchiveDocument, GuessableField, MailOrigin } from './document.js';
import { isCalendarDate, isCurrencyCode, mailyDedupKey } from './document.js';

export interface BillingExportItem {
  messageId: string;
  kind: 'invoice' | 'receipt';
  subject: string | null;
  from: { name: string | null; address: string } | null;
  receivedAt: string | null;
  classifiedAt: string;
  trashed: boolean;
  documents: {
    attachmentId: string;
    filename: string | null;
    mimeType: string | null;
    sizeBytes: number | null;
  }[];
  kids: string[];
  accounts: string[];
  ibans: string[];
  amount: { value: number; currency: string } | null;
  dueDate: string | null;
}

export interface BillingExportPage {
  items: BillingExportItem[];
  cursor: string | null;
  hasMore: boolean;
}

export interface MailyImportStatus {
  lastSuccessAt: string | null;
  lastError: string | null;
}

const IMPORTED_FIELDS: GuessableField[] = [
  'kind',
  'merchant',
  'amountMinor',
  'currency',
  'dueOn',
  'kid',
  'account',
  'iban',
];

function first(values: string[]): string | null {
  return (
    values.find(function nonempty(value) {
      return value.trim() !== '';
    }) ?? null
  );
}

function minorAmount(amount: BillingExportItem['amount']): {
  amountMinor: number | null;
  currency: string | null;
} {
  if (amount === null || !Number.isFinite(amount.value))
    return { amountMinor: null, currency: null };
  const currency = amount.currency.toUpperCase();
  if (!isCurrencyCode(currency)) return { amountMinor: null, currency: null };
  try {
    const digits = new Intl.NumberFormat('en', { style: 'currency', currency }).resolvedOptions()
      .maximumFractionDigits;
    const minor = Math.round(amount.value * 10 ** (digits ?? 2));
    if (!Number.isSafeInteger(minor)) return { amountMinor: null, currency: null };
    return { amountMinor: minor, currency };
  } catch {
    return { amountMinor: null, currency: null };
  }
}

export function importedDocument(
  id: string,
  item: BillingExportItem,
  now: string,
): ArchiveDocument {
  const amount = minorAmount(item.amount);
  const mail: MailOrigin = {
    fromName: item.from?.name ?? null,
    fromAddress: item.from?.address ?? null,
    subject: item.subject,
    receivedAt: item.receivedAt,
  };
  return {
    id,
    source: 'maily',
    kind: item.kind,
    merchant: item.from?.name?.trim() || item.from?.address || null,
    purchasedItem: null,
    tags: [],
    starred: false,
    ...amount,
    issuedOn: null,
    dueOn: item.dueDate !== null && isCalendarDate(item.dueDate) ? item.dueDate : null,
    kid: first(item.kids),
    account: first(item.accounts),
    iban: first(item.ibans),
    notes: '',
    dedupKey: mailyDedupKey(item.messageId),
    guessed: [...IMPORTED_FIELDS],
    capturedAt: item.receivedAt ?? item.classifiedAt,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    mail,
  };
}

export function refreshImportedDocument(
  existing: ArchiveDocument,
  incoming: ArchiveDocument,
): ArchiveDocument {
  const updated = { ...existing, updatedAt: incoming.updatedAt };
  for (const field of IMPORTED_FIELDS) {
    if (existing.guessed.includes(field)) {
      if (field === 'kind') updated.kind = incoming.kind;
      else if (field === 'merchant') updated.merchant = incoming.merchant;
      else if (field === 'amountMinor') updated.amountMinor = incoming.amountMinor;
      else if (field === 'currency') updated.currency = incoming.currency;
      else if (field === 'dueOn') updated.dueOn = incoming.dueOn;
      else if (field === 'kid') updated.kid = incoming.kid;
      else if (field === 'account') updated.account = incoming.account;
      else if (field === 'iban') updated.iban = incoming.iban;
    }
  }
  // Amount and currency form one valid value. A confirmed half wins when a new
  // guess cannot be represented alongside it.
  if (updated.amountMinor !== null && updated.currency === null) {
    if (!existing.guessed.includes('amountMinor')) updated.currency = existing.currency;
    else updated.amountMinor = existing.amountMinor;
  }
  return updated;
}
