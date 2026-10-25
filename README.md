# Porkex — Frontend

Porkex is a personal finance tracker for income, expenses, categories, budgets and recurring payments, with charts to follow your spending. It works in a PC browser and as an installable Android PWA, with offline recovery and synchronization.

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
