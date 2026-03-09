import type {
  GraphDocument,
  GraphEvaluation,
  NodeDefinition,
  NodeDefinitionResolver,
  NodeEvaluationRecord,
  NodeInstance,
  UiNode,
} from '@procedural-web-composer/shared-types'

export function buildUiTree(
  graph: GraphDocument,
  evaluation: GraphEvaluation,
  registry: NodeDefinitionResolver,
): UiNode | null {
  const structureEdges = graph.edges.filter((edge) => edge.kind === 'structure')
  const nodesById = new Map(graph.nodes.map((node) => [node.id, node]))
  const uiByNodeId = new Map<string, UiNode>()
  const incomingStructureCount = new Map<string, number>()
  const childrenByParentId = new Map<string, string[]>()

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
      })
    }
  }

  for (const edge of structureEdges) {
    if (!uiByNodeId.has(edge.from.nodeId) || !uiByNodeId.has(edge.to.nodeId)) {
      continue
    }

    incomingStructureCount.set(
      edge.to.nodeId,
      (incomingStructureCount.get(edge.to.nodeId) ?? 0) + 1,
    )

    childrenByParentId.set(edge.from.nodeId, [
      ...(childrenByParentId.get(edge.from.nodeId) ?? []),
      edge.to.nodeId,
    ])
  }

  for (const [parentId, childIds] of childrenByParentId.entries()) {
    childrenByParentId.set(
      parentId,
      [...childIds].sort((left, right) => compareNodePosition(nodesById.get(left), nodesById.get(right))),
    )
  }

  const roots = graph.nodes
    .filter(
      (node) => uiByNodeId.has(node.id) && (incomingStructureCount.get(node.id) ?? 0) === 0,
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
    kind: 'fragment',
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
  childrenByParentId: Map<string, string[]>,
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

  const children = (childrenByParentId.get(nodeId) ?? [])
    .map((childId) => assembleNodeTree(childId, childrenByParentId, uiByNodeId, visited))
    .filter((child): child is UiNode => child !== null)

  return {
    ...uiNode,
    children,
  }
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

function isUiNode(value: unknown): value is UiNode {
  return typeof value === 'object' && value !== null && 'kind' in value && 'children' in value
}
