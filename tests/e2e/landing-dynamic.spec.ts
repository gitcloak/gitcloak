import type { Page } from '@playwright/test'
import { test, expect } from './helpers'

/**
 * The landing page is normally unreachable in the suite: the mock backend
 * always seeds a signed-in session, which redirects `/` to `/app`. `?stay=1`
 * (honoured in mock builds only — see `src/app/page.tsx`) keeps it mounted so
 * the hero can be driven for real. `tests/e2e/landing.spec.ts` still covers the
 * redirect itself.
 */
const LANDING = '/?stay=1'

/** Wait for the particle field's test hook to be published. */
async function waitForBackground(page: Page): Promise<void> {
  await expect
    .poll(() => page.evaluate(() => typeof window.__landingBackground))
    .toBe('object')
}

test.describe('Landing page dynamics', () => {
  test('renders the hero and keeps every link clickable above the canvas', async ({
    page,
  }) => {
    await page.goto(LANDING)

    await expect(page.getByTestId('spotlight-logo')).toBeVisible()
    await expect(page.getByTestId('spotlight-logo-lit')).toHaveCount(1)

    // The particle field is decorative and must never eat a click.
    const canvas = page.getByTestId('landing-background')
    await expect(canvas).toBeVisible()
    await expect(canvas).toHaveAttribute('aria-hidden', 'true')
    expect(await canvas.evaluate((el) => getComputedStyle(el).pointerEvents)).toBe(
      'none'
    )

    // The header link sits above the canvas: the topmost element at its centre
    // is the link itself, not the canvas covering the viewport.
    const github = page.getByRole('link', { name: 'View GitCloak on GitHub' })
    const box = (await github.boundingBox())!
    const topmost = await page.evaluate(
      ({ x, y }) =>
        document.elementFromPoint(x, y)?.closest('a')?.getAttribute('aria-label') ??
        null,
      { x: box.x + box.width / 2, y: box.y + box.height / 2 }
    )
    expect(topmost).toBe('View GitCloak on GitHub')

    // The hero's call to action is clickable too: the topmost element at its
    // centre is the button, not the canvas. (The mock session is signed in, so
    // the button offers to sign out rather than in.)
    const cta = page.getByRole('button', { name: /^Sign (in with GitHub|Out)$/ })
    await expect(cta).toBeVisible()
    const ctaBox = (await cta.boundingBox())!
    const ctaTopmost = await page.evaluate(
      ({ x, y }) => document.elementFromPoint(x, y)?.closest('button')?.textContent ?? null,
      { x: ctaBox.x + ctaBox.width / 2, y: ctaBox.y + ctaBox.height / 2 }
    )
    expect(ctaTopmost).toMatch(/Sign (in with GitHub|Out)/)
  })

  test('particles drift, are pushed aside by the cursor, then settle back', async ({
    page,
  }) => {
    await page.goto(LANDING)
    const canvas = page.getByTestId('landing-background')
    await expect(canvas).toBeVisible()
    await waitForBackground(page)

    // The loop is running.
    const first = await page.evaluate(() => window.__landingBackground!.frames())
    await page.waitForTimeout(300)
    expect(
      await page.evaluate(() => window.__landingBackground!.frames())
    ).toBeGreaterThan(first)

    // Before the pointer arrives nothing is being pushed.
    expect(
      await page.evaluate(() => window.__landingBackground!.pointerActive())
    ).toBe(false)

    // Hovering the hero shoves the particles around the pointer.
    const box = (await canvas.boundingBox())!
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    expect(
      await page.evaluate(() => window.__landingBackground!.pointerActive())
    ).toBe(true)
    await expect
      .poll(() => page.evaluate(() => window.__landingBackground!.maxOffset()))
      .toBeGreaterThan(0.2)

    const pushed = await page.evaluate(() =>
      window
        .__landingBackground!.offsets()
        .map((value, index) => (value > 0.1 ? index : -1))
        .filter((index) => index >= 0)
    )
    expect(pushed.length).toBeGreaterThan(0)

    // Move the pointer to the far corner: the shoved particles are nowhere
    // near it, so they can only decay — they settle back onto their drift.
    await page.mouse.move(box.x + 8, box.y + 8)
    await page.waitForTimeout(1200)

    const settled = await page.evaluate(
      (indices) => indices.map((index) => window.__landingBackground!.offsets()[index]),
      pushed
    )
    expect(Math.max(...settled)).toBeLessThan(0.05)
  })

  test('the spotlight follows the pointer and fades when it leaves', async ({
    page,
  }) => {
    await page.goto(LANDING)
    const logo = page.getByTestId('spotlight-logo')
    const lit = page.getByTestId('spotlight-logo-lit')
    await expect(logo).toHaveAttribute('data-spotlight', 'idle')

    const box = (await logo.boundingBox())!
    await page.mouse.move(box.x + 12, box.y + 20)
    await expect(logo).toHaveAttribute('data-spotlight', 'active')

    // The light originates at the pointer, measured inside the logo box.
    const spot = await logo.evaluate((el) => {
      const cs = getComputedStyle(el)
      return {
        x: cs.getPropertyValue('--spot-x').trim(),
        y: cs.getPropertyValue('--spot-y').trim(),
        opacity: cs.getPropertyValue('--spot-opacity').trim(),
      }
    })
    expect(parseFloat(spot.x)).toBeCloseTo(12, 0)
    expect(parseFloat(spot.y)).toBeCloseTo(20, 0)
    expect(spot.opacity).toBe('1')

    // The lit copy is revealed by a radial mask centred on that light.
    const mask = await lit.evaluate((el) => getComputedStyle(el).maskImage)
    expect(mask).toContain('radial-gradient')
    expect(mask).toContain('12px')
    expect(mask).toContain('20px')

    // The pointer leaves the window: the light fades out and the mark returns
    // to its faint outline.
    await page.mouse.move(-120, -120)
    await expect(logo).toHaveAttribute('data-spotlight', 'idle')
    await expect
      .poll(() =>
        logo.evaluate((el) =>
          getComputedStyle(el).getPropertyValue('--spot-opacity').trim()
        )
      )
      .toBe('0')
  })

  test('the spotlight is a big irregular form that keeps changing', async ({
    page,
  }) => {
    await page.goto(LANDING)
    const logo = page.getByTestId('spotlight-logo')
    const lit = page.getByTestId('spotlight-logo-lit')

    const box = (await logo.boundingBox())!
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    await expect(logo).toHaveAttribute('data-spotlight', 'active')

    const maskOf = () => lit.evaluate((el) => getComputedStyle(el).maskImage)
    const first = await maskOf()

    // A big main lobe...
    expect(first).toContain('200px')
    // ...union of several overlapping lobes, so the edge is irregular...
    expect(first.match(/radial-gradient/g)?.length ?? 0).toBeGreaterThan(1)
    // ...and the falloff is spread across the lobe rather than a tight circle.
    expect(first).toContain('80%')

    // The lobes orbit, so the form keeps changing while the light is live.
    let changed = false
    for (let i = 0; i < 12 && !changed; i += 1) {
      await page.waitForTimeout(150)
      changed = (await maskOf()) !== first
    }
    expect(changed, 'the spotlight form should change over time').toBe(true)
  })

  test('prefers-reduced-motion holds a still frame and a lit logo', async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto(LANDING)
    await waitForBackground(page)

    const logo = page.getByTestId('spotlight-logo')
    const lit = page.getByTestId('spotlight-logo-lit')

    // No animation loop at all.
    const frames = await page.evaluate(() => window.__landingBackground!.frames())
    expect(frames).toBe(0)
    await page.waitForTimeout(400)
    expect(await page.evaluate(() => window.__landingBackground!.frames())).toBe(0)

    // The mark is held lit and unmasked — there is no light to follow.
    await expect(logo).toHaveAttribute('data-spotlight', 'static')
    await expect(lit).toHaveCSS('opacity', '1')
    expect(await lit.evaluate((el) => getComputedStyle(el).maskImage)).toBe('none')

    // Moving the pointer changes nothing.
    await page.mouse.move(200, 200)
    await expect(logo).toHaveAttribute('data-spotlight', 'static')
  })

  test('particles take their colour from the theme token', async ({ page }) => {
    await page.goto(LANDING)
    await waitForBackground(page)

    await expect
      .poll(() => page.evaluate(() => window.__landingBackground?.color() ?? ''))
      .toBe('#0969da') // --gc-accent, light

    await page.getByTestId('theme-toggle').click()
    await page.getByRole('menuitem', { name: 'Dark' }).click()
    await expect(page.locator('html')).toHaveClass(/dark/)

    // The canvas re-reads the token when the theme flips.
    await expect
      .poll(() => page.evaluate(() => window.__landingBackground?.color() ?? ''))
      .toBe('#2f81f7') // --gc-accent, dark
  })
})
