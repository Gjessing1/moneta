# Roadmap — Moneta

Open work only. **This file is committed to git**, so its history records what shipped and when.

**How to use this file**

- `[ ]` open · `[~]` partly shipped, and only the remainder is described.
- Sections are in priority order, and so are the items inside each one: the first open item is the
  next thing to do.
- **Delete an item when it ships**, in the same commit as the work. Before deleting, move any rule
  the code must keep following into [ARCHITECTURE.md](ARCHITECTURE.md).
- Each item states the outcome, any scope limits, and what's left. Put investigation notes in the
  commit or a design doc, not here.
- Nothing cites this file, and code never cites it. See [README.md](README.md).
- **Web and Android have the same features.** From section 3 on, a user-visible item is done only
  when it has been verified in a browser _and_ in the APK on the emulator.

## Inbox

Unsorted ideas and bugs. Triage them into a section below.

- Drop `paidAt` from `ArchiveDocument` and the document API: Moneta doesn't track payments. The
  `paid_at` column stays, because migrations are append-only and additive.

---

## 1. Foundation: storage and the maily contract

Nothing here is visible to users. It fixes the decisions everything else builds on.

- [ ] Document API: `PUT /api/documents/:uuid/file` (idempotent, A12), `GET /api/documents` (paged,
      filtered), `GET /api/documents/:id`, `PATCH /api/documents/:id`, `DELETE` (soft delete that
      can be undone for 30 days), and `GET /api/documents/:id/file/:n` streamed from the data dir.
- [ ] Add `/home/gjessing/data/moneta` to the nightly backups (SQLite via `.backup`, originals as
      files) and write down how in DEPLOYMENT.md. This must be done before the first real document
      is stored.

## 2. Core archive: the smallest version worth using daily (web)

- [ ] Archive list (the Recent view): one list across all sources, newest first, grouped by month.
      Each row shows merchant (or what was bought, once named), amount, date, kind and source, and
      the list scrolls smoothly past a few thousand items.
- [ ] Document view: the original rendered inline (PDF pages and images, pinch zoom on the phone),
      the facts beside or below it, and a Source block that says where it came from (sender and
      date, with a link that opens the mail in maily) and that the original is stored in Moneta
      (file name, size, date saved). Download or share the original.
- [ ] Edit details: one form for every field, plus an optional "what you bought" field (searchable,
      shown in the Warranty view). Fields read from mail or OCR carry a marker until saved (the
      `guessed` list).
- [ ] Delete and restore: delete from the document (with a confirmation) or from a multi-select,
      then an undo bar. Settings › Recently deleted lists them with Restore and "Delete now"; they
      are purged after 30 days. A deleted maily document is never imported again.
- [ ] Manual upload: pick or drop one or more PDFs/images and file them. On desktop this is the
      fallback for anything maily missed.
- [ ] Camera capture: the Capture tab opens the rear camera in one tap (`capture="environment"`).
      The photo is saved as a receipt awaiting details, and a short form (merchant, amount, date)
      can be filled in then or later. Multi-page capture appends pages to the same document.
- [ ] maily import (A13, A14): settle the body-only receipt decision first. Backfill every message
      maily classifies as an invoice or receipt, then run incrementally. The document attachment is copied into the data dir (A8), and the job is
      idempotent on the dedup key. When maily is down, the job logs it, retries later, and the
      archive keeps serving. Settings shows the last import time and any error.

## 3. Android app: same features, from here on

The shell goes in now, before the list of features grows, so every later item is built and verified
on both surfaces from the start. See [ANDROID.md](ANDROID.md).

- [ ] Capacitor shell (`android/`, `io.gjessing.moneta`): first-launch server URL prompt, SSO login
      inside the WebView, back button through web history, system bars/insets, app icon. Check that
      the search field docked at the bottom rises above the keyboard (the web app sets
      `interactive-widget=resizes-content`; the activity needs `adjustResize`). Camera
      capture and upload from section 2 work unchanged inside it.
- [ ] Caddy: exempt the PWA assets and `/api/app/{version,download}` from SSO (A11). This edits
      shared host infrastructure, so ask first, then reload Caddy.
- [ ] Release pipeline: keystore at `~/.config/moneta/keystore.env`, `/api/app/version` and
      `/api/app/download` served from `MONETA_DATA_DIR/app/`, and `scripts/release-android.sh`
      modelled on nodecal's (build signed → publish → check live version → download → compare
      SHA-256). Settings › Updates shows the web version and the APK version, an Update button when a
      newer APK is published, and "Check for updates"; the web app also notices a newer deploy
      (`/api/health` gitSha) and offers a reload. In a normal browser Settings links to the APK
      download instead.
- [ ] Share target: "Share → Moneta" for PDFs and images from any app (one or many files) lands in
      the capture flow, pre-filled with the file name. Native code only hands over bytes (A11).
- [ ] Launcher shortcut: long-press the icon → "Capture receipt", which opens straight into the
      camera.
- [ ] Android e2e harness in `apps/android/e2e/` on the `atlas_test` AVD: launch, log in, capture
      (emulated camera), share a PDF in, and see both in the archive. Write its README first.

## 4. Find

- [ ] Search: one box (bottom of the screen on the phone) across merchant, what was bought, notes, amounts ("499", "499,50"), dates ("mars 2026") and the
      document text (the PDF text layer, maily's body text, OCR text once section 5 lands). Uses
      SQLite FTS5; results arrive while typing.
- [ ] Filters: kind, source, shop, date range and amount range, as chips above the search box.
      Filters are stored in the URL, so a filtered view can be bookmarked or shared to the app.
- [ ] Shops view: every merchant with its document count and latest date, most used first, then A
      to Z. Opening one lists its documents.
- [ ] Tags/categories: a free-form tag per document (e.g. `bolig`, `bil`, `jobb`), filterable, with
      suggestions from the merchant's earlier tags. The Tags view lists them with counts; Settings ›
      Tags renames, merges and removes them.
- [ ] Select several: long-press enters select mode; tag, export or delete the selection.

## 5. Capture quality

- [ ] Offline capture queue (A12): a service worker caches the app shell, and captures and shares
      made with no network queue in IndexedDB, show as "waiting to upload", and upload on reconnect.
      Verify in airplane mode in the browser and in the APK.
- [ ] Photo extraction: settle the OCR decision (tesseract in the image vs an Ollama vision model),
      then fill amount/date/merchant/org number with maily's Norwegian/English parsers (shared, not
      copied). Guessed fields are marked until they are confirmed.
- [ ] Image cleanup on capture: auto-crop to the paper, deskew, and compress to a sane size, keeping
      the original only when cleanup fails.
- [ ] Duplicate hints: flag a captured receipt that probably matches a mailed one (see the open
      decision), and let me merge them or dismiss the hint.

## 6. Export and retention

- [ ] Export: pick a date range (plus the current filters) and get a ZIP with the originals, named
      `YYYY-MM-DD merchant amount.ext`, and a CSV of the facts. On Android the ZIP goes to the
      system share sheet or Downloads.
- [ ] Warranty: mark a receipt as a warranty item (default 5 years for goods under Norwegian
      consumer law, 2 for cheap items, set in Settings). The Warranty view lists items by what was
      bought, covered ones by end date, then expired ones.

## Later / maybe

- [ ] Yearly overview: spend per tag/merchant per month, for the tax season.
