import { z } from 'zod'

export const valueTypeSchema = z.enum([
  'string',
  'number',
  'boolean',
  'unknown',
  'object',
  'array',
  'ui-node',
  'ui-children',
  'style-token',
  'theme',
])

export const portableParamSchemaFieldSchema = z.object({
  type: z.enum(['string', 'number', 'boolean', 'enum', 'json', 'string-or-number']),
  options: z.array(z.string()).optional(),
})

export const graphSubgraphMetadataSchema = z.object({
  publicParamsSchema: z.record(portableParamSchemaFieldSchema).optional(),
  publicDefaultParams: z.record(z.unknown()).optional(),
})

export const positionSchema = z.object({
  x: z.number(),
  y: z.number(),
})

export const nodeInstanceSchema = z.object({
  id: z.string().min(1),
  type: z.string().min(1),
  version: z.number().int().nonnegative(),
  label: z.string().min(1).optional(),
  position: positionSchema,
  params: z.record(z.unknown()),
  ui: z
    .object({
      collapsed: z.boolean().optional(),
      width: z.number().positive().optional(),
    })
    .optional(),
})

export const edgeEndpointSchema = z.object({
  nodeId: z.string().min(1),
  port: z.string().min(1),
})

export const edgeInstanceSchema = z.object({
  id: z.string().min(1),
  from: edgeEndpointSchema,
  to: edgeEndpointSchema,
  kind: z.enum(['data', 'structure', 'style', 'event']),
  order: z.number().optional(),
})

export const graphDocumentSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  kind: z.enum(['page', 'component', 'subgraph']),
  nodes: z.array(nodeInstanceSchema),
  edges: z.array(edgeInstanceSchema),
  subgraph: graphSubgraphMetadataSchema.optional(),
  viewport: z
    .object({
      x: z.number(),
      y: z.number(),
      zoom: z.number(),
    })
    .optional(),
})

export const assetReferenceSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(['image', 'video', 'file']),
  name: z.string().min(1),
  url: z.string().url(),
})

export const projectDocumentSchema = z.object({
  version: z.string().min(1),
  meta: z.object({
    id: z.string().min(1),
    name: z.string().min(1),
    createdAt: z.string().min(1),
    updatedAt: z.string().min(1),
  }),
  settings: z.object({
    entryGraphId: z.string().min(1),
    themeMode: z.enum(['light', 'dark']).optional(),
  }),
  graphs: z.array(graphDocumentSchema),
  assets: z.array(assetReferenceSchema),
})
