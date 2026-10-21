import 'vuetify/styles'
import { createVuetify } from 'vuetify'
import { aliases, mdi } from './mdiSvg'

// Vercel-inspired dark theme: pure black canvas, #0a0a0a surfaces,
// hairline borders, blue/green/red semantic accents.
//
// Components and directives are NOT registered here on purpose. vite-plugin-vuetify
// (autoImport, see vite.config.ts) already resolves the ones used in the
// templates, so listing them by hand with `import * as components` would ship
// all ~97 of them — including v-calendar, v-data-table and v-timeline, which this
// app never renders.
//
// The icons cast exists only because Vuetify types a custom icon set as a JSX
// component, which its own iconsets satisfy by shipping untyped .js files. The
// type is derived from createVuetify itself rather than imported from Vuetify's
// internals; mdiSvg.spec.ts mounts a real VIcon and checks the rendered <path>.
type VuetifyOptions = NonNullable<Parameters<typeof createVuetify>[0]>

export default createVuetify({
  icons: {
    defaultSet: 'mdi',
    aliases,
    sets: {
      mdi
    }
  } as VuetifyOptions['icons'],
  theme: {
    defaultTheme: 'dark',
    themes: {
      dark: {
        dark: true,
        colors: {
          background: '#000000',
          surface: '#0a0a0a',
          'surface-bright': '#3c3c3c',
          'surface-variant': '#111111',
          primary: '#0070f3',
          'on-primary': '#ffffff',
          secondary: '#ededed',
          'on-secondary': '#000000',
          error: '#e5484d',
          'on-error': '#ffffff',
          success: '#00c853',
          // White like on-error: filled success buttons otherwise render
          // their label in a dark green that reads poorly on #00c853.
          'on-success': '#ffffff',
          warning: '#f5a623',
          'on-warning': '#3d2a00',
          info: '#0070f3',
          'on-background': '#ededed',
          'on-surface': '#ededed',
          'on-surface-variant': '#a1a1a1',
          outline: '#2e2e2e',
          'outline-variant': '#1f1f1f'
        }
      }
    }
  },
  defaults: {
    VCard: {
      color: 'surface',
      elevation: 1,
      rounded: 'xl',
      border: true
    },
    VBtn: {
      elevation: 0,
      style: 'text-transform: none; letter-spacing: normal; font-weight: 500;',
      rounded: 'pill'
    },
    VTextField: {
      variant: 'outlined',
      color: 'primary',
      rounded: 'pill'
    },
    VSelect: {
      variant: 'outlined',
      color: 'primary',
      rounded: 'pill'
    }
  }
})
