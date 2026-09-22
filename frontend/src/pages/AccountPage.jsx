import { useEffect, useState } from 'react'
import { Lock, Palette } from 'lucide-react'
import { ChangePasswordForm } from '../features/auth/ChangePasswordForm'
import { MfaSettings } from '../features/auth/MfaSettings'
import { AccentColorPicker } from '../components/settings/AccentColorPicker'
import { SettingsNav } from '../components/settings/SettingsNav'
import { authApi } from '../features/auth/authApi'

// Two-pane settings layout: a left-hand menu (SettingsNav) grouping every
// setting under its category, and a right-hand detail pane that shows just
// the title, description, and content of whichever single setting is
// active — no accordion, one setting on screen at a time. Adding a new
// setting is: one more entry in the right group's `items`.
function buildGroups(mfaEnabled) {
  return [
    {
      id: 'security',
      icon: Lock,
      label: 'Security',
      items: [
        {
          id: 'password',
          label: 'Password',
          description: 'Change your account password',
          Content: ChangePasswordForm,
        },
        {
          id: 'mfa',
          label: 'Two-factor authentication',
          description: 'Require a code from an authenticator app when signing in',
          badgeLoading: mfaEnabled === null,
          badge: mfaEnabled === null ? undefined : mfaEnabled ? 'On' : 'Off',
          Content: MfaSettings,
        },
      ],
    },
    {
      id: 'appearance',
      icon: Palette,
      label: 'Appearance',
      items: [
        {
          id: 'accent-color',
          label: 'Accent color',
          description: 'Pick the color used for buttons and links',
          Content: AccentColorPicker,
        },
      ],
    },
  ]
}

export function AccountPage() {
  const [mfaEnabled, setMfaEnabled] = useState(null)
  const [activeItemId, setActiveItemId] = useState('password')

  useEffect(() => {
    authApi
      .getMfaStatus()
      .then((res) => setMfaEnabled(res.enabled))
      .catch(() => setMfaEnabled(false))
  }, [])

  const groups = buildGroups(mfaEnabled)
  const allItems = groups.flatMap((group) => group.items)
  const activeItem = allItems.find((item) => item.id === activeItemId) ?? allItems[0]
  const ActiveContent = activeItem.Content
  // MfaSettings needs to report status changes back up so the nav badge
  // doesn't go stale after enabling/disabling without a page reload — every
  // other setting is a plain, prop-less component.
  const activeContentProps = activeItem.id === 'mfa' ? { onStatusChange: setMfaEnabled } : {}

  return (
    <section className="settings-page">
      <h1>Settings</h1>
      <p className="settings-page-subtitle">Manage your account, security, and preferences.</p>

      <div className="settings-layout">
        <SettingsNav groups={groups} activeItemId={activeItemId} onSelect={setActiveItemId} />

        <div className="settings-detail content-card">
          <div className="settings-detail-header">
            <h2>{activeItem.label}</h2>
            <p className="settings-detail-description">{activeItem.description}</p>
          </div>

          <ActiveContent {...activeContentProps} />
        </div>
      </div>
    </section>
  )
}
