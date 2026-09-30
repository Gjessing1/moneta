// Run against a local backend with a fresh temporary MONETA_DATA_DIR.
import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { randomUUID } from 'node:crypto';
import console from 'node:console';
import process from 'node:process';
import { chromium } from 'playwright';

const base = process.env.MONETA_E2E_URL ?? 'http://127.0.0.1:3048';
const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9q3AAAAABJRU5ErkJggg==',
  'base64',
);
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  timezoneId: 'Europe/Oslo',
  viewport: { width: 390, height: 844 },
});
const page = await context.newPage();
const ids = [];

try {
  for (const name of ['Test Alpha', 'Test Beta', 'Test Gamma']) {
    const id = randomUUID();
    ids.push(id);
    const upload = await context.request.put(`${base}/api/documents/${id}/file?source=upload`, {
      headers: { 'content-type': 'image/png' },
      data: png,
    });
    assert.equal(upload.status(), 201);
    const edit = await context.request.patch(`${base}/api/documents/${id}`, {
      data: { merchant: name },
    });
    assert.equal(edit.status(), 200);
  }

  page.on('dialog', function accept(dialog) {
    void dialog.accept();
  });
  await page.goto(base);
  await page.locator('.doc-row').filter({ hasText: 'Test Alpha' }).click();
  await page.getByRole('button', { name: 'Delete', exact: true }).click();
  await page.waitForURL(base + '/');
  await page.getByRole('button', { name: 'Undo' }).click();
  await page.locator('.doc-row').filter({ hasText: 'Test Alpha' }).waitFor();

  await page.getByRole('button', { name: 'Select documents' }).click();
  await page.getByRole('checkbox', { name: 'Select Test Beta' }).check();
  await page.getByRole('checkbox', { name: 'Select Test Gamma' }).check();
  await page.getByRole('button', { name: 'Delete selected' }).click();
  await page.getByText('2 documents deleted').waitFor();
  await page.goto(`${base}/settings/deleted`);
  await page.getByRole('heading', { name: 'Recently deleted' }).waitFor();
  await page
    .locator('.deleted-row')
    .filter({ hasText: 'Test Beta' })
    .getByRole('button', { name: 'Restore' })
    .click();
  await page
    .locator('.deleted-row')
    .filter({ hasText: 'Test Beta' })
    .waitFor({ state: 'detached' });
  await page
    .locator('.deleted-row')
    .filter({ hasText: 'Test Gamma' })
    .getByRole('button', { name: 'Delete now' })
    .click();
  await page
    .locator('.deleted-row')
    .filter({ hasText: 'Test Gamma' })
    .waitFor({ state: 'detached' });

  const active = await (await context.request.get(`${base}/api/documents`)).json();
  assert.deepEqual(new Set(active.items.map((doc) => doc.id)), new Set([ids[0], ids[1]]));
  assert.equal((await context.request.get(`${base}/api/documents/${ids[2]}`)).status(), 404);
  console.log(
    'Delete browser check passed: confirm, undo, selection, restore and permanent delete.',
  );
} finally {
  await browser.close();
}
