import { test, expect, gotoApp, submitPassword } from './helpers'

/**
 * Guards the style guide (docs/style-guide.md) being applied to the unlock
 * popup: header medallion, dialog radius, tinted footer actions and the inline
 * error alert must all resolve to the shared `--gc-*` tokens.
 */
test.describe('Style guide applied to the unlock popup', () => {
  test('uses the shared dialog block: medallion, radius and flat actions', async ({
    page,
  }) => {
    await gotoApp(page)
    await page.getByTestId('repo-lock-toggle').click()
    await expect(page.getByTestId('unlock-title')).toBeVisible()

    // Header medallion (style guide §6.7).
    await expect(page.getByTestId('unlock-icon')).toBeVisible()

    const styles = await page.getByTestId('unlock-dialog').evaluate((dialog) => {
      const pick = (selector: string) =>
        getComputedStyle(dialog.querySelector(selector) as HTMLElement)
      const dialogStyle = getComputedStyle(dialog)
      const submit = pick('[data-testid="unlock-submit"]')
      const cancel = pick('[data-testid="unlock-cancel"]')
      const input = pick('[data-testid="unlock-input"]')
      return {
        dialogRadius: dialogStyle.borderTopLeftRadius,
        submitBg: submit.backgroundColor,
        // Tailwind v4 `shadow-none` sets --tw-shadow to a transparent value.
        submitTwShadow: submit.getPropertyValue('--tw-shadow').trim(),
        cancelBg: cancel.backgroundColor,
        inputRadius: input.borderTopLeftRadius,
        inputBorder: input.borderTopColor,
      }
    })

    // rounded-gc-lg
    expect(styles.dialogRadius).toBe('8px')
    // bg-gc-success + flat (no shadow)
    expect(styles.submitBg).toBe('rgb(46, 164, 79)')
    expect(styles.submitTwShadow).toBe('0 0 #0000')
    // outline cancel on bg-gc-surface
    expect(styles.cancelBg).toBe('rgb(255, 255, 255)')
    // input rounded-gc-md + border-gc-border
    expect(styles.inputRadius).toBe('6px')
    expect(styles.inputBorder).toBe('rgb(225, 228, 232)')
  })

  test('renders the inline error alert with the guide danger tokens', async ({
    page,
  }) => {
    await gotoApp(page)
    await page.getByTestId('repo-lock-toggle').click()
    await expect(page.getByTestId('unlock-title')).toBeVisible()

    await submitPassword(page, 'unlock', 'not-the-password')
    const error = page.getByTestId('unlock-error')
    await expect(error).toBeVisible()

    const styles = await error.evaluate((el) => {
      const cs = getComputedStyle(el)
      return {
        background: cs.backgroundColor,
        color: cs.color,
        radius: cs.borderTopLeftRadius,
      }
    })

    expect(styles.background).toBe('rgb(255, 235, 233)') // --gc-danger-bg
    expect(styles.color).toBe('rgb(207, 34, 46)') // --gc-danger-fg
    expect(styles.radius).toBe('6px') // rounded-gc-md
  })
})
