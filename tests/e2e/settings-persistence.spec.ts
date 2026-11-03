import type { Page } from '@playwright/test'
import { test, expect, gotoApp } from './helpers'

/** The cookie names the app persists settings under (see settings-cookie.ts). */
const THEME_COOKIE = 'gitcloak_theme'
const AUTOSAVE_COOKIE = 'gitcloak_autosave'

async function readCookies(page: Page): Promise<string> {
  return page.evaluate(() => document.cookie)
}

async function openSettings(page: Page): Promise<void> {
  await page.getByTestId('settings-button').click()
  await expect(page.getByTestId('settings-dialog')).toBeVisible()
}

test.describe('Settings persistence', () => {
  test('autosave is stored in a cookie, survives a reload, and is shown next to Save', async ({
    page,
  }) => {
    await gotoApp(page)

    // Off by default: no cookie, no indicator.
    expect(await readCookies(page)).not.toContain(`${AUTOSAVE_COOKIE}=`)
    await expect(page.getByTestId('autosave-indicator')).toHaveCount(0)

    await openSettings(page)
    await page.getByTestId('autosave-toggle').click()
    await expect(page.getByTestId('autosave-toggle')).toHaveAttribute(
      'aria-checked',
      'true'
    )
    await page.getByTestId('settings-done').click()

    // The preference is written straight to a first-party cookie.
    await expect
      .poll(() => readCookies(page))
      .toContain(`${AUTOSAVE_COOKIE}=true`)

    // And it is visible right beside the Save button.
    const indicator = page.getByTestId('autosave-indicator')
    await expect(indicator).toBeVisible()
    await expect(indicator).toHaveAttribute('data-state', 'on')
    await expect(indicator).toContainText('Autosave on')

    // Drop localStorage so only the cookie can restore the setting.
    await page.evaluate(() => window.localStorage.clear())
    await page.reload()
    await gotoApp(page)

    await expect
      .poll(() => readCookies(page))
      .toContain(`${AUTOSAVE_COOKIE}=true`)
    await expect(page.getByTestId('autosave-indicator')).toHaveAttribute(
      'data-state',
      'on'
    )
    await openSettings(page)
    await expect(page.getByTestId('autosave-toggle')).toHaveAttribute(
      'aria-checked',
      'true'
    )
  })

  test('theme choice is stored in a cookie and applied after a reload', async ({
    page,
  }) => {
    await gotoApp(page)
    await openSettings(page)

    await page.getByTestId('theme-option-dark').click()
    await expect(page.locator('html')).toHaveClass(/dark/)
    await page.getByTestId('settings-done').click()

    await expect
      .poll(() => readCookies(page))
      .toContain(`${THEME_COOKIE}=dark`)

    // Drop localStorage: only the cookie is left to restore the theme.
    await page.evaluate(() => window.localStorage.clear())
    await page.reload()
    await gotoApp(page)

    await expect(page.locator('html')).toHaveClass(/dark/)
    await expect
      .poll(() => readCookies(page))
      .toContain(`${THEME_COOKIE}=dark`)
  })
})
