import assert from 'node:assert/strict';
import process from 'node:process';
import { chromium } from '/work/node_modules/playwright/index.mjs';

const base = process.env.MONETA_E2E_URL ?? 'http://127.0.0.1:3051';
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    timezoneId: 'Europe/Oslo',
  });
  await page.goto(base);
  await page.getByRole('heading', { name: 'September 2026' }).waitFor();
  assert.equal(await page.getByRole('slider', { name: 'Jump to month' }).count(), 1);
  await page.getByRole('slider', { name: 'Jump to month' }).click({ position: { x: 12, y: 250 } });
  await page.getByRole('heading', { name: 'January 2024' }).waitFor({ state: 'visible' });
  assert.match(page.url(), /to=2024-01-31/);
  assert.equal(await page.getByRole('slider', { name: 'Jump to month' }).count(), 1);

  await page.getByRole('button', { name: 'Clear' }).click();
  await page.getByLabel('Source').selectOption('upload');
  await page.getByRole('heading', { name: 'July 2026' }).waitFor();
  assert.equal(await page.getByRole('heading', { name: 'September 2026' }).count(), 0);
  assert.match(page.url(), /source=upload/);

  await page.getByRole('button', { name: 'Clear' }).click();
  await page.getByLabel('Jump to / through').fill('2025-12-31');
  await page.getByRole('heading', { name: 'February 2025' }).waitFor();
  assert.equal(await page.getByRole('heading', { name: 'September 2026' }).count(), 0);

  await page.getByRole('button', { name: 'Clear' }).click();
  await page.getByLabel('Order').selectOption('oldest');
  await page.getByRole('heading', { name: 'January 2024' }).waitFor();
  assert.equal(await page.locator('.month__title').first().textContent(), 'January 2024');

  await page.getByRole('link', { name: 'Shops', exact: true }).click();
  await page.getByRole('link', { name: /Shop One/ }).click();
  await page.getByRole('button', { name: 'Rename shop' }).click();
  await page.getByLabel('Name for all documents from this shop').fill('Shop Two');
  await page.getByRole('button', { name: 'Save name' }).click();
  await page.getByRole('heading', { name: 'Shop Two' }).waitFor();
  await page.getByRole('link', { name: 'Shops', exact: true }).click();
  const merged = await page.getByRole('link', { name: /Shop Two/ }).textContent();
  assert.match(merged ?? '', /4/);
  assert.equal(await page.getByRole('link', { name: /Shop One/ }).count(), 0);
} finally {
  await browser.close();
}
