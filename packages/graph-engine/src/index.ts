import type {
  EdgeInstance,
  EvaluationContext,
  GraphDocument,
  GraphEvaluation,
  NodeDefinitionResolver,
  NodeEvaluationRecord,
  NodeInstance,
  ProjectDocument,
  RuntimeIssue,
} from '@procedural-web-composer/shared-types'

export interface DependencyGraph {
  evaluationAdjacency: Map<string, string[]>
  incoming: Map<string, EdgeInstance[]>
  outgoing: Map<string, EdgeInstance[]>
  evaluationIncoming: Map<string, EdgeInstance[]>
}

export function createDependencyGraph(graph: GraphDocument): DependencyGraph {
  const evaluationAdjacency = new Map<string, string[]>()
  const incoming = new Map<string, EdgeInstance[]>()
  const outgoing = new Map<string, EdgeInstance[]>()
  const evaluationIncoming = new Map<string, EdgeInstance[]>()

  for (const node of graph.nodes) {
    evaluationAdjacency.set(node.id, [])
    incoming.set(node.id, [])
    outgoing.set(node.id, [])
    evaluationIncoming.set(node.id, [])
  }

  for (const edge of graph.edges) {
    incoming.set(edge.to.nodeId, [...(incoming.get(edge.to.nodeId) ?? []), edge])
    outgoing.set(edge.from.nodeId, [...(outgoing.get(edge.from.nodeId) ?? []), edge])

    if (!isEvaluationEdge(edge)) {
      continue
    }

    evaluationAdjacency.set(edge.from.nodeId, [
      ...(evaluationAdjacency.get(edge.from.nodeId) ?? []),
      edge.to.nodeId,
    ])
    evaluationIncoming.set(edge.to.nodeId, [
      ...(evaluationIncoming.get(edge.to.nodeId) ?? []),
      edge,
    ])
  }

  return {
    evaluationAdjacency,
    incoming,
    outgoing,
    evaluationIncoming,
  }
}

export function getEvaluationOrder(graph: GraphDocument): string[] {
  const evaluationEdges = graph.edges.filter(isEvaluationEdge)
  const adjacency = new Map<string, string[]>()
  const inDegree = new Map<string, number>()

  for (const node of graph.nodes) {
    adjacency.set(node.id, [])
    inDegree.set(node.id, 0)
  }

  for (const edge of evaluationEdges) {
    adjacency.set(edge.from.nodeId, [...(adjacency.get(edge.from.nodeId) ?? []), edge.to.nodeId])
    inDegree.set(edge.to.nodeId, (inDegree.get(edge.to.nodeId) ?? 0) + 1)
  }

  const queue = graph.nodes
    .filter((node) => (inDegree.get(node.id) ?? 0) === 0)
    .map((node) => node.id)
  const order: string[] = []

  while (queue.length > 0) {
    const nodeId = queue.shift()

    if (!nodeId) {
      continue
    }

    order.push(nodeId)

    for (const nextNodeId of adjacency.get(nodeId) ?? []) {
      const nextInDegree = (inDegree.get(nextNodeId) ?? 0) - 1
      inDegree.set(nextNodeId, nextInDegree)

      if (nextInDegree === 0) {
        queue.push(nextNodeId)
      }
    }
  }

  if (order.length === graph.nodes.length) {
    return order
  }

  return [
    ...order,
    ...graph.nodes.map((node) => node.id).filter((nodeId) => !order.includes(nodeId)),
  ]
}

export function evaluateGraph(options: {
  project: ProjectDocument
  graph: GraphDocument
  registry: NodeDefinitionResolver
}): GraphEvaluation {
  const { project, graph, registry } = options
  const dependencyGraph = createDependencyGraph(graph)
  const order = getEvaluationOrder(graph)
  const nodesById = new Map(graph.nodes.map((node) => [node.id, node]))
  const results: GraphEvaluation['results'] = {}
  const issues: RuntimeIssue[] = []
  const graphCache = getGraphExecutionCache(graph.id)

  for (const nodeId of order) {
    const node = nodesById.get(nodeId)

    if (!node) {
      continue
    }

    const definition = registry.getNodeDefinition(node.type)

    if (!definition) {
      const issue: RuntimeIssue = {
        code: 'missing_definition',
        message: `No node definition registered for "${node.type}".`,
        severity: 'error',
        graphId: graph.id,
        nodeId,
      }

      issues.push(issue)
      results[nodeId] = {
        nodeId,
        nodeType: node.type,
        outputs: {},
        issues: [issue],
      }
      continue
    }

    const incomingEdges = dependencyGraph.incoming.get(nodeId) ?? []
    const outgoingEdges = dependencyGraph.outgoing.get(nodeId) ?? []
    const evaluationIncomingEdges = dependencyGraph.evaluationIncoming.get(nodeId) ?? []
    const inputHash = createExecutionCacheKey(node, evaluationIncomingEdges, results)
    const cachedEvaluation = graphCache.get(nodeId)

    if (cachedEvaluation && cachedEvaluation.inputHash === inputHash) {
      const cachedRecord = cloneEvaluationRecord(cachedEvaluation.record)
      results[nodeId] = cachedRecord
      issues.push(...cachedRecord.issues)
      continue
    }

    const context = createEvaluationContext({
      project,
      graph,
      node,
      registry,
      incomingEdges,
      outgoingEdges,
      evaluationIncomingEdges,
      results,
    })

    try {
      const result = definition.evaluate(node, context)
      const nodeIssues = (result.issues ?? []).map((issue) => ({
        ...issue,
        graphId: issue.graphId ?? graph.id,
        nodeId: issue.nodeId ?? node.id,
      }))

      results[nodeId] = {
        nodeId,
        nodeType: node.type,
        outputs: result.outputs,
        issues: nodeIssues,
      }

      graphCache.set(nodeId, {
        inputHash,
        record: cloneEvaluationRecord(results[nodeId]),
      })
      issues.push(...nodeIssues)
    } catch (error) {
      const issue: RuntimeIssue = {
        code: 'evaluation_failed',
        message:
          error instanceof Error
            ? error.message
            : `Evaluation failed for node "${node.id}".`,
        severity: 'error',
        graphId: graph.id,
        nodeId: node.id,
      }

      results[nodeId] = {
        nodeId,
        nodeType: node.type,
        outputs: {},
        issues: [issue],
      }

      graphCache.set(nodeId, {
        inputHash,
        record: cloneEvaluationRecord(results[nodeId]),
      })
      issues.push(issue)
    }
  }

  return {
    order,
    results,
    issues,
  }
}

function createEvaluationContext(options: {
  project: ProjectDocument
  graph: GraphDocument
  node: NodeInstance
  registry: NodeDefinitionResolver
  incomingEdges: EdgeInstance[]
  outgoingEdges: EdgeInstance[]
  evaluationIncomingEdges: EdgeInstance[]
  results: GraphEvaluation['results']
}): EvaluationContext {
  const {
    project,
    graph,
    node,
    registry,
    incomingEdges,
    outgoingEdges,
    evaluationIncomingEdges,
    results,
  } = options

  return {
    project,
    graph,
    node,
    registry,
    getInput: <T = unknown>(port: string) => {
      const edge = evaluationIncomingEdges.find((candidate) => candidate.to.port === port)
      return edge ? (results[edge.from.nodeId]?.outputs[edge.from.port] as T | undefined) : undefined
    },
    getInputs: <T = unknown>(port: string) => {
      return evaluationIncomingEdges
        .filter((candidate) => candidate.to.port === port)
        .map((edge) => results[edge.from.nodeId]?.outputs[edge.from.port] as T | undefined)
        .filter((value): value is T => value !== undefined)
    },
    getIncomingEdges: (query) => incomingEdges.filter((edge) => matchEdge(edge, query, 'to')),
    getOutgoingEdges: (query) => outgoingEdges.filter((edge) => matchEdge(edge, query, 'from')),
    getOutputFromNode: <T = unknown>(nodeId: string, port: string) =>
      results[nodeId]?.outputs[port] as T | undefined,
  }
}

function matchEdge(
  edge: EdgeInstance,
  query: { port?: string; kind?: EdgeInstance['kind'] } | undefined,
  side: 'from' | 'to',
): boolean {
  if (!query) {
    return true
  }

  if (query.kind && edge.kind !== query.kind) {
    return false
  }

  if (query.port && edge[side].port !== query.port) {
    return false
  }

  return true
}

interface CachedNodeEvaluation {
  inputHash: string
  record: NodeEvaluationRecord
}

const executionCache = new Map<string, Map<string, CachedNodeEvaluation>>()

function getGraphExecutionCache(graphId: string): Map<string, CachedNodeEvaluation> {
  const existingCache = executionCache.get(graphId)

  if (existingCache) {
    return existingCache
  }

  const nextCache = new Map<string, CachedNodeEvaluation>()
  executionCache.set(graphId, nextCache)
  return nextCache
}

function createExecutionCacheKey(
  node: NodeInstance,
  incomingEdges: EdgeInstance[],
  results: GraphEvaluation['results'],
): string {
  return stableSerialize({
    nodeId: node.id,
    nodeType: node.type,
    nodeVersion: node.version,
    params: node.params,
    inputs: [...incomingEdges]
      .sort((left, right) =>
        `${left.to.port}:${left.from.nodeId}:${left.from.port}`.localeCompare(
          `${right.to.port}:${right.from.nodeId}:${right.from.port}`,
        ),
      )
      .map((edge) => ({
        fromNodeId: edge.from.nodeId,
        fromPort: edge.from.port,
        toPort: edge.to.port,
        value: results[edge.from.nodeId]?.outputs[edge.from.port],
      })),
  })
}

function cloneEvaluationRecord(record: NodeEvaluationRecord): NodeEvaluationRecord {
  return {
    nodeId: record.nodeId,
    nodeType: record.nodeType,
    outputs: structuredClone(record.outputs),
    issues: structuredClone(record.issues),
  }
}

function stableSerialize(value: unknown): string {
  return JSON.stringify(sortForSerialization(value))
}

function sortForSerialization(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortForSerialization)
  }

  if (typeof value === 'object' && value !== null) {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey))
        .map(([key, nestedValue]) => [key, sortForSerialization(nestedValue)]),
    )
  }

  return value
}

function isEvaluationEdge(edge: EdgeInstance): boolean {
  return edge.kind === 'data' || edge.kind === 'style'
}
