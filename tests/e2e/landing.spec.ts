import { test, expect } from './helpers'

test.describe('Landing page', () => {
  // The mock backend always has a signed-in session, so the landing page's
  // "already authenticated" redirect sends visitors straight to the app.
  test('redirects a signed-in mock user to the app', async ({ page }) => {
    await page.goto('/')

    await expect(page).toHaveURL(/\/app$/)
    await expect(page.getByTestId('repo-selector')).toBeVisible()
  })
})
