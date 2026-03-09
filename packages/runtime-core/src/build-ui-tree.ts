import { isUiNode, type UiNode } from '@procedural-web-composer/ui-tree'
import type {
  GraphDocument,
  GraphEvaluation,
  NodeDefinition,
  NodeDefinitionResolver,
  NodeEvaluationRecord,
  NodeInstance,
} from '@procedural-web-composer/shared-types'

interface OrderedChildReference {
  nodeId: string
  order: number | undefined
  slot: string
}

export function buildUiTree(
  graph: GraphDocument,
  evaluation: GraphEvaluation,
  registry: NodeDefinitionResolver,
): UiNode | null {
  const structureEdges = graph.edges.filter((edge) => edge.kind === 'structure')
  const nodesById = new Map(graph.nodes.map((node) => [node.id, node]))
  const definitionsByNodeId = new Map(
    graph.nodes.map((node) => [node.id, registry.getNodeDefinition(node.type)]),
  )
  const uiByNodeId = new Map<string, UiNode>()
  const incomingStructureCount = new Map<string, number>()
  const specialStructureChildNodeIds = new Set<string>()
  const childrenByParentId = new Map<string, Map<string, OrderedChildReference[]>>()

  for (const node of graph.nodes) {
    const record = evaluation.results[node.id]

    if (!record) {
      continue
    }

    const maybeUi = getPrimaryUiOutput(registry.getNodeDefinition(node.type), record)

    if (maybeUi && isUiNode(maybeUi)) {
      uiByNodeId.set(node.id, {
        ...maybeUi,
        children: [],
        ...(maybeUi.slots ? { slots: {} } : {}),
      })
    }
  }

  for (const edge of structureEdges) {
    if (nodesById.get(edge.from.nodeId)?.type === 'subgraph.instance') {
      specialStructureChildNodeIds.add(edge.to.nodeId)
      continue
    }

    if (!uiByNodeId.has(edge.from.nodeId) || !uiByNodeId.has(edge.to.nodeId)) {
      continue
    }

    incomingStructureCount.set(
      edge.to.nodeId,
      (incomingStructureCount.get(edge.to.nodeId) ?? 0) + 1,
    )

    const definition = definitionsByNodeId.get(edge.from.nodeId)
    const slot = resolveStructureSlot(definition, edge.slot)
    const slotsForParent = childrenByParentId.get(edge.from.nodeId) ?? new Map<string, OrderedChildReference[]>()

    slotsForParent.set(slot, [
      ...(slotsForParent.get(slot) ?? []),
      {
        nodeId: edge.to.nodeId,
        order: edge.order,
        slot,
      },
    ])
    childrenByParentId.set(edge.from.nodeId, slotsForParent)
  }

  for (const [parentId, slotReferences] of childrenByParentId.entries()) {
    for (const [slot, childRefs] of slotReferences.entries()) {
      slotReferences.set(
        slot,
        [...childRefs].sort((left, right) => compareStructureChild(left, right, nodesById)),
      )
    }

    childrenByParentId.set(parentId, slotReferences)
  }

  const roots = graph.nodes
    .filter(
      (node) =>
        uiByNodeId.has(node.id) &&
        (incomingStructureCount.get(node.id) ?? 0) === 0 &&
        !specialStructureChildNodeIds.has(node.id),
    )
    .map((node) => node.id)

  if (roots.length === 0) {
    return null
  }

  const preferredRoot =
    roots.find((nodeId) => nodesById.get(nodeId)?.type === 'layout.page') ?? roots[0]

  if (roots.length === 1 && preferredRoot) {
    return assembleNodeTree(preferredRoot, childrenByParentId, uiByNodeId, new Set())
  }

  return {
    id: 'fragment_root',
    kind: 'Fragment',
    props: {},
    children: roots
      .map((nodeId) => assembleNodeTree(nodeId, childrenByParentId, uiByNodeId, new Set()))
      .filter((node): node is UiNode => node !== null),
  }
}

export function getPrimaryUiOutput(
  nodeDefinition: NodeDefinition | undefined,
  evaluationResult: NodeEvaluationRecord,
): unknown {
  const uiPorts = nodeDefinition?.outputs.filter((port) => port.valueType === 'ui-node') ?? []
  const primaryPort = uiPorts.find((port) => port.key === 'ui') ?? uiPorts[0]

  if (primaryPort) {
    return evaluationResult.outputs[primaryPort.key]
  }

  return evaluationResult.outputs.ui
}

function assembleNodeTree(
  nodeId: string,
  childrenByParentId: Map<string, Map<string, OrderedChildReference[]>>,
  uiByNodeId: Map<string, UiNode>,
  visited: Set<string>,
): UiNode | null {
  if (visited.has(nodeId)) {
    return null
  }

  const uiNode = uiByNodeId.get(nodeId)

  if (!uiNode) {
    return null
  }

  visited.add(nodeId)

  const slotReferences = childrenByParentId.get(nodeId) ?? new Map<string, OrderedChildReference[]>()
  const resolvedSlotsEntries = [...slotReferences.entries()]
    .map(([slotName, childRefs]) => [
      slotName,
      childRefs
        .map((child) => assembleNodeTree(child.nodeId, childrenByParentId, uiByNodeId, visited))
        .filter((child): child is UiNode => child !== null),
    ] as const)
    .filter((entry) => entry[1].length > 0)
  const resolvedSlots = Object.fromEntries(resolvedSlotsEntries)
  const children = resolvedSlots.children ?? []

  return {
    ...uiNode,
    children,
    ...(Object.keys(resolvedSlots).length > 0 ? { slots: resolvedSlots } : {}),
  }
}

function compareStructureChild(
  left: OrderedChildReference,
  right: OrderedChildReference,
  nodesById: Map<string, NodeInstance>,
): number {
  const leftHasOrder = typeof left.order === 'number'
  const rightHasOrder = typeof right.order === 'number'

  if (leftHasOrder && rightHasOrder && left.order !== right.order) {
    return left.order! - right.order!
  }

  if (leftHasOrder !== rightHasOrder) {
    return leftHasOrder ? -1 : 1
  }

  return compareNodePosition(nodesById.get(left.nodeId), nodesById.get(right.nodeId))
}

function compareNodePosition(left: NodeInstance | undefined, right: NodeInstance | undefined): number {
  if (!left || !right) {
    return 0
  }

  if (left.position.y === right.position.y) {
    return left.position.x - right.position.x
  }

  return left.position.y - right.position.y
}

function resolveStructureSlot(
  nodeDefinition: NodeDefinition | undefined,
  requestedSlot: string | undefined,
): string {
  const supportedSlots = nodeDefinition?.slots?.length ? nodeDefinition.slots : ['children']

  if (!requestedSlot || requestedSlot.length === 0) {
    return 'children'
  }

  return supportedSlots.includes(requestedSlot) ? requestedSlot : 'children'
}
