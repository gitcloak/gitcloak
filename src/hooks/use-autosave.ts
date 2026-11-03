'use client'

import { useCallback, useSyncExternalStore } from 'react'

import { readSettingCookie, writeSettingCookie } from '@/lib/settings-cookie'

// Preference changes made in this tab are pushed to every subscriber. Other
// tabs are picked up when the window regains focus (a cookie change emits no
// `storage` event the way localStorage does).
const listeners = new Set<() => void>()

function readAutosave(): boolean {
  try {
    return readSettingCookie('autosave') === 'true'
  } catch {
    // A blocked cookie jar should not break the settings screen.
    return false
  }
}

function writeAutosave(enabled: boolean) {
  try {
    writeSettingCookie('autosave', String(enabled))
  } catch {
    // The preference still applies for this session.
  }
  listeners.forEach((listener) => listener())
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  window.addEventListener('focus', listener)
  return () => {
    listeners.delete(listener)
    window.removeEventListener('focus', listener)
  }
}

/**
 * Whether edits are saved automatically shortly after the user stops typing.
 * Persisted per browser in a cookie; off by default.
 */
export function useAutosave(): [boolean, (enabled: boolean) => void] {
  const enabled = useSyncExternalStore(subscribe, readAutosave, () => false)
  const setEnabled = useCallback((next: boolean) => writeAutosave(next), [])
  return [enabled, setEnabled]
}
