import { describe, expect, it } from 'vitest'

import {
  parseSettingCookie,
  serializeSettingCookie,
} from '@/lib/settings-cookie'

describe('serializeSettingCookie', () => {
  it('writes the value with path, lifetime and SameSite', () => {
    expect(
      serializeSettingCookie('gitcloak_autosave', 'true', { maxAge: 3600 })
    ).toBe('gitcloak_autosave=true; path=/; max-age=3600; samesite=Lax')
  })

  it('encodes values that are not cookie-safe', () => {
    expect(
      serializeSettingCookie('gitcloak_theme', 'dark mode', { maxAge: 60 })
    ).toContain('gitcloak_theme=dark%20mode')
  })

  it('omits Secure unless asked', () => {
    const insecure = serializeSettingCookie('gitcloak_theme', 'dark', {
      maxAge: 60,
    })
    expect(insecure).not.toContain('secure')

    const secure = serializeSettingCookie('gitcloak_theme', 'dark', {
      maxAge: 60,
      secure: true,
    })
    expect(secure).toContain('; secure')
  })

  it('honours a custom SameSite', () => {
    expect(
      serializeSettingCookie('gitcloak_theme', 'dark', {
        maxAge: 60,
        sameSite: 'Strict',
      })
    ).toContain('samesite=Strict')
  })
})

describe('parseSettingCookie', () => {
  it('reads a value out of a cookie string with several cookies', () => {
    const header = 'other=1; gitcloak_theme=dark; gitcloak_autosave=true'
    expect(parseSettingCookie(header, 'gitcloak_theme')).toBe('dark')
    expect(parseSettingCookie(header, 'gitcloak_autosave')).toBe('true')
  })

  it('returns null when the cookie is missing', () => {
    expect(parseSettingCookie('other=1', 'gitcloak_theme')).toBeNull()
    expect(parseSettingCookie('', 'gitcloak_theme')).toBeNull()
  })

  it('does not match a name that merely starts the same', () => {
    expect(
      parseSettingCookie('gitcloak_theme_dark=1', 'gitcloak_theme')
    ).toBeNull()
  })

  it('decodes percent-encoded values', () => {
    expect(
      parseSettingCookie('gitcloak_theme=dark%20mode', 'gitcloak_theme')
    ).toBe('dark mode')
  })

  it('tolerates malformed escapes by returning the raw value', () => {
    expect(parseSettingCookie('gitcloak_theme=%E0%A4%A', 'gitcloak_theme')).toBe(
      '%E0%A4%A'
    )
  })

  it('round-trips through serialize', () => {
    const serialized = serializeSettingCookie('gitcloak_autosave', 'true', {
      maxAge: 3600,
    })
    // `document.cookie` stores the pair without the attributes it understands,
    // but parse must still find the value inside a full attribute list.
    expect(parseSettingCookie(serialized, 'gitcloak_autosave')).toBe('true')
  })
})
