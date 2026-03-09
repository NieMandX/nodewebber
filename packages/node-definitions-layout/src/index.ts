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

const pageParamsSchema = z.object({
  maxWidth: z.union([z.number(), z.string()]),
  padding: z.union([z.number(), z.string()]),
}).passthrough()

const sectionParamsSchema = z.object({
  paddingY: z.union([z.number(), z.string()]),
  background: z.string(),
}).passthrough()

const stackParamsSchema = z.object({
  direction: z.enum(['row', 'column']),
  gap: z.union([z.number(), z.string()]),
  align: z.enum(['start', 'center', 'end', 'stretch']),
}).passthrough()

const pageDefaultParams = {
  maxWidth: 1120,
  padding: 32,
}

const sectionDefaultParams = {
  paddingY: 24,
  background: 'transparent',
}

const stackDefaultParams: {
  direction: 'row' | 'column'
  gap: number
  align: 'start' | 'center' | 'end' | 'stretch'
} = {
  direction: 'column',
  gap: 16,
  align: 'stretch',
}

export const pageNodeDefinition: NodeDefinition = {
  type: 'layout.page',
  version: 1,
  title: 'Page',
  category: 'Layout',
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
          props: {},
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
          props: {},
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

export const layoutNodeDefinitions: NodeDefinition[] = [
  pageNodeDefinition,
  sectionNodeDefinition,
  stackNodeDefinition,
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
