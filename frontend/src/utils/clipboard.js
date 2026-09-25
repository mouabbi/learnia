/**
 * Copies text to the clipboard. `navigator.clipboard` only exists in a
 * secure context (https or localhost) — on http://learnia.local it's
 * undefined — so this falls back to the legacy hidden-textarea +
 * execCommand('copy') trick, which still works over plain http as long as
 * it runs inside a user gesture (a click handler). Resolves true on
 * success, false if both paths failed.
 */
export async function copyText(text) {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text)
      return true
    } catch {
      // fall through to the legacy path
    }
  }

  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.setAttribute('readonly', '')
  textarea.style.position = 'fixed'
  textarea.style.top = '0'
  textarea.style.left = '0'
  textarea.style.opacity = '0'
  document.body.appendChild(textarea)
  // Keep focus inside an open modal's focus trap from fighting the select.
  const previouslyFocused = document.activeElement
  textarea.focus()
  textarea.select()
  textarea.setSelectionRange(0, text.length)
  let ok
  try {
    ok = document.execCommand('copy')
  } catch {
    ok = false
  }
  document.body.removeChild(textarea)
  previouslyFocused?.focus?.()
  return ok
}
