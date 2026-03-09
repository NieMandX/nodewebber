import type { GraphDocument, NodeInstance, ProjectDocument } from '@procedural-web-composer/shared-types'
import { createId, nowIsoString } from '@procedural-web-composer/shared-utils'

export function createNodeInstance(options: {
  type: string
  version: number
  label?: string
  position: NodeInstance['position']
  params?: Record<string, unknown>
  ui?: NodeInstance['ui']
}): NodeInstance {
  return {
    id: createId('node'),
    type: options.type,
    version: options.version,
    position: options.position,
    params: structuredClone(options.params ?? {}),
    ...(options.label ? { label: options.label } : {}),
    ...(options.ui ? { ui: options.ui } : {}),
  }
}

export function createEmptyGraphDocument(name = 'Home Page'): GraphDocument {
  return {
    id: createId('graph'),
    name,
    kind: 'page',
    nodes: [
      createNodeInstance({
        type: 'layout.page',
        version: 1,
        label: 'Page',
        position: {
          x: 320,
          y: 160,
        },
        params: {
          maxWidth: 1120,
          padding: 32,
        },
        ui: {
          width: 248,
        },
      }),
    ],
    edges: [],
    viewport: {
      x: 0,
      y: 0,
      zoom: 1,
    },
  }
}

export function createEmptyProjectDocument(name = 'Procedural Web Composer'): ProjectDocument {
  const createdAt = nowIsoString()
  const graph = createEmptyGraphDocument()

  return {
    version: '1.0.0',
    meta: {
      id: createId('project'),
      name,
      createdAt,
      updatedAt: createdAt,
    },
    settings: {
      entryGraphId: graph.id,
      themeMode: 'light',
    },
    graphs: [graph],
    assets: [],
  }
}
