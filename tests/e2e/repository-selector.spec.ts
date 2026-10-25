import { test, expect, gotoApp, selectRepo } from './helpers'

test.describe('Repository selector', () => {
  test('lists every available repository', async ({ page }) => {
    await gotoApp(page)

    await page.getByTestId('repo-selector').click()

    const options = page.getByTestId('repo-option')
    await expect(options).toHaveCount(3)
    await expect(options.nth(0)).toHaveAttribute('data-repo', 'mockuser/demo-notes')
    await expect(options.nth(1)).toHaveAttribute('data-repo', 'mockuser/scratch')
    await expect(options.nth(2)).toHaveAttribute('data-repo', 'mockuser/empty')
  })

  test('switching repositories updates status, file tree and editor', async ({
    page,
  }) => {
    await gotoApp(page)

    await selectRepo(page, 'mockuser/scratch')

    await expect(page.getByTestId('repo-lock-status')).toContainText('Not set up')
    await expect(
      page.locator('[data-testid="file-node"][data-path="notes.md"]')
    ).toBeVisible()
    await expect(
      page.locator('[data-testid="file-node"][data-path="README.md"]')
    ).toHaveCount(0)

    // Editor returns to the empty state when switching away from a file.
    await expect(page.getByTestId('editor-title')).toHaveText('Welcome to GitCloak')

    // Switch back and confirm the original repository's files return.
    await selectRepo(page, 'mockuser/demo-notes')
    await expect(
      page.locator('[data-testid="file-node"][data-path="README.md"]')
    ).toBeVisible()
  })
})
