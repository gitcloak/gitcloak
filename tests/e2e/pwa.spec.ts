import { test, expect, gotoApp } from './helpers'

/**
 * What makes the app installable on a phone's home screen.
 *
 * Nothing here can put an icon on a real iOS home screen, so these cover
 * everything the install reads: the manifest and the files it points at, the
 * Apple-specific meta tags, the edge-to-edge viewport, and the rule that keeps
 * the shell clear of the device insets. Chromium reports no insets, so the
 * launch itself stays a check on a real device.
 */

const ICONS = [
  { src: '/icons/icon-192.png', width: 192, height: 192 },
  { src: '/icons/icon-512.png', width: 512, height: 512 },
  { src: '/icons/icon-maskable-512.png', width: 512, height: 512 },
  { src: '/icons/apple-touch-icon.png', width: 180, height: 180 },
]

/** Read a PNG's IHDR: its pixel size and whether it carries an alpha channel. */
function readPngHeader(buffer: Buffer): {
  width: number
  height: number
  alpha: boolean
} {
  expect(buffer.subarray(1, 4).toString('latin1'), 'PNG signature').toBe('PNG')
  const colorType = buffer[25]
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
    // 4 is grey+alpha and 6 is RGBA; 0, 2 and 3 (palette) can carry an opaque
    // image with no alpha channel at all.
    alpha: colorType === 4 || colorType === 6,
  }
}

test.describe('Installable web app', () => {
  test('serves a manifest the browser can install from', async ({ page, request }) => {
    const response = await request.get('/manifest.webmanifest')
    expect(response.ok()).toBe(true)
    expect(response.headers()['content-type']).toContain('json')

    const manifest = await response.json()
    expect(manifest.name).toBe('GitCloak')
    expect(manifest.short_name).toBe('GitCloak')
    expect(manifest.description).toContain('encrypted')
    // `/app` redirects to `/` without a session, so `/` is the entry point that
    // is right for a cold launch either way.
    expect(manifest.start_url).toBe('/')
    expect(manifest.scope).toBe('/')
    expect(manifest.display).toBe('standalone')
    // A single colour stands for the splash in both themes, so it is the brand
    // accent — the one the icon beside it is painted with.
    expect(manifest.theme_color).toBe('#667eea')
    expect(manifest.background_color).toBe('#667eea')

    const icons = manifest.icons as { sizes: string; purpose?: string }[]
    const sizes = icons.map((icon) => icon.sizes)
    expect(sizes).toContain('192x192')
    expect(sizes).toContain('512x512')
    // Android crops a home-screen icon, and only a `maskable` one is drawn
    // inside the safe circle instead of being cut off.
    expect(icons.some((icon) => icon.purpose === 'maskable')).toBe(true)

    // The head has to link it, or none of the above is ever read.
    await gotoApp(page)
    await expect(page.locator('link[rel="manifest"]')).toHaveAttribute(
      'href',
      '/manifest.webmanifest'
    )
  })

  test('ships every icon at the size it is declared at', async ({ request }) => {
    for (const icon of ICONS) {
      const response = await request.get(icon.src)
      expect(response.ok(), `${icon.src} should be served`).toBe(true)
      expect(response.headers()['content-type'], `${icon.src} content type`).toBe(
        'image/png'
      )

      const header = readPngHeader(await response.body())
      expect(header.width, `${icon.src} width`).toBe(icon.width)
      expect(header.height, `${icon.src} height`).toBe(icon.height)
    }
  })

  test('the Apple touch icon is opaque, so iOS cannot composite it onto black', async ({
    request,
  }) => {
    // iOS ignores transparency in a home-screen icon and fills it with black,
    // which is what turns an icon into a black or blank tile.
    const header = readPngHeader(await (await request.get('/icons/apple-touch-icon.png')).body())
    expect(header.width).toBe(180)
    expect(header.alpha).toBe(false)
  })

  test('carries the Apple home-screen tags', async ({ page }) => {
    await gotoApp(page)

    const meta = (name: string) => page.locator(`meta[name="${name}"]`)
    await expect(meta('apple-mobile-web-app-title')).toHaveAttribute('content', 'GitCloak')
    // Both spellings: the `apple-` one is what iOS before 16.4 reads, the bare
    // one is the current standard and what newer iOS prefers.
    await expect(meta('apple-mobile-web-app-capable')).toHaveAttribute('content', 'yes')
    await expect(meta('mobile-web-app-capable')).toHaveAttribute('content', 'yes')
    await expect(meta('apple-mobile-web-app-status-bar-style')).toHaveAttribute(
      'content',
      'default'
    )

    const appleIcon = page.locator('link[rel="apple-touch-icon"]')
    await expect(appleIcon).toHaveAttribute('href', '/icons/apple-touch-icon.png')
    await expect(appleIcon).toHaveAttribute('sizes', '180x180')
  })

  test('runs edge-to-edge and keeps the shell clear of the device insets', async ({
    page,
  }) => {
    await gotoApp(page)

    // The web view paints under the notch and the home indicator...
    const viewport = await page.locator('meta[name="viewport"]').getAttribute('content')
    expect(viewport).toContain('viewport-fit=cover')

    // ...so the shell pads itself by the insets, on all four edges. The values
    // are 0 without device insets, which is why the rule is read rather than a
    // computed pixel value.
    await expect(page.locator('[data-slot="sidebar-wrapper"]')).toHaveClass(/gc-safe-insets/)

    const rule = await page.evaluate(() => {
      const collect = (rules: CSSRuleList): string[] => {
        const found: string[] = []
        for (const rule of Array.from(rules)) {
          if (rule instanceof CSSStyleRule && rule.selectorText === '.gc-safe-insets') {
            found.push(rule.style.cssText)
          } else if ('cssRules' in rule) {
            found.push(...collect((rule as CSSGroupingRule).cssRules))
          }
        }
        return found
      }
      const declarations = Array.from(document.styleSheets).flatMap((sheet) => {
        try {
          return collect(sheet.cssRules)
        } catch {
          return []
        }
      })
      return declarations.join('\n')
    })

    for (const edge of ['top', 'right', 'bottom', 'left']) {
      expect(rule).toContain(`padding-${edge}: env(safe-area-inset-${edge})`)
    }
  })
})
