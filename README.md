# Porkex — Frontend

Porkex v1.0.0 is a personal finance tracker for accounts, savings goals, income, expenses, categories, weekly/monthly/yearly budgets and recurring payments, with charts to follow your spending. It works in a PC browser and as an installable Android PWA, with offline recovery and synchronization. Settings supports transaction CSV imports/exports and full account-data JSON backups/restores.

Built with Vue 3, TypeScript and Vuetify. The API is maintained in [porkex-backend](https://github.com/adrixryz/porkex-backend).

## Run locally

Use Node 26.12.1 (see `.node-version`), or a compatible patched Node 24.22.1+, and start the backend on port 3000 first.

```bash
npm ci
npm exec -- vp dev
```

Open [localhost:5173](http://localhost:5173). For a separate API host, copy [.env.example](.env.example) to `.env` and set `VITE_API_BASE` before building.

## Production build

```bash
npm exec -- vp run build
npm exec -- vp preview
```

Publish `dist/` as a static site with HTTPS and rewrite application routes to `/index.html` (Render: `/*` → `/index.html`). Set `VITE_API_BASE` to the backend origin before building and allow the frontend origin in the backend's `CORS_ORIGINS`. Never put secrets in `VITE_*` variables. Deploy the matching frontend and backend revisions together; `vp preview` is for local preview, not production hosting.
