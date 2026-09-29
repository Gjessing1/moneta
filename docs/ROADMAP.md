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

- [ ] …

---

## 1. Foundation — first deploy

- [ ] Fill in [VISION.md](VISION.md): the problem, core features, non-goals.
- [ ] Record the first decisions in [ARCHITECTURE.md](ARCHITECTURE.md): data model and auth model.
- [ ] `scripts/host-setup.sh` + `scripts/forgejo-setup.sh --push`. CI goes green and
      `/api/health` on the host reports the pushed commit.
- [ ] Caddy site + SSO decision; reachable at `https://moneta.gjessing.io`.
- [ ] Add the data dir to backups if it holds anything that can't be recreated.

## 2. Core — the smallest version worth using daily

- [ ] …

## 3. Next

- [ ] …

## Later / maybe

- [ ] Android app (see [ANDROID.md](ANDROID.md)).
- [ ] PWA install + offline shell (`vite-plugin-pwa`).
