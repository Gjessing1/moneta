import { createHash } from 'node:crypto';
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { afterEach, describe, expect, it } from 'vitest';
import { OriginalRejectedError, originalPath, storeOriginal } from './originals.js';

const dirs: string[] = [];
afterEach(() => {
  for (const dir of dirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

function dataDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'moneta-originals-'));
  dirs.push(dir);
  return dir;
}

describe('storeOriginal', () => {
  it('stores bytes under their SHA-256, split across chunks', async () => {
    const dir = dataDir();
    const chunks = [Buffer.from('%PDF-'), Buffer.from('1.7 body')];
    const expected = createHash('sha256').update(Buffer.concat(chunks)).digest('hex');
    const result = await storeOriginal(dir, Readable.from(chunks), 1024);
    expect(result).toEqual({ sha256: expected, sizeBytes: 13 });
    expect(readFileSync(originalPath(dir, expected)).toString()).toBe('%PDF-1.7 body');
    expect(originalPath(dir, expected)).toBe(
      join(dir, 'originals', expected.slice(0, 2), expected),
    );
  });

  it('stops at the size cap and leaves no temp file', async () => {
    const dir = dataDir();
    const body = Readable.from([Buffer.alloc(600), Buffer.alloc(600)]);
    const failure = storeOriginal(dir, body, 1000);
    await expect(failure).rejects.toBeInstanceOf(OriginalRejectedError);
    await expect(failure).rejects.toMatchObject({ statusCode: 413 });
    expect(readdirSync(join(dir, 'tmp'))).toEqual([]);
  });

  it('cleans up when the client goes away mid-upload', async () => {
    const dir = dataDir();
    const body = new Readable({
      read() {
        this.push(Buffer.from('partial'));
        this.destroy(new Error('socket hang up'));
      },
    });
    await expect(storeOriginal(dir, body, 1000)).rejects.toThrow('socket hang up');
    expect(readdirSync(join(dir, 'tmp'))).toEqual([]);
  });
});
