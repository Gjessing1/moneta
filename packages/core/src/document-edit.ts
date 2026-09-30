// Converting the edit form's human-readable fields to the API's precise facts.
import type { ArchiveDocument, DocumentKind, ParseResult } from './document.js';
import type { DocumentPatch } from './document-patch.js';

export interface DocumentEditValues {
  kind: DocumentKind;
  merchant: string;
  purchasedItem: string;
  amount: string;
  currency: string;
  issuedOn: string;
  dueOn: string;
  kid: string;
  account: string;
  iban: string;
  notes: string;
}

export function valuesFromDocument(doc: ArchiveDocument): DocumentEditValues {
  let amount = '';
  if (doc.amountMinor !== null) {
    const sign = doc.amountMinor < 0 ? '-' : '';
    const absolute = Math.abs(doc.amountMinor);
    amount = `${sign}${Math.floor(absolute / 100)},${String(absolute % 100).padStart(2, '0')}`;
  }
  return {
    kind: doc.kind,
    merchant: doc.merchant ?? '',
    purchasedItem: doc.purchasedItem ?? '',
    amount,
    currency: doc.currency ?? 'NOK',
    issuedOn: doc.issuedOn ?? '',
    dueOn: doc.dueOn ?? '',
    kid: doc.kid ?? '',
    account: doc.account ?? '',
    iban: doc.iban ?? '',
    notes: doc.notes,
  };
}

export function patchFromValues(values: DocumentEditValues): ParseResult<DocumentPatch> {
  const amount = parseAmount(values.amount);
  if (!amount.ok) {
    return amount;
  }
  return {
    ok: true,
    value: {
      kind: values.kind,
      merchant: values.merchant,
      purchasedItem: values.purchasedItem,
      amountMinor: amount.value,
      currency: values.currency.trim() === '' ? null : values.currency,
      issuedOn: values.issuedOn === '' ? null : values.issuedOn,
      dueOn: values.dueOn === '' ? null : values.dueOn,
      kid: values.kid,
      account: values.account,
      iban: values.iban,
      notes: values.notes,
    },
  };
}

// Norwegian decimal comma and a decimal point both work. Spaces may group
// thousands; the API still receives integer øre, never a floating point sum.
export function parseAmount(input: string): ParseResult<number | null> {
  const trimmed = input.trim();
  if (trimmed === '') {
    return { ok: true, value: null };
  }
  const compact = trimmed.replace(/[\s\u00a0]/g, '');
  const match = /^(-?)(\d+)(?:[,.](\d{1,2}))?$/.exec(compact);
  if (match === null) {
    return { ok: false, error: 'Enter an amount such as 499,50' };
  }
  const whole = Number(match[2]);
  const cents = Number((match[3] ?? '').padEnd(2, '0'));
  const minor = whole * 100 + cents;
  if (!Number.isSafeInteger(minor)) {
    return { ok: false, error: 'The amount is too large' };
  }
  return { ok: true, value: match[1] === '-' ? -minor : minor };
}
