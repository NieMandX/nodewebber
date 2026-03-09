import { basicNodeDefinitions } from '@procedural-web-composer/node-definitions-basic'
import { dataNodeDefinitions } from '@procedural-web-composer/node-definitions-data'
import { eventNodeDefinitions } from '@procedural-web-composer/node-definitions-events'
import { layoutNodeDefinitions } from '@procedural-web-composer/node-definitions-layout'
import { styleNodeDefinitions } from '@procedural-web-composer/node-definitions-style'
import { subgraphNodeDefinitions } from '@procedural-web-composer/node-definitions-subgraph'
import { viewerNodeDefinitions } from '@procedural-web-composer/node-definitions-viewer'
import {
  createNodeRegistry,
  freezeNodeRegistry,
} from '@procedural-web-composer/node-registry'
import type { NodeDefinition, NodeDefinitionResolver } from '@procedural-web-composer/shared-types'

export function createTestRegistry(
  extraDefinitions: NodeDefinition[] = [],
): NodeDefinitionResolver {
  const registry = createNodeRegistry([
    ...layoutNodeDefinitions,
    ...basicNodeDefinitions,
    ...dataNodeDefinitions,
    ...eventNodeDefinitions,
    ...viewerNodeDefinitions,
    ...styleNodeDefinitions,
    ...subgraphNodeDefinitions,
    ...extraDefinitions,
  ])

  return freezeNodeRegistry(registry)
}

export const emptyParamsSchema = {
  safeParse: (input: unknown) => ({
    success: true as const,
    data: input,
  }),
}
