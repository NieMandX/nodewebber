import React, { useEffect, useState } from 'react'
import type { CSSProperties } from 'react'
import { getGraphById } from '@procedural-web-composer/editor-core'
import type { EditorStore } from '@procedural-web-composer/editor-core'
import type { NodeDefinitionResolver, PortDefinition } from '@procedural-web-composer/shared-types'
import {
  Background,
  Controls,
  Handle,
  MiniMap,
  Position,
  ReactFlow,
  type Connection,
  type Edge,
  type NodeTypes,
  type NodeChange,
  type Node as FlowNode,
  type NodeProps,
  type OnSelectionChangeParams,
} from '@xyflow/react'
import { useStore } from 'zustand'
import {
  buildHandleId,
  edgeColor,
  getPortEdgeKind,
  parseHandleId,
  summarizeParams,
  toReactFlowEdges,
  toReactFlowNodes,
  type ComposerFlowNode,
  type ComposerFlowNodeData,
} from './helpers'

export interface EditorCanvasProps {
  store: EditorStore
  registry: NodeDefinitionResolver
}

export interface NodePaletteProps {
  store: EditorStore
  registry: NodeDefinitionResolver
}

export interface NodeInspectorProps {
  store: EditorStore
  registry: NodeDefinitionResolver
}

const nodeTypes: NodeTypes = {
  composer: ComposerFlowNode,
}

export function EditorCanvas(props: EditorCanvasProps): JSX.Element {
  const project = useStore(props.store, (state) => state.project)
  const selectedGraphId = useStore(props.store, (state) => state.selectedGraphId)
  const graph = getGraphById(project, selectedGraphId)

  if (!graph) {
    return <div style={emptyPanelStyle}>No active graph</div>
  }

  const nodes = toReactFlowNodes(graph, props.registry)
  const edges = toReactFlowEdges(graph)

  return (
    <ReactFlow<ComposerFlowNode, Edge>
      fitView
      minZoom={0.2}
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      proOptions={{ hideAttribution: true }}
      onConnect={(connection) => handleConnect(connection, props.store)}
      onNodesChange={(changes) => handleNodesChange(changes, props.store)}
      onSelectionChange={(selection) => handleSelectionChange(selection, props.store)}
      onPaneClick={() => props.store.getState().selectNode(undefined)}
      onNodesDelete={(deletedNodes) => {
        for (const node of deletedNodes) {
          props.store.getState().removeNode(node.id)
        }
      }}
      onEdgesDelete={(deletedEdges) => {
        for (const edge of deletedEdges) {
          props.store.getState().removeEdge(edge.id)
        }
      }}
      defaultEdgeOptions={{
        type: 'smoothstep',
      }}
    >
      <Background color="rgba(31, 27, 23, 0.08)" gap={24} />
      <MiniMap
        pannable
        zoomable
        nodeColor={(node) => (node.selected ? '#c96f36' : '#d3b28f')}
        maskColor="rgba(255, 250, 241, 0.55)"
      />
      <Controls />
    </ReactFlow>
  )
}

export function NodePalette(props: NodePaletteProps): JSX.Element {
  const definitions = props.registry.listNodeDefinitions()
  const categories = Array.from(new Set(definitions.map((definition) => definition.category)))

  return (
    <div style={stackPanelStyle}>
      {categories.map((category) => (
        <section key={category} style={categorySectionStyle}>
          <header style={categoryHeaderStyle}>{category}</header>
          <div style={paletteListStyle}>
            {definitions
              .filter((definition) => definition.category === category)
              .map((definition) => (
                <button
                  key={definition.type}
                  type="button"
                  onClick={() => props.store.getState().addNode(definition.type)}
                  style={paletteButtonStyle}
                >
                  <strong>{definition.title}</strong>
                  <span style={secondaryTextStyle}>{definition.type}</span>
                </button>
              ))}
          </div>
        </section>
      ))}
    </div>
  )
}

export function NodeInspector(props: NodeInspectorProps): JSX.Element {
  const project = useStore(props.store, (state) => state.project)
  const selectedGraphId = useStore(props.store, (state) => state.selectedGraphId)
  const selectedNodeId = useStore(props.store, (state) => state.selectedNodeId)
  const graph = getGraphById(project, selectedGraphId)
  const node = graph?.nodes.find((candidate) => candidate.id === selectedNodeId)

  if (!node) {
    return <div style={emptyPanelStyle}>Select a node to edit params and inspect ports.</div>
  }

  const definition = props.registry.getNodeDefinition(node.type)

  return (
    <div style={stackPanelStyle}>
      <section style={categorySectionStyle}>
        <header style={categoryHeaderStyle}>Node</header>
        <label style={fieldStyle}>
          <span style={fieldLabelStyle}>Label</span>
          <input
            value={node.label ?? ''}
            onChange={(event) => props.store.getState().updateNodeLabel(node.id, event.target.value)}
            style={inputStyle}
          />
        </label>
        <div style={metaRowStyle}>
          <span style={secondaryTextStyle}>{node.type}</span>
          <span style={secondaryTextStyle}>v{node.version}</span>
        </div>
        <button
          type="button"
          onClick={() => props.store.getState().removeNode(node.id)}
          style={dangerButtonStyle}
        >
          Delete node
        </button>
      </section>

      <section style={categorySectionStyle}>
        <header style={categoryHeaderStyle}>Params</header>
        {Object.entries(node.params).map(([key, value]) => (
          <ParamField
            key={key}
            label={key}
            value={value}
            onCommit={(nextValue) => props.store.getState().updateNodeParam(node.id, key, nextValue)}
          />
        ))}
      </section>

      {definition ? (
        <section style={categorySectionStyle}>
          <header style={categoryHeaderStyle}>Ports</header>
          <PortList title="Inputs" ports={definition.inputs} direction="input" />
          <PortList title="Outputs" ports={definition.outputs} direction="output" />
        </section>
      ) : null}
    </div>
  )
}

function ComposerFlowNode(
  props: NodeProps<FlowNode<ComposerFlowNodeData, 'composer'>>,
): JSX.Element {
  return (
    <div
      style={{
        ...flowNodeStyle,
        borderColor: props.selected ? '#c96f36' : 'rgba(31, 27, 23, 0.12)',
        boxShadow: props.selected
          ? '0 18px 40px rgba(201, 111, 54, 0.24)'
          : '0 16px 30px rgba(31, 27, 23, 0.08)',
      }}
    >
      <div style={flowNodeHeaderStyle}>
        <strong>{props.data.title}</strong>
        <span style={secondaryTextStyle}>{props.data.type}</span>
      </div>
      <div style={flowNodeBodyStyle}>
        <div style={portsColumnStyle}>
          {props.data.inputs.map((port) => (
            <PortRow key={port.key} port={port} direction="input" />
          ))}
        </div>
        <div style={portsColumnStyle}>
          {props.data.outputs.map((port) => (
            <PortRow key={port.key} port={port} direction="output" />
          ))}
        </div>
      </div>
      <div style={flowNodeFooterStyle}>{summarizeParams(props.data.params)}</div>
    </div>
  )
}

function PortRow(props: {
  port: PortDefinition
  direction: 'input' | 'output'
}): JSX.Element {
  const kind = getPortEdgeKind(props.port, props.direction)
  const handleId = buildHandleId(kind, props.port.key)
  const position = props.direction === 'input' ? Position.Left : Position.Right

  return (
    <div
      style={{
        ...portRowStyle,
        justifyContent: props.direction === 'input' ? 'flex-start' : 'flex-end',
        textAlign: props.direction === 'input' ? 'left' : 'right',
      }}
    >
      <Handle
        id={handleId}
        type={props.direction === 'input' ? 'target' : 'source'}
        position={position}
        style={{
          background: edgeColor(kind),
          width: 10,
          height: 10,
          border: '2px solid white',
        }}
      />
      <span style={portLabelStyle}>
        {props.port.key}
        <small style={portTypeStyle}>{props.port.valueType}</small>
      </span>
    </div>
  )
}

function PortList(props: {
  title: string
  ports: PortDefinition[]
  direction: 'input' | 'output'
}): JSX.Element {
  return (
    <div style={portSummaryBlockStyle}>
      <strong style={subHeaderStyle}>{props.title}</strong>
      {props.ports.length === 0 ? (
        <span style={secondaryTextStyle}>None</span>
      ) : (
        props.ports.map((port) => (
          <div key={`${props.title}-${port.key}`} style={portSummaryRowStyle}>
            <span>{port.key}</span>
            <span style={{ ...secondaryTextStyle, color: edgeColor(getPortEdgeKind(port, props.direction)) }}>
              {getPortEdgeKind(port, props.direction)}
            </span>
          </div>
        ))
      )}
    </div>
  )
}

function ParamField(props: {
  label: string
  value: unknown
  onCommit: (value: unknown) => void
}): JSX.Element {
  if (typeof props.value === 'boolean') {
    return (
      <label style={fieldStyle}>
        <span style={fieldLabelStyle}>{props.label}</span>
        <input
          type="checkbox"
          checked={props.value}
          onChange={(event) => props.onCommit(event.target.checked)}
        />
      </label>
    )
  }

  if (typeof props.value === 'number') {
    return (
      <label style={fieldStyle}>
        <span style={fieldLabelStyle}>{props.label}</span>
        <input
          type="number"
          value={props.value}
          onChange={(event) => props.onCommit(Number(event.target.value))}
          style={inputStyle}
        />
      </label>
    )
  }

  if (typeof props.value === 'object' && props.value !== null) {
    return <JsonParamField label={props.label} value={props.value} onCommit={props.onCommit} />
  }

  return (
    <label style={fieldStyle}>
      <span style={fieldLabelStyle}>{props.label}</span>
      <input
        value={String(props.value ?? '')}
        onChange={(event) => props.onCommit(event.target.value)}
        style={inputStyle}
      />
    </label>
  )
}

function JsonParamField(props: {
  label: string
  value: unknown
  onCommit: (value: unknown) => void
}): JSX.Element {
  const [draft, setDraft] = useState(() => JSON.stringify(props.value, null, 2))
  const [error, setError] = useState<string>()

  useEffect(() => {
    setDraft(JSON.stringify(props.value, null, 2))
    setError(undefined)
  }, [props.value])

  return (
    <label style={fieldStyle}>
      <span style={fieldLabelStyle}>{props.label}</span>
      <textarea
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        style={textareaStyle}
      />
      <button
        type="button"
        onClick={() => {
          try {
            props.onCommit(JSON.parse(draft))
            setError(undefined)
          } catch (nextError) {
            setError(nextError instanceof Error ? nextError.message : 'Invalid JSON')
          }
        }}
        style={jsonApplyButtonStyle}
      >
        Apply JSON
      </button>
      {error ? <span style={errorTextStyle}>{error}</span> : null}
    </label>
  )
}

function handleConnect(connection: Connection, store: EditorStore): void {
  const source = parseHandleId(connection.sourceHandle)
  const target = parseHandleId(connection.targetHandle)

  if (!connection.source || !connection.target || !source || !target) {
    return
  }

  if (source.kind !== target.kind) {
    return
  }

  store.getState().connectNodes({
    fromNodeId: connection.source,
    fromPort: source.port,
    toNodeId: connection.target,
    toPort: target.port,
    kind: source.kind,
  })
}

function handleNodesChange(changes: NodeChange[], store: EditorStore): void {
  for (const change of changes) {
    if (change.type === 'position' && change.position) {
      store.getState().updateNodePosition(change.id, change.position)
    }
  }
}

function handleSelectionChange(
  selection: OnSelectionChangeParams,
  store: EditorStore,
): void {
  store.getState().selectNode(selection.nodes[0]?.id)
}

const emptyPanelStyle: CSSProperties = {
  display: 'grid',
  placeItems: 'center',
  minHeight: '220px',
  padding: '24px',
  color: '#7a6b5e',
  border: '1px dashed rgba(31, 27, 23, 0.16)',
  borderRadius: '20px',
  background: 'rgba(255, 250, 241, 0.72)',
  textAlign: 'center',
}

const stackPanelStyle: CSSProperties = {
  display: 'grid',
  gap: '16px',
}

const categorySectionStyle: CSSProperties = {
  display: 'grid',
  gap: '12px',
  padding: '16px',
  borderRadius: '20px',
  background: 'rgba(255, 250, 241, 0.88)',
  border: '1px solid rgba(31, 27, 23, 0.08)',
}

const categoryHeaderStyle: CSSProperties = {
  fontSize: '0.76rem',
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
  color: '#7a6b5e',
}

const paletteListStyle: CSSProperties = {
  display: 'grid',
  gap: '10px',
}

const paletteButtonStyle: CSSProperties = {
  display: 'grid',
  gap: '4px',
  padding: '14px',
  borderRadius: '16px',
  border: '1px solid rgba(31, 27, 23, 0.08)',
  background: '#fffdf8',
  color: '#1f1b17',
  cursor: 'pointer',
  textAlign: 'left',
}

const flowNodeStyle: CSSProperties = {
  minWidth: '250px',
  borderRadius: '20px',
  border: '1px solid rgba(31, 27, 23, 0.12)',
  background: '#fffdf8',
  overflow: 'hidden',
}

const flowNodeHeaderStyle: CSSProperties = {
  display: 'grid',
  gap: '4px',
  padding: '14px 16px 12px',
  borderBottom: '1px solid rgba(31, 27, 23, 0.08)',
  background: 'linear-gradient(135deg, rgba(255, 248, 238, 0.95), rgba(247, 236, 220, 0.92))',
}

const flowNodeBodyStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: '12px',
  padding: '12px 16px',
}

const portsColumnStyle: CSSProperties = {
  display: 'grid',
  gap: '8px',
}

const portRowStyle: CSSProperties = {
  position: 'relative',
  display: 'flex',
  alignItems: 'center',
  minHeight: '24px',
}

const portLabelStyle: CSSProperties = {
  display: 'grid',
  fontSize: '0.82rem',
}

const portTypeStyle: CSSProperties = {
  fontSize: '0.68rem',
  color: '#7a6b5e',
}

const flowNodeFooterStyle: CSSProperties = {
  padding: '10px 16px 14px',
  borderTop: '1px solid rgba(31, 27, 23, 0.08)',
  color: '#7a6b5e',
  fontSize: '0.76rem',
}

const secondaryTextStyle: CSSProperties = {
  color: '#7a6b5e',
  fontSize: '0.82rem',
}

const fieldStyle: CSSProperties = {
  display: 'grid',
  gap: '8px',
}

const fieldLabelStyle: CSSProperties = {
  fontSize: '0.82rem',
  color: '#5d5249',
}

const inputStyle: CSSProperties = {
  width: '100%',
  minHeight: '40px',
  padding: '0 12px',
  borderRadius: '12px',
  border: '1px solid rgba(31, 27, 23, 0.12)',
  background: '#fffdf8',
  color: '#1f1b17',
}

const textareaStyle: CSSProperties = {
  width: '100%',
  minHeight: '120px',
  padding: '12px',
  borderRadius: '12px',
  border: '1px solid rgba(31, 27, 23, 0.12)',
  background: '#fffdf8',
  color: '#1f1b17',
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
  resize: 'vertical',
}

const jsonApplyButtonStyle: CSSProperties = {
  width: 'fit-content',
  minHeight: '36px',
  padding: '0 12px',
  borderRadius: '999px',
  border: '1px solid rgba(31, 27, 23, 0.12)',
  background: '#f7ede0',
  color: '#1f1b17',
  cursor: 'pointer',
}

const dangerButtonStyle: CSSProperties = {
  width: 'fit-content',
  minHeight: '36px',
  padding: '0 12px',
  borderRadius: '999px',
  border: '1px solid rgba(191, 67, 39, 0.18)',
  background: '#fff2ee',
  color: '#bf4327',
  cursor: 'pointer',
}

const metaRowStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: '12px',
}

const portSummaryBlockStyle: CSSProperties = {
  display: 'grid',
  gap: '8px',
}

const subHeaderStyle: CSSProperties = {
  fontSize: '0.82rem',
}

const portSummaryRowStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: '12px',
  fontSize: '0.82rem',
}

const errorTextStyle: CSSProperties = {
  color: '#bf4327',
  fontSize: '0.76rem',
}
