import {
  test,
  expect,
  gotoApp,
  clickFileNode,
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

    await expectEditor(page, 'welcome.md.age', /Welcome/)
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

    await clickFileNode(page, 'notes')
    await clickFileNode(page, 'notes/secret.md.age')

    await expect(page.getByTestId('decrypt-error-title')).toBeVisible()
    await expect(page.getByTestId('decrypt-error-title')).toHaveText(
      'Cannot Decrypt File'
    )
    await expect(page.getByTestId('decrypt-error-description')).toContainText(
      'notes/secret.md.age'
    )

    // A wrong alternative password reports an error.
    await submitPassword(page, 'decrypt-error', 'still-wrong')
    await expect(page.getByTestId('decrypt-error-error')).toContainText(
      'could not decrypt this file'
    )

    // The file's real password decrypts it and remembers it.
    await submitPassword(page, 'decrypt-error', 'different-password')
    await expect(page.getByTestId('decrypt-error-title')).toBeHidden()
    await expectEditor(page, 'notes/secret.md.age', /Secret Notes/)
    await expect(page.getByTestId('notice')).toHaveAttribute('data-notice-type', 'success')
    await expect(page.getByTestId('notice')).toContainText('alternative password')
    // Repository stays unlocked.
    await expect(page.getByTestId('repo-lock-status')).toHaveAttribute(
      'data-repo-status',
      'unlocked'
    )
  })
})
