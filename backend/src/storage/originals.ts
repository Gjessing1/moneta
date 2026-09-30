// Original files on disk, content-addressed (A15): the path is a function of
// the SHA-256 alone, and a stored file is never modified.
import { createHash, randomUUID } from 'node:crypto';
import { createWriteStream, existsSync } from 'node:fs';
import { mkdir, readdir, rename, rm, stat } from 'node:fs/promises';
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

// Young files may belong to an upload that has stored its bytes but has not
// committed its files row yet. A failed upload's orphan is collected next run.
export async function removeUnreferencedOriginals(
  dataDir: string,
  isReferenced: (sha256: string) => boolean,
  olderThan: number,
): Promise<number> {
  const root = join(dataDir, 'originals');
  let prefixes;
  try {
    prefixes = await readdir(root, { withFileTypes: true });
  } catch (error) {
    if (isMissing(error)) return 0;
    throw error;
  }
  let removed = 0;
  for (const prefix of prefixes) {
    if (!prefix.isDirectory() || !/^[a-f0-9]{2}$/.test(prefix.name)) continue;
    const folder = join(root, prefix.name);
    for (const entry of await readdir(folder, { withFileTypes: true })) {
      if (!entry.isFile() || !/^[a-f0-9]{64}$/.test(entry.name)) continue;
      if (entry.name.slice(0, 2) !== prefix.name || isReferenced(entry.name)) continue;
      const path = join(folder, entry.name);
      if ((await stat(path)).mtimeMs > olderThan) continue;
      // Recheck after the async stat: an upload may have committed meanwhile.
      if (isReferenced(entry.name)) continue;
      await rm(path);
      removed += 1;
    }
  }
  return removed;
}

function isMissing(error: unknown): boolean {
  return error instanceof Error && 'code' in error && error.code === 'ENOENT';
}
