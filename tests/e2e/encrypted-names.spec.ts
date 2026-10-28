import {
  test,
  expect,
  gotoApp,
  clickFileByName,
  expectEditor,
  fillEditor,
  submitPassword,
  fetchMockState,
  rootNewFileButton,
} from './helpers'

const REPO = 'mockuser/demo-notes'
const PASSWORD = 'demo-password'

test.describe('Encrypted file names', () => {
  test('shows stored names while locked and plain names once unlocked', async ({
    page,
    request,
  }) => {
    await gotoApp(page)

    // journal.md is stored at the root under an encrypted name.
    const state = await fetchMockState(request)
    const storedPath = Object.keys(state[REPO]).find(
      (path) => path.endsWith('.age') && !path.includes('/') && path !== 'welcome.md.age'
    )
    expect(storedPath).toBeDefined()
    expect(storedPath).not.toContain('journal')

    // Locked: the tree shows only the stored name.
    await expect(
      page.locator(`[data-testid="file-node"][data-path="${storedPath}"]`)
    ).toHaveAttribute('data-name', storedPath!)
    await expect(
      page.locator('[data-testid="file-node"][data-name="journal.md"]')
    ).toHaveCount(0)

    // Encrypted files are marked with a lock, locked or not; plain files are not.
    await expect(
      page.locator(`[data-testid="file-node"][data-path="${storedPath}"]`)
    ).toHaveAttribute('data-protected', 'true')
    await expect(
      page.locator('[data-testid="file-node"][data-path="README.md"]')
    ).toHaveAttribute('data-protected', 'false')

    // Unlocked: the plain name replaces it, and the file opens under that name.
    await page.getByTestId('repo-lock-toggle').click()
    await submitPassword(page, 'unlock', PASSWORD)
    await expect(page.getByTestId('repo-lock-status')).toHaveAttribute(
      'data-repo-status',
      'unlocked'
    )
    await expect(
      page.locator(`[data-testid="file-node"][data-path="${storedPath}"]`)
    ).toHaveAttribute('data-name', 'journal.md')
    await clickFileByName(page, 'journal.md')
    await expectEditor(page, 'journal.md', /This file and its name are encrypted/)

    // Locking again removes the plain name from the tree.
    await page.getByTestId('repo-lock-toggle').click()
    await expect(page.getByTestId('repo-lock-status')).toHaveAttribute(
      'data-repo-status',
      'locked'
    )
    await expect(
      page.locator('[data-testid="file-node"][data-name="journal.md"]')
    ).toHaveCount(0)
    await expect(
      page.locator(`[data-testid="file-node"][data-path="${storedPath}"]`)
    ).toBeVisible()
  })

  test('encrypts folder names too and shows them decrypted in the tree', async ({
    page,
    request,
  }) => {
    await gotoApp(page)
    await page.getByTestId('repo-lock-toggle').click()
    await submitPassword(page, 'unlock', PASSWORD)

    await rootNewFileButton(page).click()
    await page.getByTestId('new-file-input').fill('archive/plan.md')
    await page.getByTestId('new-file-submit').click()
    await fillEditor(page, '# Plan\n')
    await page.getByTestId('save-button').click()

    await expect(page.getByTestId('notice')).toContainText('Saved archive/plan.md')
    await expect(page.getByTestId('selected-file-path')).toHaveText('archive/plan.md')

    // GitHub only sees the encrypted folder and file names.
    const state = await fetchMockState(request)
    const files = state[REPO]
    const nested = Object.keys(files).find(
      (path) => path.includes('/') && !path.startsWith('notes/')
    )
    expect(nested).toBeDefined()
    const [folder, file] = nested!.split('/')
    expect(folder).not.toBe('archive')
    expect(file).not.toBe('plan.md.age')
    expect(Object.keys(files).some((path) => path.split('/').includes('archive'))).toBe(false)

    // The tree shows the plain folder, which expands to the plain file.
    const archive = page.locator(
      '[data-testid="file-node"][data-name="archive"][data-node-type="dir"]'
    )
    await expect(archive).toBeVisible()
    await archive.click()
    await expect(
      page.locator('[data-testid="file-node"][data-name="plan.md"]')
    ).toBeVisible()
  })
})
