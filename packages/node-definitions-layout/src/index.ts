import { z } from 'zod'
import { DEFAULT_THEME, formatCssUnit, normalizeThemeValue } from '@procedural-web-composer/shared-utils'
import type { UiNode } from '@procedural-web-composer/ui-tree'
import type { NodeDefinition, ThemeValue } from '@procedural-web-composer/shared-types'

const layoutParentInput = {
  key: 'parent',
  valueType: 'ui-node' as const,
}

const uiOutput = {
  key: 'ui',
  valueType: 'ui-node' as const,
}

const pageSlots = ['children'] as const
const sectionSlots = ['children'] as const
const stackSlots = ['children'] as const
const shellSlots = ['children', 'header', 'body', 'footer'] as const

const visibilitySchemaFields = {
  visibleOnSteps: z.array(z.string()).optional(),
  hiddenOnSteps: z.array(z.string()).optional(),
}

const pageParamsSchema = z.object({
  maxWidth: z.union([z.number(), z.string()]),
  padding: z.union([z.number(), z.string()]),
  ...visibilitySchemaFields,
}).passthrough()

const sectionParamsSchema = z.object({
  paddingY: z.union([z.number(), z.string()]),
  background: z.string(),
  ...visibilitySchemaFields,
}).passthrough()

const stackParamsSchema = z.object({
  direction: z.enum(['row', 'column']),
  gap: z.union([z.number(), z.string()]),
  align: z.enum(['start', 'center', 'end', 'stretch']),
  ...visibilitySchemaFields,
}).passthrough()

const shellParamsSchema = z.object({
  padding: z.union([z.number(), z.string()]),
  gap: z.union([z.number(), z.string()]),
  background: z.string(),
  ...visibilitySchemaFields,
}).passthrough()

const pageDefaultParams = {
  maxWidth: 1120,
  padding: 32,
  visibleOnSteps: [] as string[],
  hiddenOnSteps: [] as string[],
}

const sectionDefaultParams = {
  paddingY: 24,
  background: 'transparent',
  visibleOnSteps: [] as string[],
  hiddenOnSteps: [] as string[],
}

const stackDefaultParams: {
  direction: 'row' | 'column'
  gap: number
  align: 'start' | 'center' | 'end' | 'stretch'
  visibleOnSteps: string[]
  hiddenOnSteps: string[]
} = {
  direction: 'column',
  gap: 16,
  align: 'stretch',
  visibleOnSteps: [],
  hiddenOnSteps: [],
}

const shellDefaultParams = {
  padding: 24,
  gap: 20,
  background: 'rgba(255,255,255,0.42)',
  visibleOnSteps: [] as string[],
  hiddenOnSteps: [] as string[],
}

export const pageNodeDefinition: NodeDefinition = {
  type: 'layout.page',
  version: 1,
  title: 'Page',
  category: 'Layout',
  slots: [...pageSlots],
  inputs: [
    {
      key: 'theme',
      valueType: 'theme',
    },
  ],
  outputs: [uiOutput],
  defaultParams: pageDefaultParams,
  paramsSchema: pageParamsSchema,
  evaluate: (node, ctx) => {
    const params = pageParamsSchema.safeParse(node.params).success
      ? pageParamsSchema.parse(node.params)
      : pageDefaultParams
    const theme = normalizeThemeValue(ctx.getInput<ThemeValue>('theme') ?? DEFAULT_THEME)
    const ui: UiNode = {
      id: node.id,
      kind: 'Page',
      props: {
        theme,
        maxWidth: params.maxWidth,
        ...getVisibilityProps(params),
      },
      children: [],
      styles: {
        minHeight: '100vh',
        padding: formatCssUnit(params.padding, '32px'),
        backgroundColor: theme.colors.background,
        color: theme.colors.text,
        fontFamily: theme.typography.fontFamily,
      },
    }

    return {
      outputs: {
        ui,
      },
    }
  },
}

export const sectionNodeDefinition: NodeDefinition = {
  type: 'layout.section',
  version: 1,
  title: 'Section',
  category: 'Layout',
  slots: [...sectionSlots],
  inputs: [layoutParentInput],
  outputs: [uiOutput],
  defaultParams: sectionDefaultParams,
  paramsSchema: sectionParamsSchema,
  evaluate: (node) => {
    const params = sectionParamsSchema.safeParse(node.params).success
      ? sectionParamsSchema.parse(node.params)
      : sectionDefaultParams

    return {
      outputs: {
        ui: {
          id: node.id,
          kind: 'Section',
          props: {
            ...getVisibilityProps(params),
          },
          children: [],
          styles: {
            paddingBlock: formatCssUnit(params.paddingY, '24px'),
            background: params.background,
          },
        } satisfies UiNode,
      },
    }
  },
}

export const stackNodeDefinition: NodeDefinition = {
  type: 'layout.stack',
  version: 1,
  title: 'Stack',
  category: 'Layout',
  slots: [...stackSlots],
  inputs: [layoutParentInput],
  outputs: [uiOutput],
  defaultParams: stackDefaultParams,
  paramsSchema: stackParamsSchema,
  evaluate: (node) => {
    const params = stackParamsSchema.safeParse(node.params).success
      ? stackParamsSchema.parse(node.params)
      : stackDefaultParams

    return {
      outputs: {
        ui: {
          id: node.id,
          kind: 'Stack',
          props: {
            ...getVisibilityProps(params),
          },
          children: [],
          styles: {
            display: 'flex',
            flexDirection: params.direction,
            gap: formatCssUnit(params.gap, '16px'),
            alignItems: normalizeAlign(params.align),
          },
        } satisfies UiNode,
      },
    }
  },
}

export const shellNodeDefinition: NodeDefinition = {
  type: 'layout.shell',
  version: 1,
  title: 'Shell',
  category: 'Layout',
  slots: [...shellSlots],
  inputs: [layoutParentInput],
  outputs: [uiOutput],
  defaultParams: shellDefaultParams,
  paramsSchema: shellParamsSchema,
  evaluate: (node) => {
    const params = shellParamsSchema.safeParse(node.params).success
      ? shellParamsSchema.parse(node.params)
      : shellDefaultParams

    return {
      outputs: {
        ui: {
          id: node.id,
          kind: 'Shell',
          props: {
            ...getVisibilityProps(params),
          },
          children: [],
          styles: {
            display: 'grid',
            gap: formatCssUnit(params.gap, '20px'),
            padding: formatCssUnit(params.padding, '24px'),
            background: params.background,
          },
        } satisfies UiNode,
      },
    }
  },
}

export const layoutNodeDefinitions: NodeDefinition[] = [
  pageNodeDefinition,
  sectionNodeDefinition,
  stackNodeDefinition,
  shellNodeDefinition,
]

function normalizeAlign(value: 'start' | 'center' | 'end' | 'stretch'): string {
  if (value === 'start') {
    return 'flex-start'
  }

  if (value === 'end') {
    return 'flex-end'
  }

  return value
}

function getVisibilityProps(params: Record<string, unknown>): Record<string, unknown> {
  const visibleOnSteps = params.visibleOnSteps
  const hiddenOnSteps = params.hiddenOnSteps

  return {
    ...(hasStringArray(visibleOnSteps) && visibleOnSteps.length > 0
      ? { visibleOnSteps }
      : {}),
    ...(hasStringArray(hiddenOnSteps) && hiddenOnSteps.length > 0
      ? { hiddenOnSteps }
      : {}),
  }
}

function hasStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === 'string')
}
