import {
  test,
  expect,
  gotoApp,
  selectRepo,
  fetchMockState,
} from './helpers'

test.describe('Creating and saving files', () => {
  test('creates a new file and sets a repository password with confirmation', async ({
    page,
    request,
  }) => {
    await gotoApp(page)
    await selectRepo(page, 'mockuser/scratch')

    // Open the "new file" dialog.
    await page.getByTestId('new-file-button').click()
    await expect(page.getByTestId('new-file-dialog')).toBeVisible()
    await expect(page.getByTestId('new-file-title')).toHaveText('Create New File')
    await page.getByTestId('new-file-input').fill('hello.md')
    await page.getByTestId('new-file-submit').click()

    // A brand new, empty file is opened in the editor.
    await expect(page.getByTestId('selected-file-path')).toHaveText('hello.md')
    await expect(page.getByTestId('editor-title')).toContainText('New')
    await expect(page.getByTestId('editor-input')).toHaveValue('')
    await expect(page.getByTestId('save-button')).toBeDisabled()

    // Editing enables save.
    await page.getByTestId('editor-input').fill('# Hello from the test\n')
    await expect(page.getByTestId('editor-status')).toHaveAttribute(
      'data-status',
      'modified'
    )
    await expect(page.getByTestId('save-button')).toBeEnabled()
    await expect(page.getByTestId('save-button')).toHaveAttribute('data-state', 'dirty')

    // Saving an uninitialized repository asks for a brand new password.
    await page.getByTestId('save-button').click()
    await expect(page.getByTestId('set-password-title')).toBeVisible()
    await expect(page.getByTestId('set-password-title')).toHaveText(
      'Set Repository Password'
    )

    // Mismatched confirmation is rejected.
    await page.getByTestId('set-password-input').fill('newpass123')
    await page.getByTestId('set-password-confirm-input').fill('mismatch')
    await page.getByTestId('set-password-submit').click()
    await expect(page.getByTestId('set-password-error')).toContainText(
      'Passwords do not match'
    )

    // Matching confirmation creates `.gitcloak` and saves the encrypted file.
    await page.getByTestId('set-password-confirm-input').fill('newpass123')
    await page.getByTestId('set-password-submit').click()

    await expect(page.getByTestId('notice')).toHaveAttribute('data-notice-type', 'success')
    await expect(page.getByTestId('notice')).toContainText('Saved hello.md')
    await expect(page.getByTestId('selected-file-path')).toHaveText('hello.md')
    await expect(page.getByTestId('repo-lock-status')).toHaveAttribute(
      'data-repo-status',
      'unlocked'
    )
    // The file tree refreshed and now shows the encrypted file.
    await expect(
      page.locator('[data-testid="file-node"][data-name="hello.md"]')
    ).toBeVisible()

    // At rest the name is encrypted, the content is age-encrypted and
    // `.gitcloak` must exist.
    const state = await fetchMockState(request)
    const files = state['mockuser/scratch']
    expect(files['.gitcloak']).toContain('"verification"')
    expect(files['hello.md.age']).toBeUndefined()
    const [storedPath] = Object.keys(files).filter((path) => path.endsWith('.age'))
    expect(storedPath).not.toContain('hello')
    expect(files[storedPath]).toContain('-----BEGIN AGE ENCRYPTED FILE-----')
  })

  test('prompts for the existing repository password when saving into a locked repository', async ({
    page,
    request,
  }) => {
    await gotoApp(page)

    // demo-notes is locked and already initialized.
    await expect(page.getByTestId('repo-lock-status')).toContainText('Locked')

    await page.getByTestId('new-file-button').click()
    await page.getByTestId('new-file-input').fill('draft.md')
    await page.getByTestId('new-file-submit').click()
    await page.getByTestId('editor-input').fill('# Draft\n')
    await page.getByTestId('save-button').click()

    await expect(page.getByTestId('save-password-title')).toBeVisible()
    await expect(page.getByTestId('save-password-title')).toHaveText(
      'Enter Repository Password'
    )

    // Wrong password is rejected.
    await page.getByTestId('save-password-input').fill('wrong-password')
    await page.getByTestId('save-password-submit').click()
    await expect(page.getByTestId('save-password-error')).toContainText(
      'Incorrect password!'
    )

    // Correct password saves the file and unlocks the repository.
    await page.getByTestId('save-password-input').fill('demo-password')
    await page.getByTestId('save-password-submit').click()

    await expect(page.getByTestId('notice')).toContainText('Saved draft.md')
    await expect(page.getByTestId('repo-lock-status')).toHaveAttribute(
      'data-repo-status',
      'unlocked'
    )

    const state = await fetchMockState(request)
    const files = state['mockuser/demo-notes']
    expect(files['draft.md.age']).toBeUndefined()
    expect(Object.keys(files).some((path) => path.includes('draft'))).toBe(false)
    const storedPaths = Object.keys(files).filter((path) => path.endsWith('.age'))
    expect(storedPaths.some((path) => files[path].includes('-----BEGIN AGE ENCRYPTED FILE-----'))).toBe(true)
  })

  test('save stays disabled until the editor content changes', async ({ page }) => {
    await gotoApp(page)

    await page.getByTestId('new-file-button').click()
    await page.getByTestId('new-file-input').fill('untouched.md')
    await page.getByTestId('new-file-submit').click()

    await expect(page.getByTestId('save-button')).toBeDisabled()

    await page.getByTestId('editor-input').fill('now there is content')
    await expect(page.getByTestId('save-button')).toBeEnabled()

    // Reverting to the original (empty) content disables save again.
    await page.getByTestId('editor-input').fill('')
    await expect(page.getByTestId('save-button')).toBeDisabled()
  })
})
