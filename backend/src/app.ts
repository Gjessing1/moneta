import { existsSync } from 'node:fs';
import fastifyStatic from '@fastify/static';
import Fastify from 'fastify';
import type { HealthReport } from '@moneta/core';
import type { Config } from './config.js';
import type { Db } from './db/database.js';
import { registerDocumentFileRoutes } from './routes/document-files.js';
import { registerDocumentRoutes } from './routes/documents.js';
import { schedulePurge } from './purge.js';

export async function buildApp(config: Config, db: Db) {
  const app = Fastify({ logger: { level: config.logLevel } });

  app.get('/api/health', async function health(): Promise<HealthReport> {
    return { ok: true, name: 'moneta', version: config.version, gitSha: config.gitSha };
  });

  registerDocumentRoutes(app, db, config.mailyPublicUrl);
  registerDocumentFileRoutes(app, db, config.dataDir, config.mailyPublicUrl);
  schedulePurge(app, db, config.dataDir);

  if (existsSync(config.webRoot)) {
    await app.register(fastifyStatic, { root: config.webRoot });
    // SPA fallback: unknown non-API paths get index.html so client routing works.
    app.setNotFoundHandler(function spaFallback(request, reply) {
      if (request.url.startsWith('/api/')) {
        return reply.code(404).send({ error: 'not found' });
      }
      return reply.sendFile('index.html');
    });
  }

  return app;
}
