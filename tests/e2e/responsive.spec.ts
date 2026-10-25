import { test, expect, gotoApp } from './helpers'

/**
 * The shell is one component with two layouts: an inline column at `md` and up,
 * and an off-canvas `Sheet` below it. The desktop suite already exercises the
 * inline layout, so these cover the mobile branch and the desktop collapse.
 */

test.describe('Responsive app shell', () => {
  test('mobile viewport gets an off-canvas sidebar with no horizontal overflow', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 667 })
    await page.goto('/app')

    // Nothing may push the document wider than the viewport.
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth
      )
    ).toBe(0)

    // The inline column is not rendered at all on mobile.
    await expect(page.locator('[data-slot="sidebar-container"]')).toHaveCount(0)

    // The editor header keeps the trigger, so the tree stays reachable.
    const trigger = page.locator('[data-slot="sidebar-trigger"]').last()
    await expect(trigger).toBeVisible()
    await trigger.click()

    const sheet = page.locator('[data-sidebar="sidebar"]')
    await expect(sheet).toBeVisible()
    await expect(
      page.locator('[data-testid="file-node"][data-path="README.md"]')
    ).toBeVisible()

    await page.keyboard.press('Escape')
    await expect(sheet).toBeHidden()
  })

  test('the settings theme choice switches the document to the dark palette', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 667 })
    await page.goto('/app')
    await page.locator('[data-slot="sidebar-trigger"]').last().click()

    // Opening settings from the sheet closes the sheet and shows the dialog.
    await page.getByTestId('settings-button').click()
    await expect(page.getByTestId('settings-dialog')).toBeVisible()
    await expect(page.locator('[data-sidebar="sidebar"]')).toBeHidden()

    await page.getByTestId('theme-option-dark').click()

    const html = page.locator('html')
    await expect(html).toHaveClass(/dark/)

    // `--gc-surface` and `--gc-fg` must come from the `.dark` block.
    const dark = await html.evaluate((el) => {
      const s = getComputedStyle(el)
      return {
        surface: s.getPropertyValue('--gc-surface').trim(),
        fg: s.getPropertyValue('--gc-fg').trim(),
      }
    })
    expect(dark).toEqual({ surface: '#0d1117', fg: '#e6edf3' })

    await page.getByTestId('theme-option-light').click()
    await expect(html).not.toHaveClass(/dark/)

    await page.getByTestId('settings-done').click()
    await expect(page.getByTestId('settings-dialog')).toBeHidden()
  })

  test('desktop keeps the inline sidebar and collapses it with the trigger', async ({
    page,
  }) => {
    await gotoApp(page)

    const container = page.locator('[data-slot="sidebar-container"]')
    const sidebar = page.locator('[data-slot="sidebar"][data-variant]')
    // The collapsed `offcanvas` sidebar is translated out of the viewport rather
    // than unmounted, so assert the state attribute and the collapsed gap.
    const gap = page.locator('[data-slot="sidebar-gap"]')

    await expect(sidebar).toHaveAttribute('data-state', 'expanded')
    await expect(container).toBeVisible()
    await expect(gap).toHaveCSS('width', '256px')
    await expect(
      page.locator('[data-testid="file-node"][data-path="README.md"]')
    ).toBeVisible()

    await page.locator('[data-slot="sidebar-trigger"]').last().click()
    await expect(sidebar).toHaveAttribute('data-state', 'collapsed')
    await expect(gap).toHaveCSS('width', '0px')

    await page.locator('[data-slot="sidebar-trigger"]').last().click()
    await expect(sidebar).toHaveAttribute('data-state', 'expanded')
    await expect(gap).toHaveCSS('width', '256px')
  })
})
