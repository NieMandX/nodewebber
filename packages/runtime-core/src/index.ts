import { deserializeProjectDocument, validateGraph } from '@procedural-web-composer/graph-core'
import { evaluateGraph } from '@procedural-web-composer/graph-engine'
import type {
  GraphDocument,
  NodeDefinitionResolver,
  ProjectDocument,
  ProjectRuntimeResult,
} from '@procedural-web-composer/shared-types'
import { buildUiTree } from './build-ui-tree'

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

  const evaluation = evaluateGraph({
    project: document,
    graph,
    registry,
  })

  return {
    graph,
    root: buildUiTree(graph, evaluation, registry),
    evaluation,
    validation,
    issues: evaluation.issues,
  }
}

export { buildUiTree, getPrimaryUiOutput } from './build-ui-tree'

function getGraphDocument(
  document: ProjectDocument,
  graphId: string,
): GraphDocument | undefined {
  return document.graphs.find((candidate) => candidate.id === graphId)
}
