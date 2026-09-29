# Roadmap — Moneta

Open work only. **This file is committed to git**, so its history records what shipped and when.

**How to use this file**

- `[ ]` open · `[~]` partly shipped, and only the remainder is described.
- Sections are in priority order, and so are the items inside each one: the first open item is the
  next thing to do.
- **Delete an item when it ships**, in the same commit as the work. Before deleting, move any rule the
  code must keep following into [ARCHITECTURE.md](ARCHITECTURE.md).
- Each item states the outcome, any scope limits, and what's left. Put investigation notes in the
  commit or a design doc, not here.
- Nothing cites this file, and code never cites it. See [README.md](README.md).

## Inbox

Unsorted ideas and bugs. Triage them into a section below.

- [ ] Share target: "share PDF/photo to Moneta" from other Android apps (bank app, browser).
- [ ] Warranty reminder: flag receipts for electronics/appliances and surface them when the
      warranty (5 years for most goods under Norwegian consumer law) is about to run out.

---

## 1. Foundation — first deploy

- [ ] Add `/home/gjessing/data/moneta` to backups once it holds imported or captured documents.

## 2. Core — the smallest version worth using daily

- [ ] Settle the open decisions in [ARCHITECTURE.md](ARCHITECTURE.md#open-decisions) that block this
      section (import trigger, maily interface) and record them as `A`-entries.
- [ ] Data model: SQLite with a `documents` table (UUID, source `maily|camera|upload`, kind
      `invoice|receipt`, merchant, amount + currency, issued/due dates, payment facts, file path,
      source dedup key). Add `better-sqlite3` (see TEMPLATE notes on approving its install script).
- [ ] maily import: pull every message maily classifies as invoice/receipt, copy its document
      attachment into the data dir (A8), idempotent on the maily message + attachment id. A one-off
      backfill, then incremental. Works with maily down (it retries later, and the archive still
      serves).
- [ ] Archive UI: one list across sources, newest first, filters invoice/receipt and paid/unpaid,
      opens the original PDF/image.
- [ ] Camera capture (PWA): a big "capture" button that opens the rear camera, uploads the photo and
      files it as a receipt awaiting details. Manual entry of merchant/amount/date as the fallback.

## 3. Next

- [ ] Photo extraction: OCR the captured image, then fill amount/date/merchant with the same
      Norwegian/English parsers maily uses (shared, not copied). Mark guessed fields for review.
- [ ] Offline capture queue: photos taken without a network upload on reconnect.
- [ ] Search across merchant, amount, date and OCR/body text.
- [ ] Unpaid invoices view with due dates; mark as paid.
- [ ] Export a date range: ZIP of originals + CSV.

## Later / maybe

- [ ] Android app: Capacitor shell with camera and share target (see [ANDROID.md](ANDROID.md)).
- [ ] PWA install + offline shell (`vite-plugin-pwa`).
- [ ] Link from a Moneta item back to the message in maily (maily deep links use its internal UUID).
