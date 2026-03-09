import { createNodeRegistry, freezeNodeRegistry } from '@procedural-web-composer/node-registry'
import { basicNodeDefinitions } from '@procedural-web-composer/node-definitions-basic'
import { layoutNodeDefinitions } from '@procedural-web-composer/node-definitions-layout'
import { styleNodeDefinitions } from '@procedural-web-composer/node-definitions-style'
import { subgraphNodeDefinitions } from '@procedural-web-composer/node-definitions-subgraph'

const registryInstance = createNodeRegistry([
  ...layoutNodeDefinitions,
  ...basicNodeDefinitions,
  ...styleNodeDefinitions,
  ...subgraphNodeDefinitions,
])

freezeNodeRegistry(registryInstance)

export const registry = registryInstance
