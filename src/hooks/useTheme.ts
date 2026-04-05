import { useCallback, useEffect, useSyncExternalStore } from 'react'

type Theme = 'light' | 'dark' | 'system'

const STORAGE_KEY = 'quorum-theme'

/**
 * Reads the persisted theme preference from localStorage.
 * Returns 'system' if nothing is stored.
 */
function getStoredTheme(): Theme {
  if (typeof window === 'undefined') return 'system'
  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored === 'light' || stored === 'dark') return stored
  return 'system'
}

/** Resolves 'system' to the actual OS preference. */
function resolveTheme(theme: Theme): 'light' | 'dark' {
  if (theme !== 'system') return theme
  if (typeof window === 'undefined') return 'light'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

/** Applies the resolved theme to <html> by toggling the 'dark' class. */
function applyTheme(theme: Theme) {
  const resolved = resolveTheme(theme)
  document.documentElement.classList.toggle('dark', resolved === 'dark')
}

// ── Tiny external store so multiple components stay in sync ──────────

let listeners: Array<() => void> = []
let currentTheme: Theme = typeof window !== 'undefined' ? getStoredTheme() : 'system'

function subscribe(listener: () => void) {
  listeners = [...listeners, listener]
  return () => {
    listeners = listeners.filter((l) => l !== listener)
  }
}

function getSnapshot() {
  return currentTheme
}

function getServerSnapshot(): Theme {
  return 'system'
}

function setTheme(next: Theme) {
  currentTheme = next
  localStorage.setItem(STORAGE_KEY, next)
  applyTheme(next)
  listeners.forEach((l) => l())
}

/**
 * Hook for reading and setting the color theme.
 *
 * - Persists preference to localStorage under `quorum-theme`
 * - Falls back to system preference when set to 'system'
 * - Toggles the `dark` class on `<html>` so Tailwind's `dark:` variant works
 * - Listens for OS preference changes when in 'system' mode
 */
export function useTheme() {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)

  // Apply on mount and listen for OS preference changes
  useEffect(() => {
    applyTheme(currentTheme)

    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const handleChange = () => {
      if (currentTheme === 'system') applyTheme('system')
    }
    mq.addEventListener('change', handleChange)
    return () => mq.removeEventListener('change', handleChange)
  }, [])

  const set = useCallback((next: Theme) => setTheme(next), [])

  return {
    /** The stored preference: 'light', 'dark', or 'system'. */
    theme,
    /** The resolved theme after evaluating system preference. */
    resolved: resolveTheme(theme),
    /** Update the theme preference. */
    setTheme: set,
  }
}
