// Small color-math helpers for the accent-color picker (see
// hooks/useAccentColor.js) — no color library needed for this.

export function hexToRgb(hex) {
  const value = hex.replace('#', '')
  const bigint = parseInt(value, 16)
  return { r: (bigint >> 16) & 255, g: (bigint >> 8) & 255, b: bigint & 255 }
}

function toHexByte(value) {
  return Math.max(0, Math.min(255, Math.round(value))).toString(16).padStart(2, '0')
}

// Lighten (positive percent) or darken (negative) a hex color — used to
// derive --accent-hover from the user's chosen --accent.
export function shade(hex, percent) {
  const { r, g, b } = hexToRgb(hex)
  const amount = (percent / 100) * 255
  return `#${toHexByte(r + amount)}${toHexByte(g + amount)}${toHexByte(b + amount)}`
}

// Picks black or white text over a given background so any accent color
// the user chooses stays readable (used for --accent-text).
export function contrastText(hex) {
  const { r, g, b } = hexToRgb(hex)
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return luminance > 0.6 ? '#111827' : '#ffffff'
}
