import {
  test,
  expect,
  gotoApp,
  clickFileNode,
  expectEditor,
} from './helpers'

test.describe('File tree and editor', () => {
  test('opens a plaintext file and reflects it in the editor', async ({ page }) => {
    await gotoApp(page)

    await clickFileNode(page, 'README.md')

    await expectEditor(page, 'README.md', /Demo Notes/)
    await expect(page.getByTestId('editor-repo')).toHaveText('mockuser/demo-notes')
    await expect(page.getByTestId('editor-status')).toHaveAttribute('data-status', 'saved')
    await expect(
      page.locator('[data-testid="file-node"][data-path="README.md"]')
    ).toHaveAttribute('data-selected', 'true')

    // Save is disabled while there are no changes.
    await expect(page.getByTestId('save-button')).toBeDisabled()
    await expect(page.getByTestId('save-button')).toHaveAttribute('data-state', 'clean')

    // Status bar reports line/character counts for the open file.
    await expect(page.getByTestId('editor-stats')).toContainText('chars')
  })

  test('expands a directory and opens a nested file', async ({ page }) => {
    await gotoApp(page)

    await clickFileNode(page, 'notes')

    await expect(
      page.locator('[data-testid="file-node"][data-path="notes/todo.md"]')
    ).toBeVisible()
    await expect(
      page.locator('[data-testid="file-node"][data-path="notes/secret.md.age"]')
    ).toBeVisible()

    await clickFileNode(page, 'notes/todo.md')
    await expectEditor(page, 'notes/todo.md', /write tests/)
  })

  test('refresh re-reads the repository contents', async ({ page }) => {
    await gotoApp(page)

    await page.getByTestId('refresh-files-button').click()

    await expect(
      page.locator('[data-testid="file-node"][data-path="README.md"]')
    ).toBeVisible()
  })
})
