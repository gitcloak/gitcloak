import { test, expect, gotoApp, submitPassword } from './helpers'

test.describe('Repository unlock flow', () => {
  test('rejects an incorrect password and then unlocks with the right one', async ({
    page,
  }) => {
    await gotoApp(page)

    await expect(page.getByTestId('repo-lock-status')).toContainText('Locked')

    await page.getByTestId('repo-lock-toggle').click()

    await expect(page.getByTestId('unlock-title')).toBeVisible()
    await expect(page.getByTestId('unlock-title')).toHaveText('Unlock Repository')
    await expect(page.getByTestId('unlock-description')).toContainText(
      'mockuser/demo-notes'
    )

    // Wrong password surfaces an inline error and keeps the repository locked.
    await submitPassword(page, 'unlock', 'not-the-password')
    await expect(page.getByTestId('unlock-error')).toContainText(
      'Incorrect password. Please try again.'
    )
    await expect(page.getByTestId('unlock-title')).toBeVisible()
    await expect(page.getByTestId('repo-lock-status')).toContainText('Locked')

    // Correct password unlocks and shows a success notice.
    await submitPassword(page, 'unlock', 'demo-password')
    await expect(page.getByTestId('unlock-title')).toBeHidden()
    await expect(page.getByTestId('repo-lock-status')).toHaveAttribute(
      'data-repo-status',
      'unlocked'
    )
    await expect(page.getByTestId('repo-lock-status')).toContainText('Unlocked')
    await expect(page.getByTestId('repo-lock-toggle')).toContainText('Lock repository')
    await expect(page.getByTestId('notice')).toHaveAttribute('data-notice-type', 'success')
    await expect(page.getByTestId('notice')).toContainText(
      'mockuser/demo-notes is now unlocked.'
    )
  })

  test('locks the repository again and clears the password from memory', async ({
    page,
  }) => {
    await gotoApp(page)

    // Unlock first.
    await page.getByTestId('repo-lock-toggle').click()
    await submitPassword(page, 'unlock', 'demo-password')
    await expect(page.getByTestId('repo-lock-status')).toHaveAttribute(
      'data-repo-status',
      'unlocked'
    )

    // Lock again.
    await page.getByTestId('repo-lock-toggle').click()
    await expect(page.getByTestId('repo-lock-status')).toHaveAttribute(
      'data-repo-status',
      'locked'
    )
    await expect(page.getByTestId('repo-lock-toggle')).toContainText('Unlock repository')
    await expect(page.getByTestId('notice')).toHaveAttribute('data-notice-type', 'info')
    await expect(page.getByTestId('notice')).toContainText(
      'Password removed from memory.'
    )
  })

  test('the cancel button dismisses the unlock dialog', async ({ page }) => {
    await gotoApp(page)

    await page.getByTestId('repo-lock-toggle').click()
    await expect(page.getByTestId('unlock-title')).toBeVisible()

    await page.getByTestId('unlock-cancel').click()
    await expect(page.getByTestId('unlock-title')).toBeHidden()
    await expect(page.getByTestId('repo-lock-status')).toContainText('Locked')
  })
})
