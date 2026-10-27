import { Page } from '@playwright/test'
import {
  test,
  expect,
  gotoApp,
  clickFileNode,
  expectEditor,
  expectEditorValue,
  fillEditor,
  submitPassword,
  fetchMockState,
} from './helpers'

const REPO = 'mockuser/demo-notes'
const FILE = 'welcome.md.age'
const PASSWORD = 'demo-password'
const EDITED = '# Welcome\n\nAutosaved while typing.\n'
// Longer than AUTOSAVE_DELAY_MS in editor-area.tsx, with margin for the UI.
const PAST_AUTOSAVE_DELAY_MS = 2500

async function setAutosave(page: Page, enabled: boolean): Promise<void> {
  await page.getByTestId('settings-button').click()
  await expect(page.getByTestId('settings-dialog')).toBeVisible()
  const toggle = page.getByTestId('autosave-toggle')
  if ((await toggle.getAttribute('aria-checked')) !== String(enabled)) {
    await toggle.click()
  }
  await expect(toggle).toHaveAttribute('aria-checked', String(enabled))
  await page.getByTestId('settings-done').click()
  await expect(page.getByTestId('settings-dialog')).toBeHidden()
}

async function unlockRepo(page: Page): Promise<void> {
  await page.getByTestId('repo-lock-toggle').click()
  await submitPassword(page, 'unlock', PASSWORD)
  await expect(page.getByTestId('repo-lock-status')).toHaveAttribute(
    'data-repo-status',
    'unlocked'
  )
}

test.describe('Autosave', () => {
  test('is off by default and leaves edits unsaved', async ({ page }) => {
    await gotoApp(page)
    await unlockRepo(page)
    await clickFileNode(page, FILE)
    await expectEditor(page, FILE)

    await fillEditor(page, EDITED)
    await expect(page.getByTestId('editor-status')).toHaveAttribute('data-status', 'modified')

    await page.waitForTimeout(PAST_AUTOSAVE_DELAY_MS)
    await expect(page.getByTestId('editor-status')).toHaveAttribute('data-status', 'modified')
    await expect(page.getByTestId('autosave-status')).toHaveCount(0)
  })

  test('saves edits shortly after typing stops, and the setting persists', async ({
    page,
    request,
  }) => {
    await gotoApp(page)
    await setAutosave(page, true)
    await unlockRepo(page)

    await clickFileNode(page, FILE)
    await expectEditor(page, FILE)
    const before = (await fetchMockState(request))[REPO][FILE]

    await fillEditor(page, EDITED)
    await expect(page.getByTestId('autosave-status')).toHaveAttribute('data-state', 'on')
    await expect(page.getByTestId('editor-status')).toHaveAttribute('data-status', 'saved')
    await expect(page.getByTestId('save-button')).toHaveAttribute('data-state', 'clean')
    await expect(page.getByTestId('notice')).toContainText(`Saved ${FILE}`)

    const after = (await fetchMockState(request))[REPO][FILE]
    expect(after).not.toEqual(before)
    expect(after).toContain('-----BEGIN AGE ENCRYPTED FILE-----')

    // The preference is stored per browser, so it survives a reload.
    await page.reload()
    await gotoApp(page)
    await page.getByTestId('settings-button').click()
    await expect(page.getByTestId('autosave-toggle')).toHaveAttribute('aria-checked', 'true')
    await page.getByTestId('settings-done').click()

    // The autosaved bytes decrypt back to the edited text.
    await clickFileNode(page, FILE)
    await submitPassword(page, 'unlock', PASSWORD)
    await expectEditor(page, FILE, EDITED)
  })

  test('keeps accepting edits while a save is in flight and saves the latest text', async ({
    page,
  }) => {
    // Hold the first save open so that edits land while it is in flight.
    let releaseFirstSave!: () => void
    const firstSaveHeld = new Promise<void>((resolve) => {
      releaseFirstSave = resolve
    })
    let saveRequests = 0
    await page.route('**/api/repos/*/*/save', async (route) => {
      saveRequests += 1
      if (saveRequests === 1) await firstSaveHeld
      await route.continue()
    })

    await gotoApp(page)
    await setAutosave(page, true)
    await unlockRepo(page)
    await clickFileNode(page, FILE)
    await expectEditor(page, FILE)

    await fillEditor(page, '# Welcome\n\nFirst.\n')
    await expect(page.getByTestId('editor-status')).toHaveAttribute('data-status', 'saving')

    // Typing while the save is still running must not be blocked or reverted.
    await fillEditor(page, '# Welcome\n\nFirst.\nSecond.\n')
    await expectEditorValue(page, '# Welcome\n\nFirst.\nSecond.\n')

    releaseFirstSave()
    await expect(page.getByTestId('editor-status')).toHaveAttribute('data-status', 'saved', {
      timeout: 20_000,
    })
    await expectEditorValue(page, '# Welcome\n\nFirst.\nSecond.\n')

    // The latest text, not the snapshot taken when the first save started, is
    // what ends up stored.
    await page.unroute('**/api/repos/*/*/save')
    await page.reload()
    await gotoApp(page)
    await clickFileNode(page, FILE)
    await submitPassword(page, 'unlock', PASSWORD)
    await expectEditor(page, FILE, '# Welcome\n\nFirst.\nSecond.\n')
    expect(saveRequests).toBeGreaterThanOrEqual(2)
  })

  test('never opens a password dialog while the repository is locked', async ({ page }) => {
    await gotoApp(page)
    await setAutosave(page, true)
    await unlockRepo(page)

    await clickFileNode(page, FILE)
    await expectEditor(page, FILE)

    // Lock with the file still open. Autosave must pause rather than ask for
    // the password in the middle of typing.
    await page.getByTestId('repo-lock-toggle').click()
    await expect(page.getByTestId('repo-lock-status')).toHaveAttribute(
      'data-repo-status',
      'locked'
    )

    await fillEditor(page, EDITED)
    await expect(page.getByTestId('autosave-status')).toHaveAttribute('data-state', 'paused')

    await page.waitForTimeout(PAST_AUTOSAVE_DELAY_MS)
    await expect(page.getByTestId('save-password-dialog')).toHaveCount(0)
    await expect(page.getByTestId('editor-status')).toHaveAttribute('data-status', 'modified')
  })
})
