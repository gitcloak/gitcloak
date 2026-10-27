import { test as base, expect, type APIRequestContext, type Page } from '@playwright/test'

/**
 * Shared fixtures/helpers for the end-to-end suite.
 *
 * Every test starts with a clean mock backend thanks to the `beforeEach` hook
 * below, then drives the real UI rendered by `next dev` with
 * `FILE_BACKEND=mock`.
 */
export const test = base.extend<{ resetBackend: void }>({
  resetBackend: [
    async ({ request }: { request: APIRequestContext }, use) => {
      const response = await request.post('/api/test/reset')
      expect(response.ok(), 'mock backend reset should succeed').toBeTruthy()
      await use()
    },
    { auto: true },
  ],
})

export { expect }

/**
 * Navigate to the authenticated app and wait until it is hydrated and the
 * repository status check has resolved.
 */
export async function gotoApp(page: Page): Promise<void> {
  await page.goto('/app')
  await page.getByTestId('repo-selector').waitFor({ state: 'visible' })
  // FileTree exposes this global once it mounts; use it as a hydration gate.
  await page.waitForFunction(
    () => typeof window.__fileTreeRefresh === 'function'
  )
  await expect(page.getByTestId('repo-lock-status')).not.toHaveAttribute(
    'data-repo-status',
    'checking'
  )
}

/** Switch the selected repository through the repository dropdown. */
export async function selectRepo(page: Page, fullName: string): Promise<void> {
  await page.getByTestId('repo-selector').click()
  await page.locator(`[data-testid="repo-option"][data-repo="${fullName}"]`).click()
  await expect(page.getByTestId('repo-selector')).toHaveAttribute(
    'data-repo',
    fullName
  )
  await expect(page.getByTestId('repo-lock-status')).not.toHaveAttribute(
    'data-repo-status',
    'checking'
  )
}

/** Click a node in the file tree by its repository-relative path. */
export async function clickFileNode(page: Page, path: string): Promise<void> {
  await page.locator(`[data-testid="file-node"][data-path="${path}"]`).click()
}

/**
 * Click a node by the name it shows. Locked repositories show stored
 * (encrypted) names, so use the stored path there instead.
 */
export async function clickFileByName(page: Page, name: string): Promise<void> {
  await page.locator(`[data-testid="file-node"][data-name="${name}"]`).click()
}

/** Stored path of the file the tree shows as `name` (valid while names are decrypted). */
export async function storedPathOf(page: Page, name: string): Promise<string> {
  const node = page.locator(`[data-testid="file-node"][data-name="${name}"]`)
  await expect(node).toBeVisible()
  return (await node.getAttribute('data-path')) as string
}

/** Wait for the editor to contain a specific file and value. */
export async function expectEditor(
  page: Page,
  path: string,
  valueMatcher?: string | RegExp
): Promise<void> {
  await expect(page.getByTestId('selected-file-path')).toHaveText(path)
  if (valueMatcher !== undefined) {
    await expect(page.getByTestId('editor-input')).toHaveValue(valueMatcher)
  }
}

/** Fill and submit a password dialog by its test id prefix. */
export async function submitPassword(
  page: Page,
  testId: string,
  password: string
): Promise<void> {
  await page.getByTestId(`${testId}-input`).fill(password)
  await page.getByTestId(`${testId}-submit`).click()
}

/** Read the raw stored contents of every mock file. */
export async function fetchMockState(
  request: APIRequestContext
): Promise<Record<string, Record<string, string>>> {
  const response = await request.get('/api/test/state')
  expect(response.ok()).toBeTruthy()
  return response.json()
}
