# UI conventions

Porkex keeps Vuetify as the rendering engine. `src/components/ui/` is a thin
application layer on top of it: it standardises the visual defaults and the
repeated composition/behaviour, without hiding Vuetify itself.

## Where global style lives

`src/plugins/vuetify.ts` owns the defaults that should apply everywhere:

- `VCard`: `surface` colour, `elevation: 1`, `rounded: xl`, border.
- `VBtn`: no elevation, the shared text style and `rounded: pill`.

The existing `.v-card.elevation-1` rule in `src/style.css` keeps cards flat
(hairline borders, no shadow), so the single change above updates every card.
Changing a global default or a wrapper is enough for all usages that do not
deliberately override it.

## Components

| Component          | Purpose                                                      | Main API / slots                                                                                                                                                                              |
| ------------------ | ------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `AppPage`          | Page container (`v-container` + max width/padding)           | default slot; attrs fall through                                                                                                                                                              |
| `AppPageHeader`    | Page title, subtitle and right-aligned actions               | `title`, `subtitle`, `#title`, `#actions`                                                                                                                                                     |
| `AppCard`          | Card shell with the standard header/body/actions composition | `title`, `subtitle`, `#header`, `#title`, `#header-actions`, default, `#actions`                                                                                                              |
| `AppEmptyState`    | Icon + title + description + actions for empty collections   | `icon`, `title`, `description`, `padding` (`8`/`10`/`12`), `#actions`                                                                                                                         |
| `AppStatCard`      | KPI/summary card with optional icon and caption              | `label`, `value`, `icon`, `color`, `labelClass`, `valueClass`, `caption`, `#value`, `#caption`                                                                                                |
| `AppButton`        | `v-btn` with the shared pill/no-elevation defaults           | default slot; all `v-btn` attrs                                                                                                                                                               |
| `AppIconButton`    | Icon-only button with a required accessible name             | `icon`, `label`, `size`, `variant`, `type`; all other `v-btn` attrs                                                                                                                           |
| `AppTextField`     | Text field that forwards Vuetify props and named slots       | all `v-text-field` attrs; named slots are forwarded                                                                                                                                           |
| `AppSelect`        | Select that forwards Vuetify props and named slots           | all `v-select` attrs; named slots are forwarded                                                                                                                                               |
| `AppDialog`        | Modal dialog with standard card/header/body                  | `v-model`, `title`, `maxWidth`, `persistent`, `closable`, `closeDisabled`, `contentClass`, `actionsClass`, `#title`, default, `#actions`, `close` event                                       |
| `AppConfirmDialog` | Centered destructive/simple confirmation                     | `v-model`, `title`, `message`, `confirmLabel`, `cancelLabel`, `color`, `icon`, `loading`, `maxWidth`, `persistent`, `confirmDisabled`, `cancelDisabled`, `#icon`, default, `confirm`/`cancel` |
| `AppSnackbar`      | The single app-wide snackbar host                            | mounted once in `App.vue`; use `useSnackbar().showSnack(message, color)`                                                                                                                      |

## Usage rules

1. Use `AppPage` and `AppPageHeader` in views instead of repeating
   `v-container` and the title row.
2. Use `AppCard` for normal cards. Keep `v-card-text`/`v-card-title` inside it
   only when the standard feed does not fit; prefer the wrapper slots.
3. Keep layout primitives raw (`v-row`, `v-col`, `v-icon`, `v-divider`). Do not
   wrap them just to rename them.
4. Keep `v-btn` children inside `v-btn-toggle` raw: Vuetify needs them for the
   group model and the existing pill CSS.
5. Use `AppButton`/`AppIconButton` everywhere else. `AppIconButton` requires a
   `label`, which becomes `aria-label`.
6. Use `AppTextField`/`AppSelect` for form controls. They keep Vuetify's
   default density and detail space; add `density="compact"` and/or
   `hide-details` only where the layout needs a denser field.
7. Use `AppDialog` for modal dialogs and `AppConfirmDialog` for confirmations.
   The dialog owns the close button, body padding and header border.
8. Transient notifications go through `useSnackbar().showSnack()`. Do not add
   another `v-snackbar` to a view. `UpdateNotice` and `UndoNotice` are
   intentional specialised snackbars and stay separate.
9. Override a shared style only at the call site when the exception is real.
   Otherwise change the global default or wrapper so the whole app follows.

## Attributes and slots

Wrappers use `inheritAttrs: false` + `v-bind="$attrs"` on the underlying
Vuetify component. This means normal Vuetify props/events/listeners continue to
work, and call-site attrs win over wrapper defaults. `AppTextField` and
`AppSelect` also forward named slots, so Vuetify patterns such as
`#append-inner`, `#selection` and `#item` keep working.

## Testing

Each wrapper has a focused spec under `src/components/ui/`. Domain specs keep
mounting the real wrappers; do not stub `App*` components in domain tests, or
the shared markup/behaviour would stop being exercised.

Run the full frontend validation after UI changes:

```bash
npm run typecheck
npm run check
npm test
npm run test:browser
npm run test:integration
npm run build
```

`npm run check` (format + lint) is deliberately separate from `vue-tsc`: Oxlint
does not type-check Vue SFC templates, so `npm run typecheck` is still required.
