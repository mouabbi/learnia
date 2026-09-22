import { Skeleton } from '../Skeleton'

// Left-hand menu for the settings page: groups (e.g. "Security") each
// listing their individual settings as sub-items (e.g. "Password",
// "Two-factor authentication"). Purely controlled — AccountPage owns which
// item is active and swaps the detail pane on the right accordingly.
export function SettingsNav({ groups, activeItemId, onSelect }) {
  return (
    <nav className="settings-nav" aria-label="Settings">
      {groups.map((group) => (
        <div className="settings-nav-group" key={group.id}>
          <p className="settings-nav-group-label">
            <group.icon className="settings-nav-icon" aria-hidden="true" size={14} />
            {group.label}
          </p>

          <ul className="settings-nav-list">
            {group.items.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  className="settings-nav-item"
                  aria-current={item.id === activeItemId ? 'page' : undefined}
                  onClick={() => onSelect(item.id)}
                >
                  <span className="settings-nav-item-label">{item.label}</span>
                  {item.badgeLoading && <Skeleton width="2rem" height="1.1em" className="settings-nav-badge-skeleton" />}
                  {!item.badgeLoading && item.badge && (
                    <span className={`settings-nav-badge settings-nav-badge-${item.badge.toLowerCase()}`}>
                      {item.badge}
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  )
}
