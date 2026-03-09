import { z } from 'zod'
import type { UiNode } from '@procedural-web-composer/ui-tree'
import type { NodeDefinition } from '@procedural-web-composer/shared-types'

const parentInput = {
  key: 'parent',
  valueType: 'ui-node' as const,
}

const unknownOutput = {
  key: 'value',
  valueType: 'unknown' as const,
}

const repeatUiOutput = {
  key: 'ui',
  valueType: 'ui-node' as const,
}

const valueParamsSchema = z.object({
  value: z.unknown(),
}).passthrough()

const objectParamsSchema = z.object({
  value: z.record(z.unknown()),
}).passthrough()

const arrayParamsSchema = z.object({
  value: z.array(z.unknown()),
}).passthrough()

const conditionParamsSchema = z.object({
  condition: z.boolean().optional(),
  whenTrue: z.unknown().optional(),
  whenFalse: z.unknown().optional(),
}).passthrough()

const repeatParamsSchema = z.object({
  itemSubgraphGraphId: z.string().optional(),
}).passthrough()

const getParamsSchema = z.object({
  key: z.string().min(1),
}).passthrough()

export const dataValueNodeDefinition: NodeDefinition = {
  type: 'data.value',
  version: 1,
  title: 'Value',
  category: 'Data',
  inputs: [],
  outputs: [unknownOutput],
  defaultParams: {
    value: '',
  },
  paramsSchema: valueParamsSchema,
  evaluate: (node) => ({
    outputs: {
      value: node.params.value,
    },
  }),
}

export const dataObjectNodeDefinition: NodeDefinition = {
  type: 'data.object',
  version: 1,
  title: 'Object',
  category: 'Data',
  inputs: [],
  outputs: [
    {
      key: 'value',
      valueType: 'object',
    },
  ],
  defaultParams: {
    value: {},
  },
  paramsSchema: objectParamsSchema,
  evaluate: (node) => ({
    outputs: {
      value: node.params.value ?? {},
    },
  }),
}

export const dataArrayNodeDefinition: NodeDefinition = {
  type: 'data.array',
  version: 1,
  title: 'Array',
  category: 'Data',
  inputs: [],
  outputs: [
    {
      key: 'value',
      valueType: 'array',
    },
  ],
  defaultParams: {
    value: [],
  },
  paramsSchema: arrayParamsSchema,
  evaluate: (node) => ({
    outputs: {
      value: node.params.value ?? [],
    },
  }),
}

export const dataConditionNodeDefinition: NodeDefinition = {
  type: 'data.condition',
  version: 1,
  title: 'Condition',
  category: 'Data',
  inputs: [
    {
      key: 'condition',
      valueType: 'boolean',
      required: true,
    },
    {
      key: 'whenTrue',
      valueType: 'unknown',
    },
    {
      key: 'whenFalse',
      valueType: 'unknown',
    },
  ],
  outputs: [unknownOutput],
  defaultParams: {
    condition: false,
    whenTrue: null,
    whenFalse: null,
  },
  paramsSchema: conditionParamsSchema,
  evaluate: (node, ctx) => {
    const params = conditionParamsSchema.safeParse(node.params).success
      ? conditionParamsSchema.parse(node.params)
      : {
          condition: false,
          whenTrue: null,
          whenFalse: null,
        }
    const condition = ctx.getInput<boolean>('condition') ?? params.condition ?? false
    const whenTrue = ctx.getInput('whenTrue') ?? params.whenTrue
    const whenFalse = ctx.getInput('whenFalse') ?? params.whenFalse

    return {
      outputs: {
        value: condition ? whenTrue : whenFalse,
      },
    }
  },
}

export const dataRepeatNodeDefinition: NodeDefinition = {
  type: 'data.repeat',
  version: 1,
  title: 'Repeat',
  category: 'Data',
  inputs: [
    parentInput,
    {
      key: 'items',
      valueType: 'array',
      required: true,
    },
  ],
  outputs: [repeatUiOutput],
  defaultParams: {
    itemSubgraphGraphId: '',
  },
  paramsSchema: repeatParamsSchema,
  evaluate: (node) => {
    return {
      outputs: {
        ui: {
          id: node.id,
          kind: 'Fragment',
          props: {},
          children: [],
        } satisfies UiNode,
      },
    }
  },
}

export const dataGetNodeDefinition: NodeDefinition = {
  type: 'data.get',
  version: 1,
  title: 'Get',
  category: 'Data',
  inputs: [
    {
      key: 'object',
      valueType: 'unknown',
      required: true,
    },
  ],
  outputs: [unknownOutput],
  defaultParams: {
    key: '',
  },
  paramsSchema: getParamsSchema,
  evaluate: (node, ctx) => {
    const params = getParamsSchema.safeParse(node.params).success
      ? getParamsSchema.parse(node.params)
      : {
          key: '',
        }
    const objectValue = ctx.getInput<Record<string, unknown> | unknown[]>('object')

    if (Array.isArray(objectValue)) {
      const numericIndex = Number(params.key)

      return {
        outputs: {
          value: Number.isInteger(numericIndex) ? objectValue[numericIndex] : undefined,
        },
      }
    }

    return {
      outputs: {
        value:
          typeof objectValue === 'object' && objectValue !== null
            ? objectValue[params.key]
            : undefined,
      },
    }
  },
}

export const dataNodeDefinitions: NodeDefinition[] = [
  dataValueNodeDefinition,
  dataObjectNodeDefinition,
  dataArrayNodeDefinition,
  dataConditionNodeDefinition,
  dataRepeatNodeDefinition,
  dataGetNodeDefinition,
]
