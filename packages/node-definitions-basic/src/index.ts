import { z } from 'zod'
import { formatCssUnit } from '@procedural-web-composer/shared-utils'
import type { UiNode } from '@procedural-web-composer/ui-tree'
import type { NodeDefinition } from '@procedural-web-composer/shared-types'

const parentInput = {
  key: 'parent',
  valueType: 'ui-node' as const,
}

const uiOutput = {
  key: 'ui',
  valueType: 'ui-node' as const,
}

const headingParamsSchema = z.object({
  text: z.string(),
  level: z.number().int().min(1).max(6),
  align: z.enum(['left', 'center', 'right']),
}).passthrough()

const textParamsSchema = z.object({
  text: z.string(),
}).passthrough()

const buttonParamsSchema = z.object({
  label: z.string(),
  href: z.string(),
  variant: z.enum(['solid', 'ghost']),
}).passthrough()

const imageParamsSchema = z.object({
  src: z.string(),
  alt: z.string(),
  fit: z.enum(['cover', 'contain']),
  height: z.union([z.number(), z.string()]),
}).passthrough()

const placeholderImage =
  'data:image/svg+xml;utf8,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22720%22 height=%22480%22 viewBox=%220 0 720 480%22%3E%3Crect width=%22720%22 height=%22480%22 rx=%2228%22 fill=%22%23ead6bf%22/%3E%3Ccircle cx=%22180%22 cy=%22140%22 r=%2252%22 fill=%22%23c96f36%22 opacity=%220.78%22/%3E%3Cpath d=%22M72 376L232 212l112 116 82-86 222 134H72Z%22 fill=%22%238b5a37%22 opacity=%220.82%22/%3E%3Ctext x=%2258%22 y=%2258%22 font-size=%2230%22 font-family=%22Arial%22 fill=%22%231f1b17%22%3EProcedural media%3C/text%3E%3C/svg%3E'

const headingDefaultParams = {
  text: 'Compose a page visually',
  level: 1,
  align: 'left',
}

const textDefaultParams = {
  text: 'Wire layout, content, and theme nodes into a renderable UI tree.',
}

const buttonDefaultParams = {
  label: 'Read the graph',
  href: '#',
  variant: 'solid',
}

const imageDefaultParams = {
  src: placeholderImage,
  alt: 'Placeholder artwork',
  fit: 'cover',
  height: 280,
}

export const headingNodeDefinition: NodeDefinition = {
  type: 'content.heading',
  version: 1,
  title: 'Heading',
  category: 'Content',
  inputs: [
    parentInput,
    {
      key: 'text',
      valueType: 'string',
    },
  ],
  outputs: [uiOutput],
  defaultParams: headingDefaultParams,
  paramsSchema: headingParamsSchema,
  evaluate: (node, ctx) => {
    const params = headingParamsSchema.safeParse(node.params).success
      ? headingParamsSchema.parse(node.params)
      : headingDefaultParams
    const text = ctx.getInput<string>('text') ?? params.text

    return {
      outputs: {
        ui: {
          id: node.id,
          kind: 'Heading',
          props: {
            text,
            level: params.level,
          },
          children: [],
          styles: {
            textAlign: params.align,
            margin: 0,
          },
        } satisfies UiNode,
      },
    }
  },
}

export const textNodeDefinition: NodeDefinition = {
  type: 'content.text',
  version: 1,
  title: 'Text',
  category: 'Content',
  inputs: [
    parentInput,
    {
      key: 'text',
      valueType: 'string',
    },
  ],
  outputs: [uiOutput],
  defaultParams: textDefaultParams,
  paramsSchema: textParamsSchema,
  evaluate: (node, ctx) => {
    const params = textParamsSchema.safeParse(node.params).success
      ? textParamsSchema.parse(node.params)
      : textDefaultParams
    const text = ctx.getInput<string>('text') ?? params.text

    return {
      outputs: {
        ui: {
          id: node.id,
          kind: 'Text',
          props: {
            text,
          },
          children: [],
          styles: {
            lineHeight: 1.6,
            margin: 0,
          },
        } satisfies UiNode,
      },
    }
  },
}

export const buttonNodeDefinition: NodeDefinition = {
  type: 'content.button',
  version: 1,
  title: 'Button',
  category: 'Content',
  inputs: [
    parentInput,
    {
      key: 'label',
      valueType: 'string',
    },
    {
      key: 'href',
      valueType: 'string',
    },
  ],
  outputs: [uiOutput],
  defaultParams: buttonDefaultParams,
  paramsSchema: buttonParamsSchema,
  evaluate: (node, ctx) => {
    const params = buttonParamsSchema.safeParse(node.params).success
      ? buttonParamsSchema.parse(node.params)
      : buttonDefaultParams
    const label = ctx.getInput<string>('label') ?? params.label
    const href = ctx.getInput<string>('href') ?? params.href

    return {
      outputs: {
        ui: {
          id: node.id,
          kind: 'Button',
          props: {
            label,
            href,
            variant: params.variant,
          },
          children: [],
          styles: {},
        } satisfies UiNode,
      },
    }
  },
}

export const imageNodeDefinition: NodeDefinition = {
  type: 'content.image',
  version: 1,
  title: 'Image',
  category: 'Content',
  inputs: [
    parentInput,
    {
      key: 'src',
      valueType: 'string',
    },
    {
      key: 'alt',
      valueType: 'string',
    },
  ],
  outputs: [uiOutput],
  defaultParams: imageDefaultParams,
  paramsSchema: imageParamsSchema,
  evaluate: (node, ctx) => {
    const params = imageParamsSchema.safeParse(node.params).success
      ? imageParamsSchema.parse(node.params)
      : imageDefaultParams
    const src = ctx.getInput<string>('src') ?? params.src
    const alt = ctx.getInput<string>('alt') ?? params.alt

    return {
      outputs: {
        ui: {
          id: node.id,
          kind: 'Image',
          props: {
            src,
            alt,
            fit: params.fit,
          },
          children: [],
          styles: {
            height: formatCssUnit(params.height, '280px'),
            width: '100%',
          },
        } satisfies UiNode,
      },
    }
  },
}

export const basicNodeDefinitions: NodeDefinition[] = [
  headingNodeDefinition,
  textNodeDefinition,
  buttonNodeDefinition,
  imageNodeDefinition,
]
