# Moneta

Receipts and invoices in one archive: collected from maily, captured with the phone camera.

<table>
  <tr>
    <td align="center"><img src="assets/screenshots/archive.png" width="200" alt="Archive of recent receipts and invoices, photographed or imported from mail"></td>
    <td align="center"><img src="assets/screenshots/shops.png" width="200" alt="Shops tab listing every merchant with its document count"></td>
    <td align="center"><img src="assets/screenshots/receipt.png" width="200" alt="Starred receipt with amount, purchased item, tags and the original image"></td>
    <td align="center"><img src="assets/screenshots/invoice-dark.png" width="200" alt="Invoice in dark mode with due date, KID and account number ready to copy"></td>
  </tr>
  <tr>
    <td align="center"><sub>Archive</sub></td>
    <td align="center"><sub>Shops</sub></td>
    <td align="center"><sub>Receipt with original</sub></td>
    <td align="center"><sub>Invoice (dark mode)</sub></td>
  </tr>
</table>

<sub>Screenshots: Moneta 0.1.0 (commit <code>c8645e5</code>), taken 28 October 2026 with sample data.</sub>

## Development

```sh
nvm use            # Node 22+ locally; images run Node 24
npm install
cp .env.example .env
npm run dev        # tsc watch · backend http://localhost:3047 · web http://localhost:5173
npm run gate       # format → lint → build → typecheck → test (+ docker build if packaging changed)
```

## Layout

- `packages/core`: shared domain types and logic
- `apps/web`: React + Vite web app
- `backend`: Fastify API; serves the built web app in production

## Deployment

Pushing to `main` builds the image on Forgejo Actions, pushes it to `git.gjessing.io/gjessing1/moneta-backend`
and redeploys it on the host. Health check: `GET /api/health`.
