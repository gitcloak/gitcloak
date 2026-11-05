import type { MetadataRoute } from 'next'

/**
 * The web app manifest, served by Next at `/manifest.webmanifest` and linked
 * from the head automatically because it lives at this path in the app router.
 *
 * It is what makes the app installable: iOS uses it together with the Apple
 * meta tags in `layout.tsx` for "Add to Home Screen", and Android/Chrome uses it
 * for the install prompt and the standalone window (icon, title, colors).
 *
 * A cold launch lands on `/`. `/app` redirects to `/` without a session, and `/`
 * sends a signed-in visitor straight to `/app`, so `/` is the one entry point
 * that is right whether or not the auth cookie survived, which iOS does not
 * guarantee for a home-screen launch.
 */

/**
 * The brand gradient of the icon and the in-app medallion (`--gc-brand` and
 * `--gc-brand-alt` in `globals.css`). A manifest color is a single value with no
 * way to follow `prefers-color-scheme`, so the splash uses the brand accent
 * rather than the light or the dark surface: it is the one color that reads the
 * same in both themes, and it matches the icon that is drawn on top of it.
 */
const BRAND = '#667eea'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'GitCloak',
    short_name: 'GitCloak',
    description: 'Secure, encrypted markdown editing for GitHub repositories',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    theme_color: BRAND,
    background_color: BRAND,
    icons: [
      // `any` for the launcher and task switcher, `maskable` for Android's
      // adaptive icons, whose 80% safe circle the art keeps inside. The SVG is
      // the source the PNGs were rendered from.
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      {
        src: '/icons/icon-maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
      { src: '/icons/gitcloak-mark.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
    ],
  }
}
