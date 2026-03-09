import { useState } from 'react'
import { listNodeDefinitions } from '@procedural-web-composer/node-registry'
import type { EditorStore } from '@procedural-web-composer/editor-core'
import type { NodeDefinitionResolver } from '@procedural-web-composer/shared-types'
import { DRAG_NODE_TYPE_MIME } from './dnd'

export interface NodePaletteProps {
  store: EditorStore
  registry: NodeDefinitionResolver
}

export function NodePalette(props: NodePaletteProps): JSX.Element {
  const [query, setQuery] = useState('')
  const normalizedQuery = query.trim().toLowerCase()
  const definitions = listNodeDefinitions(props.registry).filter((definition) => {
    if (normalizedQuery.length === 0) {
      return true
    }

    return (
      definition.title.toLowerCase().includes(normalizedQuery) ||
      definition.type.toLowerCase().includes(normalizedQuery)
    )
  })
  const categories = ['Layout', 'Content', 'Style']

  return (
    <div className="palette-stack">
      <label className="search-field">
        <span className="field-caption">Search nodes</span>
        <input
          className="search-input"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search by title or type"
        />
      </label>

      {categories.map((category) => {
        const categoryNodes = definitions.filter((definition) => definition.category === category)

        if (categoryNodes.length === 0) {
          return null
        }

        return (
          <section key={category} className="palette-section">
            <header className="palette-section-header">{category}</header>
            <div className="palette-grid">
              {categoryNodes.map((definition) => (
                <button
                  key={definition.type}
                  type="button"
                  className="palette-card"
                  draggable
                  onClick={() => props.store.getState().addNode(definition.type)}
                  onDragStart={(event) => {
                    event.dataTransfer.setData(DRAG_NODE_TYPE_MIME, definition.type)
                    event.dataTransfer.effectAllowed = 'move'
                  }}
                >
                  <strong>{definition.title}</strong>
                  <span>{definition.type}</span>
                  <small>{definition.category}</small>
                </button>
              ))}
            </div>
          </section>
        )
      })}

      {definitions.length === 0 ? (
        <div className="empty-panel">No nodes match the current search.</div>
      ) : null}
    </div>
  )
}

