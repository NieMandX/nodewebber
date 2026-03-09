import { deserializeProjectDocument, serializeProjectDocument } from '@procedural-web-composer/graph-core'
import type {
  EdgeInstance,
  GraphDocument,
  NodeDefinitionResolver,
  NodeInstance,
  ProjectDocument,
} from '@procedural-web-composer/shared-types'
import {
  cloneProjectDocument,
  createId,
  nowIsoString,
} from '@procedural-web-composer/shared-utils'
import { createStore } from 'zustand/vanilla'
import type { StoreApi } from 'zustand/vanilla'
import { createEmptyProjectDocument, createNodeInstance } from './factories'

export interface ConnectNodesInput {
  fromNodeId: string
  fromPort: string
  toNodeId: string
  toPort: string
  kind: EdgeInstance['kind']
}

export interface EditorHistory {
  past: ProjectDocument[]
  future: ProjectDocument[]
}

export interface EditorState {
  project: ProjectDocument
  selectedGraphId: string
  selectedNodeId: string | undefined
  jsonBuffer: string
  history: EditorHistory
  setSelectedGraph: (graphId: string) => void
  selectNode: (nodeId?: string) => void
  addNode: (type: string, position?: NodeInstance['position']) => void
  duplicateNode: (nodeId: string, position?: NodeInstance['position']) => void
  removeNode: (nodeId: string) => void
  removeEdge: (edgeId: string) => void
  connectNodes: (connection: ConnectNodesInput) => void
  updateNodeParam: (nodeId: string, key: string, value: unknown) => void
  updateNodeParams: (nodeId: string, params: Record<string, unknown>) => void
  updateNodeLabel: (nodeId: string, label: string) => void
  updateNodePosition: (nodeId: string, position: NodeInstance['position']) => void
  setJsonBuffer: (json: string) => void
  loadProject: (project: ProjectDocument) => void
  loadProjectFromJson: (json: string) => { ok: true } | { ok: false; error: string }
  saveProject: () => string
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
    jsonBuffer: serializeProjectDocument(initialProject),
    history: createEmptyHistory(),
    setSelectedGraph: (graphId) => {
      set((state) => ({
        ...state,
        selectedGraphId: graphId,
        selectedNodeId: undefined,
      }))
    },
    selectNode: (nodeId) => {
      set((state) => ({
        ...state,
        selectedNodeId: nodeId,
      }))
    },
    addNode: (type, position) => {
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
            label: definition.title,
            position:
              position ??
              {
                x: 80 + (nextIndex % 3) * 280,
                y: 80 + Math.floor(nextIndex / 3) * 180,
              },
            params: definition.defaultParams,
            ui: {
              width: 248,
            },
          })

          graph.nodes.push(node)
        })

        if (!project) {
          return state
        }

        return {
          ...state,
          project,
          selectedNodeId: getLastNodeId(project, state.selectedGraphId),
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

        return {
          ...state,
          project,
          selectedNodeId: getLastNodeId(project, state.selectedGraphId),
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

        return {
          ...state,
          project,
          selectedNodeId: state.selectedNodeId === nodeId ? undefined : state.selectedNodeId,
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

function getLastNodeId(project: ProjectDocument, graphId: string): string | undefined {
  return getGraphById(project, graphId)?.nodes.at(-1)?.id
}
