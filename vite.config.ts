import { fileURLToPath, URL } from 'node:url'
// From vitest/config, not vite: it re-exports defineConfig with the `test` key typed.
import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import vuetify from 'vite-plugin-vuetify'

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
    vue(),
    vuetify({ autoImport: true })
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
