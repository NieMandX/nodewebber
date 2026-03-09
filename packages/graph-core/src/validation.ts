import type {
  EdgeInstance,
  GraphDocument,
  GraphIssue,
  GraphValidationResult,
  NodeDefinitionResolver,
  PortDefinition,
  ProjectDocument,
  ValueType,
  ViewerActionConfig,
} from '@procedural-web-composer/shared-types'
import { detectCycles } from './algorithms'
import { analyzeGraphDiagnostics } from './diagnostics'
import { projectDocumentSchema } from './schemas'
import {
  getSubgraphDefinition,
  isReusableGraph,
  resolvePublicSlots,
  validatePortableParamDefaults,
} from './subgraphs'

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
    issues.push(...validateEdges(graph, registry, project))
    issues.push(...validateGraphSemantics(project, graph, registry))

    for (const cycle of detectCycles(graph)) {
      issues.push({
        code: 'cycle_detected',
        message: `Cycle detected in graph "${graph.name}": ${cycle.join(' -> ')}.`,
        severity: 'error',
        graphId: graph.id,
      })
    }
  }

  issues.push(...validateSubgraphReferences(project))

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
  project?: ProjectDocument,
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
    const inputPort =
      targetDefinition.inputs.find((port) => port.key === edge.to.port) ??
      getDynamicTargetInputPort(project, targetNode, edge)

    if (edge.slot && edge.kind !== 'structure') {
      issues.push({
        code: 'slot_on_non_structure_edge',
        message: `Edge "${edge.id}" declares slot "${edge.slot}" but only structure edges support slots.`,
        severity: 'warning',
        graphId: graph.id,
        edgeId: edge.id,
      })
    }

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
      if (edge.kind === 'data' && targetNode.type === 'subgraph.instance') {
        issues.push({
          code: 'subgraph_public_param_missing',
          message: `Edge "${edge.id}" targets unknown public param "${edge.to.port}" on subgraph instance "${targetNode.id}".`,
          severity: 'warning',
          graphId: graph.id,
          edgeId: edge.id,
          nodeId: targetNode.id,
        })
      } else {
        issues.push({
          code: 'edge_target_port_missing',
          message: `Edge "${edge.id}" references missing input port "${edge.to.port}" on "${targetNode.type}".`,
          severity: 'error',
          graphId: graph.id,
          edgeId: edge.id,
          nodeId: targetNode.id,
        })
      }
    }

    if (!outputPort || !inputPort) {
      continue
    }

    if (edge.kind === 'structure' && edge.slot) {
      const supportedSlots = getSupportedSlotsForNode(project, sourceNode, sourceDefinition)

      if (!supportedSlots.includes(edge.slot)) {
        issues.push({
          code: 'structure_slot_unknown',
          message: `Edge "${edge.id}" targets unknown slot "${edge.slot}" on node "${sourceNode.id}".`,
          severity: 'warning',
          graphId: graph.id,
          edgeId: edge.id,
          nodeId: sourceNode.id,
        })
      }
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
      outputPort.valueType !== 'unknown' &&
      inputPort.valueType !== 'unknown' &&
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
  project: ProjectDocument,
  graph: GraphDocument,
  registry?: NodeDefinitionResolver,
): GraphIssue[] {
  const diagnostics = analyzeGraphDiagnostics(graph, registry)
  const issues: GraphIssue[] = []
  const nodesById = new Map(graph.nodes.map((node) => [node.id, node]))

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

  for (const nodeId of diagnostics.disconnectedNodeIds) {
    issues.push({
      code: 'disconnected_node',
      message: `Node "${nodeId}" is disconnected from all edges.`,
      severity: 'warning',
      graphId: graph.id,
      nodeId,
    })
  }

  if (isReusableGraph(graph) && diagnostics.missingRenderableRoot) {
    issues.push({
      code: 'subgraph_root_missing',
      message: `Reusable graph "${graph.name}" has no renderable UI root.`,
      severity: 'warning',
      graphId: graph.id,
    })
  }

  if (isReusableGraph(graph)) {
    const metadataIssues = validatePortableParamDefaults(
      graph.subgraph?.publicParamsSchema,
      graph.subgraph?.publicDefaultParams,
    )

    for (const message of metadataIssues) {
      issues.push({
        code: 'subgraph_public_params_invalid',
        message: `${graph.name}: ${message}`,
        severity: 'warning',
        graphId: graph.id,
      })
    }

    const rawPublicSlots = graph.subgraph?.publicSlots ?? []
    const uniquePublicSlots = new Set(rawPublicSlots)

    if (uniquePublicSlots.size !== rawPublicSlots.length) {
      issues.push({
        code: 'subgraph_public_slots_duplicate',
        message: `Reusable graph "${graph.name}" declares duplicate public slots.`,
        severity: 'warning',
        graphId: graph.id,
      })
    }
  }

  for (const node of graph.nodes.filter((candidate) => candidate.type === 'subgraph.instance')) {
    const referencedGraphId = getSubgraphGraphId(node)

    if (!referencedGraphId) {
      issues.push({
        code: 'subgraph_reference_missing',
        message: `Subgraph instance "${node.id}" does not declare "subgraphGraphId".`,
        severity: 'error',
        graphId: graph.id,
        nodeId: node.id,
      })
      continue
    }

    const referencedGraph = project.graphs.find((candidate) => candidate.id === referencedGraphId)

    if (!referencedGraph) {
      issues.push({
        code: 'subgraph_graph_missing',
        message: `Subgraph instance "${node.id}" references missing graph "${referencedGraphId}".`,
        severity: 'error',
        graphId: graph.id,
        nodeId: node.id,
      })
      continue
    }

    if (!isReusableGraph(referencedGraph)) {
      issues.push({
        code: 'subgraph_graph_kind_invalid',
        message: `Subgraph instance "${node.id}" must reference a graph with kind "subgraph" or "component".`,
        severity: 'error',
        graphId: graph.id,
        nodeId: node.id,
      })
    }
  }

  if (isReusableGraph(graph)) {
    const declaredSlots = resolvePublicSlots(graph.subgraph?.publicSlots)

    for (const node of graph.nodes.filter((candidate) => candidate.type === 'subgraph.slot')) {
      const slotName =
        typeof node.params.name === 'string' && node.params.name.trim().length > 0
          ? node.params.name.trim()
          : 'children'

      if (!declaredSlots.includes(slotName)) {
        issues.push({
          code: 'subgraph_slot_undeclared',
          message: `Slot placeholder "${node.id}" references undeclared slot "${slotName}".`,
          severity: 'warning',
          graphId: graph.id,
          nodeId: node.id,
        })
      }
    }
  } else {
    for (const node of graph.nodes.filter((candidate) => candidate.type === 'subgraph.slot')) {
      issues.push({
        code: 'subgraph_slot_outside_reusable_graph',
        message: `Slot placeholder "${node.id}" is being used outside a reusable graph.`,
        severity: 'warning',
        graphId: graph.id,
        nodeId: node.id,
      })
    }
  }

  for (const node of graph.nodes.filter((candidate) => candidate.type === 'data.repeat')) {
    const templateGraphId =
      typeof node.params.itemSubgraphGraphId === 'string' &&
      node.params.itemSubgraphGraphId.length > 0
        ? node.params.itemSubgraphGraphId
        : undefined

    if (!templateGraphId) {
      issues.push({
        code: 'repeat_template_missing',
        message: `Repeat node "${node.id}" does not declare "itemSubgraphGraphId".`,
        severity: 'warning',
        graphId: graph.id,
        nodeId: node.id,
      })
      continue
    }

    const templateGraph = project.graphs.find((candidate) => candidate.id === templateGraphId)

    if (!templateGraph) {
      issues.push({
        code: 'repeat_template_graph_missing',
        message: `Repeat node "${node.id}" references missing reusable graph "${templateGraphId}".`,
        severity: 'error',
        graphId: graph.id,
        nodeId: node.id,
      })
      continue
    }

    if (!isReusableGraph(templateGraph)) {
      issues.push({
        code: 'repeat_template_graph_kind_invalid',
        message: `Repeat node "${node.id}" must reference a graph with kind "subgraph" or "component".`,
        severity: 'error',
        graphId: graph.id,
        nodeId: node.id,
      })
    }
  }

  for (const node of graph.nodes) {
    if (node.type === 'viewer.block') {
      const hasConnectedModel = graph.edges.some(
        (edge) =>
          edge.kind === 'data' &&
          edge.to.nodeId === node.id &&
          edge.to.port === 'model',
      )
      const fallbackModel = asRecord(node.params.model)
      const fallbackModelSrc =
        typeof fallbackModel?.src === 'string' ? fallbackModel.src.trim() : ''
      const modelSrc =
        typeof node.params.modelSrc === 'string' ? node.params.modelSrc.trim() : ''

      if (!hasConnectedModel && fallbackModelSrc.length === 0 && modelSrc.length === 0) {
        issues.push({
          code: 'viewer_block_model_missing',
          message: `Viewer block "${node.id}" has no model source configured.`,
          severity: 'warning',
          graphId: graph.id,
          nodeId: node.id,
        })
      }

      const stateReferences = collectViewerStateReferences(graph, nodesById, node)
      const variantReferences = collectViewerVariantReferences(graph, nodesById, node)
      const hotspotReferences = collectViewerHotspotReferences(graph, nodesById, node)
      const knownStateIds = new Set(
        stateReferences
          .map((stateReference) => stateReference.id)
          .filter((stateId): stateId is string => Boolean(stateId)),
      )
      const knownVariantIds = new Set(
        variantReferences
          .map((variantReference) => variantReference.id)
          .filter((variantId): variantId is string => Boolean(variantId)),
      )
      const knownHotspotIds = new Set(
        hotspotReferences
          .map((hotspotReference) => hotspotReference.id)
          .filter((hotspotId): hotspotId is string => Boolean(hotspotId)),
      )
      const interactionsEnabled = resolveViewerInteractionsEnabled(graph, nodesById, node)
      const hasInteractiveHotspots = hotspotReferences.some(
        (hotspotReference) =>
          Boolean(hotspotReference.linkedStateId) || Boolean(hotspotReference.action),
      )

      if (!interactionsEnabled && hasInteractiveHotspots) {
        issues.push({
          code: 'viewer_interactions_disabled',
          message: `Viewer block "${node.id}" has interactions disabled while hotspots still declare actions.`,
          severity: 'warning',
          graphId: graph.id,
          nodeId: node.id,
        })
      }

      for (const hotspotReference of hotspotReferences) {
        if (
          hotspotReference.linkedStateId &&
          !knownStateIds.has(hotspotReference.linkedStateId)
        ) {
          issues.push({
            code: 'viewer_hotspot_linked_state_missing',
            message: `Viewer hotspot "${hotspotReference.sourceNodeId}" references unknown state "${hotspotReference.linkedStateId}".`,
            severity: 'warning',
            graphId: graph.id,
            nodeId: hotspotReference.sourceNodeId,
          })
        }

        const action = hotspotReference.action

        if (!action) {
          continue
        }

        if (
          (action.type === 'setState' || action.type === 'focusCamera') &&
          (!action.stateId || !knownStateIds.has(action.stateId))
        ) {
          issues.push({
            code: 'viewer_action_state_unknown',
            message: `Viewer action "${hotspotReference.actionSourceNodeId ?? hotspotReference.sourceNodeId}" references unknown state "${action.stateId ?? ''}".`,
            severity: 'warning',
            graphId: graph.id,
            nodeId: hotspotReference.actionSourceNodeId ?? hotspotReference.sourceNodeId,
          })
        }

        if (
          action.type === 'setVariant' &&
          (!action.variantId || !knownVariantIds.has(action.variantId))
        ) {
          issues.push({
            code: 'viewer_action_variant_unknown',
            message: `Viewer action "${hotspotReference.actionSourceNodeId ?? hotspotReference.sourceNodeId}" references unknown variant "${action.variantId ?? ''}".`,
            severity: 'warning',
            graphId: graph.id,
            nodeId: hotspotReference.actionSourceNodeId ?? hotspotReference.sourceNodeId,
          })
        }

        if (
          action.type === 'showHotspot' &&
          (!action.hotspotId || !knownHotspotIds.has(action.hotspotId))
        ) {
          issues.push({
            code: 'viewer_action_hotspot_unknown',
            message: `Viewer action "${hotspotReference.actionSourceNodeId ?? hotspotReference.sourceNodeId}" references unknown hotspot "${action.hotspotId ?? ''}".`,
            severity: 'warning',
            graphId: graph.id,
            nodeId: hotspotReference.actionSourceNodeId ?? hotspotReference.sourceNodeId,
          })
        }
      }
    }

    if (node.type === 'viewer.model') {
      const src = typeof node.params.src === 'string' ? node.params.src.trim() : ''

      if (src.length === 0) {
        issues.push({
          code: 'viewer_model_src_missing',
          message: `Viewer model "${node.id}" has an empty source.`,
          severity: 'warning',
          graphId: graph.id,
          nodeId: node.id,
        })
      }
    }

    if (node.type === 'viewer.environment') {
      const type = node.params.type === 'hdri' ? 'hdri' : 'color'
      const hdriSrc =
        typeof node.params.hdriSrc === 'string' ? node.params.hdriSrc.trim() : ''

      if (type === 'hdri' && hdriSrc.length === 0) {
        issues.push({
          code: 'viewer_environment_hdri_missing',
          message: `Viewer environment "${node.id}" uses HDRI mode without "hdriSrc".`,
          severity: 'warning',
          graphId: graph.id,
          nodeId: node.id,
        })
      }
    }

    if (node.type === 'viewer.hotspot' && !hasValidViewerVector(node.params.position)) {
      issues.push({
        code: 'viewer_hotspot_position_invalid',
        message: `Viewer hotspot "${node.id}" is missing a valid 3D position.`,
        severity: 'warning',
        graphId: graph.id,
        nodeId: node.id,
      })
    }

    if (node.type === 'viewer.cameraPreset' && !hasValidViewerCameraParams(node.params)) {
      issues.push({
        code: 'viewer_camera_invalid',
        message: `Viewer camera preset "${node.id}" has invalid numeric constraints.`,
        severity: 'warning',
        graphId: graph.id,
        nodeId: node.id,
      })
    }

    if (node.type === 'viewer.hotspots') {
      const hotspotEdgeCount = graph.edges.filter(
        (edge) =>
          edge.kind === 'data' &&
          edge.to.nodeId === node.id &&
          edge.to.port === 'hotspots',
      ).length

      if (hotspotEdgeCount === 0) {
        issues.push({
          code: 'viewer_hotspots_empty',
          message: `Viewer hotspots node "${node.id}" has no hotspot inputs connected.`,
          severity: 'warning',
          graphId: graph.id,
          nodeId: node.id,
        })
      }
    }

    if (node.type === 'viewer.states') {
      const duplicateIds = getDuplicateViewerIds(
        collectViewerStateReferencesFromAggregator(graph, nodesById, node.id).map(
          (stateReference) => stateReference.id,
        ),
      )

      if (duplicateIds.length > 0) {
        issues.push({
          code: 'viewer_state_duplicate_id',
          message: `Viewer states node "${node.id}" declares duplicate state ids: ${duplicateIds.join(', ')}.`,
          severity: 'warning',
          graphId: graph.id,
          nodeId: node.id,
        })
      }
    }

    if (node.type === 'viewer.variants') {
      const duplicateIds = getDuplicateViewerIds(
        collectViewerVariantReferencesFromAggregator(graph, nodesById, node.id).map(
          (variantReference) => variantReference.id,
        ),
      )

      if (duplicateIds.length > 0) {
        issues.push({
          code: 'viewer_variant_duplicate_id',
          message: `Viewer variants node "${node.id}" declares duplicate variant ids: ${duplicateIds.join(', ')}.`,
          severity: 'warning',
          graphId: graph.id,
          nodeId: node.id,
        })
      }
    }
  }

  return issues
}

function validateSubgraphReferences(project: ProjectDocument): GraphIssue[] {
  const issues: GraphIssue[] = []
  const adjacency = new Map<string, string[]>()

  for (const graph of project.graphs) {
    adjacency.set(
      graph.id,
      graph.nodes
        .filter((node) => node.type === 'subgraph.instance')
        .map(getSubgraphGraphId)
        .filter((graphId): graphId is string => Boolean(graphId)),
    )
  }

  const visited = new Set<string>()
  const visiting = new Set<string>()

  for (const graph of project.graphs) {
    visit(graph.id, [])
  }

  return issues

  function visit(graphId: string, path: string[]): void {
    if (visiting.has(graphId)) {
      issues.push({
        code: 'subgraph_cycle_detected',
        message: `Circular subgraph reference detected: ${[...path, graphId].join(' -> ')}.`,
        severity: 'error',
        graphId,
      })
      return
    }

    if (visited.has(graphId)) {
      return
    }

    visiting.add(graphId)

    for (const nextGraphId of adjacency.get(graphId) ?? []) {
      visit(nextGraphId, [...path, graphId])
    }

    visiting.delete(graphId)
    visited.add(graphId)
  }
}

function getSubgraphGraphId(node: { params: Record<string, unknown> }): string | undefined {
  const graphId = node.params.subgraphGraphId
  return typeof graphId === 'string' && graphId.length > 0 ? graphId : undefined
}

function getDynamicTargetInputPort(
  project: ProjectDocument | undefined,
  targetNode: { type: string; params: Record<string, unknown> },
  edge: EdgeInstance,
): PortDefinition | undefined {
  if (!project || edge.kind !== 'data' || targetNode.type !== 'subgraph.instance') {
    return undefined
  }

  const referencedSubgraph = getSubgraphDefinition(
    project,
    getSubgraphGraphId(targetNode) ?? '',
  )
  const field = referencedSubgraph?.publicParamsSchema[edge.to.port]

  if (!field) {
    return undefined
  }

  return {
    key: edge.to.port,
    valueType: getValueTypeForPortableField(field.type),
  }
}

function getSupportedSlotsForNode(
  project: ProjectDocument | undefined,
  node: { type: string; params: Record<string, unknown>; id: string },
  sourceDefinition: { slots?: string[] },
): string[] {
  if (node.type === 'subgraph.instance') {
    if (!project) {
      return ['children']
    }

    return resolvePublicSlots(
      getSubgraphDefinition(project, getSubgraphGraphId(node) ?? '')?.publicSlots,
    )
  }

  return sourceDefinition.slots?.length ? sourceDefinition.slots : ['children']
}

interface ViewerStateReference {
  id?: string
  sourceNodeId: string
}

interface ViewerVariantReference {
  id?: string
  sourceNodeId: string
}

interface ViewerHotspotReference {
  id?: string
  sourceNodeId: string
  linkedStateId?: string
  action?: ViewerActionConfig
  actionSourceNodeId?: string
}

function collectViewerStateReferences(
  graph: GraphDocument,
  nodesById: Map<string, { type: string; params: Record<string, unknown>; id: string }>,
  viewerBlockNode: { id: string; params: Record<string, unknown> },
): ViewerStateReference[] {
  const references = collectViewerStateReferencesFromArray(viewerBlockNode.params.states, viewerBlockNode.id)

  for (const edge of graph.edges.filter(
    (candidate) =>
      candidate.kind === 'data' &&
      candidate.to.nodeId === viewerBlockNode.id &&
      candidate.to.port === 'states',
  )) {
    const sourceNode = nodesById.get(edge.from.nodeId)

    if (sourceNode?.type === 'viewer.states') {
      references.push(...collectViewerStateReferencesFromAggregator(graph, nodesById, sourceNode.id))
    }
  }

  return references
}

function collectViewerStateReferencesFromAggregator(
  graph: GraphDocument,
  nodesById: Map<string, { type: string; params: Record<string, unknown>; id: string }>,
  aggregatorNodeId: string,
): ViewerStateReference[] {
  const references: ViewerStateReference[] = []

  for (const edge of graph.edges.filter(
    (candidate) =>
      candidate.kind === 'data' &&
      candidate.to.nodeId === aggregatorNodeId &&
      candidate.to.port === 'states',
  )) {
    const sourceNode = nodesById.get(edge.from.nodeId)

    if (sourceNode?.type === 'viewer.state') {
      references.push({
        id: readViewerString(sourceNode.params.id) ?? sourceNode.id,
        sourceNodeId: sourceNode.id,
      })
    }
  }

  return references
}

function collectViewerStateReferencesFromArray(
  value: unknown,
  sourceNodeId: string,
): ViewerStateReference[] {
  return Array.isArray(value)
    ? value
        .map((item) => asRecord(item))
        .filter((item): item is Record<string, unknown> => Boolean(item))
        .map((item, index) => ({
          id: readViewerString(item.id) ?? `state-${index + 1}`,
          sourceNodeId,
        }))
    : []
}

function collectViewerVariantReferences(
  graph: GraphDocument,
  nodesById: Map<string, { type: string; params: Record<string, unknown>; id: string }>,
  viewerBlockNode: { id: string; params: Record<string, unknown> },
): ViewerVariantReference[] {
  const references = collectViewerVariantReferencesFromArray(
    viewerBlockNode.params.variants,
    viewerBlockNode.id,
  )

  for (const edge of graph.edges.filter(
    (candidate) =>
      candidate.kind === 'data' &&
      candidate.to.nodeId === viewerBlockNode.id &&
      candidate.to.port === 'variants',
  )) {
    const sourceNode = nodesById.get(edge.from.nodeId)

    if (sourceNode?.type === 'viewer.variants') {
      references.push(...collectViewerVariantReferencesFromAggregator(graph, nodesById, sourceNode.id))
    }
  }

  return references
}

function collectViewerVariantReferencesFromAggregator(
  graph: GraphDocument,
  nodesById: Map<string, { type: string; params: Record<string, unknown>; id: string }>,
  aggregatorNodeId: string,
): ViewerVariantReference[] {
  const references: ViewerVariantReference[] = []

  for (const edge of graph.edges.filter(
    (candidate) =>
      candidate.kind === 'data' &&
      candidate.to.nodeId === aggregatorNodeId &&
      candidate.to.port === 'variants',
  )) {
    const sourceNode = nodesById.get(edge.from.nodeId)

    if (sourceNode?.type === 'viewer.variant') {
      references.push({
        id: readViewerString(sourceNode.params.id) ?? sourceNode.id,
        sourceNodeId: sourceNode.id,
      })
    }
  }

  return references
}

function collectViewerVariantReferencesFromArray(
  value: unknown,
  sourceNodeId: string,
): ViewerVariantReference[] {
  return Array.isArray(value)
    ? value
        .map((item) => asRecord(item))
        .filter((item): item is Record<string, unknown> => Boolean(item))
        .map((item, index) => ({
          id: readViewerString(item.id) ?? `variant-${index + 1}`,
          sourceNodeId,
        }))
    : []
}

function collectViewerHotspotReferences(
  graph: GraphDocument,
  nodesById: Map<string, { type: string; params: Record<string, unknown>; id: string }>,
  viewerBlockNode: { id: string; params: Record<string, unknown> },
): ViewerHotspotReference[] {
  const references = collectViewerHotspotReferencesFromArray(
    viewerBlockNode.params.hotspots,
    viewerBlockNode.id,
  )

  for (const edge of graph.edges.filter(
    (candidate) =>
      candidate.kind === 'data' &&
      candidate.to.nodeId === viewerBlockNode.id &&
      candidate.to.port === 'hotspots',
  )) {
    const sourceNode = nodesById.get(edge.from.nodeId)

    if (sourceNode?.type === 'viewer.hotspots') {
      references.push(...collectViewerHotspotReferencesFromAggregator(graph, nodesById, sourceNode.id))
    }
  }

  return references
}

function collectViewerHotspotReferencesFromAggregator(
  graph: GraphDocument,
  nodesById: Map<string, { type: string; params: Record<string, unknown>; id: string }>,
  aggregatorNodeId: string,
): ViewerHotspotReference[] {
  const references: ViewerHotspotReference[] = []

  for (const edge of graph.edges.filter(
    (candidate) =>
      candidate.kind === 'data' &&
      candidate.to.nodeId === aggregatorNodeId &&
      candidate.to.port === 'hotspots',
  )) {
    const sourceNode = nodesById.get(edge.from.nodeId)

    if (sourceNode?.type === 'viewer.hotspot') {
      references.push(collectViewerHotspotReferenceFromNode(graph, nodesById, sourceNode))
    }
  }

  return references
}

function collectViewerHotspotReferenceFromNode(
  graph: GraphDocument,
  nodesById: Map<string, { type: string; params: Record<string, unknown>; id: string }>,
  hotspotNode: { id: string; params: Record<string, unknown> },
): ViewerHotspotReference {
  const actionEdge = graph.edges.find(
    (edge) =>
      edge.kind === 'data' &&
      edge.to.nodeId === hotspotNode.id &&
      edge.to.port === 'onClickAction',
  )
  const actionSourceNode = actionEdge ? nodesById.get(actionEdge.from.nodeId) : undefined
  const linkedStateId = readViewerString(hotspotNode.params.linkedStateId)
  const action =
    (actionSourceNode ? getViewerActionFromNode(actionSourceNode) : undefined) ??
    parseViewerActionConfig(hotspotNode.params.onClickAction)

  return {
    id: readViewerString(hotspotNode.params.id) ?? hotspotNode.id,
    sourceNodeId: hotspotNode.id,
    ...(linkedStateId ? { linkedStateId } : {}),
    ...(action ? { action } : {}),
    ...(actionSourceNode?.id ? { actionSourceNodeId: actionSourceNode.id } : {}),
  }
}

function collectViewerHotspotReferencesFromArray(
  value: unknown,
  sourceNodeId: string,
): ViewerHotspotReference[] {
  return Array.isArray(value)
    ? value
        .map((item) => asRecord(item))
        .filter((item): item is Record<string, unknown> => Boolean(item))
        .map((item, index) => {
          const linkedStateId = readViewerString(item.linkedStateId)
          const action = parseViewerActionConfig(item.onClickAction)

          return {
            id: readViewerString(item.id) ?? `hotspot-${index + 1}`,
            sourceNodeId,
            ...(linkedStateId ? { linkedStateId } : {}),
            ...(action ? { action } : {}),
          }
        })
    : []
}

function resolveViewerInteractionsEnabled(
  graph: GraphDocument,
  nodesById: Map<string, { type: string; params: Record<string, unknown>; id: string }>,
  viewerBlockNode: { id: string; params: Record<string, unknown> },
): boolean {
  const connectedEdge = graph.edges.find(
    (edge) =>
      edge.kind === 'data' &&
      edge.to.nodeId === viewerBlockNode.id &&
      edge.to.port === 'interactionsEnabled',
  )

  if (connectedEdge) {
    const sourceNode = nodesById.get(connectedEdge.from.nodeId)

    if (sourceNode?.type === 'data.value' && typeof sourceNode.params.value === 'boolean') {
      return sourceNode.params.value
    }
  }

  return viewerBlockNode.params.interactionsEnabled !== false
}

function getViewerActionFromNode(node: {
  type: string
  params: Record<string, unknown>
}): ViewerActionConfig | undefined {
  if (node.type === 'viewer.setState') {
    return {
      type: 'setState',
      stateId: readViewerString(node.params.stateId) ?? '',
    }
  }

  if (node.type === 'viewer.setVariant') {
    return {
      type: 'setVariant',
      variantId: readViewerString(node.params.variantId) ?? '',
    }
  }

  if (node.type === 'viewer.showHotspot') {
    return {
      type: 'showHotspot',
      hotspotId: readViewerString(node.params.hotspotId) ?? '',
    }
  }

  if (node.type === 'viewer.focusCamera') {
    const camera = asRecord(node.params.camera)
    const stateId = readViewerString(node.params.stateId)

    return {
      type: 'focusCamera',
      ...(camera ? { camera: camera as never } : {}),
      ...(stateId ? { stateId } : {}),
    }
  }

  return undefined
}

function parseViewerActionConfig(value: unknown): ViewerActionConfig | undefined {
  const action = asRecord(value)
  const type = readViewerString(action?.type)

  if (type === 'setState') {
    return {
      type: 'setState',
      stateId: readViewerString(action?.stateId) ?? '',
    }
  }

  if (type === 'setVariant') {
    return {
      type: 'setVariant',
      variantId: readViewerString(action?.variantId) ?? '',
    }
  }

  if (type === 'showHotspot') {
    return {
      type: 'showHotspot',
      hotspotId: readViewerString(action?.hotspotId) ?? '',
    }
  }

  if (type === 'focusCamera') {
    const camera = asRecord(action?.camera)
    const stateId = readViewerString(action?.stateId)

    return {
      type: 'focusCamera',
      ...(camera ? { camera: camera as never } : {}),
      ...(stateId ? { stateId } : {}),
    }
  }

  return undefined
}

function getDuplicateViewerIds(values: Array<string | undefined>): string[] {
  const duplicates = new Set<string>()
  const seen = new Set<string>()

  for (const value of values) {
    if (!value) {
      continue
    }

    if (seen.has(value)) {
      duplicates.add(value)
      continue
    }

    seen.add(value)
  }

  return [...duplicates]
}

function readViewerString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined
}

function getValueTypeForPortableField(
  type: 'string' | 'number' | 'boolean' | 'enum' | 'json' | 'string-or-number',
): ValueType {
  if (type === 'string' || type === 'enum') {
    return 'string'
  }

  if (type === 'number') {
    return 'number'
  }

  if (type === 'boolean') {
    return 'boolean'
  }

  return 'unknown'
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined
}

function hasValidViewerVector(value: unknown): boolean {
  const vector = asRecord(value)

  return (
    typeof vector?.x === 'number' &&
    Number.isFinite(vector.x) &&
    typeof vector.y === 'number' &&
    Number.isFinite(vector.y) &&
    typeof vector.z === 'number' &&
    Number.isFinite(vector.z)
  )
}

function hasValidViewerCameraParams(params: Record<string, unknown>): boolean {
  const fov = params.fov
  const minDistance = params.minDistance
  const maxDistance = params.maxDistance

  if (typeof fov === 'number' && (!Number.isFinite(fov) || fov <= 0)) {
    return false
  }

  if (typeof minDistance === 'number' && (!Number.isFinite(minDistance) || minDistance < 0)) {
    return false
  }

  if (typeof maxDistance === 'number' && (!Number.isFinite(maxDistance) || maxDistance < 0)) {
    return false
  }

  if (
    typeof minDistance === 'number' &&
    typeof maxDistance === 'number' &&
    maxDistance < minDistance
  ) {
    return false
  }

  if ('position' in params && params.position !== undefined && !hasValidViewerVector(params.position)) {
    return false
  }

  if ('target' in params && params.target !== undefined && !hasValidViewerVector(params.target)) {
    return false
  }

  return true
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

  if (outputType === 'unknown' || inputType === 'unknown') {
    return edge.kind === 'data'
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
