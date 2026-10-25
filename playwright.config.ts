import { defineConfig, devices } from '@playwright/test'

const PORT = Number(process.env.E2E_PORT || 3100)
const BASE_URL = `http://127.0.0.1:${PORT}`

/**
 * End-to-end tests run the real Next.js app against the in-memory mock
 * backend (`FILE_BACKEND=mock`), so no GitHub credentials or network access
 * are required. A separate build directory is used to avoid clashing with a
 * developer's running `next dev`.
 *
 * The `chrome` channel is used so the tests exercise the locally installed
 * Google Chrome instead of requiring a Playwright browser download. On a
 * machine without Chrome, run `npx playwright install chromium` and remove
 * `channel: 'chrome'`.
 */
export default defineConfig({
  testDir: './tests/e2e',
  timeout: 60_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['list']] : [['list']],
  use: {
    ...devices['Desktop Chrome'],
    channel: 'chrome',
    baseURL: BASE_URL,
    headless: true,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: `npm run dev -- -p ${PORT}`,
    url: BASE_URL,
    timeout: 180_000,
    reuseExistingServer: false,
    stdout: 'pipe',
    stderr: 'pipe',
    env: {
      FILE_BACKEND: 'mock',
      NEXT_DIST_DIR: '.next-e2e',
      AUTH_SECRET: 'e2e-test-secret-not-used-for-real-auth',
      AUTH_URL: BASE_URL,
      NEXTAUTH_URL: BASE_URL,
      GITHUB_CLIENT_ID: 'e2e-dummy-client-id',
      GITHUB_CLIENT_SECRET: 'e2e-dummy-client-secret',
      GITHUB_APP_ID: '1',
    },
  },
})
