import { Skeleton } from '../Skeleton'

// Shown by ProtectedRoute/PublicOnlyRoute while the initial GET /auth/me is
// in flight — a rough outline of the real app shell (topbar + a couple of
// content blocks) instead of a blank flash before the real page mounts.
export function AppShellSkeleton() {
  return (
    <div className="app-shell" aria-busy="true" aria-label="Loading">
      <header className="topbar">
        <Skeleton width="1.5rem" height="1.5rem" />
        <Skeleton width="6rem" height="1.2em" />
      </header>

      <main className="app-content">
        <div className="content-card skeleton-block">
          <Skeleton width="40%" height="1.3em" />
          <Skeleton width="90%" height="1em" />
          <Skeleton width="70%" height="1em" />
        </div>
        <div className="content-card skeleton-block">
          <Skeleton width="30%" height="1.3em" />
          <Skeleton width="85%" height="1em" />
        </div>
      </main>
    </div>
  )
}
