import { test, expect } from './helpers'

test.describe('Landing page', () => {
  test('renders the marketing content and sign-in affordance', async ({ page }) => {
    await page.goto('/')

    await expect(
      page.getByRole('heading', { name: 'GitCloak 🔐' })
    ).toBeVisible()
    await expect(
      page.getByText('Secure, encrypted markdown editing for GitHub repositories')
    ).toBeVisible()

    // Feature list
    await expect(page.getByText('Client-side encryption (age format)')).toBeVisible()
    await expect(page.getByText('Zero-knowledge architecture')).toBeVisible()
    await expect(page.getByText('GitHub OAuth integration')).toBeVisible()
    await expect(page.getByText('No vendor lock-in')).toBeVisible()

    // Primary call to action and footer link
    await expect(page.getByRole('button', { name: 'Sign in with GitHub' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'View on GitHub' })).toBeVisible()
    await expect(
      page.getByText('Your encryption key never leaves your browser')
    ).toBeVisible()
  })
})
