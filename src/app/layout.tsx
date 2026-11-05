import type { Metadata, Viewport } from "next"
import "./globals.css"
import { Providers } from "@/components/providers"

export const metadata: Metadata = {
  title: "GitCloak",
  description: "Secure, encrypted markdown editing for GitHub repositories",
  applicationName: "GitCloak",
  // Home-screen install. `appleWebApp` emits `mobile-web-app-capable`,
  // `apple-mobile-web-app-title` and `apple-mobile-web-app-status-bar-style`;
  // the older `apple-mobile-web-app-capable` spelling is added by hand below,
  // because iOS before 16.4 only honours that one. `default` (rather than
  // `black-translucent`) keeps the status bar text legible in both themes: a
  // translucent bar forces white text, which disappears over the light shell.
  // The manifest itself is served by `src/app/manifest.ts`.
  appleWebApp: {
    capable: true,
    title: "GitCloak",
    statusBarStyle: "default",
  },
  other: {
    "apple-mobile-web-app-capable": "yes",
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    // iOS asks for 180x180, and composites a transparent pixel onto black — so
    // this file has no alpha channel at all.
    apple: [
      { url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Keeps the shell edge-to-edge under the notch on iOS while staying themed.
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0d1117" },
  ],
  // Let the app paint into the notch and the home-indicator strip. The shell
  // then keeps its own chrome clear of the insets (see `gc-safe-insets`).
  viewportFit: "cover",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    // `suppressHydrationWarning` is required by next-themes: it sets the theme
    // class on <html> before React hydrates, so the server/client markup differ.
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-svh bg-background font-sans text-foreground antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
