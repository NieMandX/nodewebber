import { createNodeRegistry, freezeNodeRegistry } from '@procedural-web-composer/node-registry'
import { basicNodeDefinitions } from '@procedural-web-composer/node-definitions-basic'
import { layoutNodeDefinitions } from '@procedural-web-composer/node-definitions-layout'
import { styleNodeDefinitions } from '@procedural-web-composer/node-definitions-style'

const registryInstance = createNodeRegistry([
  ...layoutNodeDefinitions,
  ...basicNodeDefinitions,
  ...styleNodeDefinitions,
])

freezeNodeRegistry(registryInstance)

export const registry = registryInstance
