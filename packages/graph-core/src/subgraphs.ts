import type {
  GraphDocument,
  PortableParamSchema,
  PortableParamSchemaField,
  ProjectDocument,
  SubgraphDefinition,
} from '@procedural-web-composer/shared-types'

export function isReusableGraph(graph: GraphDocument): boolean {
  return graph.kind === 'subgraph' || graph.kind === 'component'
}

export function getSubgraphDefinitions(project: ProjectDocument): SubgraphDefinition[] {
  return project.graphs
    .filter(isReusableGraph)
    .map((graph) => ({
      graphId: graph.id,
      title: graph.name,
      publicParamsSchema: graph.subgraph?.publicParamsSchema ?? {},
      publicDefaultParams: graph.subgraph?.publicDefaultParams ?? {},
      publicSlots: resolvePublicSlots(graph.subgraph?.publicSlots),
    }))
}

export function getSubgraphDefinition(
  project: ProjectDocument,
  graphId: string,
): SubgraphDefinition | undefined {
  return getSubgraphDefinitions(project).find((definition) => definition.graphId === graphId)
}

export function validatePortableParamDefaults(
  schema: PortableParamSchema | undefined,
  defaults: Record<string, unknown> | undefined,
): string[] {
  const issues: string[] = []
  const resolvedSchema = schema ?? {}
  const resolvedDefaults = defaults ?? {}

  for (const [key, value] of Object.entries(resolvedDefaults)) {
    const field = resolvedSchema[key]

    if (!field) {
      issues.push(`Default "${key}" has no matching public schema field.`)
      continue
    }

    if (!matchesPortableParamField(field, value)) {
      issues.push(`Default "${key}" does not match public schema type "${field.type}".`)
    }
  }

  for (const key of Object.keys(resolvedSchema)) {
    if (!(key in resolvedDefaults)) {
      issues.push(`Public schema field "${key}" is missing a default value.`)
    }
  }

  return issues
}

export function matchesPortableParamField(
  field: PortableParamSchemaField,
  value: unknown,
): boolean {
  if (field.type === 'json') {
    return true
  }

  if (field.type === 'string') {
    return typeof value === 'string'
  }

  if (field.type === 'number') {
    return typeof value === 'number'
  }

  if (field.type === 'boolean') {
    return typeof value === 'boolean'
  }

  if (field.type === 'string-or-number') {
    return typeof value === 'string' || typeof value === 'number'
  }

  return typeof value === 'string' && (field.options?.includes(value) ?? false)
}

export function resolvePublicSlots(publicSlots: string[] | undefined): string[] {
  const normalized = (publicSlots ?? [])
    .map((slot) => slot.trim())
    .filter((slot) => slot.length > 0)

  const uniqueSlots = [...new Set(normalized)]

  return uniqueSlots.length > 0 ? uniqueSlots : ['children']
}
