import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildApp } from './app.js';
import { loadConfig } from './config.js';

describe('GET /api/health', () => {
  it('reports the build it runs', async () => {
    const config = loadConfig({ GIT_SHA: 'abc123', LOG_LEVEL: 'silent' });
    const app = await buildApp({ ...config, webRoot: '/nonexistent' });
    const res = await app.inject({ method: 'GET', url: '/api/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ ok: true, name: 'moneta', gitSha: 'abc123' });
    await app.close();
  });
});

describe('serving the web app', () => {
  it('answers deep links with index.html and unknown API paths with 404', async () => {
    const webRoot = mkdtempSync(join(tmpdir(), 'moneta-web-'));
    writeFileSync(join(webRoot, 'index.html'), '<!doctype html><title>Moneta</title>');
    const config = loadConfig({ LOG_LEVEL: 'silent' });
    const app = await buildApp({ ...config, webRoot });
    try {
      for (const url of ['/capture', '/d/4f1c2b', '/search?q=kiwi', '/warranty']) {
        const res = await app.inject({ method: 'GET', url });
        expect(res.statusCode, url).toBe(200);
        expect(res.body, url).toContain('<title>Moneta</title>');
      }
      const api = await app.inject({ method: 'GET', url: '/api/nope' });
      expect(api.statusCode).toBe(404);
      expect(api.json()).toEqual({ error: 'not found' });
    } finally {
      await app.close();
      rmSync(webRoot, { recursive: true, force: true });
    }
  });
});
