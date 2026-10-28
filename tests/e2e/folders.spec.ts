import type { Page } from '@playwright/test'
import {
  test,
  expect,
  gotoApp,
  fetchMockState,
  fillEditor,
  rootNewFileButton,
  storedPathOf,
  submitPassword,
} from './helpers'

const rootNewFolderButton = (page: Page) =>
  page.locator('[data-testid="tree-new-folder-button"][data-path=""]')

test.describe('Folders in the file tree', () => {
  test('folder buttons need an unlocked repository', async ({ page }) => {
    await gotoApp(page)

    // demo-notes is locked: a folder needs the password to hold its placeholder.
    await expect(page.getByTestId('repo-lock-status')).toContainText('Locked')
    await expect(rootNewFolderButton(page)).toBeDisabled()
    await expect(rootNewFileButton(page)).toBeEnabled()
    await expect(
      page.locator('[data-testid="file-node"][data-name="notes"] [data-testid="tree-new-file-button"]')
    ).toBeDisabled()
  })

  test('creates an empty folder, then a file inside it', async ({ page, request }) => {
    await gotoApp(page)

    await page.getByTestId('repo-lock-toggle').click()
    await submitPassword(page, 'unlock', 'demo-password')
    await expect(page.getByTestId('repo-lock-status')).toHaveAttribute(
      'data-repo-status',
      'unlocked'
    )

    // A folder at the root. The new folder is listed, and its placeholder is hidden.
    await rootNewFolderButton(page).click()
    await expect(page.getByTestId('new-file-title')).toHaveText('Create New Folder')
    await page.getByTestId('new-file-input').fill('projects')
    await page.getByTestId('new-file-submit').click()

    await expect(page.getByTestId('notice')).toContainText('Created folder projects')
    const folder = page.locator('[data-testid="file-node"][data-name="projects"]')
    await expect(folder).toHaveAttribute('data-node-type', 'dir')
    await expect(page.locator('[data-testid="file-node"][data-name=".gitkeep"]')).toHaveCount(0)

    // The folder's own button creates a file inside it. The dialog names the folder.
    await folder.locator('[data-testid="tree-new-file-button"]').click()
    await expect(page.getByTestId('new-file-title')).toHaveText('Create New File')
    await expect(page.getByTestId('new-file-description')).toContainText('projects')
    await page.getByTestId('new-file-input').fill('todo.md')
    await page.getByTestId('new-file-submit').click()

    await expect(page.getByTestId('selected-file-path')).toHaveText('projects/todo.md')
    await fillEditor(page, '# Todo\n')
    await page.getByTestId('save-button').click()
    await expect(page.getByTestId('notice')).toContainText('Saved projects/todo.md')

    // The file shows under its folder, which stayed open through the refresh.
    await expect(
      page.locator('[data-testid="file-node"][data-name="todo.md"]')
    ).toBeVisible()

    // Names are encrypted at rest, and the folder holds the placeholder and the file.
    const state = await fetchMockState(request)
    const files = state['mockuser/demo-notes']
    expect(Object.keys(files).some((path) => path.includes('projects'))).toBe(false)
    // Only the seeded plain `notes/todo.md` mentions todo in its stored path.
    expect(Object.keys(files).filter((path) => path.includes('todo'))).toEqual(['notes/todo.md'])
    const storedFolder = (await storedPathOf(page, 'todo.md')).split('/')[0]
    const inside = Object.keys(files).filter((path) => path.startsWith(`${storedFolder}/`))
    expect(inside).toHaveLength(2)
    for (const path of inside) {
      expect(files[path]).toContain('-----BEGIN AGE ENCRYPTED FILE-----')
    }
  })

  test('rejects the reserved placeholder name', async ({ page }) => {
    await gotoApp(page)

    await rootNewFileButton(page).click()
    await page.getByTestId('new-file-input').fill('.gitkeep')
    await page.getByTestId('new-file-submit').click()

    await expect(page.getByTestId('notice')).toHaveAttribute('data-notice-type', 'error')
    await expect(page.getByTestId('notice')).toContainText('reserved for empty folders')
  })
})
