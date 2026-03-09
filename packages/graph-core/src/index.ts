export {
  assetReferenceSchema,
  edgeInstanceSchema,
  graphDocumentSchema,
  nodeInstanceSchema,
  projectDocumentSchema,
} from './schemas'
export { detectCycles, topoSort } from './algorithms'
export {
  analyzeGraphDiagnostics,
  getGraphDiagnostics,
} from './diagnostics'
export type {
  GraphDiagnostics,
  ProjectDiagnostics,
} from './diagnostics'
export {
  getSubgraphDefinition,
  getSubgraphDefinitions,
  isReusableGraph,
  matchesPortableParamField,
  validatePortableParamDefaults,
} from './subgraphs'
export { validateEdges, validateGraph, validateNodes } from './validation'

import type { ProjectDocument } from '@procedural-web-composer/shared-types'
import { projectDocumentSchema } from './schemas'

export function serializeProjectDocument(document: ProjectDocument, indent = 2): string {
  return JSON.stringify(document, null, indent)
}

export function deserializeProjectDocument(input: string | unknown): ProjectDocument {
  const rawValue = typeof input === 'string' ? JSON.parse(input) : input
  return projectDocumentSchema.parse(rawValue) as ProjectDocument
}
