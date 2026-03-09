import { getSubgraphDefinition, isReusableGraph } from '@procedural-web-composer/graph-core'
import type {
  GraphDocument,
  PresentationRuntime,
  PresentationStepConfig,
  ProjectDocument,
} from '@procedural-web-composer/shared-types'

export function buildPresentationRuntime(
  document: ProjectDocument,
  graphId: string,
): PresentationRuntime | undefined {
  const rootGraph = document.graphs.find((graph) => graph.id === graphId)

  if (!rootGraph) {
    return undefined
  }

  const visitedGraphIds = new Set<string>()
  const aggregatedSteps: PresentationStepConfig[] = []
  const fallbackSteps: PresentationStepConfig[] = []
  let foundAggregator = false

  visitGraph(rootGraph)

  const steps = dedupeSteps(foundAggregator ? aggregatedSteps : fallbackSteps)

  if (steps.length === 0) {
    return undefined
  }

  return {
    graphId,
    steps,
    ...(steps[0]?.id ? { initialStepId: steps[0].id } : {}),
  }

  function visitGraph(graph: GraphDocument): void {
    if (visitedGraphIds.has(graph.id)) {
      return
    }

    visitedGraphIds.add(graph.id)

    const nodesById = new Map(graph.nodes.map((node) => [node.id, node]))
    const stepNodes = graph.nodes
      .filter((node) => node.type === 'presentation.step')
      .sort(compareNodesByPosition)
    const aggregatorNodes = graph.nodes
      .filter((node) => node.type === 'presentation.steps')
      .sort(compareNodesByPosition)

    if (aggregatorNodes.length > 0) {
      foundAggregator = true

      for (const aggregatorNode of aggregatorNodes) {
        aggregatedSteps.push(
          ...graph.edges
            .filter(
              (edge) =>
                edge.kind === 'data' &&
                edge.to.nodeId === aggregatorNode.id &&
                edge.to.port === 'steps',
            )
            .sort((left, right) => compareEdgesByOrder(left, right, nodesById))
            .map((edge) => nodesById.get(edge.from.nodeId))
            .filter((node): node is NonNullable<typeof node> => node?.type === 'presentation.step')
            .map(toPresentationStepConfig),
        )
      }
    } else {
      fallbackSteps.push(...stepNodes.map(toPresentationStepConfig))
    }

    for (const node of graph.nodes) {
      if (node.type === 'subgraph.instance') {
        const subgraphDefinition = getSubgraphDefinition(
          document,
          readString(node.params.subgraphGraphId) ?? '',
        )
        const referencedGraph = subgraphDefinition
          ? document.graphs.find((candidate) => candidate.id === subgraphDefinition.graphId)
          : undefined

        if (referencedGraph && isReusableGraph(referencedGraph)) {
          visitGraph(referencedGraph)
        }
      }

      if (node.type === 'data.repeat') {
        const referencedGraphId = readString(node.params.itemSubgraphGraphId)
        const referencedGraph = referencedGraphId
          ? document.graphs.find((candidate) => candidate.id === referencedGraphId)
          : undefined

        if (referencedGraph && isReusableGraph(referencedGraph)) {
          visitGraph(referencedGraph)
        }
      }
    }
  }
}

function toPresentationStepConfig(node: {
  id: string
  params: Record<string, unknown>
}): PresentationStepConfig {
  const metadata = asRecord(node.params.metadata)

  return {
    id: readString(node.params.id) ?? node.id,
    ...(readString(node.params.label) ? { label: readString(node.params.label)! } : {}),
    ...(readString(node.params.title) ? { title: readString(node.params.title)! } : {}),
    ...(readString(node.params.description)
      ? { description: readString(node.params.description)! }
      : {}),
    ...(readString(node.params.viewerStateId)
      ? { viewerStateId: readString(node.params.viewerStateId)! }
      : {}),
    ...(readString(node.params.viewerVariantId)
      ? { viewerVariantId: readString(node.params.viewerVariantId)! }
      : {}),
    ...(readStringArray(node.params.visibleSlots)
      ? { visibleSlots: readStringArray(node.params.visibleSlots)! }
      : {}),
    ...(readStringArray(node.params.visibleNodeIds)
      ? { visibleNodeIds: readStringArray(node.params.visibleNodeIds)! }
      : {}),
    ...(readStringArray(node.params.hiddenNodeIds)
      ? { hiddenNodeIds: readStringArray(node.params.hiddenNodeIds)! }
      : {}),
    ...(metadata ? { metadata } : {}),
  }
}

function dedupeSteps(steps: PresentationStepConfig[]): PresentationStepConfig[] {
  const seen = new Set<string>()

  return steps.filter((step) => {
    if (seen.has(step.id)) {
      return false
    }

    seen.add(step.id)
    return true
  })
}

function compareNodesByPosition(
  left: { position: { x: number; y: number } },
  right: { position: { x: number; y: number } },
): number {
  if (left.position.y === right.position.y) {
    return left.position.x - right.position.x
  }

  return left.position.y - right.position.y
}

function compareEdgesByOrder(
  left: { order?: number; from: { nodeId: string } },
  right: { order?: number; from: { nodeId: string } },
  nodesById: Map<string, { position: { x: number; y: number } }>,
): number {
  const leftHasOrder = typeof left.order === 'number'
  const rightHasOrder = typeof right.order === 'number'

  if (leftHasOrder && rightHasOrder && left.order !== right.order) {
    return (left.order ?? 0) - (right.order ?? 0)
  }

  if (leftHasOrder !== rightHasOrder) {
    return leftHasOrder ? -1 : 1
  }

  return compareNodesByPosition(
    nodesById.get(left.from.nodeId) ?? { position: { x: 0, y: 0 } },
    nodesById.get(right.from.nodeId) ?? { position: { x: 0, y: 0 } },
  )
}

function readString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined
}

function readStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined
  }

  const normalized = value
    .filter((entry): entry is string => typeof entry === 'string')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)

  return normalized.length > 0 ? normalized : undefined
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined
}
