import { test, expect, gotoApp } from './helpers'

test.describe('Add repositories', () => {
  test('extends the installation to a repository chosen in the dialog', async ({
    page,
  }) => {
    await gotoApp(page)

    await page.getByTestId('repo-selector').click()
    await page.getByTestId('add-repositories-button').click()

    await expect(page.getByTestId('add-repositories-dialog')).toBeVisible()

    // Only repositories the installation does not cover yet are offered.
    const options = page.getByTestId('add-repo-option')
    await expect(options).toHaveCount(2)
    await expect(options.nth(0)).toHaveAttribute('data-repo', 'mockuser/design-docs')
    await expect(options.nth(1)).toHaveAttribute('data-repo', 'mockuser/team-notes')

    // The fallback link points at GitHub's installation settings.
    await expect(page.getByTestId('add-repositories-manage-link')).toHaveAttribute(
      'href',
      'https://github.com/settings/installations/1'
    )

    await page
      .locator('[data-testid="add-repo-confirm"][data-repo="mockuser/design-docs"]')
      .click()

    // The row is marked added and the repository becomes the selected one.
    await expect(
      page.locator('[data-testid="add-repo-option"][data-repo="mockuser/design-docs"] [data-testid="add-repo-added"]')
    ).toBeVisible()
    await expect(page.getByTestId('repo-selector')).toHaveAttribute(
      'data-repo',
      'mockuser/design-docs'
    )

    await page.getByTestId('add-repositories-done').click()
    await expect(page.getByTestId('add-repositories-dialog')).toHaveCount(0)

    // It is now a normal repository in the selector, with its files.
    await page.getByTestId('repo-selector').click()
    await expect(page.getByTestId('repo-option')).toHaveCount(5)
    await expect(
      page.locator('[data-testid="repo-option"][data-repo="mockuser/design-docs"]')
    ).toBeVisible()
    await page
      .locator('[data-testid="repo-option"][data-repo="mockuser/design-docs"]')
      .click()

    await expect(
      page.locator('[data-testid="file-node"][data-path="design-docs.md"]')
    ).toBeVisible()
  })

  test('reports an error when GitHub rejects the repository', async ({
    page,
  }) => {
    await gotoApp(page)

    // The path "does-not-exist" is not in the selectable set, so the mock
    // backend refuses it the way GitHub would.
    await page.route('**/api/repos/available', async (route) => {
      await route.fulfill({
        json: {
          installation: {
            id: 1,
            accountLogin: 'mockuser',
            accountType: 'User',
            repositorySelection: 'selected',
            manageUrl: 'https://github.com/settings/installations/1',
          },
          selectable: [
            {
              id: 9999,
              name: 'does-not-exist',
              fullName: 'mockuser/does-not-exist',
              owner: 'mockuser',
              private: true,
              description: null,
              updatedAt: '2024-06-03T09:00:00.000Z',
            },
          ],
        },
      })
    })

    await page.getByTestId('repo-selector').click()
    await page.getByTestId('add-repositories-button').click()

    await page
      .locator('[data-testid="add-repo-confirm"][data-repo="mockuser/does-not-exist"]')
      .click()

    await expect(page.getByTestId('add-repositories-error')).toBeVisible()
  })
})
