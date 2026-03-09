import { memo, useEffect, useMemo, useRef, useState } from 'react'
import { getGraphById } from '@procedural-web-composer/editor-core'
import type { EditorStore } from '@procedural-web-composer/editor-core'
import type {
  GraphIssue,
  NodeDefinitionResolver,
  NodeInstance,
  PortDefinition,
} from '@procedural-web-composer/shared-types'
import {
  Background,
  Controls,
  Handle,
  MiniMap,
  NodeToolbar,
  Position,
  ReactFlow,
  useReactFlow,
  type Connection,
  type Edge,
  type Node as FlowNode,
  type NodeChange,
  type NodeProps,
  type NodeTypes,
  type OnSelectionChangeParams,
  type ReactFlowInstance,
} from '@xyflow/react'
import { useStore } from 'zustand'
import {
  buildHandleId,
  edgeColor,
  getPortEdgeKind,
  parseHandleId,
  toReactFlowEdges,
} from '@procedural-web-composer/editor-reactflow'
import { DRAG_NODE_TYPE_MIME } from './dnd'

interface EditorCanvasProps {
  store: EditorStore
  registry: NodeDefinitionResolver
  issues: GraphIssue[]
}

interface EditorCanvasNodeData extends Record<string, unknown> {
  nodeId: string
  title: string
  type: string
  params: Record<string, unknown>
  inputs: PortDefinition[]
  outputs: PortDefinition[]
  invalid: boolean
  invalidMessages: string[]
  hasClipboard: boolean
  onDelete: (nodeId: string) => void
  onDuplicate: (nodeId: string, position?: NodeInstance['position']) => void
  onCopy: (nodeId: string) => void
  onPaste: (position: NodeInstance['position']) => void
}

type EditorCanvasNode = FlowNode<EditorCanvasNodeData, 'editor-node'>

export function EditorCanvas(props: EditorCanvasProps): JSX.Element {
  const project = useStore(props.store, (state) => state.project)
  const selectedGraphId = useStore(props.store, (state) => state.selectedGraphId)
  const graph = getGraphById(project, selectedGraphId)
  const [clipboardNodeId, setClipboardNodeId] = useState<string>()
  const [reactFlowInstance, setReactFlowInstance] = useState<ReactFlowInstance<EditorCanvasNode, Edge> | null>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)

  const invalidMessagesByNodeId = useMemo(() => {
    const nextMap = new Map<string, string[]>()

    for (const issue of props.issues) {
      if (!issue.nodeId) {
        continue
      }

      nextMap.set(issue.nodeId, [...(nextMap.get(issue.nodeId) ?? []), issue.message])
    }

    return nextMap
  }, [props.issues])

  if (!graph) {
    return <div className="empty-panel">No active graph</div>
  }

  const clipboardExistsInGraph =
    clipboardNodeId !== undefined && graph.nodes.some((node) => node.id === clipboardNodeId)
  const nodes: EditorCanvasNode[] = graph.nodes.map((node) => {
    const definition = props.registry.getNodeDefinition(node.type)

    return {
      id: node.id,
      type: 'editor-node',
      position: node.position,
      data: {
        nodeId: node.id,
        title: node.label ?? definition?.title ?? node.type,
        type: node.type,
        params: node.params,
        inputs: definition?.inputs ?? [],
        outputs: definition?.outputs ?? [],
        invalid: invalidMessagesByNodeId.has(node.id),
        invalidMessages: invalidMessagesByNodeId.get(node.id) ?? [],
        hasClipboard: clipboardExistsInGraph,
        onDelete: (nodeId) => props.store.getState().removeNode(nodeId),
        onDuplicate: (nodeId, position) => props.store.getState().duplicateNode(nodeId, position),
        onCopy: (nodeId) => setClipboardNodeId(nodeId),
        onPaste: (position) => {
          if (!clipboardNodeId) {
            return
          }

          props.store.getState().duplicateNode(clipboardNodeId, position)
        },
      },
    }
  })
  const edges = toReactFlowEdges(graph)
  const nodeTypes: NodeTypes = {
    'editor-node': CanvasNode,
  }

  return (
    <div
      ref={wrapperRef}
      className="canvas-interaction-layer"
      onDragOver={(event) => {
        event.preventDefault()
        event.dataTransfer.dropEffect = 'move'
      }}
      onDrop={(event) => {
        event.preventDefault()
        const nodeType = event.dataTransfer.getData(DRAG_NODE_TYPE_MIME)

        if (!nodeType || !reactFlowInstance) {
          return
        }

        const position = reactFlowInstance.screenToFlowPosition({
          x: event.clientX,
          y: event.clientY,
        })

        props.store.getState().addNode(nodeType, position)
      }}
    >
      <ReactFlow<EditorCanvasNode, Edge>
        fitView
        minZoom={0.2}
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        proOptions={{ hideAttribution: true }}
        onInit={setReactFlowInstance}
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
          position="bottom-right"
          pannable
          zoomable
          nodeColor={(node) => {
            const typedNode = node as EditorCanvasNode

            if (typedNode.data.invalid) {
              return '#bf4327'
            }

            return typedNode.selected ? '#c96f36' : '#d3b28f'
          }}
          maskColor="rgba(255, 250, 241, 0.55)"
        />
        <Controls position="bottom-left" />
      </ReactFlow>

      <div className="canvas-center-control">
        <button
          type="button"
          className="button chrome"
          onClick={() => centerGraph(reactFlowInstance, graph.nodes)}
        >
          Center graph
        </button>
      </div>
    </div>
  )
}

const CanvasNode = memo(function CanvasNode(
  props: NodeProps<FlowNode<EditorCanvasNodeData, 'editor-node'>>,
): JSX.Element {
  const reactFlow = useReactFlow<EditorCanvasNode, Edge>()
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null)

  useEffect(() => {
    if (!contextMenu) {
      return
    }

    const handlePointerDown = (): void => {
      setContextMenu(null)
    }

    window.addEventListener('pointerdown', handlePointerDown)

    return () => window.removeEventListener('pointerdown', handlePointerDown)
  }, [contextMenu])

  const focusNode = (): void => {
    const node = reactFlow.getNode(props.id)
    const nodePosition = node?.position

    if (!nodePosition) {
      return
    }

    reactFlow.setCenter(nodePosition.x + (props.width ?? 140) / 2, nodePosition.y + (props.height ?? 80) / 2, {
      zoom: Math.max(reactFlow.getZoom(), 0.9),
      duration: 180,
    })
  }

  return (
    <div
      className={`canvas-node${props.selected ? ' selected' : ''}${props.data.invalid ? ' invalid' : ''}`}
      onContextMenu={(event) => {
        event.preventDefault()
        setContextMenu({
          x: event.clientX,
          y: event.clientY,
        })
      }}
    >
      <NodeToolbar isVisible={props.selected} position={Position.Top}>
        <div className="node-toolbar">
          <button type="button" className="toolbar-chip" onClick={() => props.data.onDuplicate(props.id)}>
            Duplicate
          </button>
          <button type="button" className="toolbar-chip" onClick={focusNode}>
            Focus
          </button>
          <button type="button" className="toolbar-chip danger" onClick={() => props.data.onDelete(props.id)}>
            Delete
          </button>
        </div>
      </NodeToolbar>

      <div className="canvas-node-header">
        <div>
          <strong>{props.data.title}</strong>
          <span>{props.data.type}</span>
        </div>
        {props.data.invalid ? <small className="invalid-badge">Invalid</small> : null}
      </div>
      <div className="canvas-node-body">
        <div className="canvas-node-ports">
          {props.data.inputs.map((port) => (
            <PortRow key={`input-${port.key}`} port={port} direction="input" />
          ))}
        </div>
        <div className="canvas-node-ports right">
          {props.data.outputs.map((port) => (
            <PortRow key={`output-${port.key}`} port={port} direction="output" />
          ))}
        </div>
      </div>
      <div className="canvas-node-footer">{summarizeParams(props.data.params)}</div>
      {props.data.invalidMessages.length > 0 ? (
        <div className="canvas-node-warnings">
          {props.data.invalidMessages.slice(0, 2).map((message, index) => (
            <small key={`${props.id}-warning-${index}`}>{message}</small>
          ))}
        </div>
      ) : null}

      {contextMenu ? (
        <div
          className="node-context-menu"
          style={{
            left: contextMenu.x,
            top: contextMenu.y,
          }}
          onPointerDown={(event) => event.stopPropagation()}
        >
          <button type="button" onClick={() => props.data.onDelete(props.id)}>
            Delete
          </button>
          <button type="button" onClick={() => props.data.onDuplicate(props.id)}>
            Duplicate
          </button>
          <button type="button" onClick={() => props.data.onCopy(props.id)}>
            Copy
          </button>
          <button
            type="button"
            disabled={!props.data.hasClipboard}
            onClick={() =>
              props.data.onPaste({
                x: props.positionAbsoluteX + 44,
                y: props.positionAbsoluteY + 44,
              })
            }
          >
            Paste
          </button>
        </div>
      ) : null}
    </div>
  )
})

function PortRow(props: {
  port: PortDefinition
  direction: 'input' | 'output'
}): JSX.Element {
  const kind = getPortEdgeKind(props.port, props.direction)

  return (
    <div className={`canvas-port-row ${props.direction}`}>
      <Handle
        id={buildHandleId(kind, props.port.key)}
        type={props.direction === 'input' ? 'target' : 'source'}
        position={props.direction === 'input' ? Position.Left : Position.Right}
        style={{
          background: edgeColor(kind),
          width: 10,
          height: 10,
          border: '2px solid white',
        }}
      />
      <span>
        {props.port.key}
        <small>{props.port.valueType}</small>
      </span>
    </div>
  )
}

function handleConnect(connection: Connection, store: EditorStore): void {
  const source = parseHandleId(connection.sourceHandle)
  const target = parseHandleId(connection.targetHandle)

  if (!connection.source || !connection.target || !source || !target || source.kind !== target.kind) {
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

function handleSelectionChange(selection: OnSelectionChangeParams, store: EditorStore): void {
  store.getState().selectNode(selection.nodes[0]?.id)
}

function centerGraph(
  reactFlowInstance: ReactFlowInstance<EditorCanvasNode, Edge> | null,
  nodes: NodeInstance[],
): void {
  if (!reactFlowInstance || nodes.length === 0) {
    return
  }

  const centerX = nodes.reduce((sum, node) => sum + node.position.x, 0) / nodes.length
  const centerY = nodes.reduce((sum, node) => sum + node.position.y, 0) / nodes.length

  reactFlowInstance.setCenter(centerX, centerY, {
    zoom: reactFlowInstance.getZoom(),
    duration: 180,
  })
}

function summarizeParams(params: Record<string, unknown>): string {
  const entries = Object.entries(params).slice(0, 3)

  if (entries.length === 0) {
    return 'No params'
  }

  return entries.map(([key, value]) => `${key}: ${formatParamValue(value)}`).join(' | ')
}

function formatParamValue(value: unknown): string {
  if (typeof value === 'string') {
    return value.length > 16 ? `${value.slice(0, 16)}...` : value
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }

  if (Array.isArray(value)) {
    return `[${value.length}]`
  }

  if (typeof value === 'object' && value !== null) {
    return '{...}'
  }

  return 'unset'
}
