import type {
  EdgeKind,
  GraphDocument,
  NodeDefinitionResolver,
  PortDefinition,
} from '@procedural-web-composer/shared-types'
import type { Edge, Node as FlowNode } from '@xyflow/react'

export interface ComposerFlowNodeData extends Record<string, unknown> {
  nodeId: string
  title: string
  type: string
  params: Record<string, unknown>
  inputs: PortDefinition[]
  outputs: PortDefinition[]
}

export type ComposerFlowNode = FlowNode<ComposerFlowNodeData, 'composer'>

export function toReactFlowNodes(
  graph: GraphDocument,
  registry: NodeDefinitionResolver,
): ComposerFlowNode[] {
  return graph.nodes.map((node) => {
    const definition = registry.getNodeDefinition(node.type)

    return {
      id: node.id,
      type: 'composer',
      position: node.position,
      data: {
        nodeId: node.id,
        title: node.label ?? definition?.title ?? node.type,
        type: node.type,
        params: node.params,
        inputs: definition?.inputs ?? [],
        outputs: definition?.outputs ?? [],
      },
    }
  })
}

export function toReactFlowEdges(graph: GraphDocument): Edge[] {
  return graph.edges.map((edge) => ({
    id: edge.id,
    source: edge.from.nodeId,
    target: edge.to.nodeId,
    sourceHandle: buildHandleId(
      edge.kind,
      edge.from.port,
      edge.kind === 'structure' ? edge.slot ?? DEFAULT_STRUCTURE_SLOT : edge.slot,
    ),
    targetHandle: buildHandleId(edge.kind, edge.to.port),
    type: 'smoothstep',
    animated: edge.kind === 'style',
    style: {
      stroke: edgeColor(edge.kind),
      strokeWidth: edge.kind === 'structure' ? 2.4 : 1.8,
      ...(edge.kind === 'event' ? { strokeDasharray: '6 4' } : {}),
    },
  }))
}

const DEFAULT_STRUCTURE_SLOT = 'children'

export function buildHandleId(
  kind: EdgeKind,
  port: string,
  slot?: string,
): string {
  return slot ? `${kind}:${port}:${slot}` : `${kind}:${port}`
}

export function parseHandleId(
  handleId: string | null | undefined,
): { kind: EdgeKind; port: string; slot?: string } | undefined {
  if (!handleId) {
    return undefined
  }

  const [kind, port, ...slotParts] = handleId.split(':')
  const slot = slotParts.join(':')

  if (!kind || !port || !isEdgeKind(kind)) {
    return undefined
  }

  return {
    kind,
    port,
    ...(slot ? { slot } : {}),
  }
}

export function getPortEdgeKind(port: PortDefinition, direction: 'input' | 'output'): EdgeKind {
  if (port.key === 'parent') {
    return 'structure'
  }

  if (port.valueType === 'event') {
    return 'event'
  }

  if (port.valueType === 'theme' || port.valueType === 'style-token') {
    return 'style'
  }

  if (port.valueType === 'ui-node' && direction === 'output') {
    return 'structure'
  }

  return 'data'
}

export function edgeColor(kind: EdgeKind): string {
  if (kind === 'structure') {
    return '#c96f36'
  }

  if (kind === 'style') {
    return '#2f8f6d'
  }

  if (kind === 'event') {
    return '#bf4327'
  }

  return '#4e6bf0'
}

export function summarizeParams(params: Record<string, unknown>): string {
  const entries = Object.entries(params).slice(0, 3)

  if (entries.length === 0) {
    return 'No params'
  }

  return entries
    .map(([key, value]) => `${key}: ${formatParamValue(value)}`)
    .join(' | ')
}

function formatParamValue(value: unknown): string {
  if (typeof value === 'string') {
    return value.length > 16 ? `${value.slice(0, 16)}…` : value
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }

  if (Array.isArray(value)) {
    return `[${value.length}]`
  }

  if (typeof value === 'object' && value !== null) {
    return '{…}'
  }

  return 'unset'
}

function isEdgeKind(value: string): value is EdgeKind {
  return value === 'data' || value === 'structure' || value === 'style' || value === 'event'
}
