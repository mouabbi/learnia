// Facebook-style placeholder shape: a shimmering block standing in for
// content that hasn't loaded yet. Compose several of these into the rough
// outline of the real content (see MfaSettings, ProtectedRoute) instead of
// showing a blank screen or a spinner.
export function Skeleton({ width, height = '1em', circle = false, className = '' }) {
  return (
    <span
      className={`skeleton ${circle ? 'skeleton-circle' : ''} ${className}`.trim()}
      style={{ width, height }}
      aria-hidden="true"
    />
  )
}
