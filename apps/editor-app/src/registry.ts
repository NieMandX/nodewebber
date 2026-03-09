import { createNodeRegistry, freezeNodeRegistry } from '@procedural-web-composer/node-registry'
import { basicNodeDefinitions } from '@procedural-web-composer/node-definitions-basic'
import { dataNodeDefinitions } from '@procedural-web-composer/node-definitions-data'
import { eventNodeDefinitions } from '@procedural-web-composer/node-definitions-events'
import { layoutNodeDefinitions } from '@procedural-web-composer/node-definitions-layout'
import { presentationNodeDefinitions } from '@procedural-web-composer/node-definitions-presentation'
import { styleNodeDefinitions } from '@procedural-web-composer/node-definitions-style'
import { subgraphNodeDefinitions } from '@procedural-web-composer/node-definitions-subgraph'
import { viewerNodeDefinitions } from '@procedural-web-composer/node-definitions-viewer'

const registryInstance = createNodeRegistry([
  ...layoutNodeDefinitions,
  ...basicNodeDefinitions,
  ...dataNodeDefinitions,
  ...eventNodeDefinitions,
  ...presentationNodeDefinitions,
  ...viewerNodeDefinitions,
  ...styleNodeDefinitions,
  ...subgraphNodeDefinitions,
])

freezeNodeRegistry(registryInstance)

export const registry = registryInstance
