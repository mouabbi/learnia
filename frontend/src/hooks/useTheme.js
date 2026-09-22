import { useCallback, useEffect, useState } from 'react'

const STORAGE_KEY = 'learnia:theme'

function readStoredTheme() {
  try {
    return localStorage.getItem(STORAGE_KEY) || 'system'
  } catch {
    // Private browsing / storage blocked — fall back to system, the
    // toggle still works, it just won't persist across reloads.
    return 'system'
  }
}

function applyTheme(theme) {
  const root = document.documentElement
  if (theme === 'system') {
    root.removeAttribute('data-theme')
  } else {
    root.setAttribute('data-theme', theme)
  }
}

// Manual light/dark override on top of the `prefers-color-scheme` media
// query already baked into index.css. `theme` is 'light' | 'dark' | 'system'
// (system = defer to the OS, the pre-existing default behavior).
export function useTheme() {
  const [theme, setTheme] = useState(readStoredTheme)

  useEffect(() => {
    applyTheme(theme)
  }, [theme])

  const toggleTheme = useCallback(() => {
    setTheme((prev) => {
      // Toggle flips between light/dark. If we were following the system
      // preference, jump to the opposite of whatever the system is now.
      const systemPrefersDark =
        typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches
      const current = prev === 'system' ? (systemPrefersDark ? 'dark' : 'light') : prev
      const next = current === 'dark' ? 'light' : 'dark'
      try {
        localStorage.setItem(STORAGE_KEY, next)
      } catch {
        // ignore — see readStoredTheme()
      }
      return next
    })
  }, [])

  return { theme, toggleTheme }
}
