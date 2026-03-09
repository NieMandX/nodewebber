import type { GraphDocument, ProjectDocument } from '@procedural-web-composer/shared-types'
import { createId, nowIsoString } from '@procedural-web-composer/shared-utils'

export function createEmptyGraphDocument(name = 'Home Page'): GraphDocument {
  return {
    id: createId('graph'),
    name,
    kind: 'page',
    nodes: [],
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

