import {
  test,
  expect,
  gotoApp,
  selectRepo,
  fetchMockState,
  fillEditor,
  expectEditorValue,
  startNewFile,
  submitPassword,
} from './helpers'

test.describe('Creating and saving files', () => {
  test('creates a new file and sets a repository password with confirmation', async ({
    page,
    request,
  }) => {
    await gotoApp(page)
    await selectRepo(page, 'mockuser/scratch')

    // Open the "new file" dialog.
    await startNewFile(page)
    await expect(page.getByTestId('new-file-dialog')).toBeVisible()
    await expect(page.getByTestId('new-file-title')).toHaveText('Create New File')
    await page.getByTestId('new-file-input').fill('hello.md')
    await page.getByTestId('new-file-submit').click()

    // A brand new, empty file is opened in the editor.
    await expect(page.getByTestId('selected-file-path')).toHaveText('hello.md')
    await expect(page.getByTestId('editor-title')).toContainText('New')
    await expectEditorValue(page, '')
    await expect(page.getByTestId('save-button')).toBeDisabled()

    // Editing enables save.
    await fillEditor(page, '# Hello from the test\n')
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

    await startNewFile(page)
    await page.getByTestId('new-file-input').fill('draft.md')
    await page.getByTestId('new-file-submit').click()
    await fillEditor(page, '# Draft\n')
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

    await startNewFile(page)
    await page.getByTestId('new-file-input').fill('untouched.md')
    await page.getByTestId('new-file-submit').click()

    await expect(page.getByTestId('save-button')).toBeDisabled()

    await fillEditor(page, 'now there is content')
    await expect(page.getByTestId('save-button')).toBeEnabled()

    // Reverting to the original (empty) content disables save again.
    await fillEditor(page, '')
    await expect(page.getByTestId('save-button')).toBeDisabled()
  })

  test('commits a plain file the moment it is created, without a save', async ({
    page,
    request,
  }) => {
    await gotoApp(page)
    // demo-notes is locked, so a plain file needs no password — nothing stands
    // between creating it and committing it.
    await expect(page.getByTestId('repo-lock-status')).toContainText('Locked')

    await startNewFile(page)
    await page.getByTestId('new-file-encryption-plain').click()
    await expect(page.getByTestId('new-file-encryption-plain')).toBeChecked()
    await page.getByTestId('new-file-input').fill('early.md')
    await page.getByTestId('new-file-submit').click()

    // No save happened, yet the file is in the tree...
    await expect(
      page.locator('[data-testid="file-node"][data-name="early.md"]')
    ).toBeVisible()
    // ...and already committed, as an empty file.
    const files = (await fetchMockState(request))['mockuser/demo-notes']
    expect(files['early.md']).toBe('')

    // The editor opened it, with nothing to save.
    await expect(page.getByTestId('selected-file-path')).toHaveText('early.md')
    await expectEditorValue(page, '')
    await expect(page.getByTestId('save-button')).toBeDisabled()
  })

  test('commits an empty encrypted file the moment it is created, once unlocked', async ({
    page,
    request,
  }) => {
    await gotoApp(page)
    await page.getByTestId('repo-lock-toggle').click()
    await submitPassword(page, 'unlock', 'demo-password')
    // Unlocking also renames the older plain `.age` files in this repository,
    // which takes a moment; the dialog stays open until it finishes. Snapshot
    // the state only afterwards, or those renames show up as new blobs.
    await expect(page.getByTestId('unlock-dialog')).toHaveCount(0)
    await expect(page.getByTestId('repo-lock-status')).toHaveAttribute(
      'data-repo-status',
      'unlocked'
    )

    const before = (await fetchMockState(request))['mockuser/demo-notes']

    await startNewFile(page)
    // Encrypted is what the root of a repository offers by default.
    await expect(page.getByTestId('new-file-encryption-encrypted')).toBeChecked()
    await page.getByTestId('new-file-input').fill('vault.md')
    await page.getByTestId('new-file-submit').click()

    // The password is already in memory, so nothing asks for it again.
    await expect(page.getByTestId('set-password-title')).toHaveCount(0)
    await expect(page.getByTestId('save-password-title')).toHaveCount(0)

    await expect(
      page.locator('[data-testid="file-node"][data-name="vault.md"]')
    ).toBeVisible()

    const after = (await fetchMockState(request))['mockuser/demo-notes']
    const added = Object.keys(after).filter((path) => !(path in before))
    // One new blob, encrypted, under a name that leaks neither the file's name
    // nor the fact that it is empty.
    expect(added).toHaveLength(1)
    expect(added[0].endsWith('.age')).toBe(true)
    expect(added[0]).not.toContain('vault')
    expect(after[added[0]]).toContain('-----BEGIN AGE ENCRYPTED FILE-----')

    await expect(page.getByTestId('selected-file-path')).toHaveText('vault.md')
    await expectEditorValue(page, '')
    await expect(page.getByTestId('save-button')).toBeDisabled()
  })

  test('leaves a file created in a locked repository uncommitted until it is saved', async ({
    page,
    request,
  }) => {
    await gotoApp(page)
    await expect(page.getByTestId('repo-lock-status')).toContainText('Locked')

    // An encrypted file needs the repository password, which is only asked for
    // on save — so this file cannot be committed any earlier than it used to be.
    await startNewFile(page)
    await page.getByTestId('new-file-input').fill('later.md')
    await page.getByTestId('new-file-submit').click()

    // It is open and unsaved: no node in the tree, no blob in the repository.
    await expect(page.getByTestId('editor-title')).toContainText('New')
    await expect(page.getByTestId('save-button')).toBeDisabled()
    await expect(
      page.locator('[data-testid="file-node"][data-name="later.md"]')
    ).toHaveCount(0)

    const files = (await fetchMockState(request))['mockuser/demo-notes']
    expect(Object.keys(files).some((path) => path.includes('later'))).toBe(false)
  })
})
