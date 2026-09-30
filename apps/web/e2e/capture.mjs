// Run against a local backend with a fresh temporary MONETA_DATA_DIR.
import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import console from 'node:console';
import process from 'node:process';
import { chromium } from 'playwright';

const base = process.env.MONETA_E2E_URL ?? 'http://127.0.0.1:3048';
const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9q3AAAAABJRU5ErkJggg==',
  'base64',
);
const secondPng = Buffer.concat([png, Buffer.from('second page')]);
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ timezoneId: 'Europe/Oslo' });
const page = await context.newPage();

try {
  await page.goto(`${base}/capture`);
  const uploads = page.getByRole('button', { name: /Upload files/ });
  const fileChooser = page.waitForEvent('filechooser');
  await uploads.click();
  await (
    await fileChooser
  ).setFiles([
    { name: 'first.png', mimeType: 'image/png', buffer: png },
    { name: 'second.png', mimeType: 'image/png', buffer: secondPng },
  ]);
  await page.getByRole('button', { name: 'File 2 documents' }).click();
  await page.getByRole('status').getByText('Filed 2 documents.').waitFor();

  let list = await (await context.request.get(`${base}/api/documents`)).json();
  assert.equal(list.items.length, 2);
  assert.ok(list.items.every((item) => item.source === 'upload'));

  const cameraChooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: /Photograph a receipt/ }).click();
  await (await cameraChooser).setFiles({ name: 'page1.png', mimeType: 'image/png', buffer: png });
  assert.equal(await page.locator('input[capture]').getAttribute('capture'), 'environment');
  const nextChooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: /Add another page/ }).click();
  await (
    await nextChooser
  ).setFiles({ name: 'page2.png', mimeType: 'image/png', buffer: secondPng });
  await page.getByRole('textbox', { name: 'Shop' }).fill('Test shop');
  await page.getByRole('textbox', { name: 'Amount (NOK)' }).fill('49,50');
  await page.getByLabel('Date').fill('2026-09-29');
  await page.getByRole('button', { name: 'File document' }).click();
  await page.waitForURL(/\/d\/[a-f0-9-]+$/);

  list = await (await context.request.get(`${base}/api/documents`)).json();
  assert.equal(list.items.length, 3);
  const receipt = list.items.find((item) => item.source === 'camera');
  assert.equal(receipt.merchant, 'Test shop');
  assert.equal(receipt.amountMinor, 4950);
  assert.equal(receipt.issuedOn, '2026-09-29');
  const detail = await (await context.request.get(`${base}/api/documents/${receipt.id}`)).json();
  assert.equal(detail.files.length, 2);
  assert.deepEqual(
    detail.files.map((file) => file.position),
    [0, 1],
  );
  console.log('Capture browser check passed: two uploads and a two-page camera receipt.');
} finally {
  await browser.close();
}
