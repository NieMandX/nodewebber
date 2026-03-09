import { z } from 'zod'
import { getSubgraphDefinition } from '@procedural-web-composer/graph-core'
import { getGraphById } from '@procedural-web-composer/editor-core'
import type { EditorStore } from '@procedural-web-composer/editor-core'
import type {
  GraphIssue,
  NodeDefinition,
  NodeDefinitionResolver,
  PortableParamSchema,
  PortDefinition,
  ValueType,
} from '@procedural-web-composer/shared-types'
import { useStore } from 'zustand'

export interface NodeInspectorProps {
  store: EditorStore
  registry: NodeDefinitionResolver
  issues: GraphIssue[]
}

export function NodeInspector(props: NodeInspectorProps): JSX.Element {
  const project = useStore(props.store, (state) => state.project)
  const selectedGraphId = useStore(props.store, (state) => state.selectedGraphId)
  const selectedNodeId = useStore(props.store, (state) => state.selectedNodeId)
  const graph = getGraphById(project, selectedGraphId)
  const node = graph?.nodes.find((candidate) => candidate.id === selectedNodeId)

  if (!graph || !node) {
    return <div className="empty-panel">Select a node to edit params, bindings, and metadata.</div>
  }

  const definition = props.registry.getNodeDefinition(node.type)
  const referencedSubgraphId =
    typeof node.params.subgraphGraphId === 'string' ? node.params.subgraphGraphId : undefined
  const referencedSubgraph =
    node.type === 'subgraph.instance' && referencedSubgraphId
      ? getSubgraphDefinition(project, referencedSubgraphId)
      : undefined

  if (!definition) {
    return <div className="empty-panel">No registered node definition found for {node.type}.</div>
  }

  const schemaFields =
    node.type === 'subgraph.instance'
      ? getSchemaFields(referencedSubgraph?.publicParamsSchema ?? {})
      : getSchemaFields(definition.paramsSchema)
  const inputs =
    node.type === 'subgraph.instance'
      ? [
          ...definition.inputs,
          ...getPublicParamInputPorts(referencedSubgraph?.publicParamsSchema ?? {}),
        ]
      : definition.inputs
  const slotNames =
    node.type === 'subgraph.instance'
      ? referencedSubgraph?.publicSlots ?? ['children']
      : definition.slots?.length
        ? definition.slots
        : []
  const bindableInputKeys = new Set(
    inputs
      .filter((input) => input.valueType === 'string' || input.valueType === 'number' || input.valueType === 'boolean')
      .map((input) => input.key),
  )
  const generalFields = schemaFields.filter((field) => !bindableInputKeys.has(field.key))
  const nodeIssues = props.issues.filter((issue) => issue.nodeId === node.id)

  return (
    <div className="inspector-stack">
      <section className="inspector-section">
        <header className="inspector-section-header">Node</header>
        <div className="inspector-meta">
          <div>
            <span className="field-caption">Type</span>
            <strong>{definition.title}</strong>
            <small>{node.type}</small>
          </div>
          <div>
            <span className="field-caption">Node ID</span>
            <code className="code-chip">{node.id}</code>
          </div>
        {node.type === 'subgraph.instance' ? (
          <div>
            <span className="field-caption">Referenced graph</span>
            <strong>{referencedSubgraph?.title ?? 'Missing component'}</strong>
            <small>{referencedSubgraphId ?? 'No graph id set'}</small>
          </div>
        ) : null}
        {slotNames.length > 0 ? (
          <div>
            <span className="field-caption">Slots</span>
            <strong>{slotNames.join(', ')}</strong>
            <small>{slotNames.length} available slot{slotNames.length === 1 ? '' : 's'}</small>
          </div>
        ) : null}
      </div>
        <label className="inspector-field">
          <span className="field-caption">Label</span>
          <input
            className="inspector-input"
            value={node.label ?? ''}
            onChange={(event) => props.store.getState().updateNodeLabel(node.id, event.target.value)}
          />
        </label>
        {nodeIssues.length > 0 ? (
          <div className="node-issue-list">
            {nodeIssues.map((issue, index) => (
              <div key={`${issue.code}-${index}`} className={`issue-chip ${issue.severity}`}>
                {issue.message}
              </div>
            ))}
          </div>
        ) : null}
      </section>

      <section className="inspector-section">
        <header className="inspector-section-header">Bindings</header>
        <div className="binding-list">
          {inputs.length === 0 ? (
            <p className="muted">This node has no inputs.</p>
          ) : (
            inputs.map((input) => (
              <BindingRow
                key={input.key}
                input={input}
                graph={graph}
                nodeId={node.id}
                nodeParams={node.params}
                schemaField={schemaFields.find((field) => field.key === input.key)}
                onUpdateParams={(nextParams) => props.store.getState().updateNodeParams(node.id, nextParams)}
              />
            ))
          )}
        </div>
      </section>

      <section className="inspector-section">
        <header className="inspector-section-header">Params</header>
        <div className="inspector-fields">
          {node.type === 'subgraph.instance' && !referencedSubgraph ? (
            <p className="muted">This instance does not reference a valid reusable graph.</p>
          ) : null}
          {generalFields.length === 0 ? (
            <p className="muted">No editable fallback params.</p>
          ) : (
            generalFields.map((field) => (
              <SchemaFieldEditor
                key={field.key}
                field={field}
                value={node.params[field.key]}
                onChange={(nextValue) =>
                  props.store
                    .getState()
                    .updateNodeParams(node.id, { ...node.params, [field.key]: nextValue })
                }
              />
            ))
          )}
        </div>
      </section>
    </div>
  )
}

function BindingRow(props: {
  input: PortDefinition
  graph: NonNullable<ReturnType<typeof getGraphById>>
  nodeId: string
  nodeParams: Record<string, unknown>
  schemaField: SchemaField | undefined
  onUpdateParams: (params: Record<string, unknown>) => void
}): JSX.Element {
  const connectedEdge = props.graph.edges.find(
    (edge) => edge.to.nodeId === props.nodeId && edge.to.port === props.input.key,
  )
  const sourceNode = connectedEdge
    ? props.graph.nodes.find((node) => node.id === connectedEdge.from.nodeId)
    : undefined
  const fallbackValue = props.nodeParams[props.input.key]

  return (
    <article className="binding-card">
      <div className="binding-header">
        <strong>{props.input.key}</strong>
        <span className="binding-type">{props.input.valueType}</span>
      </div>
      {connectedEdge && sourceNode ? (
        <div className="binding-pill bound">
          Bound to {sourceNode.label ?? sourceNode.type} · {connectedEdge.from.port}
        </div>
      ) : props.schemaField ? (
        <div className="binding-fallback">
          <span className="field-caption">Fallback value</span>
          <SchemaFieldEditor
            field={props.schemaField}
            value={fallbackValue}
            onChange={(nextValue) =>
              props.onUpdateParams({
                ...props.nodeParams,
                [props.input.key]: nextValue,
              })
            }
          />
        </div>
      ) : (
        <div className="binding-pill unbound">Not connected</div>
      )}
    </article>
  )
}

function SchemaFieldEditor(props: {
  field: SchemaField
  value: unknown
  onChange: (value: unknown) => void
}): JSX.Element {
  if (props.field.kind === 'boolean') {
    return (
      <label className="toggle-field">
        <input
          type="checkbox"
          checked={Boolean(props.value)}
          onChange={(event) => props.onChange(event.target.checked)}
        />
        <span>{props.field.key}</span>
      </label>
    )
  }

  if (props.field.kind === 'enum') {
    return (
      <label className="inspector-field">
        <span className="field-caption">{props.field.key}</span>
        <select
          className="inspector-input"
          value={String(props.value ?? props.field.options[0] ?? '')}
          onChange={(event) => props.onChange(event.target.value)}
        >
          {props.field.options.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </label>
    )
  }

  if (props.field.kind === 'number') {
    return (
      <label className="inspector-field">
        <span className="field-caption">{props.field.key}</span>
        <input
          className="inspector-input"
          type="number"
          value={typeof props.value === 'number' ? props.value : 0}
          onChange={(event) => props.onChange(Number(event.target.value))}
        />
      </label>
    )
  }

  if (props.field.kind === 'json') {
    return (
      <label className="inspector-field">
        <span className="field-caption">{props.field.key}</span>
        <textarea
          className="inspector-textarea"
          value={JSON.stringify(props.value ?? {}, null, 2)}
          onChange={(event) => {
            try {
              props.onChange(JSON.parse(event.target.value))
            } catch {
              return
            }
          }}
        />
      </label>
    )
  }

  return (
    <label className="inspector-field">
      <span className="field-caption">{props.field.key}</span>
      <input
        className="inspector-input"
        type="text"
        value={String(props.value ?? '')}
        onChange={(event) => {
          if (props.field.kind === 'string-or-number') {
            const nextValue = event.target.value
            props.onChange(nextValue.trim().length > 0 && !Number.isNaN(Number(nextValue)) ? Number(nextValue) : nextValue)
            return
          }

          props.onChange(event.target.value)
        }}
      />
    </label>
  )
}

interface SchemaField {
  key: string
  kind: 'string' | 'number' | 'boolean' | 'enum' | 'string-or-number' | 'json'
  options: string[]
}

function getSchemaFields(schema: unknown): SchemaField[] {
  if (isPortableParamSchema(schema)) {
    return Object.entries(schema).map(([key, value]) => ({
      key,
      kind: value.type,
      options: value.options ?? [],
    }))
  }

  const unwrappedSchema = unwrapSchema(schema)

  if (!(unwrappedSchema instanceof z.ZodObject)) {
    return []
  }

  return Object.entries(unwrappedSchema.shape).map(([key, value]) =>
    parseSchemaField(key, value as z.ZodTypeAny),
  )
}

function parseSchemaField(key: string, schema: z.ZodTypeAny): SchemaField {
  const unwrappedSchema = unwrapSchema(schema)

  if (unwrappedSchema instanceof z.ZodString) {
    return { key, kind: 'string', options: [] }
  }

  if (unwrappedSchema instanceof z.ZodNumber) {
    return { key, kind: 'number', options: [] }
  }

  if (unwrappedSchema instanceof z.ZodBoolean) {
    return { key, kind: 'boolean', options: [] }
  }

  if (unwrappedSchema instanceof z.ZodEnum) {
    return { key, kind: 'enum', options: [...unwrappedSchema.options] }
  }

  if (unwrappedSchema instanceof z.ZodUnion) {
    const options: z.ZodTypeAny[] = unwrappedSchema._def.options.map((option: z.ZodTypeAny) =>
      unwrapSchema(option),
    )
    const hasString = options.some((option) => option instanceof z.ZodString)
    const hasNumber = options.some((option) => option instanceof z.ZodNumber)

    if (hasString && hasNumber) {
      return { key, kind: 'string-or-number', options: [] }
    }
  }

  return { key, kind: 'json', options: [] }
}

function isPortableParamSchema(schema: unknown): schema is PortableParamSchema {
  if (typeof schema !== 'object' || schema === null || Array.isArray(schema)) {
    return false
  }

  return Object.values(schema).every((value) => {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      return false
    }

    const candidate = value as {
      type?: unknown
      options?: unknown
    }

    return (
      typeof candidate.type === 'string' &&
      ['string', 'number', 'boolean', 'enum', 'json', 'string-or-number'].includes(
        candidate.type,
      ) &&
      (candidate.options === undefined ||
        (Array.isArray(candidate.options) &&
          candidate.options.every((option) => typeof option === 'string')))
    )
  })
}

function unwrapSchema(schema: unknown): z.ZodTypeAny {
  if (!(schema instanceof z.ZodType)) {
    return z.unknown()
  }

  let currentSchema: z.ZodTypeAny = schema

  while (
    currentSchema instanceof z.ZodOptional ||
    currentSchema instanceof z.ZodDefault ||
    currentSchema instanceof z.ZodNullable ||
    currentSchema instanceof z.ZodCatch
  ) {
    currentSchema = currentSchema._def.innerType
  }

  return currentSchema
}

function getPublicParamInputPorts(schema: PortableParamSchema): PortDefinition[] {
  return Object.entries(schema).map(([key, field]) => ({
    key,
    valueType: getValueTypeForPortableField(field),
  }))
}

function getValueTypeForPortableField(field: {
  type: PortableParamSchema[keyof PortableParamSchema]['type']
}): ValueType {
  if (field.type === 'string' || field.type === 'enum') {
    return 'string'
  }

  if (field.type === 'number') {
    return 'number'
  }

  if (field.type === 'boolean') {
    return 'boolean'
  }

  return 'unknown'
}
