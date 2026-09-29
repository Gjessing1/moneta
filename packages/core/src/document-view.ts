// The document screen's model: the facts as they read on screen, where the
// document came from, and the originals Moneta keeps of it.
import { documentDay, documentTitle, KIND_LABELS, SOURCE_PHRASES } from './archive-list.js';
import type { ArchiveDocument, DocumentFile } from './document.js';
import { formatAmount, formatBytes, formatDateTime, formatDayLong, localDate } from './format.js';

export interface DocumentFact {
  label: string;
  value: string;
  // What the copy button puts on the clipboard, or null for no button. Payment
  // references are copied bare, the way a bank app wants them pasted.
  copy: string | null;
  strong: boolean;
}

export interface SourceView {
  // "From mail, faktura@fjordkraft.no", "Photographed"
  title: string;
  // "Received 25 Sep 2026, 06:12", the mail's subject
  lines: string[];
}

export interface StoredFileView {
  position: number;
  name: string;
  // A name with an extension for saving or sharing, even when the original
  // came without one.
  downloadName: string;
  contentType: string;
  // "184 KB, saved 25 Sep 2026"
  detail: string;
}

export interface DocumentView {
  title: string;
  // "Invoice from mail, 25 Sep 2026"
  subtitle: string;
  facts: DocumentFact[];
  source: SourceView;
  files: StoredFileView[];
  // "Deleted 29 Sep 2026", or null while it is in the archive.
  deleted: string | null;
}

const SOURCE_TITLES = {
  camera: 'Photographed',
  upload: 'Uploaded',
  share: 'Shared from another app',
} as const;

export function describeDocumentView(
  doc: ArchiveDocument,
  files: readonly DocumentFile[],
  timeZone: string,
): DocumentView {
  const day = formatDayLong(documentDay(doc, timeZone));
  let deleted: string | null = null;
  if (doc.deletedAt !== null) {
    deleted = `Deleted ${formatDayLong(localDate(doc.deletedAt, timeZone))}`;
  }
  const title = documentTitle(doc);
  const fileViews: StoredFileView[] = [];
  for (const file of files) {
    fileViews.push(describeStoredFile(file, title, timeZone));
  }
  return {
    title,
    subtitle: `${KIND_LABELS[doc.kind]} ${SOURCE_PHRASES[doc.source]}, ${day}`,
    facts: documentFacts(doc),
    source: describeSource(doc, timeZone),
    files: fileViews,
    deleted,
  };
}

// Only the facts the document has. D4: due date, KID and account are facts read
// from the invoice; nothing here says whether it was paid.
export function documentFacts(doc: ArchiveDocument): DocumentFact[] {
  const facts: DocumentFact[] = [];
  if (doc.amountMinor !== null && doc.currency !== null) {
    facts.push(fact('Amount', formatAmount(doc.amountMinor, doc.currency), null, true));
  }
  if (doc.issuedOn !== null) {
    facts.push(fact('Issued', formatDayLong(doc.issuedOn)));
  }
  if (doc.dueOn !== null) {
    facts.push(fact('Due', formatDayLong(doc.dueOn)));
  }
  if (doc.kid !== null) {
    facts.push(fact('KID', groupDigits(doc.kid, [4]), bare(doc.kid)));
  }
  if (doc.account !== null) {
    // Norwegian account numbers read 4.2.5.
    facts.push(fact('Account', groupDigits(doc.account, [4, 2, 5]), bare(doc.account)));
  }
  if (doc.iban !== null) {
    facts.push(fact('IBAN', groupIban(doc.iban), bare(doc.iban).toUpperCase()));
  }
  if (doc.notes.trim() !== '') {
    facts.push(fact('Notes', doc.notes.trim()));
  }
  return facts;
}

function fact(label: string, value: string, copy: string | null = null, strong = false) {
  return { label, value, copy, strong };
}

// D5: every document says where it came from.
export function describeSource(doc: ArchiveDocument, timeZone: string): SourceView {
  if (doc.source !== 'maily') {
    return {
      title: SOURCE_TITLES[doc.source],
      lines: [formatDateTime(doc.capturedAt, timeZone)],
    };
  }
  const mail = doc.mail;
  if (mail === null) {
    return { title: 'From mail', lines: [] };
  }
  let title = 'From mail';
  const sender = mail.fromAddress ?? mail.fromName;
  if (sender !== null) {
    title = `From mail, ${sender}`;
  }
  const lines: string[] = [];
  if (mail.receivedAt !== null) {
    lines.push(`Received ${formatDateTime(mail.receivedAt, timeZone)}`);
  }
  if (mail.subject !== null && mail.subject.trim() !== '') {
    lines.push(mail.subject.trim());
  }
  return { title, lines };
}

const EXTENSIONS: Record<string, string> = {
  'application/pdf': 'pdf',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
  'image/heif': 'heif',
};

export function describeStoredFile(
  file: DocumentFile,
  title: string,
  timeZone: string,
): StoredFileView {
  let name = file.fileName;
  let downloadName = file.fileName;
  if (name === null) {
    name = `${fileTypeLabel(file.contentType)} ${file.position + 1}`;
    // Characters no file system accepts become dashes.
    const safeTitle = title.replace(/[\\/:*?"<>|]/g, '-');
    downloadName = `${safeTitle} ${file.position + 1}.${EXTENSIONS[file.contentType] ?? 'bin'}`;
  }
  const saved = formatDayLong(localDate(file.createdAt, timeZone));
  return {
    position: file.position,
    name,
    downloadName: downloadName ?? name,
    contentType: file.contentType,
    detail: `${formatBytes(file.sizeBytes)}, saved ${saved}`,
  };
}

// "PDF", "Photo", or "File" for anything an import brought that isn't either.
export function fileTypeLabel(contentType: string): string {
  if (contentType === 'application/pdf') {
    return 'PDF';
  }
  if (contentType.startsWith('image/')) {
    return 'Photo';
  }
  return 'File';
}

// Spaces, dots and dashes are how the number was printed, not part of it.
function bare(value: string): string {
  return value.replace(/[\s.-]/g, '');
}

// Digits in the given group sizes, the last size repeating: [4] turns a KID
// into "0042 1187 3390 5". Anything that isn't all digits stays as printed.
export function groupDigits(value: string, sizes: readonly number[]): string {
  const digits = bare(value);
  if (!/^\d+$/.test(digits)) {
    return value;
  }
  const groups: string[] = [];
  let start = 0;
  let index = 0;
  while (start < digits.length) {
    const size = sizes[Math.min(index, sizes.length - 1)] ?? digits.length;
    groups.push(digits.slice(start, start + size));
    start += size;
    index += 1;
  }
  return groups.join(' ');
}

// IBANs are printed in groups of four: "NO93 8601 1117 947".
function groupIban(value: string): string {
  const compact = bare(value).toUpperCase();
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]+$/.test(compact)) {
    return value;
  }
  return compact.replace(/(.{4})(?=.)/g, '$1 ');
}
