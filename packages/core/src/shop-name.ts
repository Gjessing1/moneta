import type { ParseResult } from './document.js';

export interface ShopRename {
  from: string;
  to: string;
}

export function parseShopRename(body: unknown): ParseResult<ShopRename> {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return { ok: false, error: 'body must be a JSON object' };
  }
  const fields = Object.keys(body);
  if (fields.length !== 2 || !fields.includes('from') || !fields.includes('to')) {
    return { ok: false, error: 'provide only from and to' };
  }
  const values = body as Record<string, unknown>;
  if (typeof values.from !== 'string' || typeof values.to !== 'string') {
    return { ok: false, error: 'shop names must be text' };
  }
  const from = values.from.trim();
  const to = values.to.trim();
  if (from.length === 0 || to.length === 0 || from.length > 500 || to.length > 500) {
    return { ok: false, error: 'shop names must be 1 to 500 characters' };
  }
  if (from === to) {
    return { ok: false, error: 'enter a different shop name' };
  }
  return { ok: true, value: { from, to } };
}
