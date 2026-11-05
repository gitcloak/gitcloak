import {
  test,
  expect,
  gotoApp,
  fetchMockState,
  fillEditor,
  openRootMenu,
  openRowMenuByName,
  startNewFile,
  startNewFileIn,
  startNewFolder,
  startNewFolderIn,
  selectRepo,
  storedPathOf,
  submitPassword,
} from './helpers'

test.describe('Folders in the file tree', () => {
  test('file and folder actions work without an unlocked repository', async ({ page }) => {
    await gotoApp(page)

    // demo-notes is locked, but neither action needs the password: a folder
    // created now is plain, and a plain file needs nothing either.
    await expect(page.getByTestId('repo-lock-status')).toContainText('Locked')
    await openRootMenu(page)
    await expect(page.getByTestId('tree-menu-new-folder')).toBeEnabled()
    await expect(page.getByTestId('tree-menu-new-file')).toBeEnabled()
    await page.keyboard.press('Escape')

    // The same holds inside a folder, even while the repository is locked.
    await openRowMenuByName(page, 'notes')
    await expect(page.getByTestId('tree-menu-new-file')).toBeEnabled()
    await expect(page.getByTestId('tree-menu-new-folder')).toBeEnabled()
  })

  test('creates a plain folder while the repository is locked', async ({ page, request }) => {
    await gotoApp(page)
    await expect(page.getByTestId('repo-lock-status')).toContainText('Locked')

    await startNewFolder(page)
    await expect(page.getByTestId('new-file-title')).toHaveText('Create New Folder')
    // The dialog says so: with no password the folder is stored plainly.
    await expect(page.getByTestId('new-file-description')).toContainText('plain folder')
    await page.getByTestId('new-file-input').fill('drafts')
    await page.getByTestId('new-file-submit').click()

    // No password is asked for, and the folder keeps its own name.
    await expect(page.getByTestId('notice')).toContainText('Created folder drafts')
    const files = (await fetchMockState(request))['mockuser/demo-notes']
    expect(files['drafts/.gitkeep']).toBe('\n')
    expect(files['drafts/.gitkeep.age']).toBeUndefined()
    // The repository is still set up, just not unlocked.
    expect(files['.gitcloak']).toContain('"verification"')

    // It shows as a folder, and its placeholder stays hidden.
    const folder = page.locator('[data-testid="file-node"][data-name="drafts"]')
    await expect(folder).toHaveAttribute('data-node-type', 'dir')
    await folder.click()
    await expect(page.locator('[data-testid="file-node"][data-name=".gitkeep"]')).toHaveCount(0)
  })

  test('creates a plain folder in a repository that is not set up', async ({ page, request }) => {
    await gotoApp(page)
    await selectRepo(page, 'mockuser/scratch')
    await expect(page.getByTestId('repo-lock-status')).toHaveAttribute(
      'data-repo-status',
      'uninitialized'
    )

    await startNewFolder(page)
    await expect(page.getByTestId('new-file-description')).toContainText('plain folder')
    await page.getByTestId('new-file-input').fill('archive')
    await page.getByTestId('new-file-submit').click()

    await expect(page.getByTestId('notice')).toContainText('Created folder archive')
    // No password dialog, and the repository stays uninitialized.
    await expect(page.getByTestId('set-password-title')).toHaveCount(0)
    const files = (await fetchMockState(request))['mockuser/scratch']
    expect(files['archive/.gitkeep']).toBe('\n')
    expect(files['.gitcloak']).toBeUndefined()

    const folder = page.locator('[data-testid="file-node"][data-name="archive"]')
    await expect(folder).toHaveAttribute('data-node-type', 'dir')
    await expect(page.locator('[data-testid="file-node"][data-name=".gitkeep"]')).toHaveCount(0)
  })

  test('adds a plain file inside a folder while the repository is locked', async ({
    page,
    request,
  }) => {
    await gotoApp(page)
    await expect(page.getByTestId('repo-lock-status')).toContainText('Locked')

    // Open the seeded plain folder, then start a file inside it.
    await page.locator('[data-testid="file-node"][data-name="notes"]').click()
    await startNewFileIn(page, 'notes')

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
    await startNewFileIn(page, 'notes')
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
    await startNewFileIn(page, 'docs')

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
    await startNewFolder(page)
    await expect(page.getByTestId('new-file-title')).toHaveText('Create New Folder')
    await page.getByTestId('new-file-input').fill('projects')
    await page.getByTestId('new-file-submit').click()

    await expect(page.getByTestId('notice')).toContainText('Created folder projects')
    const folder = page.locator('[data-testid="file-node"][data-name="projects"]')
    await expect(folder).toHaveAttribute('data-node-type', 'dir')
    await expect(page.locator('[data-testid="file-node"][data-name=".gitkeep"]')).toHaveCount(0)

    // The folder's own menu creates a file inside it. The dialog names the folder.
    await startNewFileIn(page, 'projects')
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

  test('creates a plain folder inside a folder while the repository is locked', async ({
    page,
    request,
  }) => {
    await gotoApp(page)
    await expect(page.getByTestId('repo-lock-status')).toContainText('Locked')

    // `notes` is a plaintext folder in the seed. A folder created inside it while
    // the repository is locked is stored there, under its own name.
    await page.locator('[data-testid="file-node"][data-name="notes"]').click()
    await startNewFolderIn(page, 'notes')
    await expect(page.getByTestId('new-file-title')).toHaveText('Create New Folder')
    await expect(page.getByTestId('new-file-description')).toContainText('notes')
    await expect(page.getByTestId('new-file-description')).toContainText('plain folder')
    await page.getByTestId('new-file-input').fill('drafts')
    await page.getByTestId('new-file-submit').click()

    await expect(page.getByTestId('notice')).toContainText('Created folder notes/drafts')
    const files = (await fetchMockState(request))['mockuser/demo-notes']
    expect(files['notes/drafts/.gitkeep']).toBe('\n')
    // It stays inside the folder that already existed, plainly named.
    expect(files['notes/drafts/.gitkeep.age']).toBeUndefined()
    await expect(page.locator('[data-testid="file-node"][data-name="drafts"]')).toHaveCount(1)
    await expect(page.locator('[data-testid="file-node"][data-name=".gitkeep"]')).toHaveCount(0)
  })

  test('creates an encrypted folder inside an encrypted folder', async ({ page, request }) => {
    await gotoApp(page)
    await page.getByTestId('repo-lock-toggle').click()
    await submitPassword(page, 'unlock', 'demo-password')

    await startNewFolder(page)
    await page.getByTestId('new-file-input').fill('projects')
    await page.getByTestId('new-file-submit').click()
    await expect(page.getByTestId('notice')).toContainText('Created folder projects')

    // A folder inside it. Its name is derived from the folder's plaintext path,
    // so it lands in the folder that is already stored, not next to it.
    await startNewFolderIn(page, 'projects')
    await expect(page.getByTestId('new-file-title')).toHaveText('Create New Folder')
    await expect(page.getByTestId('new-file-description')).toContainText('projects')
    await page.getByTestId('new-file-input').fill('inner')
    await page.getByTestId('new-file-submit').click()
    await expect(page.getByTestId('notice')).toContainText('Created folder projects/inner')

    // One stored folder holds both, with nothing but the two hidden placeholders.
    const files = (await fetchMockState(request))['mockuser/demo-notes']
    expect(Object.keys(files).some((path) => path.includes('projects'))).toBe(false)
    const storedOuter = (await storedPathOf(page, 'projects')).split('/')[0]
    const inside = Object.keys(files).filter((path) => path.startsWith(`${storedOuter}/`))
    expect(inside).toHaveLength(2)
    for (const path of inside) {
      expect(path.endsWith('.age')).toBe(true)
      expect(files[path]).toContain('-----BEGIN AGE ENCRYPTED FILE-----')
    }
    await expect(page.locator('[data-testid="file-node"][data-name="inner"]')).toHaveCount(1)
    await expect(page.locator('[data-testid="file-node"][data-name=".gitkeep"]')).toHaveCount(0)
  })

  test('shows a new file created inside a newly created folder', async ({ page, request }) => {
    await gotoApp(page)
    await page.getByTestId('repo-lock-toggle').click()
    await submitPassword(page, 'unlock', 'demo-password')

    // A folder at the root, then a file inside it. The refresh after the save
    // must open the folder so the new file is visible without another click.
    await startNewFolder(page)
    await page.getByTestId('new-file-input').fill('projects')
    await page.getByTestId('new-file-submit').click()
    await expect(page.getByTestId('notice')).toContainText('Created folder projects')

    await startNewFileIn(page, 'projects')
    await page.getByTestId('new-file-input').fill('todo.md')
    await page.getByTestId('new-file-submit').click()
    await fillEditor(page, '# Todo\n')
    await page.getByTestId('save-button').click()
    await expect(page.getByTestId('notice')).toContainText('Saved projects/todo.md')

    // The file is rendered inside its folder, which means the folder is open.
    const storedFile = await storedPathOf(page, 'todo.md')
    expect(storedFile.split('/')).toHaveLength(2)
    await expect(
      page.locator(`[data-testid="file-node"][data-path="${storedFile}"]`)
    ).toBeVisible()
    const files = (await fetchMockState(request))['mockuser/demo-notes']
    expect(files[storedFile]).toContain('-----BEGIN AGE ENCRYPTED FILE-----')
  })

  test('reveals a file created at a nested path typed into the root dialog', async ({ page }) => {
    await gotoApp(page)
    await page.getByTestId('repo-lock-toggle').click()
    await submitPassword(page, 'unlock', 'demo-password')

    // The dialog accepts a path with several segments, so the folders above the
    // file come into being with it. Both must be opened for the file to show.
    await startNewFile(page)
    await page.getByTestId('new-file-input').fill('docs/guide/setup.md')
    await page.getByTestId('new-file-submit').click()
    await fillEditor(page, '# Setup\n')
    await page.getByTestId('save-button').click()
    await expect(page.getByTestId('notice')).toContainText('Saved docs/guide/setup.md')

    await expect(page.locator('[data-testid="file-node"][data-name="docs"]')).toBeVisible()
    await expect(page.locator('[data-testid="file-node"][data-name="guide"]')).toBeVisible()
    await expect(page.locator('[data-testid="file-node"][data-name="setup.md"]')).toBeVisible()
  })

  test('reveals a plain file created at a nested path while the repository is locked', async ({
    page,
    request,
  }) => {
    await gotoApp(page)
    await expect(page.getByTestId('repo-lock-status')).toContainText('Locked')

    await startNewFile(page)
    // At the root both choices are offered; while locked, Plain is the one that
    // needs no password.
    await page.getByTestId('new-file-encryption-plain').click()
    await page.getByTestId('new-file-input').fill('drafts/deep.md')
    await page.getByTestId('new-file-submit').click()
    await fillEditor(page, '# Deep\n')
    await page.getByTestId('save-button').click()
    await expect(page.getByTestId('notice')).toContainText('Saved drafts/deep.md')

    // Stored plainly, in a folder of its own, and shown without a further click.
    const files = (await fetchMockState(request))['mockuser/demo-notes']
    expect(files['drafts/deep.md']).toContain('Deep')
    await expect(page.locator('[data-testid="file-node"][data-name="drafts"]')).toBeVisible()
    await expect(
      page.locator('[data-testid="file-node"][data-path="drafts/deep.md"]')
    ).toBeVisible()
  })

  test('rejects the reserved placeholder name', async ({ page }) => {
    await gotoApp(page)

    await startNewFile(page)
    await page.getByTestId('new-file-input').fill('.gitkeep')
    await page.getByTestId('new-file-submit').click()

    await expect(page.getByTestId('notice')).toHaveAttribute('data-notice-type', 'error')
    await expect(page.getByTestId('notice')).toContainText('reserved for empty folders')
  })
})
