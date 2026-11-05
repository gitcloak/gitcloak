import {
  test,
  expect,
  gotoApp,
  clickFileNode,
  clickFileByName,
  expectEditor,
  fillEditor,
  startNewFileIn,
  submitPassword,
} from './helpers'

test.describe('File tree and editor', () => {
  test('opens a plaintext file and reflects it in the editor', async ({ page }) => {
    await gotoApp(page)

    await clickFileNode(page, 'README.md')

    await expectEditor(page, 'README.md', /Demo Notes/)
    await expect(page.getByTestId('editor-repo')).toHaveText('mockuser/demo-notes')
    await expect(page.getByTestId('editor-status')).toHaveAttribute('data-status', 'saved')
    await expect(
      page.locator('[data-testid="file-node"][data-path="README.md"]')
    ).toHaveAttribute('data-selected', 'true')

    // Save is disabled while there are no changes.
    await expect(page.getByTestId('save-button')).toBeDisabled()
    await expect(page.getByTestId('save-button')).toHaveAttribute('data-state', 'clean')

    // Status bar reports line/character counts for the open file.
    await expect(page.getByTestId('editor-stats')).toContainText('chars')
  })

  test('expands a directory and opens a nested file', async ({ page }) => {
    await gotoApp(page)

    await clickFileNode(page, 'notes')

    await expect(
      page.locator('[data-testid="file-node"][data-path="notes/todo.md"]')
    ).toBeVisible()
    await expect(
      page.locator('[data-testid="file-node"][data-path="notes/secret.md.age"]')
    ).toBeVisible()

    await clickFileNode(page, 'notes/todo.md')
    await expectEditor(page, 'notes/todo.md', /write tests/)
  })

  test('refresh re-reads the repository contents', async ({ page }) => {
    await gotoApp(page)

    await page.getByTestId('refresh-files-button').click()

    await expect(
      page.locator('[data-testid="file-node"][data-path="README.md"]')
    ).toBeVisible()
  })

  test('puts the full path beside the repository and the file name in the title', async ({
    page,
  }) => {
    await gotoApp(page)

    await clickFileNode(page, 'notes')
    await clickFileNode(page, 'notes/todo.md')

    // The header's first line is the repository followed by the whole path.
    await expect(page.getByTestId('editor-repo')).toHaveText('mockuser/demo-notes')
    await expect(page.getByTestId('selected-file-path')).toHaveText('notes/todo.md')
    // The title holds only the file's own name.
    await expect(page.getByTestId('selected-file-name')).toHaveText('todo.md')
    await expect(page.getByTestId('editor-title')).toContainText('todo.md')
    await expect(page.getByTestId('editor-title')).not.toContainText('notes/todo.md')
  })

  test('shows the decrypted path of an encrypted file', async ({ page }) => {
    await gotoApp(page)
    await page.getByTestId('repo-lock-toggle').click()
    await submitPassword(page, 'unlock', 'demo-password')

    // journal.md is stored under an encrypted name; the header shows the plain one.
    await clickFileByName(page, 'journal.md')
    await expect(page.getByTestId('selected-file-path')).toHaveText('journal.md')
    await expect(page.getByTestId('selected-file-name')).toHaveText('journal.md')
    await expect(page.getByTestId('editor-repo')).toHaveText('mockuser/demo-notes')
  })

  test('marks the open file with a tint and an accent bar that hover does not share', async ({
    page,
  }) => {
    await gotoApp(page)

    const row = page.locator('[data-testid="file-node"][data-path="README.md"]')
    await expect(row).toBeVisible()

    // Read the styles the browser actually paints, not just the data attribute.
    const rowStyle = () =>
      row.evaluate((el) => {
        const style = getComputedStyle(el)
        return {
          background: style.backgroundColor,
          weight: style.fontWeight,
          borderLeftWidth: style.borderLeftWidth,
          borderLeftColor: style.borderLeftColor,
        }
      })

    // At rest the row is untinted, lighter than the selected row, and has no
    // accent bar.
    const idle = await rowStyle()

    // Hovering tints the row, but that tint must not be the selection tint.
    await row.hover()
    await page.waitForTimeout(250)
    const hovered = await rowStyle()
    expect(hovered.background).not.toBe(idle.background)
    expect(hovered.borderLeftColor).toBe(idle.borderLeftColor)

    // Opening the file marks it as selected. Move the pointer off the row so we
    // read its resting style rather than the hovered variant.
    await row.click()
    await expect(row).toHaveAttribute('data-selected', 'true')
    await page.mouse.move(0, 0)
    await page.waitForTimeout(250)
    const selected = await rowStyle()

    // The selected row is distinct from both idle and hover.
    expect(selected.background).not.toBe(idle.background)
    expect(selected.background).not.toBe(hovered.background)
    // A weight change and a 2px accent bar are non-colour cues on top of the tint.
    expect(selected.weight).not.toBe(idle.weight)
    expect(selected.borderLeftWidth).toBe('2px')
    expect(selected.borderLeftColor).not.toBe(idle.borderLeftColor)
    expect(idle.borderLeftColor).toBe('rgba(0, 0, 0, 0)')
  })

  test('marks a newly created file once it is saved and appears in the tree', async ({
    page,
  }) => {
    await gotoApp(page)

    // Start a plain file inside the seeded folder; demo-notes is locked, and a
    // plain file needs no password.
    await clickFileNode(page, 'notes')
    await startNewFileIn(page, 'notes')
    await page.getByTestId('new-file-input').fill('scratch.md')
    await page.getByTestId('new-file-submit').click()
    await expect(page.getByTestId('selected-file-path')).toHaveText('notes/scratch.md')

    // An unsaved file is not in the repository yet, so the tree has no row to mark.
    await expect(
      page.locator('[data-testid="file-node"][data-name="scratch.md"]')
    ).toHaveCount(0)

    await fillEditor(page, '# Scratch\n\nPlain note.\n')
    await page.getByTestId('save-button').click()
    await expect(page.getByTestId('notice')).toContainText('Saved notes/scratch.md')

    // Once saved it appears, and the row the editor has open is the marked one.
    const row = page.locator('[data-testid="file-node"][data-name="scratch.md"]')
    await expect(row).toBeVisible()
    await expect(row).toHaveAttribute('data-selected', 'true')
    const borderLeftColor = () =>
      row.evaluate((el) => getComputedStyle(el).borderLeftColor)
    const siblingBorderLeftColor = () =>
      page
        .locator('[data-testid="file-node"][data-name="todo.md"]')
        .evaluate((el) => getComputedStyle(el).borderLeftColor)
    expect(await borderLeftColor()).not.toBe(await siblingBorderLeftColor())
  })
})
