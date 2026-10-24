import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

/**
 * Unit-test configuration.
 *
 * These tests target the pure crypto helpers (no browser, no server), so they
 * run in the `node` environment. The Playwright end-to-end specs live in
 * `tests/e2e` and are run separately (`npm run test:e2e`).
 */
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['tests/unit/**/*.test.ts'],
    // age's scrypt KDF is deliberately slow (~1s per operation); give each
    // test plenty of headroom.
    testTimeout: 30_000,
  },
})
