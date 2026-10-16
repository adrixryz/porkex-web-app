# Porkex — frontend

Personal finance tracker UI: Vue 3 (`<script setup>` + TypeScript), Vuetify 4, vue-router 4 and Chart.js.

## Requirements

- Node 24+ (Vitest 5 and jsdom's undici need it)
- The backend running on `http://localhost:3000` (see `../porkex-backend`, a sibling folder)

## Getting started

```bash
npm install
npm run dev
```

The dev server runs on `http://localhost:5173` and proxies `/api` and `/auth` to the backend (see `vite.config.ts`).

## Scripts

| Script | What it does |
| --- | --- |
| `npm run dev` | Dev server with hot reload |
| `npm run build` | Type-checks (`vue-tsc`) and builds to `dist/` |
| `npm run preview` | Serves the production build locally |
| `npm test` | Unit tests (`vitest run`) |
| `npm run test:watch` | Vitest in watch mode |
| `npm run test:coverage` | Unit tests with a coverage report |
| `npm run typecheck` | `vue-tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm run format` | Prettier |

## Structure

```
src/
  components/   TransactionDialog, AmountStepper (shared UI)
  composables/  useAsyncData (fetch state + cache), useSnackbar (shared toast state)
  plugins/      Vuetify instance (dark theme, component defaults), MDI SVG icon set
  router/       Routes and the auth guard
  utils/        api (auth + fetch + write queue), cache, outbox, connection, currency, date, color
  views/        Login, Dashboard, Transactions, Categories, Analytics, Budgets, Settings
  App.vue       Shell: app bar, navigation drawer, page transitions, status banners
  style.css     Global resets and shared utilities
```

Unit tests live next to the code they cover, as `*.spec.ts`.

## Offline behaviour

The API may be a cold instance, and a phone loses signal. Reads and writes are
handled separately, because they have different failure modes.

**Reads — cache first, network after (`utils/cache.ts`).** The last successful
response for each URL is kept in `localStorage` and painted immediately, while
the real request runs in the background and replaces it when it answers. A view
passes a `cacheKey` to `useAsyncData` to opt in; because the key can be a
function, each filter combination of the transaction list gets its own entry.
`App.vue` shows a banner while stale data is on screen, with different wording
for "no signal" and "the server is waking up".

The cache holds at most 12 entries (LRU) and skips any response over 256 KB. It
is wiped on logout along with the token, so financial figures never outlive the
session that produced them.

**Writes — queued and replayed (`utils/outbox.ts`).** A mutation that never
reached the server is stored and replayed on app start, on the browser's `online`
event, and after any write that got through. Reads are never queued. A 4xx is
not queued either: the server answered, so the payload is wrong rather than the
network, and it would fail identically on a retry. A 5xx is retried up to five
times and then dropped, so one bad write cannot block the queue.

Replays are safe because a transaction create gets a `clientId` **before the
first attempt** (`utils/api.ts`). If the server stores the row and the response
is lost, the replay carries the same id and the backend returns the existing row
instead of writing a second one. Generating the id at flush time would let that
duplicate through.

A queued write older than seven days is dropped on the next flush, and every
drop — rejected by the server or expired — raises a warning banner instead of
disappearing without a word. Only one tab replays the queue at a time: a
short-lived lock in `localStorage` keeps two tabs from racing each other. A
request that hangs past 45 seconds is treated as "never reached the server":
reads fall back to the cache and writes are queued.

A pending write is counted in a banner, not shown in the list: the table keeps
showing what the server last confirmed.

## Notes

- Amounts arrive from the API as decimal numbers. The backend stores them as
  whole cents so sums stay exact, so nothing on this side needs rounding.
- Dates are calendar days: the API stores them as UTC midnight and the app reads
  them back with UTC components (`utils/date.ts`), so a movement always shows on
  the day it was entered, wherever the device is. `createdAt` is a real instant
  and is displayed in local time. "Today" and the windows that depend on it
  (`/analytics`, `/budgets`) are anchored to the device's own calendar day with
  a `today` query parameter, so the day does not roll over mid-evening west of
  UTC.
- The currency setting only changes the symbol used for display; there is no
  conversion between currencies.
- Weeks start on Monday (see `utils/date.ts`).
- The access token is kept in `localStorage` and does not expire until you log out.
  Any `401` clears it and sends the user back to `/login`.
- `AnalyticsView` and `TransactionsView` mirror their filters into the URL query
  string, so views are bookmarkable and the browser Back button works.
- Icons are inline SVG from `@mdi/js`, not an icon font. To add one, import it
  and pass it as `:icon="mdiFoo"`. Vuetify's own internal icons come from the
  alias table in `plugins/mdiSvg.ts`.