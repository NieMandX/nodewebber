import type {
  GraphDocument,
  NodeDefinitionResolver,
  ProjectDocument,
} from '@procedural-web-composer/shared-types'

export interface GraphDiagnostics {
  graphId: string
  graphName: string
  orphanUiNodeIds: string[]
  unusedThemeNodeIds: string[]
  multiplePageNodeIds: string[]
  missingPageNode: boolean
  missingPageRoot: boolean
  disconnectedNodeIds: string[]
}

export interface ProjectDiagnostics {
  graphs: GraphDiagnostics[]
}

export function getGraphDiagnostics(
  project: ProjectDocument,
  registry?: NodeDefinitionResolver,
): ProjectDiagnostics
export function getGraphDiagnostics(
  graph: GraphDocument,
  registry?: NodeDefinitionResolver,
): GraphDiagnostics
export function getGraphDiagnostics(
  input: ProjectDocument | GraphDocument,
  registry?: NodeDefinitionResolver,
): ProjectDiagnostics | GraphDiagnostics {
  if (isProjectDocument(input)) {
    return {
      graphs: input.graphs.map((graph) => analyzeGraphDiagnostics(graph, registry)),
    }
  }

  return analyzeGraphDiagnostics(input, registry)
}

export function analyzeGraphDiagnostics(
  graph: GraphDocument,
  registry?: NodeDefinitionResolver,
): GraphDiagnostics {
  const structureEdges = graph.edges.filter((edge) => edge.kind === 'structure')
  const incomingStructureCounts = new Map<string, number>()
  const structureChildren = new Map<string, string[]>()

  for (const edge of structureEdges) {
    incomingStructureCounts.set(
      edge.to.nodeId,
      (incomingStructureCounts.get(edge.to.nodeId) ?? 0) + 1,
    )
    structureChildren.set(edge.from.nodeId, [
      ...(structureChildren.get(edge.from.nodeId) ?? []),
      edge.to.nodeId,
    ])
  }

  const pageNodeIds = graph.nodes
    .filter((node) => node.type === 'layout.page')
    .map((node) => node.id)
  const pageRootNodeIds = pageNodeIds.filter(
    (nodeId) => (incomingStructureCounts.get(nodeId) ?? 0) === 0,
  )
  const firstPageRootId = pageRootNodeIds[0]
  const unusedThemeNodeIds = graph.nodes
    .filter((node) => node.type === 'style.theme')
    .filter(
      (node) =>
        !graph.edges.some((edge) => edge.from.nodeId === node.id || edge.to.nodeId === node.id),
    )
    .map((node) => node.id)
  const disconnectedNodeIds = graph.nodes
    .filter(
      (node) =>
        !graph.edges.some((edge) => edge.from.nodeId === node.id || edge.to.nodeId === node.id),
    )
    .map((node) => node.id)

  const uiNodeIds =
    registry === undefined
      ? []
      : graph.nodes
          .filter((node) => {
            const definition = registry.getNodeDefinition(node.type)
            return definition?.outputs.some((port) => port.valueType === 'ui-node') ?? false
          })
          .map((node) => node.id)

  const structureRootNodeIds =
    graph.kind === 'page' && firstPageRootId
      ? [firstPageRootId]
      : pageRootNodeIds.length > 0
        ? pageRootNodeIds
        : uiNodeIds.filter((nodeId) => (incomingStructureCounts.get(nodeId) ?? 0) === 0)

  const connectedUiNodeIds = new Set<string>()

  for (const rootNodeId of structureRootNodeIds) {
    visitStructureTree(rootNodeId, structureChildren, connectedUiNodeIds)
  }

  return {
    graphId: graph.id,
    graphName: graph.name,
    orphanUiNodeIds: uiNodeIds.filter((nodeId) => !connectedUiNodeIds.has(nodeId)),
    unusedThemeNodeIds,
    multiplePageNodeIds: pageNodeIds.length > 1 ? pageNodeIds : [],
    missingPageNode: graph.kind === 'page' && pageNodeIds.length === 0,
    missingPageRoot: graph.kind === 'page' && pageRootNodeIds.length === 0,
    disconnectedNodeIds,
  }
}

function visitStructureTree(
  nodeId: string,
  structureChildren: Map<string, string[]>,
  visited: Set<string>,
): void {
  if (visited.has(nodeId)) {
    return
  }

  visited.add(nodeId)

  for (const childId of structureChildren.get(nodeId) ?? []) {
    visitStructureTree(childId, structureChildren, visited)
  }
}

function isProjectDocument(input: ProjectDocument | GraphDocument): input is ProjectDocument {
  return 'graphs' in input
}
