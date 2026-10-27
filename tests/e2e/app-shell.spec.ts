import { test, expect, gotoApp, selectRepo, rootNewFileButton } from './helpers'

test.describe('App shell', () => {
  test('renders the sidebar, file tree, empty editor and account controls', async ({
    page,
  }) => {
    await gotoApp(page)

    // Default repository is the most recently updated seed (demo-notes).
    await expect(page.getByTestId('repo-selector')).toHaveAttribute(
      'data-repo',
      'mockuser/demo-notes'
    )
    await expect(page.getByTestId('repo-selector')).toContainText('mockuser/demo-notes')

    // Lock state is derived from the seeded `.gitcloak` file.
    await expect(page.getByTestId('repo-lock-status')).toHaveAttribute(
      'data-repo-status',
      'locked'
    )
    await expect(page.getByTestId('repo-lock-status')).toContainText('Locked')
    await expect(page.getByTestId('repo-lock-toggle')).toBeEnabled()
    await expect(page.getByTestId('repo-lock-toggle')).toContainText('Unlock repository')

    // File navigator controls.
    await expect(page.getByTestId('refresh-files-button')).toBeVisible()
    await expect(rootNewFileButton(page)).toBeVisible()

    // Root tree nodes from the seed data.
    await expect(
      page.locator('[data-testid="file-node"][data-path="README.md"]')
    ).toBeVisible()
    await expect(
      page.locator('[data-testid="file-node"][data-path=".gitcloak"]')
    ).toBeVisible()
    await expect(
      page.locator('[data-testid="file-node"][data-path="notes"][data-node-type="dir"]')
    ).toBeVisible()

    // Empty editor state.
    await expect(page.getByTestId('editor-title')).toHaveText('Welcome to GitCloak')
    await expect(page.getByText('Select a file to start editing')).toBeVisible()
    await expect(page.getByTestId('editor-empty')).toBeVisible()
    await expect(page.getByTestId('editor-status')).toHaveAttribute('data-status', 'ready')
    await expect(page.getByTestId('save-button')).toBeDisabled()
    await expect(page.getByTestId('save-button')).toHaveAttribute('data-state', 'empty')
    await expect(page.getByTestId('editor-stats')).toHaveText('UTF-8')

    // Account controls.
    await expect(page.getByTestId('user-name')).toHaveText('Mock User')
    await expect(page.getByTestId('user-email')).toHaveText('mock@example.com')
    await expect(page.getByTestId('settings-button')).toBeVisible()
    await expect(page.getByTestId('signout-button')).toBeVisible()
  })

  test('shows an empty-state for a repository without files', async ({ page }) => {
    await gotoApp(page)
    await selectRepo(page, 'mockuser/empty')

    await expect(page.getByTestId('file-tree-empty')).toBeVisible()
    await expect(page.getByTestId('file-tree-empty')).toHaveText('No files found')
    // An empty repository has no `.gitcloak`, so it is "not set up".
    await expect(page.getByTestId('repo-lock-status')).toHaveAttribute(
      'data-repo-status',
      'uninitialized'
    )
  })
})
