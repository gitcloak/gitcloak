'use client'

import { ThemeProvider } from "next-themes"
import { SessionProvider } from "next-auth/react"
import type { Session } from "next-auth"

// Preview deployments and end-to-end tests run against the mock backend,
// which has no real OAuth. Seed the provider with a signed-in session so the
// UI renders without ever calling Auth.js.
const MOCK_MODE = process.env.NEXT_PUBLIC_MOCK_BACKEND === "1"

const mockSession = MOCK_MODE
  ? ({
      user: {
        id: "mock-user",
        name: "Mock User",
        email: "mock@example.com",
      },
      expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    } as Session)
  : undefined

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      // `system` is the default so the shell follows the OS. Playwright renders
      // with `prefers-color-scheme: light` (pinned in playwright.config.ts), so
      // the computed-style assertions in style-guide.spec.ts stay deterministic.
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <SessionProvider session={mockSession}>{children}</SessionProvider>
    </ThemeProvider>
  )
}
