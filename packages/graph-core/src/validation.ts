import type {
  EdgeInstance,
  GraphDocument,
  GraphIssue,
  GraphValidationResult,
  NodeDefinitionResolver,
  ProjectDocument,
  ValueType,
} from '@procedural-web-composer/shared-types'
import { detectCycles } from './algorithms'
import { analyzeGraphDiagnostics } from './diagnostics'
import { projectDocumentSchema } from './schemas'

export function validateGraph(
  project: ProjectDocument,
  registry?: NodeDefinitionResolver,
): GraphValidationResult {
  const schemaResult = projectDocumentSchema.safeParse(project)
  const issues: GraphIssue[] = []

  if (!schemaResult.success) {
    for (const issue of schemaResult.error.issues) {
      issues.push({
        code: 'schema_invalid',
        message: issue.message,
        severity: 'error',
        path: issue.path.join('.'),
      })
    }

    return {
      valid: false,
      issues,
    }
  }

  const entryGraph = project.graphs.find((graph) => graph.id === project.settings.entryGraphId)

  if (!entryGraph) {
    issues.push({
      code: 'entry_graph_missing',
      message: `Entry graph "${project.settings.entryGraphId}" was not found.`,
      severity: 'error',
    })
  }

  const graphIds = new Set<string>()

  for (const graph of project.graphs) {
    if (graphIds.has(graph.id)) {
      issues.push({
        code: 'duplicate_graph_id',
        message: `Duplicate graph id "${graph.id}".`,
        severity: 'error',
        graphId: graph.id,
      })
    }

    graphIds.add(graph.id)
    issues.push(...validateNodes(graph, registry))
    issues.push(...validateEdges(graph, registry))
    issues.push(...validateGraphSemantics(graph, registry))

    for (const cycle of detectCycles(graph)) {
      issues.push({
        code: 'cycle_detected',
        message: `Cycle detected in graph "${graph.name}": ${cycle.join(' -> ')}.`,
        severity: 'error',
        graphId: graph.id,
      })
    }
  }

  return {
    valid: issues.every((issue) => issue.severity !== 'error'),
    issues,
  }
}

export function validateNodes(
  graph: GraphDocument,
  registry?: NodeDefinitionResolver,
): GraphIssue[] {
  const issues: GraphIssue[] = []
  const nodeIds = new Set<string>()

  for (const node of graph.nodes) {
    if (nodeIds.has(node.id)) {
      issues.push({
        code: 'duplicate_node_id',
        message: `Duplicate node id "${node.id}".`,
        severity: 'error',
        graphId: graph.id,
        nodeId: node.id,
      })
    }

    nodeIds.add(node.id)

    if (!registry) {
      continue
    }

    const definition = registry.getNodeDefinition(node.type)

    if (!definition) {
      issues.push({
        code: 'unknown_node_type',
        message: `Node "${node.id}" references unknown type "${node.type}".`,
        severity: 'error',
        graphId: graph.id,
        nodeId: node.id,
      })
      continue
    }

    if (definition.version !== node.version) {
      issues.push({
        code: 'node_version_mismatch',
        message: `Node "${node.id}" is version ${node.version} but "${node.type}" is registered as version ${definition.version}.`,
        severity: 'warning',
        graphId: graph.id,
        nodeId: node.id,
      })
    }

    if (isSchemaLike(definition.paramsSchema)) {
      const parseResult = definition.paramsSchema.safeParse(node.params)

      if (!parseResult.success) {
        for (const issue of parseResult.error.issues) {
          issues.push({
            code: 'node_params_invalid',
            message: `${node.type}: ${issue.message}`,
            severity: 'error',
            graphId: graph.id,
            nodeId: node.id,
            path: issue.path.join('.'),
          })
        }
      }
    }
  }

  return issues
}

export function validateEdges(
  graph: GraphDocument,
  registry?: NodeDefinitionResolver,
): GraphIssue[] {
  const issues: GraphIssue[] = []
  const edgeIds = new Set<string>()
  const nodesById = new Map(graph.nodes.map((node) => [node.id, node]))
  const incomingPortCounts = new Map<string, number>()

  for (const edge of graph.edges) {
    if (edgeIds.has(edge.id)) {
      issues.push({
        code: 'duplicate_edge_id',
        message: `Duplicate edge id "${edge.id}".`,
        severity: 'error',
        graphId: graph.id,
        edgeId: edge.id,
      })
    }

    edgeIds.add(edge.id)

    const sourceNode = nodesById.get(edge.from.nodeId)
    const targetNode = nodesById.get(edge.to.nodeId)

    if (!sourceNode) {
      issues.push({
        code: 'edge_source_missing',
        message: `Edge "${edge.id}" references missing source node "${edge.from.nodeId}".`,
        severity: 'error',
        graphId: graph.id,
        edgeId: edge.id,
      })
    }

    if (!targetNode) {
      issues.push({
        code: 'edge_target_missing',
        message: `Edge "${edge.id}" references missing target node "${edge.to.nodeId}".`,
        severity: 'error',
        graphId: graph.id,
        edgeId: edge.id,
      })
    }

    if (!registry || !sourceNode || !targetNode) {
      continue
    }

    const sourceDefinition = registry.getNodeDefinition(sourceNode.type)
    const targetDefinition = registry.getNodeDefinition(targetNode.type)

    if (!sourceDefinition || !targetDefinition) {
      continue
    }

    const outputPort = sourceDefinition.outputs.find((port) => port.key === edge.from.port)
    const inputPort = targetDefinition.inputs.find((port) => port.key === edge.to.port)

    if (!outputPort) {
      issues.push({
        code: 'edge_source_port_missing',
        message: `Edge "${edge.id}" references missing output port "${edge.from.port}" on "${sourceNode.type}".`,
        severity: 'error',
        graphId: graph.id,
        edgeId: edge.id,
        nodeId: sourceNode.id,
      })
    }

    if (!inputPort) {
      issues.push({
        code: 'edge_target_port_missing',
        message: `Edge "${edge.id}" references missing input port "${edge.to.port}" on "${targetNode.type}".`,
        severity: 'error',
        graphId: graph.id,
        edgeId: edge.id,
        nodeId: targetNode.id,
      })
    }

    if (!outputPort || !inputPort) {
      continue
    }

    const incomingKey = `${edge.to.nodeId}:${edge.to.port}`
    incomingPortCounts.set(incomingKey, (incomingPortCounts.get(incomingKey) ?? 0) + 1)

    if (!inputPort.multiple && (incomingPortCounts.get(incomingKey) ?? 0) > 1) {
      issues.push({
        code: 'input_port_overconnected',
        message: `Input "${edge.to.port}" on node "${edge.to.nodeId}" does not accept multiple connections.`,
        severity: 'error',
        graphId: graph.id,
        edgeId: edge.id,
        nodeId: targetNode.id,
      })
    }

    if (!isCompatibleEdgeKind(edge, outputPort.valueType, inputPort.valueType)) {
      issues.push({
        code: 'edge_kind_mismatch',
        message: `Edge "${edge.id}" kind "${edge.kind}" is incompatible with ${outputPort.valueType} -> ${inputPort.valueType}.`,
        severity: 'error',
        graphId: graph.id,
        edgeId: edge.id,
      })
    }

    if (
      outputPort.valueType !== inputPort.valueType &&
      edge.kind !== 'structure' &&
      edge.kind !== 'event'
    ) {
      issues.push({
        code: 'edge_value_type_mismatch',
        message: `Edge "${edge.id}" connects ${outputPort.valueType} to ${inputPort.valueType}.`,
        severity: 'error',
        graphId: graph.id,
        edgeId: edge.id,
      })
    }
  }

  if (registry) {
    for (const node of graph.nodes) {
      const definition = registry.getNodeDefinition(node.type)

      if (!definition) {
        continue
      }

      for (const input of definition.inputs.filter((port) => port.required)) {
        const hasIncoming = graph.edges.some(
          (edge) => edge.to.nodeId === node.id && edge.to.port === input.key,
        )

        if (!hasIncoming) {
          issues.push({
            code: 'required_input_missing',
            message: `Required input "${input.key}" is not connected on node "${node.id}".`,
            severity: 'error',
            graphId: graph.id,
            nodeId: node.id,
          })
        }
      }
    }
  }

  return issues
}

function validateGraphSemantics(
  graph: GraphDocument,
  registry?: NodeDefinitionResolver,
): GraphIssue[] {
  const diagnostics = analyzeGraphDiagnostics(graph, registry)
  const issues: GraphIssue[] = []

  if (graph.kind === 'page') {
    if (diagnostics.missingPageNode) {
      issues.push({
        code: 'page_node_missing',
        message: `Page graph "${graph.name}" should contain exactly one layout.page node.`,
        severity: 'warning',
        graphId: graph.id,
      })
    }

    if (diagnostics.multiplePageNodeIds.length > 0) {
      issues.push({
        code: 'multiple_page_nodes',
        message: `Page graph "${graph.name}" contains ${diagnostics.multiplePageNodeIds.length} layout.page nodes.`,
        severity: 'warning',
        graphId: graph.id,
      })
    }

    if (diagnostics.missingPageRoot) {
      issues.push({
        code: 'page_root_missing',
        message: `Page graph "${graph.name}" has no root layout.page node in the structure tree.`,
        severity: 'warning',
        graphId: graph.id,
      })
    }
  }

  for (const themeNodeId of diagnostics.unusedThemeNodeIds) {
    issues.push({
      code: 'unused_theme_node',
      message: `Theme node "${themeNodeId}" is not connected.`,
      severity: 'warning',
      graphId: graph.id,
      nodeId: themeNodeId,
    })
  }

  for (const uiNodeId of diagnostics.orphanUiNodeIds) {
    issues.push({
      code: 'ui_node_orphaned',
      message: `UI node "${uiNodeId}" is not connected to the structure tree.`,
      severity: 'warning',
      graphId: graph.id,
      nodeId: uiNodeId,
    })
  }

  return issues
}

function isCompatibleEdgeKind(
  edge: EdgeInstance,
  outputType: ValueType,
  inputType: ValueType,
): boolean {
  if (edge.kind === 'structure') {
    return outputType === 'ui-node' && inputType === 'ui-node'
  }

  if (edge.kind === 'style') {
    return (
      (outputType === 'theme' || outputType === 'style-token') &&
      (inputType === 'theme' || inputType === 'style-token')
    )
  }

  if (edge.kind === 'event') {
    return true
  }

  return edge.kind === 'data'
}

function isSchemaLike(
  schema: unknown,
): schema is {
  safeParse: (
    input: unknown,
  ) =>
    | { success: true; data: unknown }
    | {
        success: false
        error: {
          issues: Array<{
            path: Array<string | number>
            message: string
          }>
        }
      }
} {
  return (
    typeof schema === 'object' &&
    schema !== null &&
    'safeParse' in schema &&
    typeof schema.safeParse === 'function'
  )
}
