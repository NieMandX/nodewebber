import { z } from 'zod'
import type { NodeDefinition } from '@procedural-web-composer/shared-types'

const parentInput = {
  key: 'parent',
  valueType: 'ui-node' as const,
}

const uiOutput = {
  key: 'ui',
  valueType: 'ui-node' as const,
}

const valueOutput = {
  key: 'value',
  valueType: 'unknown' as const,
}

const subgraphInstanceParamsSchema = z.object({
  subgraphGraphId: z.string().min(1),
}).passthrough()

const subgraphParamParamsSchema = z.object({
  key: z.string().min(1),
  fallbackValue: z.unknown().optional(),
}).passthrough()

export const subgraphInstanceNodeDefinition: NodeDefinition = {
  type: 'subgraph.instance',
  version: 1,
  title: 'Component Instance',
  category: 'Subgraph',
  inputs: [parentInput],
  outputs: [uiOutput],
  defaultParams: {
    subgraphGraphId: '',
  },
  paramsSchema: subgraphInstanceParamsSchema,
  evaluate: () => ({
    outputs: {},
  }),
}

export const subgraphParamNodeDefinition: NodeDefinition = {
  type: 'subgraph.param',
  version: 1,
  title: 'Public Param',
  category: 'Subgraph',
  inputs: [],
  outputs: [valueOutput],
  defaultParams: {
    key: 'value',
    fallbackValue: '',
  },
  paramsSchema: subgraphParamParamsSchema,
  evaluate: (node, ctx) => {
    const params = subgraphParamParamsSchema.safeParse(node.params).success
      ? subgraphParamParamsSchema.parse(node.params)
      : {
          key: 'value',
          fallbackValue: '',
        }
    const runtimeValue = node.params.__resolvedValue
    const hasRuntimeValue = '__resolvedValue' in node.params
    const issues =
      !hasRuntimeValue && ctx.graph.kind === 'subgraph'
        ? [
            {
              code: 'subgraph_param_unbound',
              message: `Public param "${params.key}" is using its fallback value.`,
              severity: 'warning' as const,
            },
          ]
        : undefined

    return {
      outputs: {
        value: hasRuntimeValue ? runtimeValue : params.fallbackValue,
      },
      ...(issues ? { issues } : {}),
    }
  },
}

export const subgraphNodeDefinitions: NodeDefinition[] = [
  subgraphInstanceNodeDefinition,
  subgraphParamNodeDefinition,
]
