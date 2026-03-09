import { useEffect, useState } from 'react'
import { getGraphById } from '@procedural-web-composer/editor-core'
import type { EditorStore } from '@procedural-web-composer/editor-core'
import type { GraphSubgraphMetadata } from '@procedural-web-composer/shared-types'
import { useStore } from 'zustand'

export interface SubgraphMetadataPanelProps {
  store: EditorStore
}

export function SubgraphMetadataPanel(props: SubgraphMetadataPanelProps): JSX.Element | null {
  const project = useStore(props.store, (state) => state.project)
  const selectedGraphId = useStore(props.store, (state) => state.selectedGraphId)
  const graph = getGraphById(project, selectedGraphId)
  const [name, setName] = useState(graph?.name ?? '')
  const [schemaBuffer, setSchemaBuffer] = useState('{}')
  const [defaultsBuffer, setDefaultsBuffer] = useState('{}')
  const [error, setError] = useState<string>()

  useEffect(() => {
    if (!graph || (graph.kind !== 'subgraph' && graph.kind !== 'component')) {
      return
    }

    setName(graph.name)
    setSchemaBuffer(JSON.stringify(graph.subgraph?.publicParamsSchema ?? {}, null, 2))
    setDefaultsBuffer(JSON.stringify(graph.subgraph?.publicDefaultParams ?? {}, null, 2))
    setError(undefined)
  }, [graph])

  if (!graph || (graph.kind !== 'subgraph' && graph.kind !== 'component')) {
    return null
  }

  return (
    <section className="inspector-section">
      <header className="inspector-section-header">Component Metadata</header>
      <label className="inspector-field">
        <span className="field-caption">Graph title</span>
        <input
          className="inspector-input"
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
      </label>
      <label className="inspector-field">
        <span className="field-caption">Public params schema (JSON)</span>
        <textarea
          className="inspector-textarea"
          value={schemaBuffer}
          onChange={(event) => setSchemaBuffer(event.target.value)}
        />
      </label>
      <label className="inspector-field">
        <span className="field-caption">Public default params (JSON)</span>
        <textarea
          className="inspector-textarea"
          value={defaultsBuffer}
          onChange={(event) => setDefaultsBuffer(event.target.value)}
        />
      </label>
      <p className="muted">
        Match these keys with `subgraph.param` nodes inside the reusable graph.
      </p>
      <div className="json-actions">
        <button
          type="button"
          className="button chrome"
          onClick={() => {
            try {
              const nextSchema = JSON.parse(schemaBuffer)
              const nextDefaults = JSON.parse(defaultsBuffer)

              if (!isRecord(nextSchema) || !isRecord(nextDefaults)) {
                setError('Schema and defaults must be JSON objects.')
                return
              }

              props.store.getState().updateGraphName(graph.id, name.trim() || graph.name)
              props.store.getState().updateGraphSubgraphMetadata(graph.id, {
                ...normalizeMetadata(nextSchema, nextDefaults),
              })
              setError(undefined)
            } catch (parseError) {
              setError(
                parseError instanceof Error
                  ? parseError.message
                  : 'Could not parse component metadata JSON.',
              )
            }
          }}
        >
          Save metadata
        </button>
      </div>
      {error ? <p className="error-text">{error}</p> : null}
    </section>
  )
}

function normalizeMetadata(
  schema: Record<string, unknown>,
  defaults: Record<string, unknown>,
): GraphSubgraphMetadata {
  const metadata: GraphSubgraphMetadata = {}

  if (Object.keys(schema).length > 0) {
    metadata.publicParamsSchema = schema as NonNullable<GraphSubgraphMetadata['publicParamsSchema']>
  }

  if (Object.keys(defaults).length > 0) {
    metadata.publicDefaultParams = defaults
  }

  return metadata
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
