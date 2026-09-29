// Original files on disk, content-addressed (A15): the path is a function of
// the SHA-256 alone, and a stored file is never modified.
import { createHash, randomUUID } from 'node:crypto';
import { createWriteStream, existsSync } from 'node:fs';
import { mkdir, rename, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { Transform, type Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

export interface StoredOriginal {
  sha256: string;
  sizeBytes: number;
}

// A body the archive refuses to keep. Nothing of it is left on disk.
export class OriginalRejectedError extends Error {
  constructor(
    message: string,
    readonly statusCode: 400 | 413,
  ) {
    super(message);
  }
}

export function originalPath(dataDir: string, sha256: string): string {
  return join(dataDir, 'originals', sha256.slice(0, 2), sha256);
}

// Streams into tmp/ while hashing, then renames into place. tmp/ sits on the
// same filesystem as originals/, so the rename is atomic and a crash never
// leaves a half-written file under its final name.
export async function storeOriginal(
  dataDir: string,
  body: Readable,
  maxBytes: number,
): Promise<StoredOriginal> {
  const tmpDir = join(dataDir, 'tmp');
  await mkdir(tmpDir, { recursive: true });
  const tmpFile = join(tmpDir, randomUUID());
  const hash = createHash('sha256');
  let sizeBytes = 0;

  const measure = new Transform({
    transform(chunk: Buffer, _encoding, callback) {
      sizeBytes += chunk.length;
      if (sizeBytes > maxBytes) {
        callback(new OriginalRejectedError(`the file is larger than ${maxBytes} bytes`, 413));
        return;
      }
      hash.update(chunk);
      callback(null, chunk);
    },
  });

  try {
    await pipeline(body, measure, createWriteStream(tmpFile, { flags: 'wx' }));
    if (sizeBytes === 0) {
      throw new OriginalRejectedError('the file is empty', 400);
    }
    const sha256 = hash.digest('hex');
    const target = originalPath(dataDir, sha256);
    if (existsSync(target)) {
      // Same hash, same bytes: the copy already stored is the one we keep.
      await rm(tmpFile);
    } else {
      await mkdir(join(dataDir, 'originals', sha256.slice(0, 2)), { recursive: true });
      await rename(tmpFile, target);
    }
    return { sha256, sizeBytes };
  } catch (err) {
    await rm(tmpFile, { force: true });
    throw err;
  }
}
