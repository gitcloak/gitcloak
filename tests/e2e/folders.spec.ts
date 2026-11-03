import type { Page } from '@playwright/test'
import {
  test,
  expect,
  gotoApp,
  fetchMockState,
  fillEditor,
  rootNewFileButton,
  selectRepo,
  storedPathOf,
  submitPassword,
} from './helpers'

const rootNewFolderButton = (page: Page) =>
  page.locator('[data-testid="tree-new-folder-button"][data-path=""]')

test.describe('Folders in the file tree', () => {
  test('folder buttons need an unlocked repository, but files can be added anywhere', async ({
    page,
  }) => {
    await gotoApp(page)

    // demo-notes is locked: a folder needs the password to hold its placeholder.
    await expect(page.getByTestId('repo-lock-status')).toContainText('Locked')
    await expect(rootNewFolderButton(page)).toBeDisabled()
    await expect(rootNewFileButton(page)).toBeEnabled()
    // A nested file may be plain, which needs no password, so its button is
    // enabled even while the repository is locked.
    await expect(
      page.locator('[data-testid="file-node"][data-name="notes"] [data-testid="tree-new-file-button"]')
    ).toBeEnabled()
  })

  test('adds a plain file inside a folder while the repository is locked', async ({
    page,
    request,
  }) => {
    await gotoApp(page)
    await expect(page.getByTestId('repo-lock-status')).toContainText('Locked')

    // Open the seeded plain folder, then start a file inside it.
    await page.locator('[data-testid="file-node"][data-name="notes"]').click()
    await page
      .locator('[data-testid="file-node"][data-name="notes"] [data-testid="tree-new-file-button"]')
      .click()

    // Locked, so the dialog offers only a plain file: Encrypted is disabled and
    // Plain is preselected.
    await expect(page.getByTestId('new-file-title')).toHaveText('Create New File')
    await expect(page.getByTestId('new-file-encryption-encrypted')).toBeDisabled()
    await expect(page.getByTestId('new-file-encryption-plain')).toHaveAttribute(
      'aria-checked',
      'true'
    )

    await page.getByTestId('new-file-input').fill('scratch.md')
    await page.getByTestId('new-file-submit').click()
    await expect(page.getByTestId('selected-file-path')).toHaveText('notes/scratch.md')

    await fillEditor(page, '# Scratch\n\nPlain note.\n')
    await page.getByTestId('save-button').click()

    // A plain save never asks for the password.
    await expect(page.getByTestId('save-password-dialog')).toHaveCount(0)
    await expect(page.getByTestId('notice')).toContainText('Saved notes/scratch.md')

    // Stored under its plain name with plain-text content, next to the seeded
    // plain file in the same folder.
    const files = (await fetchMockState(request))['mockuser/demo-notes']
    expect(files['notes/scratch.md']).toContain('Plain note.')
    expect(Object.keys(files).some((path) => path.endsWith('scratch.md.age'))).toBe(false)

    await expect(
      page.locator('[data-testid="file-node"][data-name="scratch.md"]')
    ).toBeVisible()
  })

  test('keeps a file created in a locked folder in that folder when unlocked first', async ({
    page,
    request,
  }) => {
    await gotoApp(page)
    await expect(page.getByTestId('repo-lock-status')).toContainText('Locked')

    // Start a plain file inside the seeded folder while the repository is locked.
    await page.locator('[data-testid="file-node"][data-name="notes"]').click()
    await page
      .locator('[data-testid="file-node"][data-name="notes"] [data-testid="tree-new-file-button"]')
      .click()
    await expect(page.getByTestId('new-file-encryption-encrypted')).toBeDisabled()
    await page.getByTestId('new-file-input').fill('later.md')
    await page.getByTestId('new-file-submit').click()
    await expect(page.getByTestId('selected-file-path')).toHaveText('notes/later.md')

    // Unlock before saving. The file already carries the folder's stored name, so
    // saving must not encrypt that part of the path a second time.
    await page.getByTestId('repo-lock-toggle').click()
    await submitPassword(page, 'unlock', 'demo-password')
    await expect(page.getByTestId('notice')).toContainText('is now unlocked')

    await fillEditor(page, '# Later\n\nStill in notes.\n')
    await page.getByTestId('save-button').click()
    await expect(page.getByTestId('notice')).toContainText('Saved notes/later.md')

    const files = (await fetchMockState(request))['mockuser/demo-notes']
    expect(files['notes/later.md']).toContain('Still in notes.')
    // Exactly one file, in the folder it was created in: no doubly-encrypted copy.
    expect(Object.keys(files).filter((path) => path.endsWith('later.md'))).toEqual([
      'notes/later.md',
    ])
  })

  test('adds a plain file inside a folder of a repository that is not set up', async ({
    page,
    request,
  }) => {
    await gotoApp(page)
    // scratch has no `.gitcloak`, so there is no password to ask for and the
    // tree shows every name as it is stored.
    await selectRepo(page, 'mockuser/scratch')
    await expect(page.getByTestId('repo-lock-status')).toHaveAttribute(
      'data-repo-status',
      'uninitialized'
    )

    await page.locator('[data-testid="file-node"][data-name="docs"]').click()
    await page
      .locator('[data-testid="file-node"][data-name="docs"] [data-testid="tree-new-file-button"]')
      .click()

    // Encrypted is out while the repository has no password; Plain is the only
    // choice and is preselected.
    await expect(page.getByTestId('new-file-encryption-encrypted')).toBeDisabled()
    await expect(page.getByTestId('new-file-encryption-plain')).toHaveAttribute(
      'aria-checked',
      'true'
    )
    await page.getByTestId('new-file-input').fill('notes.md')
    await page.getByTestId('new-file-submit').click()
    await expect(page.getByTestId('selected-file-path')).toHaveText('docs/notes.md')

    await fillEditor(page, '# Docs notes\n\nPlain note.\n')
    await page.getByTestId('save-button').click()

    // Saving never asks for a password and never creates `.gitcloak`: the
    // repository stays uninitialized.
    await expect(page.getByTestId('set-password-title')).toHaveCount(0)
    await expect(page.getByTestId('notice')).toContainText('Saved docs/notes.md')

    const files = (await fetchMockState(request))['mockuser/scratch']
    expect(files['docs/notes.md']).toContain('Plain note.')
    expect(files['.gitcloak']).toBeUndefined()
    await expect(
      page.locator('[data-testid="file-node"][data-name="notes.md"][data-path="docs/notes.md"]')
    ).toBeVisible()
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
