import { fileURLToPath, URL } from 'node:url'
// From vitest/config, not vite: it re-exports defineConfig with the `test` key typed.
import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import vuetify from 'vite-plugin-vuetify'
import { VitePWA } from 'vite-plugin-pwa'

// In local development, and for `vite preview`, the app is built without
// VITE_API_BASE so it calls a relative /api. Both servers forward that to the
// backend, which keeps the browser on a single origin and makes CORS a
// non-issue. A deployed build sets VITE_API_BASE instead and talks to the API
// host directly, so the deployed backend has to allow this origin in
// CORS_ORIGINS.
const apiProxy = {
  '/api': {
    target: 'http://localhost:3000',
    changeOrigin: true
  },
  '/auth': {
    target: 'http://localhost:3000',
    changeOrigin: true
  }
}

export default defineConfig({
  plugins: [
    // Public root URLs are served verbatim. Importing them as modules also
    // produces invalid file:/// URLs in the Windows test runner.
    vue({ template: { transformAssetUrls: { includeAbsolute: false } } }),
    vuetify({ autoImport: true }),
    // Installable app with an offline shell. The service worker precaches the
    // built assets only: API responses are deliberately left out, because the
    // app already has its own read cache (stale-while-revalidate) and write
    // outbox, and a second, invisible cache layer would fight with them.
    VitePWA({
      registerType: 'prompt',
      injectRegister: false,
      manifest: {
        name: 'Porkex',
        short_name: 'Porkex',
        description: 'Personal finance tracker',
        display: 'standalone',
        start_url: '/',
        theme_color: '#000000',
        background_color: '#000000',
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'maskable-icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        // Deep links (e.g. /transactions) must open the app shell offline.
        navigateFallback: '/index.html',
        cleanupOutdatedCaches: true
      }
    })
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
  server: {
    port: 5173,
    proxy: apiProxy
  },
  preview: {
    port: 4173,
    // Without this, `npm run preview` builds without VITE_API_BASE and then has
    // nowhere to send /api, which makes it useless for checking a build locally.
    proxy: apiProxy
  },
  test: {
    // Vuetify renders real DOM, so the tests need a browser-like environment.
    environment: 'jsdom',
    globals: false,
    include: ['src/**/*.spec.ts'],
    // CI runners are small and shared: capping the workers keeps memory bounded.
    // Locally the default (one per core) stays, since it is faster.
    ...(process.env.CI ? { maxWorkers: 2 } : {}),
    server: {
      deps: {
        // Vuetify ships untranspiled ESM that Vitest cannot load directly.
        inline: ['vuetify']
      }
    }
  }
})
