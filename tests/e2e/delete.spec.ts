import type { Page } from '@playwright/test'
import {
  test,
  expect,
  gotoApp,
  clickFileNode,
  clickFileByName,
  fetchMockState,
  rootNewFileButton,
  storedPathOf,
  submitPassword,
} from './helpers'

const REPO = 'mockuser/demo-notes'
const PASSWORD = 'demo-password'

const fileRow = (path: string) =>
  `[data-testid="file-node"][data-path="${path}"]`

/** Unlock the selected repository and wait for the dialog and migration to settle. */
async function unlock(page: Page) {
  await page.getByTestId('repo-lock-toggle').click()
  await submitPassword(page, 'unlock', PASSWORD)
  await expect(page.getByTestId('unlock-dialog')).toHaveCount(0)
  await expect(page.getByTestId('repo-lock-status')).toHaveAttribute(
    'data-repo-status',
    'unlocked'
  )
}

/** Open a file from the tree, then open the delete dialog from the header. */
async function openDelete(page: Page, path: string) {
  await page.locator(fileRow(path)).click()
  await expect(page.getByTestId('delete-file-button')).toBeEnabled()
  await page.getByTestId('delete-file-button').click()
  await expect(page.getByTestId('delete-file-dialog')).toBeVisible()
  await expect(page.getByTestId('delete-file-title')).toHaveText('Delete File')
}

test.describe('Deleting a file', () => {
  test('deletes a plain file while locked, without a password', async ({ page, request }) => {
    await gotoApp(page)
    await expect(page.getByTestId('repo-lock-status')).toContainText('Locked')

    await openDelete(page, 'README.md')
    await expect(page.getByTestId('delete-file-description')).toContainText('README.md')
    await page.getByTestId('delete-file-submit').click()

    await expect(page.getByTestId('notice')).toHaveAttribute('data-notice-type', 'success')
    await expect(page.getByTestId('notice')).toContainText('Deleted README.md')
    // Deleting addresses the stored path and sha, so it needs no password.
    await expect(page.getByTestId('save-password-dialog')).toHaveCount(0)

    const files = (await fetchMockState(request))[REPO]
    expect(files['README.md']).toBeUndefined()
    // Siblings are untouched.
    expect(files['notes/todo.md']).toContain('write tests')

    // The tree refreshed, and the editor closed because it showed the file.
    await expect(page.locator(fileRow('README.md'))).toHaveCount(0)
    await expect(page.getByTestId('selected-file-name')).toHaveCount(0)
    await expect(page.getByTestId('repo-lock-status')).toHaveAttribute(
      'data-repo-status',
      'locked'
    )
  })

  test('cancelling keeps the file and the open editor', async ({ page, request }) => {
    await gotoApp(page)

    await openDelete(page, 'README.md')
    await page.getByTestId('delete-file-cancel').click()
    await expect(page.getByTestId('delete-file-dialog')).toHaveCount(0)

    await expect(page.getByTestId('selected-file-path')).toHaveText('README.md')
    expect((await fetchMockState(request))[REPO]['README.md']).toBeDefined()
  })

  test('deletes a plain file inside a folder and leaves the folder alone', async ({
    page,
    request,
  }) => {
    await gotoApp(page)

    await clickFileNode(page, 'notes')
    await openDelete(page, 'notes/todo.md')
    await page.getByTestId('delete-file-submit').click()

    await expect(page.getByTestId('notice')).toContainText('Deleted todo.md')
    const files = (await fetchMockState(request))[REPO]
    expect(files['notes/todo.md']).toBeUndefined()
    // The folder and the file next to it survive.
    expect(files['notes/secret.md.age']).toBeDefined()
    await expect(page.locator(fileRow('notes/todo.md'))).toHaveCount(0)
  })

  test('deletes an encrypted file by its stored path once unlocked', async ({ page, request }) => {
    await gotoApp(page)

    await unlock(page)
    await expect(page.getByTestId('notice')).toContainText('is now unlocked')

    // The tree shows the plain name; the repository stores an encrypted one.
    const storedPath = await storedPathOf(page, 'journal.md')
    await clickFileByName(page, 'journal.md')
    await expect(page.getByTestId('delete-file-button')).toBeEnabled()
    await page.getByTestId('delete-file-button').click()
    await expect(page.getByTestId('delete-file-description')).toContainText('journal.md')
    await page.getByTestId('delete-file-submit').click()

    await expect(page.getByTestId('notice')).toContainText('Deleted journal.md')
    const files = (await fetchMockState(request))[REPO]
    expect(files[storedPath]).toBeUndefined()
  })

  test('offers delete for a file, but never for .gitcloak or an unsaved file', async ({
    page,
  }) => {
    await gotoApp(page)

    // Nothing is open: the control is present (the guide never hides one) but inert.
    await expect(page.getByTestId('delete-file-button')).toBeDisabled()

    await clickFileNode(page, 'README.md')
    await expect(page.getByTestId('delete-file-button')).toBeEnabled()

    // The repository's own metadata holds the name key and is never removed.
    await clickFileNode(page, '.gitcloak')
    await expect(page.getByTestId('selected-file-name')).toHaveText('.gitcloak')
    await expect(page.getByTestId('delete-file-button')).toBeDisabled()

    // A file that has not been saved has no stored blob to delete.
    await rootNewFileButton(page).click()
    await page.getByTestId('new-file-input').fill('unsaved.md')
    await page.getByTestId('new-file-submit').click()
    await expect(page.getByTestId('selected-file-name')).toHaveText('unsaved.md')
    await expect(page.getByTestId('delete-file-button')).toBeDisabled()
  })

  test('the header delete control sits next to Save and is icon-only', async ({ page }) => {
    await gotoApp(page)
    await clickFileNode(page, 'README.md')

    const del = page.getByTestId('delete-file-button')
    await expect(del).toBeVisible()
    // No visible text: the label lives in aria-label / title only.
    await expect(del).toHaveAttribute('aria-label', 'Delete file')
    expect((await del.innerText()).trim()).toBe('')
    // It is the control immediately after Save in the header.
    const followsSave = await del.evaluate(
      (node) =>
        node.previousElementSibling?.getAttribute('data-testid') === 'save-button'
    )
    expect(followsSave).toBe(true)
  })
})
