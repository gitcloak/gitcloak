import {
  test,
  expect,
  gotoApp,
  clickFileNode,
  clickFileByName,
  expectEditor,
  submitPassword,
} from './helpers'

test.describe('File decryption', () => {
  test('prompts to unlock the repository, then decrypts with the repo password', async ({
    page,
  }) => {
    await gotoApp(page)

    await clickFileNode(page, 'welcome.md.age')

    // No password cached yet, so the unlock dialog is shown.
    await expect(page.getByTestId('unlock-title')).toBeVisible()
    await submitPassword(page, 'unlock', 'demo-password')

    // The old name is encrypted on unlock, and the open file follows it.
    await expectEditor(page, 'welcome.md', /Welcome/)
    await expect(page.getByTestId('editor-input')).toHaveValue(
      /encrypted with the repository password/
    )
    await expect(page.getByTestId('repo-lock-status')).toHaveAttribute(
      'data-repo-status',
      'unlocked'
    )
  })

  test('offers an alternative password when the repo password cannot decrypt a file', async ({
    page,
  }) => {
    await gotoApp(page)

    // Unlock the repository with the shared password first.
    await page.getByTestId('repo-lock-toggle').click()
    await submitPassword(page, 'unlock', 'demo-password')
    await expect(page.getByTestId('repo-lock-status')).toHaveAttribute(
      'data-repo-status',
      'unlocked'
    )
    // Unlocking renames old file names; wait until that has finished.
    await expect(page.getByTestId('notice')).toContainText('is now unlocked')

    await clickFileNode(page, 'notes')
    await clickFileByName(page, 'secret.md')

    await expect(page.getByTestId('decrypt-error-title')).toBeVisible()
    await expect(page.getByTestId('decrypt-error-title')).toHaveText(
      'Cannot Decrypt File'
    )
    // The dialog names the stored path, which sits in the `notes` folder.
    await expect(page.getByTestId('decrypt-error-description')).toContainText('notes/')

    // A wrong alternative password reports an error.
    await submitPassword(page, 'decrypt-error', 'still-wrong')
    await expect(page.getByTestId('decrypt-error-error')).toContainText(
      'could not decrypt this file'
    )

    // The file's real password decrypts it and remembers it.
    await submitPassword(page, 'decrypt-error', 'different-password')
    await expect(page.getByTestId('decrypt-error-title')).toBeHidden()
    await expectEditor(page, 'notes/secret.md', /Secret Notes/)
    await expect(page.getByTestId('notice')).toHaveAttribute('data-notice-type', 'success')
    await expect(page.getByTestId('notice')).toContainText('alternative password')
    // Repository stays unlocked.
    await expect(page.getByTestId('repo-lock-status')).toHaveAttribute(
      'data-repo-status',
      'unlocked'
    )
  })
})
