import { deserializeProjectDocument, serializeProjectDocument } from '@procedural-web-composer/graph-core'
import type {
  EdgeInstance,
  GraphDocument,
  GraphSubgraphMetadata,
  NodeDefinitionResolver,
  NodeInstance,
  PortableParamSchemaField,
  ProjectDocument,
} from '@procedural-web-composer/shared-types'
import {
  cloneProjectDocument,
  createId,
  nowIsoString,
} from '@procedural-web-composer/shared-utils'
import { createStore } from 'zustand/vanilla'
import type { StoreApi } from 'zustand/vanilla'
import { createEmptyProjectDocument, createGraphDocument, createNodeInstance } from './factories'

export interface ConnectNodesInput {
  fromNodeId: string
  fromPort: string
  toNodeId: string
  toPort: string
  kind: EdgeInstance['kind']
  slot?: string
}

export interface AddNodeInitialState {
  label?: string
  params?: Record<string, unknown>
}

export interface ConvertSelectionToSubgraphOptions {
  name?: string
}

export type ConvertSelectionToSubgraphResult =
  | {
      ok: true
      graphId: string
      instanceNodeId: string
    }
  | {
      ok: false
      error: string
    }

export interface EditorHistory {
  past: ProjectDocument[]
  future: ProjectDocument[]
}

export interface EditorState {
  project: ProjectDocument
  selectedGraphId: string
  selectedNodeId: string | undefined
  selectedNodeIds: string[]
  jsonBuffer: string
  history: EditorHistory
  setSelectedGraph: (graphId: string) => void
  selectNode: (nodeId?: string) => void
  selectNodes: (nodeIds: string[]) => void
  addNode: (
    type: string,
    position?: NodeInstance['position'],
    initialState?: AddNodeInitialState,
  ) => void
  duplicateNode: (nodeId: string, position?: NodeInstance['position']) => void
  removeNode: (nodeId: string) => void
  removeEdge: (edgeId: string) => void
  connectNodes: (connection: ConnectNodesInput) => void
  updateNodeParam: (nodeId: string, key: string, value: unknown) => void
  updateNodeParams: (nodeId: string, params: Record<string, unknown>) => void
  updateNodeLabel: (nodeId: string, label: string) => void
  updateNodePosition: (nodeId: string, position: NodeInstance['position']) => void
  updateGraphName: (graphId: string, name: string) => void
  updateGraphSubgraphMetadata: (
    graphId: string,
    metadata: GraphSubgraphMetadata,
  ) => void
  setJsonBuffer: (json: string) => void
  loadProject: (project: ProjectDocument) => void
  loadProjectFromJson: (json: string) => { ok: true } | { ok: false; error: string }
  saveProject: () => string
  convertSelectionToSubgraph: (
    options?: ConvertSelectionToSubgraphOptions,
  ) => ConvertSelectionToSubgraphResult
  undo: () => void
  redo: () => void
}

export type EditorStore = StoreApi<EditorState>

export function createEditorStore(options: {
  registry: NodeDefinitionResolver
  initialProject?: ProjectDocument
}): EditorStore {
  const initialProject = options.initialProject ?? createEmptyProjectDocument()

  return createStore<EditorState>((set, get) => ({
    project: initialProject,
    selectedGraphId: initialProject.settings.entryGraphId,
    selectedNodeId: undefined,
    selectedNodeIds: [],
    jsonBuffer: serializeProjectDocument(initialProject),
    history: createEmptyHistory(),
    setSelectedGraph: (graphId) => {
      set((state) => ({
        ...state,
        selectedGraphId: graphId,
        selectedNodeId: undefined,
        selectedNodeIds: [],
      }))
    },
    selectNode: (nodeId) => {
      set((state) => {
        const nextNodeIds = nodeId ? [nodeId] : []

        if (
          state.selectedNodeId === nodeId &&
          areNodeIdListsEqual(state.selectedNodeIds, nextNodeIds)
        ) {
          return state
        }

        return {
          ...state,
          selectedNodeId: nodeId,
          selectedNodeIds: nextNodeIds,
        }
      })
    },
    selectNodes: (nodeIds) => {
      const nextNodeIds = [...new Set(nodeIds)]

      set((state) => {
        if (
          state.selectedNodeId === nextNodeIds[0] &&
          areNodeIdListsEqual(state.selectedNodeIds, nextNodeIds)
        ) {
          return state
        }

        return {
          ...state,
          selectedNodeId: nextNodeIds[0],
          selectedNodeIds: nextNodeIds,
        }
      })
    },
    addNode: (type, position, initialState) => {
      const definition = options.registry.getNodeDefinition(type)

      if (!definition) {
        return
      }

      set((state) => {
        const project = updateProject(state.project, state.selectedGraphId, (graph) => {
          const nextIndex = graph.nodes.length
          const node = createNodeInstance({
            type,
            version: definition.version,
            label: initialState?.label ?? definition.title,
            position:
              position ??
              {
                x: 80 + (nextIndex % 3) * 280,
                y: 80 + Math.floor(nextIndex / 3) * 180,
              },
            params: {
              ...definition.defaultParams,
              ...(initialState?.params ?? {}),
            },
            ui: {
              width: 248,
            },
          })

          graph.nodes.push(node)
        })

        if (!project) {
          return state
        }

        const nextNodeId = getLastNodeId(project, state.selectedGraphId)

        return {
          ...state,
          project,
          selectedNodeId: nextNodeId,
          selectedNodeIds: nextNodeId ? [nextNodeId] : [],
          jsonBuffer: serializeProjectDocument(project),
          history: pushHistory(state.history, state.project),
        }
      })
    },
    duplicateNode: (nodeId, position) => {
      set((state) => {
        const project = updateProject(state.project, state.selectedGraphId, (graph) => {
          const sourceNode = graph.nodes.find((node) => node.id === nodeId)

          if (!sourceNode) {
            return
          }

          const duplicatedNode = createNodeInstance({
            type: sourceNode.type,
            version: sourceNode.version,
            position:
              position ?? {
                x: sourceNode.position.x + 36,
                y: sourceNode.position.y + 36,
              },
            params: sourceNode.params,
            ...(sourceNode.label ? { label: sourceNode.label } : {}),
            ...(sourceNode.ui ? { ui: sourceNode.ui } : {}),
          })

          graph.nodes.push(duplicatedNode)
        })

        if (!project) {
          return state
        }

        const nextNodeId = getLastNodeId(project, state.selectedGraphId)

        return {
          ...state,
          project,
          selectedNodeId: nextNodeId,
          selectedNodeIds: nextNodeId ? [nextNodeId] : [],
          jsonBuffer: serializeProjectDocument(project),
          history: pushHistory(state.history, state.project),
        }
      })
    },
    removeNode: (nodeId) => {
      set((state) => {
        const project = updateProject(state.project, state.selectedGraphId, (graph) => {
          graph.nodes = graph.nodes.filter((node) => node.id !== nodeId)
          graph.edges = graph.edges.filter(
            (edge) => edge.from.nodeId !== nodeId && edge.to.nodeId !== nodeId,
          )
        })

        if (!project) {
          return state
        }

        const nextSelectedNodeIds = state.selectedNodeIds.filter((id) => id !== nodeId)

        return {
          ...state,
          project,
          selectedNodeId:
            state.selectedNodeId === nodeId ? nextSelectedNodeIds[0] : state.selectedNodeId,
          selectedNodeIds: nextSelectedNodeIds,
          jsonBuffer: serializeProjectDocument(project),
          history: pushHistory(state.history, state.project),
        }
      })
    },
    removeEdge: (edgeId) => {
      set((state) => {
        const project = updateProject(state.project, state.selectedGraphId, (graph) => {
          graph.edges = graph.edges.filter((edge) => edge.id !== edgeId)
        })

        if (!project) {
          return state
        }

        return {
          ...state,
          project,
          jsonBuffer: serializeProjectDocument(project),
          history: pushHistory(state.history, state.project),
        }
      })
    },
    connectNodes: (connection) => {
      set((state) => {
        const project = updateProject(state.project, state.selectedGraphId, (graph) => {
          const targetNode = graph.nodes.find((node) => node.id === connection.toNodeId)
          const targetDefinition = targetNode
            ? options.registry.getNodeDefinition(targetNode.type)
            : undefined
          const targetPort = targetDefinition?.inputs.find(
            (port) => port.key === connection.toPort,
          )

          graph.edges = graph.edges.filter((edge) => {
            const isSameTarget =
              edge.to.nodeId === connection.toNodeId && edge.to.port === connection.toPort
            const isDuplicate =
              edge.from.nodeId === connection.fromNodeId &&
              edge.from.port === connection.fromPort &&
              edge.to.nodeId === connection.toNodeId &&
              edge.to.port === connection.toPort &&
              edge.kind === connection.kind

            if (isDuplicate) {
              return false
            }

            if (!targetPort?.multiple && isSameTarget) {
              return false
            }

            return true
          })

          graph.edges.push({
            id: createId('edge'),
            from: {
              nodeId: connection.fromNodeId,
              port: connection.fromPort,
            },
            to: {
              nodeId: connection.toNodeId,
              port: connection.toPort,
            },
            kind: connection.kind,
            ...(connection.slot ? { slot: connection.slot } : {}),
          })
        })

        if (!project) {
          return state
        }

        return {
          ...state,
          project,
          jsonBuffer: serializeProjectDocument(project),
          history: pushHistory(state.history, state.project),
        }
      })
    },
    updateNodeParam: (nodeId, key, value) => {
      set((state) => {
        const project = updateProject(state.project, state.selectedGraphId, (graph) => {
          const node = graph.nodes.find((candidate) => candidate.id === nodeId)

          if (!node) {
            return
          }

          node.params = {
            ...node.params,
            [key]: value,
          }
        })

        if (!project) {
          return state
        }

        return {
          ...state,
          project,
          jsonBuffer: serializeProjectDocument(project),
          history: pushHistory(state.history, state.project),
        }
      })
    },
    updateNodeParams: (nodeId, params) => {
      set((state) => {
        const project = updateProject(state.project, state.selectedGraphId, (graph) => {
          const node = graph.nodes.find((candidate) => candidate.id === nodeId)

          if (!node) {
            return
          }

          node.params = structuredClone(params)
        })

        if (!project) {
          return state
        }

        return {
          ...state,
          project,
          jsonBuffer: serializeProjectDocument(project),
          history: pushHistory(state.history, state.project),
        }
      })
    },
    updateNodeLabel: (nodeId, label) => {
      set((state) => {
        const project = updateProject(state.project, state.selectedGraphId, (graph) => {
          const node = graph.nodes.find((candidate) => candidate.id === nodeId)

          if (!node) {
            return
          }

          node.label = label
        })

        if (!project) {
          return state
        }

        return {
          ...state,
          project,
          jsonBuffer: serializeProjectDocument(project),
        }
      })
    },
    updateNodePosition: (nodeId, position) => {
      set((state) => {
        const project = updateProject(state.project, state.selectedGraphId, (graph) => {
          const node = graph.nodes.find((candidate) => candidate.id === nodeId)

          if (!node) {
            return
          }

          node.position = position
        })

        if (!project) {
          return state
        }

        return {
          ...state,
          project,
          jsonBuffer: serializeProjectDocument(project),
        }
      })
    },
    updateGraphName: (graphId, name) => {
      set((state) => {
        const project = updateProject(state.project, graphId, (graph) => {
          graph.name = name
        })

        if (!project) {
          return state
        }

        return {
          ...state,
          project,
          jsonBuffer: serializeProjectDocument(project),
          history: pushHistory(state.history, state.project),
        }
      })
    },
    updateGraphSubgraphMetadata: (graphId, metadata) => {
      set((state) => {
        const project = updateProject(state.project, graphId, (graph) => {
          graph.subgraph = structuredClone(metadata)
        })

        if (!project) {
          return state
        }

        return {
          ...state,
          project,
          jsonBuffer: serializeProjectDocument(project),
          history: pushHistory(state.history, state.project),
        }
      })
    },
    setJsonBuffer: (json) => {
      set((state) => ({
        ...state,
        jsonBuffer: json,
      }))
    },
    loadProject: (project) => {
      set((state) => ({
        ...state,
        project,
        selectedGraphId: project.settings.entryGraphId,
        selectedNodeId: undefined,
        selectedNodeIds: [],
        jsonBuffer: serializeProjectDocument(project),
        history: createEmptyHistory(),
      }))
    },
    loadProjectFromJson: (json) => {
      try {
        const project = deserializeProjectDocument(json)

        set((state) => ({
          ...state,
          project,
          selectedGraphId: project.settings.entryGraphId,
          selectedNodeId: undefined,
          selectedNodeIds: [],
          jsonBuffer: serializeProjectDocument(project),
          history: createEmptyHistory(),
        }))

        return { ok: true }
      } catch (error) {
        return {
          ok: false,
          error: error instanceof Error ? error.message : 'Could not parse project JSON.',
        }
      }
    },
    saveProject: () => {
      const json = serializeProjectDocument(get().project)
      set((state) => ({
        ...state,
        jsonBuffer: json,
      }))
      return json
    },
    convertSelectionToSubgraph: (conversionOptions) => {
      const state = get()
      const result = buildSubgraphConversion(state.project, {
        selectedGraphId: state.selectedGraphId,
        selectedNodeIds: resolveSelectedNodeIds(state),
        registry: options.registry,
        ...(conversionOptions?.name ? { name: conversionOptions.name } : {}),
      })

      if (!result.ok) {
        return result
      }

      set((currentState) => ({
        ...currentState,
        project: result.project,
        selectedGraphId: result.graphId,
        selectedNodeId: undefined,
        selectedNodeIds: [],
        jsonBuffer: serializeProjectDocument(result.project),
        history: pushHistory(currentState.history, currentState.project),
      }))

      return {
        ok: true,
        graphId: result.graphId,
        instanceNodeId: result.instanceNodeId,
      }
    },
    undo: () => {
      set((state) => {
        const previousProject = state.history.past.at(-1)

        if (!previousProject) {
          return state
        }

        const restoredProject = cloneProjectDocument(previousProject)

        return {
          ...state,
          project: restoredProject,
          selectedGraphId: resolveGraphSelection(restoredProject, state.selectedGraphId),
          selectedNodeId: undefined,
          selectedNodeIds: [],
          jsonBuffer: serializeProjectDocument(restoredProject),
          history: {
            past: state.history.past.slice(0, -1),
            future: [...state.history.future, cloneProjectDocument(state.project)],
          },
        }
      })
    },
    redo: () => {
      set((state) => {
        const nextProject = state.history.future.at(-1)

        if (!nextProject) {
          return state
        }

        const restoredProject = cloneProjectDocument(nextProject)

        return {
          ...state,
          project: restoredProject,
          selectedGraphId: resolveGraphSelection(restoredProject, state.selectedGraphId),
          selectedNodeId: undefined,
          selectedNodeIds: [],
          jsonBuffer: serializeProjectDocument(restoredProject),
          history: {
            past: [...state.history.past, cloneProjectDocument(state.project)],
            future: state.history.future.slice(0, -1),
          },
        }
      })
    },
  }))
}

export function getGraphById(project: ProjectDocument, graphId: string): GraphDocument | undefined {
  return project.graphs.find((graph) => graph.id === graphId)
}

function updateProject(
  project: ProjectDocument,
  graphId: string,
  updater: (graph: GraphDocument) => void,
): ProjectDocument | undefined {
  const nextProject = cloneProjectDocument(project)
  const graph = getGraphById(nextProject, graphId)

  if (!graph) {
    return undefined
  }

  updater(graph)
  nextProject.meta.updatedAt = nowIsoString()
  return nextProject
}

function createEmptyHistory(): EditorHistory {
  return {
    past: [],
    future: [],
  }
}

function pushHistory(history: EditorHistory, project: ProjectDocument): EditorHistory {
  return {
    past: [...history.past, cloneProjectDocument(project)],
    future: [],
  }
}

function resolveGraphSelection(project: ProjectDocument, graphId: string): string {
  return getGraphById(project, graphId)?.id ?? project.settings.entryGraphId
}

function areNodeIdListsEqual(left: string[], right: string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index])
}

function getLastNodeId(project: ProjectDocument, graphId: string): string | undefined {
  return getGraphById(project, graphId)?.nodes.at(-1)?.id
}

function resolveSelectedNodeIds(state: Pick<EditorState, 'selectedNodeId' | 'selectedNodeIds'>): string[] {
  return state.selectedNodeIds.length > 0
    ? state.selectedNodeIds
    : state.selectedNodeId
      ? [state.selectedNodeId]
      : []
}

function buildSubgraphConversion(
  project: ProjectDocument,
  options: {
    selectedGraphId: string
    selectedNodeIds: string[]
    registry: NodeDefinitionResolver
    name?: string
  },
):
  | {
      ok: true
      project: ProjectDocument
      graphId: string
      instanceNodeId: string
    }
  | {
      ok: false
      error: string
    } {
  const sourceGraph = getGraphById(project, options.selectedGraphId)

  if (!sourceGraph) {
    return {
      ok: false,
      error: 'Active graph was not found.',
    }
  }

  if (options.selectedNodeIds.length === 0) {
    return {
      ok: false,
      error: 'Select one or more nodes before converting to a component.',
    }
  }

  if (sourceGraph.kind === 'page' && options.selectedNodeIds.some((nodeId) => getNodeById(sourceGraph, nodeId)?.type === 'layout.page')) {
    return {
      ok: false,
      error: 'The page root cannot be converted into a reusable component.',
    }
  }

  const selection = new Set(options.selectedNodeIds)
  const selectedNodes = sourceGraph.nodes.filter((node) => selection.has(node.id))
  const selectedEdges = sourceGraph.edges.filter(
    (edge) => selection.has(edge.from.nodeId) && selection.has(edge.to.nodeId),
  )
  const boundaryEdges = sourceGraph.edges.filter((edge) => {
    const fromSelected = selection.has(edge.from.nodeId)
    const toSelected = selection.has(edge.to.nodeId)
    return fromSelected !== toSelected
  })

  if (selectedNodes.length === 0) {
    return {
      ok: false,
      error: 'Selection did not resolve to any nodes.',
    }
  }

  if (
    boundaryEdges.some(
      (edge) =>
        edge.kind !== 'structure' ||
        (selection.has(edge.from.nodeId) && !selection.has(edge.to.nodeId)),
    )
  ) {
    return {
      ok: false,
      error:
        'Selection has external data/style/event connections or outgoing structure edges. Choose a self-contained subtree.',
    }
  }

  const incomingStructureEdges = boundaryEdges.filter(
    (edge) => edge.kind === 'structure' && !selection.has(edge.from.nodeId),
  )

  if (incomingStructureEdges.length > 1) {
    return {
      ok: false,
      error:
        'Selection has multiple external structure parents. Convert a single subtree for MVP subgraph extraction.',
    }
  }

  const instanceDefinition = options.registry.getNodeDefinition('subgraph.instance')

  if (!instanceDefinition) {
    return {
      ok: false,
      error: 'Subgraph instance node definition is not registered.',
    }
  }

  const componentName = options.name?.trim() || createGeneratedComponentName(project)
  const publicMetadata = inferSubgraphMetadataFromNodes(selectedNodes)
  const subgraphGraph = createGraphDocument({
    name: componentName,
    kind: 'subgraph',
    nodes: selectedNodes,
    edges: selectedEdges,
    viewport: sourceGraph.viewport,
    ...(hasSubgraphMetadata(publicMetadata) ? { subgraph: publicMetadata } : {}),
  })
  const instanceNode = createNodeInstance({
    type: 'subgraph.instance',
    version: instanceDefinition.version,
    label: componentName,
    position: computeSelectionPosition(selectedNodes),
    params: {
      subgraphGraphId: subgraphGraph.id,
      ...(publicMetadata.publicDefaultParams ?? {}),
    },
    ui: {
      width: 248,
    },
  })

  const nextProject = cloneProjectDocument(project)
  const nextSourceGraph = getGraphById(nextProject, sourceGraph.id)

  if (!nextSourceGraph) {
    return {
      ok: false,
      error: 'Could not update the source graph.',
    }
  }

  nextSourceGraph.nodes = nextSourceGraph.nodes.filter((node) => !selection.has(node.id))
  nextSourceGraph.edges = nextSourceGraph.edges.filter(
    (edge) => !selection.has(edge.from.nodeId) && !selection.has(edge.to.nodeId),
  )
  nextSourceGraph.nodes.push(instanceNode)

  const incomingStructureEdge = incomingStructureEdges[0]

  if (incomingStructureEdge) {
    nextSourceGraph.edges.push({
      id: createId('edge'),
      from: {
        nodeId: incomingStructureEdge.from.nodeId,
        port: incomingStructureEdge.from.port,
      },
      to: {
        nodeId: instanceNode.id,
        port: 'parent',
      },
      kind: 'structure',
      ...(typeof incomingStructureEdge.order === 'number'
        ? { order: incomingStructureEdge.order }
        : {}),
    })
  }

  nextProject.graphs.push(subgraphGraph)
  nextProject.meta.updatedAt = nowIsoString()

  return {
    ok: true,
    project: nextProject,
    graphId: subgraphGraph.id,
    instanceNodeId: instanceNode.id,
  }
}

function getNodeById(graph: GraphDocument, nodeId: string): NodeInstance | undefined {
  return graph.nodes.find((node) => node.id === nodeId)
}

function computeSelectionPosition(nodes: NodeInstance[]): NodeInstance['position'] {
  const left = Math.min(...nodes.map((node) => node.position.x))
  const top = Math.min(...nodes.map((node) => node.position.y))

  return {
    x: left,
    y: top,
  }
}

function createGeneratedComponentName(project: ProjectDocument): string {
  let index = 1

  while (project.graphs.some((graph) => graph.name === `Component ${index}`)) {
    index += 1
  }

  return `Component ${index}`
}

function inferSubgraphMetadataFromNodes(nodes: NodeInstance[]): GraphSubgraphMetadata {
  const publicParamsSchema: Record<string, PortableParamSchemaField> = {}
  const publicDefaultParams: Record<string, unknown> = {}

  for (const node of nodes.filter((candidate) => candidate.type === 'subgraph.param')) {
    const key = typeof node.params.key === 'string' ? node.params.key : undefined

    if (!key) {
      continue
    }

    publicParamsSchema[key] = inferPortableParamField(node.params.fallbackValue)
    publicDefaultParams[key] = node.params.fallbackValue
  }

  return {
    ...(Object.keys(publicParamsSchema).length > 0 ? { publicParamsSchema } : {}),
    ...(Object.keys(publicDefaultParams).length > 0 ? { publicDefaultParams } : {}),
  }
}

function inferPortableParamField(value: unknown): PortableParamSchemaField {
  if (typeof value === 'string') {
    return {
      type: 'string',
    }
  }

  if (typeof value === 'number') {
    return {
      type: 'number',
    }
  }

  if (typeof value === 'boolean') {
    return {
      type: 'boolean',
    }
  }

  return {
    type: 'json',
  }
}

function hasSubgraphMetadata(metadata: GraphSubgraphMetadata): boolean {
  return Boolean(metadata.publicParamsSchema || metadata.publicDefaultParams)
}
