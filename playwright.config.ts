import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests/browser',
  testMatch: process.env.PORKEX_TEST_API_ORIGIN
    ? ['integration.spec.ts', 'fullBackup.integration.ts', 'release110.integration.ts']
    : ['recovery.spec.ts', 'release.spec.ts'],
  fullyParallel: false,
  workers: 1,
  timeout: 35_000,
  expect: { timeout: 8_000 },
  use: { baseURL: 'http://localhost:4178', timezoneId: 'America/Lima', trace: 'retain-on-failure' },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'android', use: { ...devices['Pixel 7'], defaultBrowserType: 'chromium' } }
  ],
  webServer: {
    command: 'node tests/browser/server.mjs',
    url: 'http://localhost:4178',
    reuseExistingServer: false,
    timeout: 120_000
  }
})
