import {
  test,
  expect,
  gotoApp,
  selectRepo,
  clickFileNode,
  expectEditor,
  submitPassword,
  fetchMockState,
  fillEditor,
  rootNewFileButton,
} from './helpers'

const REPO = 'mockuser/scratch'
const FILE = 'roundtrip.md'
const PASSWORD = 'roundtrip-pass'
const MARKER = 'PLAINTEXT_MARKER_7f3a9c'
const PLAINTEXT = `# Round trip\n\n${MARKER}\n`

test.describe('Encryption round trip', () => {
  test('encrypts on save and decrypts the same file after a fresh page load', async ({
    page,
    request,
  }) => {
    await gotoApp(page)
    await selectRepo(page, REPO)

    // Create a brand new file, write to it and save it. Because this
    // repository is uninitialized, saving asks for a brand new password.
    await rootNewFileButton(page).click()
    await page.getByTestId('new-file-input').fill(FILE)
    await page.getByTestId('new-file-submit').click()
    await fillEditor(page, PLAINTEXT)
    await page.getByTestId('save-button').click()

    await expect(page.getByTestId('set-password-title')).toBeVisible()
    await page.getByTestId('set-password-input').fill(PASSWORD)
    await page.getByTestId('set-password-confirm-input').fill(PASSWORD)
    await page.getByTestId('set-password-submit').click()

    await expect(page.getByTestId('notice')).toContainText(`Saved ${FILE}`)
    await expect(page.getByTestId('selected-file-path')).toHaveText(FILE)
    await expect(page.getByTestId('repo-lock-status')).toHaveAttribute(
      'data-repo-status',
      'unlocked'
    )

    // ...and the age-encrypted bytes at rest must never contain the plaintext.
    const state = await fetchMockState(request)
    const storedPath = Object.keys(state[REPO]).find((path) => path.endsWith('.age'))
    expect(storedPath).toBeDefined()
    expect(storedPath).not.toContain('roundtrip')
    const stored = state[REPO][storedPath!]
    expect(stored).toContain('-----BEGIN AGE ENCRYPTED FILE-----')
    expect(stored).not.toContain(MARKER)
    expect(stored).not.toContain('# Round trip')

    // Lock the repository. Reloading the page drops every in-memory password,
    // so the only way to read the file again is to decrypt it from scratch.
    await page.getByTestId('repo-lock-toggle').click()
    await expect(page.getByTestId('repo-lock-status')).toHaveAttribute(
      'data-repo-status',
      'locked'
    )
    await gotoApp(page)
    await selectRepo(page, REPO)
    await expect(page.getByTestId('repo-lock-status')).toHaveAttribute(
      'data-repo-status',
      'locked'
    )

    // Re-open the file: it is downloaded from the backend and decrypted with
    // the password we set, round-tripping back to the exact original content.
    await clickFileNode(page, storedPath!)
    await expect(page.getByTestId('unlock-title')).toBeVisible()
    await submitPassword(page, 'unlock', PASSWORD)

    await expectEditor(page, FILE, PLAINTEXT)
    await expect(page.getByTestId('repo-lock-status')).toHaveAttribute(
      'data-repo-status',
      'unlocked'
    )
  })
})
