import { getSubgraphDefinition, isReusableGraph } from '@procedural-web-composer/graph-core'
import { evaluateGraph } from '@procedural-web-composer/graph-engine'
import type {
  GraphDocument,
  GraphEvaluation,
  NodeDefinitionResolver,
  NodeInstance,
  ProjectDocument,
  RuntimeIssue,
} from '@procedural-web-composer/shared-types'
import type { UiNode } from '@procedural-web-composer/ui-tree'
import { buildUiTree } from './build-ui-tree'

export interface GraphRuntimeEvaluation {
  evaluation: GraphEvaluation
  root: UiNode | null
  issues: RuntimeIssue[]
}

interface EvaluateGraphRuntimeOptions {
  document: ProjectDocument
  graph: GraphDocument
  registry: NodeDefinitionResolver
  visitedGraphIds: string[]
  runtimeCache: Map<string, GraphRuntimeEvaluation>
}

export function evaluateGraphRuntime(
  options: EvaluateGraphRuntimeOptions,
): GraphRuntimeEvaluation {
  const baseEvaluation = evaluateGraph({
    project: options.document,
    graph: options.graph,
    registry: options.registry,
  })
  const results = structuredClone(baseEvaluation.results)
  const issues: RuntimeIssue[] = [...baseEvaluation.issues]

  for (const node of options.graph.nodes.filter((candidate) => candidate.type === 'subgraph.instance')) {
    const record =
      results[node.id] ??
      {
        nodeId: node.id,
        nodeType: node.type,
        outputs: {},
        issues: [],
      }
    const subgraphGraphId = getSubgraphGraphId(node)

    if (!subgraphGraphId) {
      const issue = createSubgraphIssue(
        'subgraph_reference_missing',
        `Subgraph instance "${node.id}" is missing "subgraphGraphId".`,
        options.graph.id,
        node.id,
        'error',
      )
      record.issues = [...record.issues, issue]
      results[node.id] = record
      issues.push(issue)
      continue
    }

    const referencedGraph = options.document.graphs.find(
      (candidate) => candidate.id === subgraphGraphId,
    )

    if (!referencedGraph || !isReusableGraph(referencedGraph)) {
      const issue = createSubgraphIssue(
        'subgraph_reference_invalid',
        `Subgraph instance "${node.id}" references invalid graph "${subgraphGraphId}".`,
        options.graph.id,
        node.id,
        'error',
      )
      record.issues = [...record.issues, issue]
      results[node.id] = record
      issues.push(issue)
      continue
    }

    if (options.visitedGraphIds.includes(subgraphGraphId)) {
      const issue = createSubgraphIssue(
        'subgraph_cycle_detected',
        `Circular subgraph reference detected for "${referencedGraph.name}".`,
        options.graph.id,
        node.id,
        'error',
      )
      record.issues = [...record.issues, issue]
      results[node.id] = record
      issues.push(issue)
      continue
    }

    const subgraphDefinition = getSubgraphDefinition(options.document, subgraphGraphId)
    const publicParams = {
      ...(subgraphDefinition?.publicDefaultParams ?? {}),
      ...extractInstancePublicParams(node.params),
    }
    const cacheKey = createRuntimeCacheKey(subgraphGraphId, publicParams)
    const cached = options.runtimeCache.get(cacheKey)
    const nestedRuntime =
      cached ??
      evaluateGraphRuntime({
        ...options,
        graph: injectSubgraphParams(referencedGraph, publicParams),
        visitedGraphIds: [...options.visitedGraphIds, subgraphGraphId],
      })

    if (!cached) {
      options.runtimeCache.set(cacheKey, cloneGraphRuntimeEvaluation(nestedRuntime))
    }

    const resolvedRuntime = cloneGraphRuntimeEvaluation(nestedRuntime)
    const localIssues =
      resolvedRuntime.root === null
        ? [
            createSubgraphIssue(
              'subgraph_root_missing',
              `Subgraph "${referencedGraph.name}" produced no renderable root.`,
              options.graph.id,
              node.id,
              'warning',
            ),
          ]
        : []

    record.outputs = {
      ...record.outputs,
      ui: resolvedRuntime.root,
    }
    record.issues = [...record.issues, ...localIssues]
    results[node.id] = record
    issues.push(...localIssues, ...resolvedRuntime.issues)
  }

  const evaluation: GraphEvaluation = {
    ...baseEvaluation,
    results,
    issues,
  }

  return {
    evaluation,
    root: buildUiTree(options.graph, evaluation, options.registry),
    issues,
  }
}

function injectSubgraphParams(
  graph: GraphDocument,
  publicParams: Record<string, unknown>,
): GraphDocument {
  const nextGraph = structuredClone(graph)

  nextGraph.nodes = nextGraph.nodes.map((node) => {
    if (node.type !== 'subgraph.param') {
      return node
    }

    const key = typeof node.params.key === 'string' ? node.params.key : undefined
    const nextParams = { ...node.params }

    if (key && key in publicParams) {
      nextParams.__resolvedValue = publicParams[key]
    } else {
      delete nextParams.__resolvedValue
    }

    return {
      ...node,
      params: nextParams,
    }
  })

  return nextGraph
}

function extractInstancePublicParams(
  params: Record<string, unknown>,
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(params).filter(([key]) => key !== 'subgraphGraphId'),
  )
}

function createRuntimeCacheKey(
  graphId: string,
  publicParams: Record<string, unknown>,
): string {
  return JSON.stringify({
    graphId,
    publicParams: sortForSerialization(publicParams),
  })
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

function cloneGraphRuntimeEvaluation(
  runtime: GraphRuntimeEvaluation,
): GraphRuntimeEvaluation {
  return {
    evaluation: structuredClone(runtime.evaluation),
    root: runtime.root ? structuredClone(runtime.root) : null,
    issues: structuredClone(runtime.issues),
  }
}

function getSubgraphGraphId(node: NodeInstance): string | undefined {
  const graphId = node.params.subgraphGraphId
  return typeof graphId === 'string' && graphId.length > 0 ? graphId : undefined
}

function createSubgraphIssue(
  code: string,
  message: string,
  graphId: string,
  nodeId: string,
  severity: 'error' | 'warning',
): RuntimeIssue {
  return {
    code,
    message,
    severity,
    graphId,
    nodeId,
  }
}
