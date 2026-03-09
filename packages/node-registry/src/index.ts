import type {
  NodeDefinition,
  NodeDefinitionResolver,
} from '@procedural-web-composer/shared-types'

export class NodeRegistry implements NodeDefinitionResolver {
  private definitions = new Map<string, NodeDefinition>()
  private frozen = false

  registerNodeDefinition(definition: NodeDefinition): void {
    if (this.frozen) {
      throw new Error(`Node registry is frozen. Cannot register "${definition.type}".`)
    }

    if (this.definitions.has(definition.type)) {
      throw new Error(`Node definition "${definition.type}" is already registered.`)
    }

    this.definitions.set(definition.type, definition)
  }

  freeze(): void {
    this.frozen = true
  }

  isFrozen(): boolean {
    return this.frozen
  }

  getNodeDefinition(type: string): NodeDefinition | undefined {
    return this.definitions.get(type)
  }

  listNodeDefinitions(): NodeDefinition[] {
    return Array.from(this.definitions.values()).sort((left, right) =>
      left.category === right.category
        ? left.title.localeCompare(right.title)
        : left.category.localeCompare(right.category),
    )
  }
}

export function createNodeRegistry(definitions: NodeDefinition[] = []): NodeRegistry {
  const registry = new NodeRegistry()

  for (const definition of definitions) {
    registry.registerNodeDefinition(definition)
  }

  return registry
}

export function registerNodeDefinition(
  registry: NodeRegistry,
  definition: NodeDefinition,
): void {
  registry.registerNodeDefinition(definition)
}

export function registerNodeDefinitions(
  registry: NodeRegistry,
  definitions: NodeDefinition[],
): void {
  for (const definition of definitions) {
    registry.registerNodeDefinition(definition)
  }
}

export function getNodeDefinition(
  registry: NodeDefinitionResolver,
  type: string,
): NodeDefinition | undefined {
  return registry.getNodeDefinition(type)
}

export function listNodeDefinitions(registry: NodeDefinitionResolver): NodeDefinition[] {
  return registry.listNodeDefinitions()
}

export function freezeNodeRegistry(registry: NodeRegistry): NodeRegistry {
  registry.freeze()
  return registry
}
