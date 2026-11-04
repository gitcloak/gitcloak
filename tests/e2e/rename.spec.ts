import type { Page } from '@playwright/test'
import {
  test,
  expect,
  gotoApp,
  clickFileNode,
  clickFileByName,
  expectEditor,
  fillEditor,
  fetchMockState,
  storedPathOf,
  submitPassword,
} from './helpers'

const REPO = 'mockuser/demo-notes'
const PASSWORD = 'demo-password'

const fileRow = (path: string) =>
  `[data-testid="file-node"][data-path="${path}"]`
const renameButton = (path: string) =>
  `${fileRow(path)} [data-testid="tree-rename-button"]`

/** Open the rename dialog for a file by clicking the pen next to its row. */
async function openRename(page: Page, path: string) {
  await page.locator(fileRow(path)).hover()
  await page.locator(renameButton(path)).click()
  await expect(page.getByTestId('new-file-title')).toHaveText('Rename File')
  await expect(page.getByTestId('new-file-submit')).toHaveText('Rename')
}

/**
 * Unlock the selected repository and wait for the dialog to close. Unlocking
 * also migrates older file names, which takes a moment; the dialog stays open
 * until that finishes and would otherwise intercept the next click.
 */
async function unlock(page: Page) {
  await page.getByTestId('repo-lock-toggle').click()
  await submitPassword(page, 'unlock', PASSWORD)
  await expect(page.getByTestId('unlock-dialog')).toHaveCount(0)
  await expect(page.getByTestId('repo-lock-status')).toHaveAttribute(
    'data-repo-status',
    'unlocked'
  )
}

test.describe('Renaming a file', () => {
  test('renames a plain file at the root while the repository is locked', async ({
    page,
    request,
  }) => {
    await gotoApp(page)
    await expect(page.getByTestId('repo-lock-status')).toContainText('Locked')

    await openRename(page, 'README.md')
    await page.getByTestId('new-file-input').fill('readme.md')
    await page.getByTestId('new-file-submit').click()

    // A plain rename needs no password, and the file keeps its content.
    await expect(page.getByTestId('notice')).toContainText('Renamed README.md to readme.md')
    await expect(page.getByTestId('save-password-dialog')).toHaveCount(0)
    const files = (await fetchMockState(request))[REPO]
    expect(files['README.md']).toBeUndefined()
    expect(files['readme.md']).toContain('Demo Notes')
    expect(files['readme.md.age']).toBeUndefined()

    // The tree shows the new name and the repository is still locked.
    await expect(page.locator(fileRow('readme.md'))).toBeVisible()
    await expect(page.getByTestId('repo-lock-status')).toHaveAttribute(
      'data-repo-status',
      'locked'
    )
  })

  test('renames a plain file inside a folder and keeps it in that folder', async ({
    page,
    request,
  }) => {
    await gotoApp(page)

    await clickFileNode(page, 'notes')
    await openRename(page, 'notes/todo.md')
    await page.getByTestId('new-file-input').fill('backlog.md')
    await page.getByTestId('new-file-submit').click()

    await expect(page.getByTestId('notice')).toContainText('Renamed todo.md to backlog.md')
    const files = (await fetchMockState(request))[REPO]
    expect(files['notes/todo.md']).toBeUndefined()
    expect(files['notes/backlog.md']).toContain('write tests')
    // No second folder: the file stayed in `notes`.
    const folders = new Set(
      Object.keys(files)
        .filter((path) => path.includes('/'))
        .map((path) => path.split('/')[0])
    )
    expect([...folders]).toEqual(['notes'])
    await expect(page.locator(fileRow('notes/backlog.md'))).toBeVisible()
  })

  test('renames an encrypted file, re-encrypting its stored name', async ({ page, request }) => {
    await gotoApp(page)
    await unlock(page)

    // journal.md already has an encrypted stored name, so it is the same file
    // before and after the unlock's name migration.
    const storedPath = await storedPathOf(page, 'journal.md')
    const original = (await fetchMockState(request))[REPO][storedPath]
    expect(original).toContain('-----BEGIN AGE ENCRYPTED FILE-----')

    // Follow the file in the editor so the header can be checked after the move.
    await clickFileByName(page, 'journal.md')
    await expectEditor(page, 'journal.md', /name are encrypted/)

    await openRename(page, storedPath)
    await page.getByTestId('new-file-input').fill('diary.md')
    await page.getByTestId('new-file-submit').click()

    await expect(page.getByTestId('notice')).toContainText('Renamed journal.md to diary.md')
    const files = (await fetchMockState(request))[REPO]
    expect(files[storedPath]).toBeUndefined()
    // The stored name is encrypted: it leaks neither the old nor the new name.
    const moved = Object.keys(files).find((path) => files[path] === original)
    expect(moved).toBeDefined()
    expect(moved!.split('/')).toHaveLength(1)
    expect(moved).not.toContain('journal')
    expect(moved).not.toContain('diary')
    // The bytes are untouched and the tree shows the new plain name.
    await expect(
      page.locator('[data-testid="file-node"][data-name="diary.md"]')
    ).toBeVisible()
    // The editor followed the renamed file.
    await expect(page.getByTestId('selected-file-path')).toHaveText('diary.md')
    await expect(page.getByTestId('selected-file-name')).toHaveText('diary.md')
  })

  test('offers a rename only when the plain name is known', async ({ page }) => {
    await gotoApp(page)
    // Locked, the encrypted files show their stored names and cannot be
    // renamed, while the plain file next to them can.
    await expect(page.locator('[data-testid="file-node"][data-protected="true"]')).not.toHaveCount(0)
    await expect(
      page.locator('[data-testid="file-node"][data-protected="true"] [data-testid="tree-rename-button"]')
    ).toHaveCount(0)
    await expect(page.locator(renameButton('README.md'))).toHaveCount(1)

    await unlock(page)
    // Unlocked, journal.md shows its plain name and can be renamed.
    await expect(page.locator(renameButton('README.md'))).toHaveCount(1)
    await expect(
      page.locator('[data-testid="file-node"][data-name="journal.md"] [data-testid="tree-rename-button"]')
    ).toHaveCount(1)
  })

  test('never offers to rename .gitcloak', async ({ page }) => {
    await gotoApp(page)
    await expect(page.locator(fileRow('.gitcloak'))).toBeVisible()
    await expect(page.locator(renameButton('.gitcloak'))).toHaveCount(0)

    await unlock(page)
    await expect(page.locator(renameButton('.gitcloak'))).toHaveCount(0)
  })

  test('refuses a rename that would change whether a file is encrypted', async ({ page }) => {
    await gotoApp(page)

    await openRename(page, 'README.md')
    await page.getByTestId('new-file-input').fill('readme.md.age')
    await page.getByTestId('new-file-submit').click()

    await expect(page.getByTestId('notice')).toHaveAttribute('data-notice-type', 'error')
    await expect(page.getByTestId('notice')).toContainText('cannot end in .age')
  })

  test('refuses a rename to the same name or with a slash', async ({ page }) => {
    await gotoApp(page)

    await openRename(page, 'README.md')
    await page.getByTestId('new-file-input').fill('README.md')
    await page.getByTestId('new-file-submit').click()
    await expect(page.getByTestId('notice')).toContainText('must differ')

    await openRename(page, 'README.md')
    await page.getByTestId('new-file-input').fill('notes/README.md')
    await page.getByTestId('new-file-submit').click()
    await expect(page.getByTestId('notice')).toContainText('without "/"')
  })

  test('keeps editing the renamed file and saves it under the new name', async ({
    page,
    request,
  }) => {
    await gotoApp(page)

    await clickFileNode(page, 'README.md')
    await expectEditor(page, 'README.md', /Demo Notes/)

    await openRename(page, 'README.md')
    await page.getByTestId('new-file-input').fill('notes.md')
    await page.getByTestId('new-file-submit').click()
    await expect(page.getByTestId('notice')).toContainText('Renamed README.md to notes.md')

    // The editor followed the file; a save now writes to the new path.
    await expect(page.getByTestId('selected-file-path')).toHaveText('notes.md')
    await fillEditor(page, '# Renamed\n')
    await page.getByTestId('save-button').click()
    await expect(page.getByTestId('notice')).toContainText('Saved notes.md')

    const files = (await fetchMockState(request))[REPO]
    expect(files['notes.md']).toBe('# Renamed\n')
    expect(files['README.md']).toBeUndefined()
  })
})
