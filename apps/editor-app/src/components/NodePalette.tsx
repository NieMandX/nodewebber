import { useState, type DragEvent } from 'react'
import { getSubgraphDefinitions } from '@procedural-web-composer/graph-core'
import { listNodeDefinitions } from '@procedural-web-composer/node-registry'
import type { EditorStore } from '@procedural-web-composer/editor-core'
import type { NodeDefinitionResolver } from '@procedural-web-composer/shared-types'
import { useStore } from 'zustand'
import { DRAG_NODE_TEMPLATE_MIME, DRAG_NODE_TYPE_MIME } from './dnd'

export interface NodePaletteProps {
  store: EditorStore
  registry: NodeDefinitionResolver
}

export function NodePalette(props: NodePaletteProps): JSX.Element {
  const [query, setQuery] = useState('')
  const project = useStore(props.store, (state) => state.project)
  const selectedGraphId = useStore(props.store, (state) => state.selectedGraphId)
  const normalizedQuery = query.trim().toLowerCase()
  const definitions = listNodeDefinitions(props.registry)
    .filter((definition) => definition.type !== 'subgraph.instance')
    .filter((definition) => {
      if (normalizedQuery.length === 0) {
        return true
      }

      return (
        definition.title.toLowerCase().includes(normalizedQuery) ||
        definition.type.toLowerCase().includes(normalizedQuery)
      )
    })
  const reusableGraphs = getSubgraphDefinitions(project)
    .filter((definition) => definition.graphId !== selectedGraphId)
    .filter((definition) => {
      if (normalizedQuery.length === 0) {
        return true
      }

      return (
        definition.title.toLowerCase().includes(normalizedQuery) ||
        definition.graphId.toLowerCase().includes(normalizedQuery)
      )
    })
  const categories = ['Layout', 'Content', 'Data', 'Style', 'Subgraph']

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

      {reusableGraphs.length > 0 ? (
        <section className="palette-section">
          <header className="palette-section-header">Components</header>
          <div className="palette-grid">
            {reusableGraphs.map((definition) => (
              <button
                key={definition.graphId}
                type="button"
                className="palette-card"
                draggable
                onClick={() => addComponentInstance(props.store, definition.graphId, reusableGraphs)}
                onDragStart={(event) => dragComponentInstance(event, definition.graphId, reusableGraphs)}
              >
                <strong>{definition.title}</strong>
                <span>subgraph.instance</span>
                <small>{definition.graphId}</small>
              </button>
            ))}
          </div>
        </section>
      ) : null}

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

      {definitions.length === 0 && reusableGraphs.length === 0 ? (
        <div className="empty-panel">No nodes or components match the current search.</div>
      ) : null}
    </div>
  )
}

function addComponentInstance(
  store: EditorStore,
  graphId: string,
  definitions: ReturnType<typeof getSubgraphDefinitions>,
): void {
  const definition = definitions.find((candidate) => candidate.graphId === graphId)

  if (!definition) {
    return
  }

  store.getState().addNode('subgraph.instance', undefined, {
    label: definition.title,
    params: {
      subgraphGraphId: definition.graphId,
      ...definition.publicDefaultParams,
    },
  })
}

function dragComponentInstance(
  event: DragEvent<HTMLButtonElement>,
  graphId: string,
  definitions: ReturnType<typeof getSubgraphDefinitions>,
): void {
  const definition = definitions.find((candidate) => candidate.graphId === graphId)

  if (!definition) {
    return
  }

  event.dataTransfer.setData(DRAG_NODE_TYPE_MIME, 'subgraph.instance')
  event.dataTransfer.setData(
    DRAG_NODE_TEMPLATE_MIME,
    JSON.stringify({
      type: 'subgraph.instance',
      label: definition.title,
      params: {
        subgraphGraphId: definition.graphId,
        ...definition.publicDefaultParams,
      },
    }),
  )
  event.dataTransfer.effectAllowed = 'move'
}
