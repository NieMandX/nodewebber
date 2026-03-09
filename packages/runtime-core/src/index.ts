import { deserializeProjectDocument, validateGraph } from '@procedural-web-composer/graph-core'
import type {
  GraphDocument,
  NodeDefinitionResolver,
  ProjectDocument,
  ProjectRuntimeResult,
} from '@procedural-web-composer/shared-types'
import { buildUiTree } from './build-ui-tree'
import { evaluateGraphRuntime } from './evaluate-graph-runtime'

export function loadProjectDocument(input: string | unknown): ProjectDocument {
  return deserializeProjectDocument(input)
}

export function evaluateProjectDocument(
  document: ProjectDocument,
  registry: NodeDefinitionResolver,
): ProjectRuntimeResult {
  return evaluateGraphDocument(document, document.settings.entryGraphId, registry)
}

export function evaluateGraphDocument(
  document: ProjectDocument,
  graphId: string,
  registry: NodeDefinitionResolver,
): ProjectRuntimeResult {
  const validation = validateGraph(document, registry)
  const graph = getGraphDocument(document, graphId)

  if (!graph) {
    return {
      graph: undefined,
      root: null,
      validation,
      issues: [],
    }
  }

  const runtime = evaluateGraphRuntime({
    document,
    graph,
    registry,
    visitedGraphIds: [graph.id],
    runtimeCache: new Map(),
  })

  return {
    graph,
    root: runtime.root,
    evaluation: runtime.evaluation,
    validation,
    issues: runtime.issues,
  }
}

export { buildUiTree, getPrimaryUiOutput } from './build-ui-tree'
export {
  evaluateGraphRuntime,
  REPEAT_PREVIEW_WARNING_THRESHOLD,
} from './evaluate-graph-runtime'

function getGraphDocument(
  document: ProjectDocument,
  graphId: string,
): GraphDocument | undefined {
  return document.graphs.find((candidate) => candidate.id === graphId)
}
