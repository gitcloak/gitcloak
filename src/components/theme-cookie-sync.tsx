'use client'

import { useEffect, useRef } from 'react'
import { useTheme } from 'next-themes'

import { readSettingCookie, writeSettingCookie } from '@/lib/settings-cookie'

/**
 * Persists the theme choice in a first-party cookie so it survives a reload
 * even where `localStorage` does not.
 *
 * `next-themes` only ever writes to `localStorage`. This component runs inside
 * the `ThemeProvider` and:
 *   1. restores the cookie into `next-themes` once, on mount, then
 *   2. mirrors every later change back into the cookie.
 *
 * The restore is deliberately one-shot. `next-themes`' `setTheme` changes
 * identity whenever the theme changes, so an effect that re-read the cookie on
 * every change would read the previous value for a frame and fight the write
 * effect — an update loop. It renders nothing.
 */
export function ThemeCookieSync() {
  const { theme, setTheme } = useTheme()
  const restored = useRef(false)

  useEffect(() => {
    if (restored.current) return
    restored.current = true
    const stored = readSettingCookie('theme')
    if (stored) setTheme((current) => (current === stored ? current : stored))
  }, [setTheme])

  useEffect(() => {
    if (theme) writeSettingCookie('theme', theme)
  }, [theme])

  return null
}
