import { createNodeRegistry } from '@procedural-web-composer/node-registry'
import { basicNodeDefinitions } from '@procedural-web-composer/node-definitions-basic'
import { layoutNodeDefinitions } from '@procedural-web-composer/node-definitions-layout'
import { styleNodeDefinitions } from '@procedural-web-composer/node-definitions-style'

export const registry = createNodeRegistry([
  ...layoutNodeDefinitions,
  ...basicNodeDefinitions,
  ...styleNodeDefinitions,
])

