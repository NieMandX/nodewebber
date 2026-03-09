import { z } from 'zod'
import { DEFAULT_THEME, normalizeThemeValue } from '@procedural-web-composer/shared-utils'
import type { NodeDefinition } from '@procedural-web-composer/shared-types'

const themeParamsSchema = z.object({
  colors: z.object({
    background: z.string(),
    surface: z.string(),
    text: z.string(),
    accent: z.string(),
  }),
  typography: z.object({
    fontFamily: z.string(),
    headingScale: z.number(),
    bodySize: z.string(),
  }),
}).passthrough()

export const themeNodeDefinition: NodeDefinition = {
  type: 'style.theme',
  version: 1,
  title: 'Theme',
  category: 'Style',
  inputs: [],
  outputs: [
    {
      key: 'theme',
      valueType: 'theme',
    },
  ],
  defaultParams: DEFAULT_THEME as unknown as Record<string, unknown>,
  paramsSchema: themeParamsSchema,
  evaluate: (node) => {
    return {
      outputs: {
        theme: normalizeThemeValue(node.params),
      },
    }
  },
}

export const styleNodeDefinitions: NodeDefinition[] = [themeNodeDefinition]
