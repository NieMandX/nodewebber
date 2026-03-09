import type {
  EdgeInstance,
  GraphDocument,
  GraphSubgraphMetadata,
  NodeInstance,
  ProjectDocument,
} from '@procedural-web-composer/shared-types'

export function createProject(
  graphs: GraphDocument[],
  entryGraphId = graphs[0]?.id ?? 'graph_1',
): ProjectDocument {
  return {
    version: '1.0.0',
    meta: {
      id: 'project_test',
      name: 'Test Project',
      createdAt: '2026-03-09T00:00:00.000Z',
      updatedAt: '2026-03-09T00:00:00.000Z',
    },
    settings: {
      entryGraphId,
      themeMode: 'light',
    },
    graphs,
    assets: [],
  }
}

export function createGraph(options: {
  id: string
  name: string
  kind: GraphDocument['kind']
  nodes: NodeInstance[]
  edges?: EdgeInstance[]
  subgraph?: GraphSubgraphMetadata
}): GraphDocument {
  return {
    id: options.id,
    name: options.name,
    kind: options.kind,
    nodes: options.nodes,
    edges: options.edges ?? [],
    ...(options.subgraph ? { subgraph: options.subgraph } : {}),
  }
}

export function createNode(options: {
  id: string
  type: string
  version?: number
  x?: number
  y?: number
  label?: string
  params?: Record<string, unknown>
}): NodeInstance {
  return {
    id: options.id,
    type: options.type,
    version: options.version ?? 1,
    position: {
      x: options.x ?? 0,
      y: options.y ?? 0,
    },
    params: options.params ?? {},
    ...(options.label ? { label: options.label } : {}),
  }
}

export function createEdge(options: {
  id: string
  fromNodeId: string
  fromPort: string
  toNodeId: string
  toPort: string
  kind: EdgeInstance['kind']
  order?: number
  slot?: string
}): EdgeInstance {
  return {
    id: options.id,
    from: {
      nodeId: options.fromNodeId,
      port: options.fromPort,
    },
    to: {
      nodeId: options.toNodeId,
      port: options.toPort,
    },
    kind: options.kind,
    ...(options.order === undefined ? {} : { order: options.order }),
    ...(options.slot ? { slot: options.slot } : {}),
  }
}
