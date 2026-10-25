import type { Metadata, Viewport } from "next"
import "./globals.css"
import { Providers } from "@/components/providers"

export const metadata: Metadata = {
  title: "GitCloak",
  description: "Secure, encrypted markdown editing for GitHub repositories",
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Keeps the shell edge-to-edge under the notch on iOS while staying themed.
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0d1117" },
  ],
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
