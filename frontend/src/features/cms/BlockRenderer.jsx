// Read-only renderer for a PageContent's `blocks` array (see backend
// schemas/content.py for the exact shape). Used both by the CMS Content
// tab's Preview toggle and by the AI-import modal's page-content preview
// step. Deliberately reusable: CourseReaderPage.jsx currently renders
// plain text (`content.split('\n\n')`) and is NOT block-aware yet — it
// should eventually be upgraded to use this same renderer, but that's a
// live-learner-view behavior change left out of this CMS/import work.

function Heading({ block }) {
  const Tag = `h${Math.min(Math.max(block.level || 2, 1), 6)}`
  return <Tag className="cms-block-heading">{block.text}</Tag>
}

function Paragraph({ block }) {
  return <p className="cms-block-paragraph">{block.text}</p>
}

function Code({ block }) {
  return (
    <pre className="cms-block-code">
      <code>{block.code}</code>
    </pre>
  )
}

function Terminal({ block }) {
  return <pre className="cms-block-terminal">{block.text}</pre>
}

function Image({ block }) {
  return (
    <figure className="cms-block-figure">
      <img src={block.src} alt={block.alt || ''} loading="lazy" />
      {block.caption && <figcaption>{block.caption}</figcaption>}
    </figure>
  )
}

function Video({ block }) {
  return (
    <figure className="cms-block-figure">
      <video src={block.src} controls />
      {block.caption && <figcaption>{block.caption}</figcaption>}
    </figure>
  )
}

function Youtube({ block }) {
  return (
    <figure className="cms-block-figure">
      <iframe
        title={block.caption || 'YouTube video'}
        src={`https://www.youtube.com/embed/${block.videoId}`}
        allowFullScreen
      />
      {block.caption && <figcaption>{block.caption}</figcaption>}
    </figure>
  )
}

function Link({ block }) {
  return (
    <p>
      <a href={block.href} target="_blank" rel="noreferrer">
        {block.text}
      </a>
    </p>
  )
}

function Quote({ block }) {
  return (
    <blockquote className="cms-block-quote">
      <p>{block.text}</p>
      {block.attribution && <cite>{block.attribution}</cite>}
    </blockquote>
  )
}

function Callout({ block }) {
  return <div className={`cms-block-callout cms-callout-${block.variant}`}>{block.text}</div>
}

function List({ block }) {
  const Tag = block.ordered ? 'ol' : 'ul'
  return (
    <Tag className="cms-block-list">
      {block.items.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </Tag>
  )
}

function Table({ block }) {
  return (
    <table className="cms-block-table">
      <thead>
        <tr>
          {block.headers.map((h, i) => (
            <th key={i}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {block.rows.map((row, ri) => (
          <tr key={ri}>
            {row.map((cell, ci) => (
              <td key={ci}>{cell}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

const RENDERERS = {
  heading: Heading,
  paragraph: Paragraph,
  code: Code,
  terminal: Terminal,
  image: Image,
  video: Video,
  youtube: Youtube,
  link: Link,
  quote: Quote,
  callout: Callout,
  list: List,
  table: Table,
}

export function BlockRenderer({ blocks }) {
  if (!blocks || blocks.length === 0) {
    return <p className="cms-empty-hint">No content yet.</p>
  }
  return (
    <div className="cms-block-renderer">
      {blocks.map((block, i) => {
        const Renderer = RENDERERS[block.type]
        if (!Renderer) return null
        return <Renderer key={i} block={block} />
      })}
    </div>
  )
}
