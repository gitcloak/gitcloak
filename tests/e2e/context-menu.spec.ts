import type { Page } from '@playwright/test'
import {
  test,
  expect,
  gotoApp,
  clickFileNode,
  expectEditor,
  fetchMockState,
  fillEditor,
  openRowMenu,
  openRowMenuByName,
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

test.describe('File tree context menu', () => {
  test('renames the right-clicked file, not the one open in the editor', async ({
    page,
    request,
  }) => {
    await gotoApp(page)

    // A different file is open in the editor; the menu must ignore it.
    await clickFileNode(page, 'README.md')
    await expectEditor(page, 'README.md', /Demo Notes/)
    await clickFileNode(page, 'notes')

    await openRowMenu(page, 'notes/todo.md')
    await page.getByTestId('tree-menu-rename').click()
    await expect(page.getByTestId('new-file-title')).toHaveText('Rename File')
    await expect(page.getByTestId('new-file-description')).toContainText('todo.md')
    await page.getByTestId('new-file-input').fill('task.md')
    await page.getByTestId('new-file-submit').click()

    await expect(page.getByTestId('notice')).toContainText(
      'Renamed todo.md to task.md'
    )
    const files = (await fetchMockState(request))[REPO]
    expect(files['notes/todo.md']).toBeUndefined()
    expect(files['notes/task.md']).toContain('write tests')
    await expect(page.locator(fileRow('notes/task.md'))).toBeVisible()
    // The editor still shows the file that was open, untouched by the rename.
    await expect(page.getByTestId('selected-file-path')).toHaveText('README.md')
  })

  test('deletes the right-clicked file with no file open in the editor', async ({
    page,
    request,
  }) => {
    await gotoApp(page)

    await openRowMenu(page, 'README.md')
    await page.getByTestId('tree-menu-delete').click()
    await expect(page.getByTestId('delete-file-dialog')).toBeVisible()
    await expect(page.getByTestId('delete-file-description')).toContainText('README.md')
    await page.getByTestId('delete-file-submit').click()

    await expect(page.getByTestId('notice')).toContainText('Deleted README.md')
    const files = (await fetchMockState(request))[REPO]
    expect(files['README.md']).toBeUndefined()
    // Siblings are untouched.
    expect(files['notes/todo.md']).toContain('write tests')
    await expect(page.locator(fileRow('README.md'))).toHaveCount(0)
  })

  test('creates a file in the folder that was right-clicked', async ({
    page,
    request,
  }) => {
    await gotoApp(page)

    await openRowMenu(page, 'notes')
    await page.getByTestId('tree-menu-new-file').click()
    await expect(page.getByTestId('new-file-title')).toHaveText('Create New File')
    // Locked, so the tree knows the folder as stored and only a plain file fits.
    await expect(page.getByTestId('new-file-description')).toContainText(
      'folder you selected'
    )
    await page.getByTestId('new-file-input').fill('menu.md')
    await page.getByTestId('new-file-submit').click()
    await expect(page.getByTestId('selected-file-path')).toHaveText('notes/menu.md')

    // It really lands in `notes`, beside the file that was already there.
    await fillEditor(page, '# From the menu\n')
    await page.getByTestId('save-button').click()
    await expect(page.getByTestId('notice')).toContainText('Saved notes/menu.md')
    const files = (await fetchMockState(request))[REPO]
    expect(files['notes/menu.md']).toContain('From the menu')
    expect(files['notes/todo.md']).toContain('write tests')
  })

  test('creates a folder in the folder that was right-clicked', async ({
    page,
    request,
  }) => {
    await gotoApp(page)

    await openRowMenu(page, 'notes')
    await page.getByTestId('tree-menu-new-folder').click()
    await expect(page.getByTestId('new-file-title')).toHaveText('Create New Folder')
    await expect(page.getByTestId('new-file-description')).toContainText('notes')
    await page.getByTestId('new-file-input').fill('deep')
    await page.getByTestId('new-file-submit').click()

    await expect(page.getByTestId('notice')).toContainText('Created folder notes/deep')
    const files = (await fetchMockState(request))[REPO]
    // While the repository is locked the folder is stored plainly, in place.
    expect(files['notes/deep/.gitkeep']).toBe('\n')
    await expect(page.locator('[data-testid="file-node"][data-name="deep"]')).toBeVisible()
  })

  test('creates at the repository root from a file row and from the repository row', async ({
    page,
    request,
  }) => {
    await gotoApp(page)

    // A file row's create items add beside it, in the folder that holds it.
    await openRowMenu(page, 'README.md')
    await expect(page.getByTestId('tree-menu-new-file')).toContainText('New file in demo-notes')
    await page.getByTestId('tree-menu-new-folder').click()
    await expect(page.getByTestId('new-file-input')).toBeVisible()
    await page.getByTestId('new-file-input').fill('archive')
    await page.getByTestId('new-file-submit').click()
    await expect(page.getByTestId('notice')).toContainText('Created folder archive')
    expect((await fetchMockState(request))[REPO]['archive/.gitkeep']).toBe('\n')

    // The repository row is not a file or a folder: it only creates.
    await page.locator('[data-testid="tree-root"]').click({ button: 'right' })
    const menu = page.getByTestId('tree-context-menu')
    await expect(menu).toBeVisible()
    await expect(menu).toHaveAttribute('data-path', '')
    await expect(page.getByTestId('tree-menu-rename')).toHaveCount(0)
    await expect(page.getByTestId('tree-menu-delete')).toHaveCount(0)
    await page.getByTestId('tree-menu-new-file').click()
    await page.getByTestId('new-file-input').fill('top.md')
    await page.getByTestId('new-file-submit').click()
    await expect(page.getByTestId('selected-file-path')).toHaveText('top.md')
  })

  test('offers rename and delete for a file, and disables them where the flow refuses', async ({
    page,
  }) => {
    await gotoApp(page)

    // A plain file can be renamed and deleted while the repository is locked.
    await openRowMenu(page, 'README.md')
    await expect(page.getByTestId('tree-menu-rename')).toBeEnabled()
    await expect(page.getByTestId('tree-menu-delete')).toBeEnabled()
    await page.keyboard.press('Escape')

    // A folder has no rename or delete in the API yet, so both are shown
    // disabled rather than silently missing.
    await openRowMenu(page, 'notes')
    await expect(page.getByTestId('tree-menu-rename')).toBeDisabled()
    await expect(page.getByTestId('tree-menu-rename')).toHaveAttribute(
      'title',
      'Folders cannot be renamed yet.'
    )
    await expect(page.getByTestId('tree-menu-delete')).toBeDisabled()
    await expect(page.getByTestId('tree-menu-delete')).toHaveAttribute(
      'title',
      'Folders cannot be deleted yet.'
    )
    // Creating is still offered on a folder.
    await expect(page.getByTestId('tree-menu-new-file')).toBeEnabled()
    await page.keyboard.press('Escape')

    // The repository's own metadata is never renamed or deleted.
    await openRowMenu(page, '.gitcloak')
    await expect(page.getByTestId('tree-menu-rename')).toBeDisabled()
    await expect(page.getByTestId('tree-menu-delete')).toBeDisabled()
    await expect(page.getByTestId('tree-menu-delete')).toHaveAttribute(
      'title',
      'The repository keeps its .gitcloak file.'
    )
  })

  test('cannot rename an encrypted file until the repository is unlocked', async ({
    page,
    request,
  }) => {
    await gotoApp(page)
    await expect(page.getByTestId('repo-lock-status')).toContainText('Locked')
    await clickFileNode(page, 'notes')

    // Locked: no name key, so the new stored name cannot be derived.
    await openRowMenu(page, 'notes/secret.md.age')
    await expect(page.getByTestId('tree-menu-rename')).toBeDisabled()
    await expect(page.getByTestId('tree-menu-rename')).toHaveAttribute(
      'title',
      'Unlock the repository to rename an encrypted file.'
    )
    // Deleting addresses the stored path and sha, so it stays available.
    await expect(page.getByTestId('tree-menu-delete')).toBeEnabled()
    await page.keyboard.press('Escape')

    // Unlocked: the plain name is known, so rename is offered and works.
    await unlock(page)
    const storedPath = await storedPathOf(page, 'secret.md')
    const originalBytes = (await fetchMockState(request))[REPO][storedPath]
    expect(originalBytes).toContain('-----BEGIN AGE ENCRYPTED FILE-----')

    await openRowMenuByName(page, 'secret.md')
    await expect(page.getByTestId('tree-menu-rename')).toBeEnabled()
    await page.getByTestId('tree-menu-rename').click()
    await expect(page.getByTestId('new-file-description')).toContainText('secret.md')
    await page.getByTestId('new-file-input').fill('hidden.md')
    await page.getByTestId('new-file-submit').click()

    await expect(page.getByTestId('notice')).toContainText('Renamed secret.md to hidden.md')
    const files = (await fetchMockState(request))[REPO]
    // The bytes stay encrypted under a new, encrypted stored name.
    const moved = Object.keys(files).filter((path) => files[path] === originalBytes)
    expect(moved).toHaveLength(1)
    await expect(
      page.locator('[data-testid="file-node"][data-name="hidden.md"]')
    ).toBeVisible()
  })

  test('blocks delete while a save is in flight and allows it again after', async ({
    page,
  }) => {
    await gotoApp(page)
    await clickFileNode(page, 'README.md')
    await fillEditor(page, '# Changed\n')

    // Hold the save open so the delete control can be inspected mid-flight.
    let release: () => void = () => {}
    const held = new Promise<void>((resolve) => {
      release = resolve
    })
    let intercepted = false
    await page.route('**/save', async (route) => {
      intercepted = true
      await held
      await route.continue()
    })

    await page.getByTestId('save-button').click()
    await expect.poll(() => intercepted).toBe(true)

    await openRowMenu(page, 'README.md')
    await expect(page.getByTestId('tree-menu-delete')).toBeDisabled()
    await expect(page.getByTestId('tree-menu-delete')).toHaveAttribute(
      'title',
      'Wait for the current save to finish.'
    )
    await page.keyboard.press('Escape')

    release()
    await expect(page.getByTestId('notice')).toContainText('Saved README.md')

    // Once the save has finished the delete is offered again.
    await openRowMenu(page, 'README.md')
    await expect(page.getByTestId('tree-menu-delete')).toBeEnabled()
  })
})
