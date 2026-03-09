import { getSubgraphDefinition, isReusableGraph, resolvePublicSlots } from '@procedural-web-composer/graph-core'
import { evaluateGraph } from '@procedural-web-composer/graph-engine'
import type {
  EdgeInstance,
  GraphDocument,
  GraphEvaluation,
  NodeDefinitionResolver,
  NodeInstance,
  ProjectDocument,
  RuntimeIssue,
} from '@procedural-web-composer/shared-types'
import { isUiNode, type UiNode } from '@procedural-web-composer/ui-tree'
import { buildUiTree, getPrimaryUiOutput } from './build-ui-tree'

export const REPEAT_PREVIEW_WARNING_THRESHOLD = 100

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
  const nodesById = new Map(options.graph.nodes.map((node) => [node.id, node]))
  const results = structuredClone(baseEvaluation.results)
  const issues: RuntimeIssue[] = [...baseEvaluation.issues]
  const resolvedSpecialNodes = new Set<string>()

  for (const node of options.graph.nodes) {
    resolveSpecialNode(node.id)
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

  function resolveSpecialNode(nodeId: string): void {
    if (resolvedSpecialNodes.has(nodeId)) {
      return
    }

    const node = nodesById.get(nodeId)

    if (!node) {
      return
    }

    if (node.type === 'subgraph.instance') {
      resolveSubgraphInstance(node)
    }

    if (node.type === 'data.repeat') {
      resolveDataRepeat(node)
    }

    resolvedSpecialNodes.add(nodeId)
  }

  function resolveSubgraphInstance(node: NodeInstance): void {
    const record = ensureRecord(node, results)
    const subgraphGraphId = getSubgraphGraphId(node)

    if (!subgraphGraphId) {
      addRuntimeIssue(
        record,
        issues,
        createRuntimeIssue(
          'subgraph_reference_missing',
          `Subgraph instance "${node.id}" is missing "subgraphGraphId".`,
          options.graph.id,
          node.id,
          'error',
        ),
      )
      return
    }

    const referencedGraph = options.document.graphs.find((candidate) => candidate.id === subgraphGraphId)

    if (!referencedGraph || !isReusableGraph(referencedGraph)) {
      addRuntimeIssue(
        record,
        issues,
        createRuntimeIssue(
          'subgraph_reference_invalid',
          `Subgraph instance "${node.id}" references invalid graph "${subgraphGraphId}".`,
          options.graph.id,
          node.id,
          'error',
        ),
      )
      return
    }

    if (options.visitedGraphIds.includes(subgraphGraphId)) {
      addRuntimeIssue(
        record,
        issues,
        createRuntimeIssue(
          'subgraph_cycle_detected',
          `Circular subgraph reference detected for "${referencedGraph.name}".`,
          options.graph.id,
          node.id,
          'error',
        ),
      )
      return
    }

    const subgraphDefinition = getSubgraphDefinition(options.document, subgraphGraphId)
    const dataBoundParams = resolveIncomingDataParams(node)
    const slotAssignments = collectSlotAssignments(node)
    const publicParams = {
      ...(subgraphDefinition?.publicDefaultParams ?? {}),
      ...extractInstancePublicParams(node.params),
      ...dataBoundParams,
    }
    const cacheKey = createRuntimeCacheKey('subgraph', {
      graphId: subgraphGraphId,
      params: publicParams,
      slots: summarizeSlotAssignments(slotAssignments),
    })
    const cached = options.runtimeCache.get(cacheKey)
    const nestedRuntime =
      cached ??
      evaluateGraphRuntime({
        ...options,
        graph: injectSubgraphRuntimeState(referencedGraph, publicParams, slotAssignments),
        visitedGraphIds: [...options.visitedGraphIds, subgraphGraphId],
      })

    if (!cached) {
      options.runtimeCache.set(cacheKey, cloneGraphRuntimeEvaluation(nestedRuntime))
    }

    const resolvedRuntime = cloneGraphRuntimeEvaluation(nestedRuntime)
    issues.push(...resolvedRuntime.issues)

    if (!resolvedRuntime.root) {
      addRuntimeIssue(
        record,
        issues,
        createRuntimeIssue(
          'subgraph_root_missing',
          `Subgraph "${referencedGraph.name}" produced no renderable root.`,
          options.graph.id,
          node.id,
          'warning',
        ),
      )
      return
    }

    record.outputs = {
      ...record.outputs,
      ui: resolvedRuntime.root,
    }
  }

  function resolveDataRepeat(node: NodeInstance): void {
    const record = ensureRecord(node, results)
    const itemsValue = resolveIncomingDataParams(node).items
    const items = Array.isArray(itemsValue) ? itemsValue : []
    const repeatMemoCache = new Map<string, GraphRuntimeEvaluation>()
    const itemSubgraphGraphId =
      typeof node.params.itemSubgraphGraphId === 'string' && node.params.itemSubgraphGraphId.length > 0
        ? node.params.itemSubgraphGraphId
        : undefined

    if (!itemSubgraphGraphId) {
      addRuntimeIssue(
        record,
        issues,
        createRuntimeIssue(
          'repeat_template_missing',
          `Repeat node "${node.id}" is missing "itemSubgraphGraphId".`,
          options.graph.id,
          node.id,
          'warning',
        ),
      )
      return
    }

    const referencedGraph = options.document.graphs.find((candidate) => candidate.id === itemSubgraphGraphId)

    if (!referencedGraph || !isReusableGraph(referencedGraph)) {
      addRuntimeIssue(
        record,
        issues,
        createRuntimeIssue(
          'repeat_template_invalid',
          `Repeat node "${node.id}" references invalid graph "${itemSubgraphGraphId}".`,
          options.graph.id,
          node.id,
          'error',
        ),
      )
      return
    }

    if (options.visitedGraphIds.includes(itemSubgraphGraphId)) {
      addRuntimeIssue(
        record,
        issues,
        createRuntimeIssue(
          'repeat_cycle_detected',
          `Repeat node "${node.id}" references "${referencedGraph.name}" recursively.`,
          options.graph.id,
          node.id,
          'error',
        ),
      )
      return
    }

    if (items.length > REPEAT_PREVIEW_WARNING_THRESHOLD) {
      addRuntimeIssue(
        record,
        issues,
        createRuntimeIssue(
          'repeat_large_list',
          `Repeat node "${node.id}" is rendering ${items.length} items in preview. Large lists may degrade editor performance.`,
          options.graph.id,
          node.id,
          'warning',
        ),
      )
    }

    const repeatSubgraphDefinition = getSubgraphDefinition(options.document, itemSubgraphGraphId)
    const canMemoizeByItem =
      repeatSubgraphDefinition !== undefined &&
      !Object.hasOwn(repeatSubgraphDefinition.publicParamsSchema, 'index')

    const repeatedChildren: UiNode[] = []

    for (const [index, item] of items.entries()) {
      const runtimeParams = {
        ...(repeatSubgraphDefinition?.publicDefaultParams ?? {}),
        item,
        index,
      }
      const cacheKey = createRuntimeCacheKey('repeat-item', {
        graphId: itemSubgraphGraphId,
        params: runtimeParams,
      })
      const memoCacheKey = canMemoizeByItem
        ? createRuntimeCacheKey('repeat-item-memo', {
            graphId: itemSubgraphGraphId,
            item,
          })
        : undefined
      const memoized = memoCacheKey ? repeatMemoCache.get(memoCacheKey) : undefined
      const cached = options.runtimeCache.get(cacheKey)
      const nestedRuntime =
        memoized ??
        cached ??
        evaluateGraphRuntime({
          ...options,
          graph: injectSubgraphRuntimeState(
            referencedGraph,
            runtimeParams,
            {},
          ),
          visitedGraphIds: [...options.visitedGraphIds, itemSubgraphGraphId],
        })

      if (!cached) {
        options.runtimeCache.set(cacheKey, cloneGraphRuntimeEvaluation(nestedRuntime))
      }

      if (!memoized && memoCacheKey) {
        repeatMemoCache.set(memoCacheKey, cloneGraphRuntimeEvaluation(nestedRuntime))
      }

      const resolvedRuntime = cloneGraphRuntimeEvaluation(nestedRuntime)

      if (resolvedRuntime.root) {
        appendRepeatedRoot(repeatedChildren, resolvedRuntime.root)
      }

      issues.push(...resolvedRuntime.issues)
    }

    record.outputs = {
      ...record.outputs,
      ui: {
        id: node.id,
        kind: 'Fragment',
        props: {},
        children: repeatedChildren,
      } satisfies UiNode,
    }
  }

  function resolveIncomingDataParams(node: NodeInstance): Record<string, unknown> {
    const params: Record<string, unknown> = {}

    for (const edge of options.graph.edges.filter(
      (candidate) => candidate.kind === 'data' && candidate.to.nodeId === node.id,
    )) {
      const sourceNode = nodesById.get(edge.from.nodeId)

      if (sourceNode && isSpecialUiNode(sourceNode.type)) {
        resolveSpecialNode(sourceNode.id)
      }

      params[edge.to.port] = results[edge.from.nodeId]?.outputs[edge.from.port]
    }

    return params
  }

  function collectSlotAssignments(node: NodeInstance): Record<string, UiNode[]> {
    const assignments = new Map<string, UiNode[]>()
    const supportedSlots = getSupportedSlotsForNode(node)
    const structureEdges = options.graph.edges
      .filter((edge) => edge.kind === 'structure' && edge.from.nodeId === node.id)
      .sort((left, right) => compareStructureEdges(left, right, nodesById))

    for (const edge of structureEdges) {
      const childNode = nodesById.get(edge.to.nodeId)

      if (!childNode) {
        continue
      }

      if (isSpecialUiNode(childNode.type)) {
        resolveSpecialNode(childNode.id)
      }

      const childRecord = results[childNode.id]

      if (!childRecord) {
        continue
      }

      const maybeUi = getPrimaryUiOutput(
        options.registry.getNodeDefinition(childNode.type),
        childRecord,
      )

      if (!isUiNode(maybeUi)) {
        continue
      }

      const requestedSlot = edge.slot?.trim()
      const slotName =
        requestedSlot && supportedSlots.includes(requestedSlot)
          ? requestedSlot
          : 'children'
      assignments.set(slotName, [
        ...(assignments.get(slotName) ?? []),
        structuredClone(maybeUi),
      ])
    }

    return Object.fromEntries(assignments)
  }

  function getSupportedSlotsForNode(node: NodeInstance): string[] {
    if (node.type === 'subgraph.instance') {
      return resolvePublicSlots(
        getSubgraphDefinition(options.document, getSubgraphGraphId(node) ?? '')?.publicSlots,
      )
    }

    const definitionSlots = options.registry.getNodeDefinition(node.type)?.slots
    return definitionSlots?.length ? definitionSlots : ['children']
  }
}

function injectSubgraphRuntimeState(
  graph: GraphDocument,
  publicParams: Record<string, unknown>,
  slotAssignments: Record<string, UiNode[]>,
): GraphDocument {
  const nextGraph = structuredClone(graph)

  nextGraph.nodes = nextGraph.nodes.map((node) => {
    if (node.type === 'subgraph.param') {
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
    }

    if (node.type === 'subgraph.slot') {
      const slotName = typeof node.params.name === 'string' ? node.params.name : 'children'
      const fallbackMode = node.params.fallbackMode === 'children' ? 'children' : 'empty'
      const resolvedSlotChildren =
        slotAssignments[slotName] ??
        (fallbackMode === 'children' ? slotAssignments.children ?? [] : [])

      return {
        ...node,
        params: {
          ...node.params,
          __resolvedSlotChildren: structuredClone(resolvedSlotChildren),
        },
      }
    }

    return node
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

function summarizeSlotAssignments(slotAssignments: Record<string, UiNode[]>): Record<string, string[]> {
  return Object.fromEntries(
    Object.entries(slotAssignments).map(([slotName, slotChildren]) => [
      slotName,
      slotChildren.map((child) => child.id),
    ]),
  )
}

function createRuntimeCacheKey(
  kind: string,
  payload: Record<string, unknown>,
): string {
  const serializedPayload = sortForSerialization(payload)

  return JSON.stringify({
    kind,
    ...(typeof serializedPayload === 'object' && serializedPayload !== null
      ? serializedPayload
      : {}),
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

function ensureRecord(
  node: NodeInstance,
  results?: GraphEvaluation['results'],
): NonNullable<GraphEvaluation['results'][string]> {
  if (!results) {
    throw new Error('Graph evaluation results are required.')
  }

  const existingRecord = results[node.id]

  if (existingRecord) {
    return existingRecord
  }

  const nextRecord = {
    nodeId: node.id,
    nodeType: node.type,
    outputs: {},
    issues: [],
  }

  results[node.id] = nextRecord
  return nextRecord
}

function addRuntimeIssue(
  record: NonNullable<GraphEvaluation['results'][string]>,
  issues: RuntimeIssue[],
  issue: RuntimeIssue,
): void {
  record.issues = [...record.issues, issue]
  issues.push(issue)
}

function createRuntimeIssue(
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

function compareStructureEdges(
  left: EdgeInstance,
  right: EdgeInstance,
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

  const leftNode = nodesById.get(left.to.nodeId)
  const rightNode = nodesById.get(right.to.nodeId)

  if (!leftNode || !rightNode) {
    return 0
  }

  if (leftNode.position.y === rightNode.position.y) {
    return leftNode.position.x - rightNode.position.x
  }

  return leftNode.position.y - rightNode.position.y
}

function appendRepeatedRoot(children: UiNode[], root: UiNode): void {
  if (root.kind === 'Fragment') {
    children.push(...root.children)
    return
  }

  children.push(root)
}

function isSpecialUiNode(type: string): boolean {
  return type === 'subgraph.instance' || type === 'data.repeat'
}
