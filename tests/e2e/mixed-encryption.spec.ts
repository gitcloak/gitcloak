import type { Page } from '@playwright/test'
import {
  test,
  expect,
  gotoApp,
  selectRepo,
  clickFileNode,
  expectEditor,
  fillEditor,
  fetchMockState,
  rootNewFileButton,
  storedPathOf,
  submitPassword,
} from './helpers'

const rootNewFolderButton = (page: Page) =>
  page.locator('[data-testid="tree-new-folder-button"][data-path=""]')

const fileNode = (page: Page, path: string) =>
  page.locator(`[data-testid="file-node"][data-path="${path}"]`)

/** Pick a file's encryption in the create dialog before submitting it. */
async function chooseEncryption(page: Page, kind: 'encrypted' | 'plain'): Promise<void> {
  await page.getByTestId(`new-file-encryption-${kind}`).click()
  await expect(page.getByTestId(`new-file-encryption-${kind}`)).toBeChecked()
}

test.describe('Plain and encrypted files side by side', () => {
  test('the first encrypted file leaves the existing plain files alone', async ({
    page,
    request,
  }) => {
    await gotoApp(page)
    // scratch has no `.gitcloak` and one plain file.
    await selectRepo(page, 'mockuser/scratch')
    await expect(fileNode(page, 'notes.md')).toHaveAttribute('data-protected', 'false')

    await rootNewFileButton(page).click()
    await page.getByTestId('new-file-input').fill('secret.md')
    await page.getByTestId('new-file-submit').click()
    await fillEditor(page, '# Secret\n')
    await page.getByTestId('save-button').click()

    // The repository is uninitialized, so the save sets its first password.
    await page.getByTestId('set-password-input').fill('first-password')
    await page.getByTestId('set-password-confirm-input').fill('first-password')
    await page.getByTestId('set-password-submit').click()
    await expect(page.getByTestId('notice')).toContainText('Saved secret.md')

    const files = (await fetchMockState(request))['mockuser/scratch']
    expect(files['.gitcloak']).toContain('"verification"')
    // The file that was already there is untouched and still plain.
    expect(files['notes.md']).toContain('Nothing secret here yet')
    expect(files['notes.md.age']).toBeUndefined()
    // Only the new file is encrypted, under an encrypted name.
    const encrypted = Object.keys(files).filter((path) => path.endsWith('.age'))
    expect(encrypted).toHaveLength(1)
    expect(encrypted[0]).not.toContain('secret')
    expect(files[encrypted[0]]).toContain('-----BEGIN AGE ENCRYPTED FILE-----')

    // Both kinds are listed, and the plain one still opens.
    await expect(fileNode(page, 'notes.md')).toHaveAttribute('data-protected', 'false')
    await expect(
      page.locator('[data-testid="file-node"][data-name="secret.md"]')
    ).toHaveAttribute('data-protected', 'true')
    await clickFileNode(page, 'notes.md')
    await expectEditor(page, 'notes.md', /Nothing secret here yet/)
  })

  test('a plain file can be added next to the encrypted ones', async ({ page, request }) => {
    await gotoApp(page)
    await selectRepo(page, 'mockuser/demo-notes')
    await page.getByTestId('repo-lock-toggle').click()
    await submitPassword(page, 'unlock', 'demo-password')
    await expect(page.getByTestId('repo-lock-status')).toHaveAttribute(
      'data-repo-status',
      'unlocked'
    )

    await rootNewFileButton(page).click()
    await chooseEncryption(page, 'plain')
    await page.getByTestId('new-file-input').fill('public.md')
    await page.getByTestId('new-file-submit').click()
    await expect(page.getByTestId('selected-file-path')).toHaveText('public.md')

    await fillEditor(page, '# Public\n')
    await page.getByTestId('save-button').click()
    await expect(page.getByTestId('notice')).toContainText('Saved public.md')

    const files = (await fetchMockState(request))['mockuser/demo-notes']
    expect(files['public.md']).toBe('# Public\n')
    expect(files['public.md.age']).toBeUndefined()

    await expect(
      page.locator('[data-testid="file-node"][data-name="public.md"]')
    ).toHaveAttribute('data-protected', 'false')
  })

  test('editing a plain file keeps its name and stays plaintext', async ({ page, request }) => {
    await gotoApp(page)
    await selectRepo(page, 'mockuser/demo-notes')
    // The repository is locked: a plain file needs no password to save.
    await expect(page.getByTestId('repo-lock-status')).toHaveAttribute(
      'data-repo-status',
      'locked'
    )

    await clickFileNode(page, 'notes')
    await clickFileNode(page, 'notes/todo.md')
    await expectEditor(page, 'notes/todo.md', /write tests/)

    await fillEditor(page, '- [x] write tests\n- [x] edit plain files\n')
    await page.getByTestId('save-button').click()
    await expect(page.getByTestId('notice')).toContainText('Saved notes/todo.md')

    const files = (await fetchMockState(request))['mockuser/demo-notes']
    expect(files['notes/todo.md']).toBe('- [x] write tests\n- [x] edit plain files\n')
    // No copy under a new encrypted name, and no password was needed.
    expect(files['notes/todo.md.age']).toBeUndefined()
    await expect(page.getByTestId('repo-lock-status')).toHaveAttribute(
      'data-repo-status',
      'locked'
    )
  })

  test('a plain file inside an encrypted folder lands in that folder', async ({
    page,
    request,
  }) => {
    await gotoApp(page)
    await selectRepo(page, 'mockuser/demo-notes')
    await page.getByTestId('repo-lock-toggle').click()
    await submitPassword(page, 'unlock', 'demo-password')

    await rootNewFolderButton(page).click()
    await page.getByTestId('new-file-input').fill('projects')
    await page.getByTestId('new-file-submit').click()
    await expect(page.getByTestId('notice')).toContainText('Created folder projects')

    const folder = page.locator('[data-testid="file-node"][data-name="projects"]')
    await folder.locator('[data-testid="tree-new-file-button"]').click()
    await chooseEncryption(page, 'plain')
    await page.getByTestId('new-file-input').fill('readme.md')
    await page.getByTestId('new-file-submit').click()
    await expect(page.getByTestId('selected-file-path')).toHaveText('projects/readme.md')

    await fillEditor(page, '# Public readme\n')
    await page.getByTestId('save-button').click()
    await expect(page.getByTestId('notice')).toContainText('Saved projects/readme.md')

    const files = (await fetchMockState(request))['mockuser/demo-notes']
    // No plain `projects` folder was created alongside the encrypted one.
    expect(Object.keys(files).some((path) => path.startsWith('projects/'))).toBe(false)

    const storedFolder = (await storedPathOf(page, 'readme.md')).split('/')[0]
    expect(files[`${storedFolder}/readme.md`]).toBe('# Public readme\n')
    // The folder holds the plain file and the encrypted placeholder.
    const inside = Object.keys(files).filter((path) => path.startsWith(`${storedFolder}/`))
    expect(inside).toHaveLength(2)
  })

  test('a plain file added to an existing plaintext folder stays in that folder', async ({
    page,
    request,
  }) => {
    await gotoApp(page)
    await selectRepo(page, 'mockuser/demo-notes')
    await page.getByTestId('repo-lock-toggle').click()
    await submitPassword(page, 'unlock', 'demo-password')

    // `notes` predates encrypted names, so it is stored under its plain name.
    // A plain file added to it must be written where the folder already is,
    // instead of into a second, encrypted-name folder with the same label.
    await clickFileNode(page, 'notes')
    await page
      .locator('[data-testid="file-node"][data-name="notes"] [data-testid="tree-new-file-button"]')
      .click()
    await chooseEncryption(page, 'plain')
    await page.getByTestId('new-file-input').fill('scratch.md')
    await page.getByTestId('new-file-submit').click()
    await expect(page.getByTestId('selected-file-path')).toHaveText('notes/scratch.md')

    await fillEditor(page, '# Scratch\n\nPlain, inside notes.\n')
    await page.getByTestId('save-button').click()
    await expect(page.getByTestId('notice')).toContainText('Saved notes/scratch.md')

    const files = (await fetchMockState(request))['mockuser/demo-notes']
    expect(files['notes/scratch.md']).toContain('Plain, inside notes.')
    // `notes` is still the only folder in the repository.
    const folders = new Set(
      Object.keys(files)
        .filter((path) => path.includes('/'))
        .map((path) => path.split('/')[0])
    )
    expect([...folders]).toEqual(['notes'])
    // And the tree still shows a single `notes` folder, holding the new file.
    await expect(page.locator('[data-testid="file-node"][data-name="notes"]')).toHaveCount(1)
    await expect(page.locator('[data-testid="file-node"][data-name="scratch.md"]')).toBeVisible()
  })

  test('refuses a plain file name that ends in .age', async ({ page }) => {
    await gotoApp(page)
    await selectRepo(page, 'mockuser/scratch')

    await rootNewFileButton(page).click()
    await chooseEncryption(page, 'plain')
    await page.getByTestId('new-file-input').fill('notes.md.age')
    await page.getByTestId('new-file-submit').click()

    await expect(page.getByTestId('notice')).toHaveAttribute('data-notice-type', 'error')
    await expect(page.getByTestId('notice')).toContainText('cannot end in .age')
  })
})
