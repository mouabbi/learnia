import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Lock, Palette } from 'lucide-react'
import { describe, expect, it, vi } from 'vitest'
import { SettingsNav } from './SettingsNav'

const GROUPS = [
  {
    id: 'security',
    icon: Lock,
    label: 'Security',
    items: [
      { id: 'password', label: 'Password' },
      { id: 'mfa', label: 'Two-factor authentication', badge: 'Off' },
    ],
  },
  {
    id: 'appearance',
    icon: Palette,
    label: 'Appearance',
    items: [{ id: 'accent-color', label: 'Accent color' }],
  },
]

describe('SettingsNav', () => {
  it('renders every group label and item', () => {
    render(<SettingsNav groups={GROUPS} activeItemId="password" onSelect={vi.fn()} />)
    expect(screen.getByText('Security')).toBeInTheDocument()
    expect(screen.getByText('Appearance')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Password' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Two-factor authentication/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Accent color' })).toBeInTheDocument()
  })

  it('marks the active item current and leaves the rest unmarked', () => {
    render(<SettingsNav groups={GROUPS} activeItemId="mfa" onSelect={vi.fn()} />)
    expect(screen.getByRole('button', { name: /Two-factor authentication/ })).toHaveAttribute(
      'aria-current',
      'page',
    )
    expect(screen.getByRole('button', { name: 'Password' })).not.toHaveAttribute('aria-current')
  })

  it('calls onSelect with the clicked item id', async () => {
    const onSelect = vi.fn()
    render(<SettingsNav groups={GROUPS} activeItemId="password" onSelect={onSelect} />)
    await userEvent.click(screen.getByRole('button', { name: 'Accent color' }))
    expect(onSelect).toHaveBeenCalledWith('accent-color')
  })

  it('renders a badge next to an item that has one', () => {
    render(<SettingsNav groups={GROUPS} activeItemId="password" onSelect={vi.fn()} />)
    const mfaItem = screen.getByRole('button', { name: /Two-factor authentication/ })
    expect(within(mfaItem).getByText('Off')).toBeInTheDocument()
  })

  it('renders no badge for an item without one', () => {
    render(<SettingsNav groups={GROUPS} activeItemId="password" onSelect={vi.fn()} />)
    const passwordItem = screen.getByRole('button', { name: 'Password' })
    expect(within(passwordItem).queryByText(/^(On|Off)$/)).not.toBeInTheDocument()
  })

  it('renders a skeleton placeholder instead of the badge while it is loading', () => {
    const groups = [
      {
        ...GROUPS[0],
        items: [
          GROUPS[0].items[0],
          { id: 'mfa', label: 'Two-factor authentication', badgeLoading: true },
        ],
      },
      GROUPS[1],
    ]
    render(<SettingsNav groups={groups} activeItemId="password" onSelect={vi.fn()} />)
    const mfaItem = screen.getByRole('button', { name: /Two-factor authentication/ })
    expect(within(mfaItem).queryByText(/^(On|Off)$/)).not.toBeInTheDocument()
    expect(mfaItem.querySelector('.skeleton')).not.toBeNull()
  })
})
