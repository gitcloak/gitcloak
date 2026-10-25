"use client"

import { useCallback, useSyncExternalStore } from "react"

const AUTOSAVE_STORAGE_KEY = "gitcloak:autosave"

// Preference changes made in this tab are pushed to every subscriber. Other
// tabs are picked up through the `storage` event.
const listeners = new Set<() => void>()

function readAutosave(): boolean {
  try {
    return window.localStorage.getItem(AUTOSAVE_STORAGE_KEY) === "true"
  } catch {
    // Storage can be blocked (private mode, disabled site data). Fall back to
    // the default instead of breaking the settings screen.
    return false
  }
}

function writeAutosave(enabled: boolean) {
  try {
    window.localStorage.setItem(AUTOSAVE_STORAGE_KEY, String(enabled))
  } catch {
    // The preference still applies for this session.
  }
  listeners.forEach((listener) => listener())
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  window.addEventListener("storage", listener)
  return () => {
    listeners.delete(listener)
    window.removeEventListener("storage", listener)
  }
}

/**
 * Whether edits are saved automatically shortly after the user stops typing.
 * Persisted per browser; off by default.
 */
export function useAutosave(): [boolean, (enabled: boolean) => void] {
  const enabled = useSyncExternalStore(subscribe, readAutosave, () => false)
  const setEnabled = useCallback((next: boolean) => writeAutosave(next), [])
  return [enabled, setEnabled]
}
