import { describe, expect, it } from 'vitest';
import type { ArchiveDocument, DocumentFile } from './document.js';
import {
  describeDocumentView,
  documentFacts,
  fileTypeLabel,
  groupDigits,
} from './document-view.js';

const OSLO = 'Europe/Oslo';

function doc(overrides: Partial<ArchiveDocument> = {}): ArchiveDocument {
  return {
    id: '0d6f1c1e-6a3b-4c8e-9a52-2f0c4b1e7a10',
    source: 'maily',
    kind: 'invoice',
    merchant: 'Fjordkraft',
    purchasedItem: null,
    amountMinor: 118400,
    currency: 'NOK',
    issuedOn: '2026-09-25',
    dueOn: '2026-10-14',
    kid: '0042118733905',
    account: '1234.56.78903',
    iban: 'no9386011117947',
    notes: '',
    dedupKey: 'maily:4f2a',
    guessed: [],
    capturedAt: '2026-09-25T04:30:00.000Z',
    createdAt: '2026-09-25T04:30:00.000Z',
    updatedAt: '2026-09-25T04:30:00.000Z',
    deletedAt: null,
    mail: {
      fromName: 'Fjordkraft',
      fromAddress: 'faktura@fjordkraft.no',
      subject: 'Din faktura for september',
      receivedAt: '2026-09-25T04:12:00.000Z',
    },
    ...overrides,
  };
}

function file(overrides: Partial<DocumentFile> = {}): DocumentFile {
  return {
    id: 'f0000000-0000-4000-8000-000000000000',
    documentId: doc().id,
    position: 0,
    contentType: 'application/pdf',
    sizeBytes: 188_416,
    sha256: 'a'.repeat(64),
    fileName: 'faktura-4411.pdf',
    mailyAttachmentId: 'att-1',
    createdAt: '2026-09-25T04:30:00.000Z',
    ...overrides,
  };
}

describe('describeDocumentView', () => {
  it('reads like the design: title, kind and source, facts, provenance, the original', () => {
    const view = describeDocumentView(doc(), [file()], OSLO);
    expect(view.title).toBe('Fjordkraft');
    expect(view.subtitle).toBe('Invoice from mail, 25 Sep 2026');
    expect(view.source).toEqual({
      title: 'From mail, faktura@fjordkraft.no',
      lines: ['Received 25 Sep 2026, 06:12', 'Din faktura for september'],
    });
    expect(view.files).toEqual([
      {
        position: 0,
        name: 'faktura-4411.pdf',
        downloadName: 'faktura-4411.pdf',
        contentType: 'application/pdf',
        detail: '184 KB, saved 25 Sep 2026',
      },
    ]);
    expect(view.deleted).toBeNull();
  });

  it('says how a capture arrived and when', () => {
    const photo = doc({ source: 'camera', kind: 'receipt', merchant: null, issuedOn: null });
    const view = describeDocumentView(photo, [], OSLO);
    expect(view.title).toBe('Receipt awaiting details');
    expect(view.subtitle).toBe('Receipt photographed, 25 Sep 2026');
    expect(view.source).toEqual({ title: 'Photographed', lines: ['25 Sep 2026, 06:30'] });
  });

  it('keeps a mailed document readable before the import recorded its mail', () => {
    expect(describeDocumentView(doc({ mail: null }), [], OSLO).source).toEqual({
      title: 'From mail',
      lines: [],
    });
  });

  it('names the day it was deleted', () => {
    const deleted = doc({ deletedAt: '2026-09-29T22:30:00.000Z' });
    expect(describeDocumentView(deleted, [], OSLO).deleted).toBe('Deleted 30 Sep 2026');
  });

  it('names an unnamed original by its type and page, and saves it under the title', () => {
    const photo = file({ fileName: null, contentType: 'image/jpeg', position: 1, sizeBytes: 900 });
    const shop = doc({ merchant: 'H&M / Oslo City' });
    expect(describeDocumentView(shop, [photo], OSLO).files[0]).toEqual({
      position: 1,
      name: 'Photo 2',
      downloadName: 'H&M - Oslo City 2.jpg',
      contentType: 'image/jpeg',
      detail: '900 bytes, saved 25 Sep 2026',
    });
  });
});

describe('documentFacts', () => {
  it('lists the facts it has, grouped for reading and bare for copying', () => {
    expect(documentFacts(doc({ notes: '  Gave the receipt to Kari  ' }))).toEqual([
      { label: 'Amount', value: '1 184,00 kr', copy: null, strong: true },
      { label: 'Issued', value: '25 Sep 2026', copy: null, strong: false },
      { label: 'Due', value: '14 Oct 2026', copy: null, strong: false },
      { label: 'KID', value: '0042 1187 3390 5', copy: '0042118733905', strong: false },
      { label: 'Account', value: '1234 56 78903', copy: '12345678903', strong: false },
      { label: 'IBAN', value: 'NO93 8601 1117 947', copy: 'NO9386011117947', strong: false },
      { label: 'Notes', value: 'Gave the receipt to Kari', copy: null, strong: false },
    ]);
  });

  it('leaves out what is unknown', () => {
    const bare = doc({
      amountMinor: null,
      currency: null,
      issuedOn: null,
      dueOn: null,
      kid: null,
      account: null,
      iban: null,
    });
    expect(documentFacts(bare)).toEqual([]);
  });

  it('shows what was bought as a separate fact', () => {
    expect(documentFacts(doc({ purchasedItem: 'Headphones' }))).toContainEqual({
      label: 'What you bought',
      value: 'Headphones',
      copy: null,
      strong: false,
    });
  });
});

describe('groupDigits', () => {
  it('repeats the last group size and keeps anything that is not a number as printed', () => {
    expect(groupDigits('12345678', [4])).toBe('1234 5678');
    expect(groupDigits('1234 56 78903', [4, 2, 5])).toBe('1234 56 78903');
    expect(groupDigits('AB-1234', [4])).toBe('AB-1234');
  });
});

describe('fileTypeLabel', () => {
  it('names PDFs and photos', () => {
    expect(fileTypeLabel('application/pdf')).toBe('PDF');
    expect(fileTypeLabel('image/heic')).toBe('Photo');
    expect(fileTypeLabel('text/html')).toBe('File');
  });
});
