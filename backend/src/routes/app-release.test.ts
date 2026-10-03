import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Fastify from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { readPublishedApp, registerAppReleaseRoutes } from './app-release.js';

let dataDir: string;
let appDir: string;

beforeEach(function makeDirs() {
  dataDir = mkdtempSync(join(tmpdir(), 'moneta-app-release-'));
  appDir = join(dataDir, 'app');
  mkdirSync(appDir);
});

afterEach(function removeDirs() {
  rmSync(dataDir, { recursive: true, force: true });
});

function publish(metadata: Record<string, unknown>, apk?: Buffer) {
  if (apk) {
    writeFileSync(join(appDir, 'moneta-0.1.0.apk'), apk);
  }
  writeFileSync(join(appDir, 'version.json'), JSON.stringify(metadata));
}

const valid = {
  versionCode: 1,
  versionName: '0.1.0',
  file: 'moneta-0.1.0.apk',
  bytes: 999,
  sha256: 'a'.repeat(64),
};

describe('readPublishedApp', () => {
  it('validates the metadata and takes the size from the APK on disk', async () => {
    const apk = Buffer.from('signed apk fixture');
    publish(valid, apk);
    const release = await readPublishedApp(appDir);
    expect(release).toMatchObject({ versionCode: 1, versionName: '0.1.0', bytes: apk.length });
    expect(release.apkPath).toBe(join(appDir, 'moneta-0.1.0.apk'));
  });

  it('rejects path traversal in the APK file name', async () => {
    publish({ ...valid, file: '../moneta-0.1.0.apk' });
    await expect(readPublishedApp(appDir)).rejects.toThrow(/invalid APK filename/);
  });
});

describe('Android release routes', () => {
  it('answers 404 until an APK is published, then serves its metadata and bytes', async () => {
    const app = Fastify();
    registerAppReleaseRoutes(app, dataDir);
    try {
      const missing = await app.inject({ method: 'GET', url: '/api/app/download' });
      expect(missing.statusCode).toBe(404);

      const apk = Buffer.from('signed apk fixture');
      publish({ ...valid, sha256: 'b'.repeat(64) }, apk);

      const version = await app.inject({ method: 'GET', url: '/api/app/version' });
      expect(version.statusCode).toBe(200);
      expect(version.json()).toEqual({
        versionCode: 1,
        versionName: '0.1.0',
        sha256: 'b'.repeat(64),
        bytes: apk.length,
        apkUrl: '/api/app/download',
      });

      const download = await app.inject({ method: 'GET', url: '/api/app/download' });
      expect(download.statusCode).toBe(200);
      expect(download.headers['content-type']).toBe('application/vnd.android.package-archive');
      expect(download.headers['content-disposition']).toBe(
        'attachment; filename="moneta-0.1.0.apk"',
      );
      expect(download.rawPayload.equals(apk)).toBe(true);
    } finally {
      await app.close();
    }
  });
});
