# Capture browser check

This check files synthetic images into a **temporary** backend. It verifies that a batch upload
creates separate documents, the camera picker appends two pages to one receipt, entered details
appear on the document, editing saves invoice facts, and a single upload can be filled in before
filing. It runs at phone width. Do not point it at the deployed backend.

From the repo root, after `npm run build`, use a free local port (3048 in this example):

```sh
MONETA_DATA_DIR="$(mktemp -d)" MONETA_WEB_ROOT="$PWD/apps/web/dist" \
  PORT=3048 HOST=127.0.0.1 node backend/dist/index.js
```

In another terminal, with the Playwright image and a matching `playwright` installation:

```sh
docker run --rm --network host -v "$PWD":/work \
  -v /home/gjessing/projects/atlas/node_modules:/work/node_modules:ro -w /work \
  mcr.microsoft.com/playwright:v1.61.1-noble node apps/web/e2e/capture.mjs
```

The test expects an empty database and uses filenames and document facts prefixed with `Test`.
