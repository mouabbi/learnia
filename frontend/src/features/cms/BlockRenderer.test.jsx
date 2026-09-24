// Accessibility + performance checks for BlockRenderer (semantic HTML
// target for 19-performance-accessibility, concept 1 & 3).
//
// ASSUMED DEPENDENCY: `vitest-axe` is not yet in frontend/package.json
// (checked: no @axe-core/react, jest-axe, or vitest-axe devDependency
// exists today). This file assumes `vitest-axe` will be added — it
// provides `axe()` + a `toHaveNoViolations()` matcher with the same shape
// as jest-axe, and is the natural fit for a Vitest+RTL project. Until it's
// installed, the axe-driven tests below will fail to resolve the import;
// the plain-DOM semantic assertions (headings/lists/alt text) do not
// depend on it and can run today.
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { axe } from 'vitest-axe'
import { toHaveNoViolations } from 'vitest-axe/matchers'
import { BlockRenderer } from './BlockRenderer'

expect.extend({ toHaveNoViolations })

const BLOCKS = [
  { type: 'heading', text: 'Chapter overview', level: 2 },
  { type: 'paragraph', text: 'Some intro text.' },
  { type: 'list', ordered: false, items: ['First', 'Second'] },
  { type: 'image', src: '/img.png', alt: 'A diagram of the pipeline' },
  { type: 'table', headers: ['A', 'B'], rows: [['1', '2']] },
]

describe('BlockRenderer semantic HTML', () => {
  it('renders heading blocks as real heading tags, not styled divs', () => {
    render(<BlockRenderer blocks={BLOCKS} />)
    expect(screen.getByRole('heading', { level: 2, name: 'Chapter overview' })).toBeInTheDocument()
  })

  it('renders list blocks as ul/li, exposed via the list role', () => {
    render(<BlockRenderer blocks={BLOCKS} />)
    const list = screen.getByRole('list')
    expect(list.tagName).toBe('UL')
    expect(screen.getAllByRole('listitem')).toHaveLength(2)
  })

  it('gives images real alt text (never empty for a meaningful image block)', () => {
    render(<BlockRenderer blocks={BLOCKS} />)
    expect(screen.getByRole('img', { name: 'A diagram of the pipeline' })).toBeInTheDocument()
  })

  it('falls back to an empty (decorative) alt when the block has none, rather than omitting alt', () => {
    render(<BlockRenderer blocks={[{ type: 'image', src: '/x.png' }]} />)
    const img = screen.getByRole('presentation') || document.querySelector('img')
    // An <img alt=""> is exposed with the "presentation"/"none" role by
    // most accessibility trees; assert the attribute directly too so this
    // doesn't depend on a specific ARIA mapping.
    expect(document.querySelector('img').getAttribute('alt')).toBe('')
  })

  it('renders a real <table> with headers for table blocks', () => {
    render(<BlockRenderer blocks={BLOCKS} />)
    expect(screen.getByRole('table')).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'A' })).toBeInTheDocument()
  })

  it('has no detectable axe violations for a representative set of blocks', async () => {
    const { container } = render(<BlockRenderer blocks={BLOCKS} />)
    const results = await axe(container)
    expect(results).toHaveNoViolations()
  })
})

describe('BlockRenderer image performance (lazy loading)', () => {
  // GAP: BlockRenderer.jsx's Image component (`<img src={block.src}
  // alt={block.alt || ''} />`) does not set `loading="lazy"` today. Per
  // 19-performance-accessibility concept 3 ("lazy loading for course
  // content images"), a long page with many images should defer
  // off-screen ones. This test documents the expected behavior and will
  // fail until BlockRenderer's Image component adds loading="lazy".
  it('sets loading="lazy" on rendered content images', () => {
    render(<BlockRenderer blocks={[{ type: 'image', src: '/big.png', alt: 'Big diagram' }]} />)
    const img = screen.getByRole('img', { name: 'Big diagram' })
    expect(img).toHaveAttribute('loading', 'lazy')
  })
})
