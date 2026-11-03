/**
 * Cookie persistence for the two device-level settings: the colour theme and
 * whether autosave is on.
 *
 * These are first-party cookies rather than `localStorage` entries so the
 * preference survives when site storage is cleared or blocked (private
 * windows, embedded/sandboxed webviews) and so the server can read it. Cookies
 * are never `HttpOnly`: the client reads its own copies.
 *
 * The value is written with `path=/` and a one-year `max-age`, and marked
 * `Secure` when the page is served over HTTPS.
 */

export type SettingName = 'theme' | 'autosave'

/** One year. Settings are not secrets, and users expect them to stick. */
export const SETTINGS_COOKIE_MAX_AGE = 60 * 60 * 24 * 365

/** Cookie names. Kept in one place so reads and writes cannot drift apart. */
export const SETTINGS_COOKIE_NAMES: Record<SettingName, string> = {
  theme: 'gitcloak_theme',
  autosave: 'gitcloak_autosave',
}

export interface SerializeOptions {
  /** Lifetime in seconds. */
  maxAge: number
  /** `Secure` should only be set over HTTPS; plain HTTP drops such cookies. */
  secure?: boolean
  sameSite?: 'Lax' | 'Strict' | 'None'
}

/**
 * Serialize a single `document.cookie` assignment. Pure, so it can be unit
 * tested without a browser.
 */
export function serializeSettingCookie(
  name: string,
  value: string,
  options: SerializeOptions
): string {
  const parts = [
    `${name}=${encodeURIComponent(value)}`,
    'path=/',
    `max-age=${Math.floor(options.maxAge)}`,
    `samesite=${options.sameSite ?? 'Lax'}`,
  ]
  if (options.secure) parts.push('secure')
  return parts.join('; ')
}

/**
 * Read one cookie out of a `document.cookie` string. Returns `null` when the
 * cookie is absent. Pure, so it can be unit tested without a browser.
 */
export function parseSettingCookie(
  cookieString: string,
  name: string
): string | null {
  for (const part of cookieString.split(';')) {
    const trimmed = part.trim()
    if (!trimmed) continue
    const separator = trimmed.indexOf('=')
    if (separator === -1) continue
    if (trimmed.slice(0, separator) !== name) continue
    const raw = trimmed.slice(separator + 1)
    try {
      return decodeURIComponent(raw)
    } catch {
      // A malformed escape is returned as stored rather than throwing.
      return raw
    }
  }
  return null
}

/** Read a stored setting, or `null` when unset or on the server. */
export function readSettingCookie(setting: SettingName): string | null {
  if (typeof document === 'undefined') return null
  return parseSettingCookie(document.cookie, SETTINGS_COOKIE_NAMES[setting])
}

/** Persist a setting. No-op on the server. */
export function writeSettingCookie(setting: SettingName, value: string): void {
  if (typeof document === 'undefined') return
  document.cookie = serializeSettingCookie(
    SETTINGS_COOKIE_NAMES[setting],
    value,
    {
      maxAge: SETTINGS_COOKIE_MAX_AGE,
      secure:
        typeof location !== 'undefined' && location.protocol === 'https:',
    }
  )
}
