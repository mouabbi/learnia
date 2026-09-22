import { useCallback, useEffect, useState } from 'react'
import { contrastText, shade } from '../utils/color'

const STORAGE_KEY = 'learnia:accent-color'
const DEFAULT_ACCENT = '#4f46e5'

function readStoredAccent() {
  try {
    return localStorage.getItem(STORAGE_KEY) || DEFAULT_ACCENT
  } catch {
    // Private browsing / storage blocked — fall back to the default,
    // the picker still works, it just won't persist across reloads.
    return DEFAULT_ACCENT
  }
}

function applyAccent(hex) {
  const root = document.documentElement.style
  root.setProperty('--accent', hex)
  root.setProperty('--accent-hover', shade(hex, -12))
  root.setProperty('--accent-text', contrastText(hex))
}

// User-chosen accent color, applied as CSS custom properties (see
// index.css's --accent tokens) and persisted in localStorage. Mount once
// near the app root (see App.jsx) so it applies on every page, and reuse
// the same hook inside the Settings picker to read/change it.
export function useAccentColor() {
  const [accent, setAccent] = useState(readStoredAccent)

  useEffect(() => {
    applyAccent(accent)
  }, [accent])

  const setAccentColor = useCallback((hex) => {
    setAccent(hex)
    try {
      localStorage.setItem(STORAGE_KEY, hex)
    } catch {
      // ignore — see readStoredAccent()
    }
  }, [])

  const resetAccent = useCallback(() => {
    setAccent(DEFAULT_ACCENT)
    try {
      localStorage.removeItem(STORAGE_KEY)
    } catch {
      // ignore
    }
  }, [])

  return { accent, setAccentColor, resetAccent, isDefault: accent === DEFAULT_ACCENT }
}
