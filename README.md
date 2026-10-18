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
| `npm run icons` | Regenerates the PWA icons from `public/porkex-icon.svg` |

## Structure

```
src/
  components/   TransactionDialog, RecurringDialog, AmountStepper (shared UI)
  composables/  useAsyncData (fetch state + cache), useSnackbar (shared toast state)
  plugins/      Vuetify instance (dark theme, component defaults), MDI SVG icon set
  router/       Routes and the auth guard
  utils/        api (auth + fetch + write queue), cache, outbox, connection, currency, date, preferences, recurring, color
  views/        Login, Dashboard, Transactions, Recurring, Categories, Analytics, Budgets, Settings
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
for an offline device and data that could not be refreshed.

The cache holds at most 12 recent responses and skips any response over 256 KB. It
is wiped on logout along with the token, so financial figures never outlive the
session that produced them.

**Writes — queued and replayed (utils/outbox.ts).** A network failure or timeout
leaves the server outcome uncertain; the mutation is persisted for retry on app
start or recovery. Reads are never queued. A direct HTTP error stays visible
for the user to correct/retry. Already queued changes are retained on transient
server failures and retried by recovery; a permanent rejection pauses the queue
until the user chooses Retry or Discard.

Replays are safe because a transaction or recurring-rule create gets a `clientId`
**before the first attempt** (`utils/api.ts`). If the server stores the row and the
response is lost, the replay carries the same id and the backend returns the
existing row instead of writing a second one. Generating the id at flush time
would let that duplicate through.

Pending changes are kept until confirmed or explicitly discarded. Web Locks
serialize all writes across tabs, while a separate short lock protects changes
to the stored queue. Every replay re-reads storage and updates only its own ID.
Older changes are sent first. A rejected operation blocks later changes and the
existing warning offers Retry/Discard; only DELETE treats 404 as completed.

A 202 means saved on this device, pending synchronization. Failed persistence
(quota, damaged storage, unavailable safe locking) keeps the form open and
reports an error. Creates reuse the form's clientId on retry. Password changes
are never queued. A 401 or logout keeps pending changes owned by their account;
unverified older queues remain blocked until their original owner is verified.

Confirmed direct writes and replays invalidate read caches and refresh visible
queries without remounting forms. Filters load their own cache and obsolete
responses cannot replace current data. Visible-app recovery groups resume and
connection events, retries transient failures after 5/15/30/60 seconds, and
checks for a changed local day or timezone without polling API data.

A pending write is counted in a banner, not shown in the list: the table keeps
showing what the server last confirmed.

## PWA

The app is installable (Android: "Install app"; iOS: Share → Add to Home
Screen) and opens offline. `vite-plugin-pwa` generates the manifest and a
service worker that precaches the built assets and answers any navigation with
`index.html`, so the shell loads with no network; the data itself then comes
from the read cache and the outbox above. The worker never caches API
responses — that is `utils/cache.ts`'s job.

Updates use a prompt (Update/Later). The new worker stays waiting until the user
accepts. A modified form, form submission or API write disables Update; a worker
activated by another tab cannot reload an unfinished form. Stale bundle loading
errors offer the same update action and never reload automatically. Passwords
and form drafts are never persisted for an update.

The icons are generated from `public/porkex-icon.svg` (white pig on a black
tile) with the official generator and committed, so a normal build needs
nothing extra:

```bash
npm run icons
```

That writes `pwa-*.png`, `maskable-icon-512x512.png`,
`apple-touch-icon-180x180.png` and `favicon.ico` into `public/` (preset and
black background in `pwa-assets.config.ts`).

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
- Settings holds four account preferences (`utils/preferences.ts`): currency,
  default period, first day of the week and decimal separator. They are mirrored
  in `localStorage` for an instant, offline-safe paint and synced from the
  account on login and on the profile load, so they follow the user to any
  browser. The default period is the filter `TransactionsView` and
  `CategoriesView` open with (the URL query still wins on transactions); the
  first day of the week anchors every weekly range (including the weekly budget
  window in the backend, sent as `weekStart`); and the decimal separator only
  changes how amounts are rendered (`formatMoney`), never how they are stored or
  typed.
- Requests include the browser IANA zone in `X-Porkex-Time-Zone`. An explicit
  recurring pending/failed response warns that totals may be incomplete and
  schedules recovery while the app is visible.
- Recurring rules are the backend's job: it turns due occurrences into normal
  transactions, so this side only manages the rules (`/recurring`) and marks the
  movements they generated with a repeat icon in `TransactionsView`.
- Weeks start on the configured first day of the week (Monday by default, see
  `utils/preferences.ts` and `utils/date.ts`); the weekly budget window follows
  the same setting.
- The access token is kept in `localStorage` and does not expire until you log out.
  Any `401` clears it and sends the user back to `/login`.
- `AnalyticsView` and `TransactionsView` mirror their filters into the URL query
  string, so views are bookmarkable and the browser Back button works.
- Icons are inline SVG from `@mdi/js`, not an icon font. To add one, import it
  and pass it as `:icon="mdiFoo"`. Vuetify's own internal icons come from the
  alias table in `plugins/mdiSvg.ts`.
Registration is closed by default on the API. Login reads `/auth/config` and
shows Sign Up only when explicitly enabled; an unavailable configuration keeps
signup hidden without preventing an existing account from logging in.

## Reliability verification

Use Node 24 (the CI runtime), then run:

~~~sh
npm ci
npm run lint
npm run typecheck
npm test
npm run build
npx playwright install chromium
npm run test:browser
~~~

Browser tests build a production PWA with an empty API origin and a controlled
local server. They cover desktop Chromium and Pixel 7 Android emulation, offline
reload/replay, storage quota, rejected changes, slow writes from two tabs, URL
history, registration and a real waiting service worker. Failure traces are
kept under test-results (ignored by Git). No production API is contacted.

Accepted PWA updates also observe the waiting worker's activation directly:
Workbox can omit its reload callback when registration started without a
controller. The regression exercises that classification with a real worker;
drafts and active writes still block reload, and duplicate activation callbacks
are handled once.

With the backend checked out beside this repository and its dependencies
installed, run npm run test:integration. PORKEX_BACKEND_DIR may override that
path. The backend harness forces an isolated temporary SQLite database and
clears inherited Turso credentials. The browser server only proxies an explicit
localhost API, verifies one offline replay against real persisted data, and
cleans up the API and temporary database after the browser processes exit.

These local checks do not validate a deployed Render/Turso installation or a
physical Android device. Those checks remain manual after your review/deploy.

La matriz de los 23 puntos y sus límites de validación está en [RELIABILITY_REVIEW.md](RELIABILITY_REVIEW.md).

Tags are managed from Edit tags inside movement dialogs: create, rename, confirm global deletion and drag the handle (or use arrow keys) to save manual order. Movements allow 0–5 tags and an optional Comment. The desktop table and shared compact summary render the same catalog; pending catalog operations remain available offline. The API still accepts legacy description payloads.

Deleting a movement offers Deshacer for 8 seconds. Scheduled deletions are stored separately until expiry, grouped while the window is open, and then copied idempotently into the normal outbox under Web Locks. Navigation, reload and offline recovery preserve them; no replacement movement is created. Confirmed totals refresh after the actual DELETE.

Undo shows a busy state until its cancellation is persisted. A click within the
eight-second window targets only the scheduled IDs visible at that click, even
if another tab delays the storage lock. It never reverses a published DELETE
or cancels deletions added afterward. Browser tests await this local persistence
before full navigation: an unchanged server row alone cannot acknowledge Undo.

Recurring rules offer Skip next and Edit next for an exact scheduled date. The next-only editor reuses the movement fields with a read-only date and 0–5 tags. A conflict stays visible rather than silently affecting a later date; ordinary edits retain the rule schedule and base values.

Analytics includes Year vs year and Week vs week comparisons, using equal elapsed calendar portions for the current period. Income, expenses and balance have paired totals/deltas and a two-series chart. Comparison controls preserve months/days URL parameters and browser history, respect week-start preference, and show zero-base/no-data states explicitly.

La matriz de las nuevas funcionalidades, pruebas, commits y límites de validación está en [FEATURES_REVIEW.md](FEATURES_REVIEW.md).
