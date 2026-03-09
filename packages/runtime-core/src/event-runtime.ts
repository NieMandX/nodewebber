import { getSubgraphDefinition, isReusableGraph } from '@procedural-web-composer/graph-core'
import type {
  GraphDocument,
  GraphEventBindingEdge,
  GraphEventReactionBinding,
  GraphEventRuntime,
  GraphEventSourceBinding,
  ProjectDocument,
  ViewerCameraConfig,
} from '@procedural-web-composer/shared-types'

const DEFAULT_MAX_DISPATCH_DEPTH = 12

export function buildGraphEventRuntime(
  document: ProjectDocument,
  graphId: string,
): GraphEventRuntime | undefined {
  const rootGraph = document.graphs.find((graph) => graph.id === graphId)

  if (!rootGraph) {
    return undefined
  }

  const sources: GraphEventSourceBinding[] = []
  const reactions: GraphEventReactionBinding[] = []
  const edges: GraphEventBindingEdge[] = []
  const visitedGraphIds = new Set<string>()

  visitGraph(rootGraph)

  return {
    graphId,
    sources,
    reactions,
    edges,
    maxDispatchDepth: DEFAULT_MAX_DISPATCH_DEPTH,
  }

  function visitGraph(graph: GraphDocument): void {
    if (visitedGraphIds.has(graph.id)) {
      return
    }

    visitedGraphIds.add(graph.id)

    const inferredViewerBlockNodeId = inferViewerBlockNodeId(graph)

    for (const edge of graph.edges.filter((candidate) => candidate.kind === 'event')) {
      edges.push({
        edgeId: edge.id,
        graphId: graph.id,
        sourceNodeId: edge.from.nodeId,
        sourcePort: edge.from.port,
        targetNodeId: edge.to.nodeId,
        targetPort: edge.to.port,
      })
    }

    for (const node of graph.nodes) {
      if (node.type === 'viewer.onHotspotClick') {
        const viewerBlockNodeId = resolveViewerBlockNodeId(
          node.params.viewerBlockNodeId,
          inferredViewerBlockNodeId,
        )
        const hotspotId = readString(node.params.hotspotId)

        sources.push({
          nodeId: node.id,
          graphId: graph.id,
          sourceType: 'viewer.onHotspotClick',
          outputPort: 'event',
          eventName: readString(node.params.eventName) ?? 'viewer.hotspotClick',
          ...(viewerBlockNodeId ? { viewerBlockNodeId } : {}),
          ...(hotspotId ? { hotspotId } : {}),
        })
        continue
      }

      if (node.type === 'viewer.onStateChange') {
        const viewerBlockNodeId = resolveViewerBlockNodeId(
          node.params.viewerBlockNodeId,
          inferredViewerBlockNodeId,
        )
        const stateId = readString(node.params.stateId)

        sources.push({
          nodeId: node.id,
          graphId: graph.id,
          sourceType: 'viewer.onStateChange',
          outputPort: 'event',
          eventName: readString(node.params.eventName) ?? 'viewer.stateChange',
          ...(viewerBlockNodeId ? { viewerBlockNodeId } : {}),
          ...(stateId ? { stateId } : {}),
        })
        continue
      }

      if (node.type === 'ui.onClick') {
        sources.push({
          nodeId: node.id,
          graphId: graph.id,
          sourceType: 'ui.onClick',
          outputPort: 'event',
          eventName: readString(node.params.eventName) ?? 'ui.click',
          ...(readString(node.params.targetNodeId)
            ? { targetNodeId: readString(node.params.targetNodeId)! }
            : {}),
        })
        continue
      }

      if (node.type === 'events.setViewerState') {
        const viewerBlockNodeId = resolveViewerBlockNodeId(
          node.params.viewerBlockNodeId,
          inferredViewerBlockNodeId,
        )
        const stateId = readString(node.params.stateId)

        reactions.push({
          nodeId: node.id,
          graphId: graph.id,
          reactionType: 'events.setViewerState',
          inputPort: 'trigger',
          ...(viewerBlockNodeId ? { viewerBlockNodeId } : {}),
          ...(stateId ? { stateId } : {}),
        })
        continue
      }

      if (node.type === 'events.setViewerVariant') {
        const viewerBlockNodeId = resolveViewerBlockNodeId(
          node.params.viewerBlockNodeId,
          inferredViewerBlockNodeId,
        )
        const variantId = readString(node.params.variantId)

        reactions.push({
          nodeId: node.id,
          graphId: graph.id,
          reactionType: 'events.setViewerVariant',
          inputPort: 'trigger',
          ...(viewerBlockNodeId ? { viewerBlockNodeId } : {}),
          ...(variantId ? { variantId } : {}),
        })
        continue
      }

      if (node.type === 'events.focusViewerCamera') {
        const viewerBlockNodeId = resolveViewerBlockNodeId(
          node.params.viewerBlockNodeId,
          inferredViewerBlockNodeId,
        )
        const camera = asViewerCamera(node.params.camera)
        const stateId = readString(node.params.stateId)

        reactions.push({
          nodeId: node.id,
          graphId: graph.id,
          reactionType: 'events.focusViewerCamera',
          inputPort: 'trigger',
          ...(viewerBlockNodeId ? { viewerBlockNodeId } : {}),
          ...(camera ? { camera } : {}),
          ...(stateId ? { stateId } : {}),
        })
        continue
      }

      if (node.type === 'events.emit') {
        const payload = asRecord(node.params.payload)

        reactions.push({
          nodeId: node.id,
          graphId: graph.id,
          reactionType: 'events.emit',
          inputPort: 'trigger',
          outputPort: 'event',
          eventName: readString(node.params.eventName) ?? 'events.emit',
          ...(payload ? { payload } : {}),
        })
        continue
      }

      if (node.type === 'events.log') {
        const label = readString(node.params.label)

        reactions.push({
          nodeId: node.id,
          graphId: graph.id,
          reactionType: 'events.log',
          inputPort: 'trigger',
          ...(label ? { label } : {}),
        })
        continue
      }

      if (node.type === 'presentation.setStep') {
        const stepId = readString(node.params.stepId)

        reactions.push({
          nodeId: node.id,
          graphId: graph.id,
          reactionType: 'presentation.setStep',
          inputPort: 'trigger',
          ...(stepId ? { stepId } : {}),
        })
        continue
      }

      if (node.type === 'presentation.nextStep') {
        reactions.push({
          nodeId: node.id,
          graphId: graph.id,
          reactionType: 'presentation.nextStep',
          inputPort: 'trigger',
        })
        continue
      }

      if (node.type === 'presentation.prevStep') {
        reactions.push({
          nodeId: node.id,
          graphId: graph.id,
          reactionType: 'presentation.prevStep',
          inputPort: 'trigger',
        })
        continue
      }

      if (node.type === 'presentation.togglePlay') {
        reactions.push({
          nodeId: node.id,
          graphId: graph.id,
          reactionType: 'presentation.togglePlay',
          inputPort: 'trigger',
        })
        continue
      }

      if (node.type === 'subgraph.instance') {
        const subgraphDefinition = getSubgraphDefinition(document, readString(node.params.subgraphGraphId) ?? '')
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

function inferViewerBlockNodeId(graph: GraphDocument): string | undefined {
  const viewerBlockIds = graph.nodes
    .filter((node) => node.type === 'viewer.block')
    .map((node) => node.id)

  return viewerBlockIds.length === 1 ? viewerBlockIds[0] : undefined
}

function resolveViewerBlockNodeId(
  explicitValue: unknown,
  inferredValue: string | undefined,
): string | undefined {
  return readString(explicitValue) ?? inferredValue
}

function readString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined
}

function asViewerCamera(value: unknown): ViewerCameraConfig | undefined {
  const record = asRecord(value)

  return record ? (record as ViewerCameraConfig) : undefined
}
