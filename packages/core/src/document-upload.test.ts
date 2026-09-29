import { describe, expect, it } from 'vitest';
import { newUploadedDocument, parseUploadParams } from './document-upload.js';

const NOW = '2026-09-29T20:00:00.000Z';
const ID = '0d6f1c1e-6a3b-4c8e-9a52-2f0c4b1e7a10';

describe('parseUploadParams', () => {
  it('defaults to a manual upload filed now', () => {
    expect(parseUploadParams({}, NOW)).toEqual({
      ok: true,
      value: { source: 'upload', kind: null, capturedAt: NOW, fileName: null },
    });
  });

  it('stores the capture moment in UTC, whatever offset the phone sent (A12)', () => {
    const result = parseUploadParams(
      { source: 'camera', capturedAt: '2026-09-29T23:30:00+02:00' },
      NOW,
    );
    expect(result).toMatchObject({ ok: true, value: { capturedAt: '2026-09-29T21:30:00.000Z' } });
  });

  it('refuses a timestamp without a time zone', () => {
    expect(parseUploadParams({ capturedAt: '2026-09-29T21:30:00' }, NOW)).toMatchObject({
      ok: false,
    });
    expect(parseUploadParams({ capturedAt: '2026-09-29' }, NOW)).toMatchObject({ ok: false });
  });

  it('keeps only the last segment of a file name', () => {
    expect(parseUploadParams({ fileName: 'C:\\Users\\me\\kvittering.pdf' }, NOW)).toMatchObject({
      ok: true,
      value: { fileName: 'kvittering.pdf' },
    });
    expect(parseUploadParams({ fileName: '../../etc/passwd' }, NOW)).toMatchObject({
      ok: true,
      value: { fileName: 'passwd' },
    });
    expect(parseUploadParams({ fileName: '  ' }, NOW)).toMatchObject({
      ok: true,
      value: { fileName: null },
    });
  });

  it('never files an upload as a maily document', () => {
    expect(parseUploadParams({ source: 'maily' }, NOW)).toMatchObject({ ok: false });
    expect(parseUploadParams({ other: 'x' }, NOW)).toMatchObject({ ok: false });
  });
});

describe('newUploadedDocument', () => {
  it('starts as a receipt whose kind is still a guess', () => {
    const upload = { source: 'camera', kind: null, capturedAt: NOW, fileName: null } as const;
    expect(newUploadedDocument(ID, upload, NOW)).toMatchObject({
      id: ID,
      source: 'camera',
      kind: 'receipt',
      guessed: ['kind'],
      dedupKey: null,
      capturedAt: NOW,
    });
  });

  it('trusts a kind the client named', () => {
    const upload = { source: 'upload', kind: 'invoice', capturedAt: NOW, fileName: null } as const;
    expect(newUploadedDocument(ID, upload, NOW)).toMatchObject({ kind: 'invoice', guessed: [] });
  });
});
