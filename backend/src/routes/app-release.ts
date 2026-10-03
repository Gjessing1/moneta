import { createReadStream } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import { basename, join } from 'node:path';
import type { FastifyInstance, FastifyReply } from 'fastify';

// The signed APK and its version.json are written by scripts/publish-android.sh into
// MONETA_DATA_DIR/app (A6), so a release never needs a backend deploy and survives one.
export interface PublishedApp {
  versionCode: number;
  versionName: string;
  file: string;
  sha256: string;
  bytes: number;
  apkPath: string;
}

export async function readPublishedApp(appDir: string): Promise<PublishedApp> {
  const metadata = JSON.parse(await readFile(join(appDir, 'version.json'), 'utf8')) as Record<
    string,
    unknown
  >;
  const { versionCode, versionName, file, sha256 } = metadata;

  if (typeof versionCode !== 'number' || !Number.isSafeInteger(versionCode) || versionCode < 1) {
    throw new Error('version.json has an invalid versionCode');
  }
  if (typeof versionName !== 'string' || !/^[0-9A-Za-z][0-9A-Za-z._-]*$/.test(versionName)) {
    throw new Error('version.json has an invalid versionName');
  }
  // The file name ends up in a path and a header, so only a bare moneta-*.apk name is accepted.
  if (
    typeof file !== 'string' ||
    file !== basename(file) ||
    !/^moneta-[0-9A-Za-z._-]+\.apk$/.test(file)
  ) {
    throw new Error('version.json has an invalid APK filename');
  }
  if (typeof sha256 !== 'string' || !/^[0-9a-f]{64}$/.test(sha256)) {
    throw new Error('version.json has an invalid sha256');
  }

  const apkPath = join(appDir, file);
  const apkStat = await stat(apkPath);
  if (!apkStat.isFile()) {
    throw new Error('published APK is not a file');
  }
  return { versionCode, versionName, file, sha256, bytes: apkStat.size, apkPath };
}

function sendUnpublished(app: FastifyInstance, reply: FastifyReply, error: unknown) {
  // A missing file just means nothing is published yet; anything else is a broken release.
  if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
    app.log.error(error, 'published Android app is unreadable');
  }
  return reply.code(404).send({ error: 'No Android app has been published' });
}

export function registerAppReleaseRoutes(app: FastifyInstance, dataDir: string): void {
  const appDir = join(dataDir, 'app');

  app.get('/api/app/version', async function appVersion(_request, reply) {
    try {
      const { versionCode, versionName, sha256, bytes } = await readPublishedApp(appDir);
      return reply.header('Cache-Control', 'no-cache').send({
        versionCode,
        versionName,
        sha256,
        bytes,
        apkUrl: '/api/app/download',
      });
    } catch (error) {
      return sendUnpublished(app, reply, error);
    }
  });

  app.get('/api/app/download', async function appDownload(_request, reply) {
    try {
      const published = await readPublishedApp(appDir);
      return reply
        .header('Cache-Control', 'no-cache')
        .header('Content-Type', 'application/vnd.android.package-archive')
        .header('Content-Length', published.bytes)
        .header('Content-Disposition', `attachment; filename="${published.file}"`)
        .send(createReadStream(published.apkPath));
    } catch (error) {
      return sendUnpublished(app, reply, error);
    }
  });
}
