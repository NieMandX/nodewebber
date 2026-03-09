import { z } from 'zod'
import type {
  NodeDefinition,
  PresentationActionConfig,
  PresentationStepConfig,
} from '@procedural-web-composer/shared-types'

const triggerInput = {
  key: 'trigger',
  valueType: 'event' as const,
}

const stepOutput = {
  key: 'step',
  valueType: 'object' as const,
}

const stepListOutput = {
  key: 'steps',
  valueType: 'array' as const,
}

const actionOutput = {
  key: 'action',
  valueType: 'object' as const,
}

const stringArraySchema = z.array(z.string()).optional()

const presentationStepParamsSchema = z
  .object({
    id: z.string(),
    label: z.string().optional(),
    title: z.string().optional(),
    description: z.string().optional(),
    viewerStateId: z.string().optional(),
    viewerVariantId: z.string().optional(),
    visibleSlots: stringArraySchema,
    visibleNodeIds: stringArraySchema,
    hiddenNodeIds: stringArraySchema,
    metadata: z.record(z.unknown()).optional(),
  })
  .passthrough()

const presentationSetStepParamsSchema = z
  .object({
    stepId: z.string().optional(),
  })
  .passthrough()

const emptyParamsSchema = z.object({}).passthrough()

const stepDefaultParams = {
  id: 'step-1',
  label: 'Step 1',
  title: '',
  description: '',
  viewerStateId: '',
  viewerVariantId: '',
  visibleSlots: [] as string[],
  visibleNodeIds: [] as string[],
  hiddenNodeIds: [] as string[],
  metadata: {},
}

export const presentationStepNodeDefinition: NodeDefinition = {
  type: 'presentation.step',
  version: 1,
  title: 'Presentation Step',
  category: 'Presentation',
  inputs: [],
  outputs: [stepOutput],
  defaultParams: stepDefaultParams,
  paramsSchema: presentationStepParamsSchema,
  evaluate: (node) => {
    const params = presentationStepParamsSchema.safeParse(node.params).success
      ? presentationStepParamsSchema.parse(node.params)
      : stepDefaultParams

    return {
      outputs: {
        step: toPresentationStepConfig(params),
      },
    }
  },
}

export const presentationStepsNodeDefinition: NodeDefinition = {
  type: 'presentation.steps',
  version: 1,
  title: 'Presentation Steps',
  category: 'Presentation',
  inputs: [
    {
      key: 'steps',
      valueType: 'object',
      multiple: true,
    },
  ],
  outputs: [stepListOutput],
  defaultParams: {},
  paramsSchema: emptyParamsSchema,
  evaluate: (_, ctx) => {
    const nodesById = new Map(ctx.graph.nodes.map((node) => [node.id, node]))
    const orderedEdges = [...ctx.getIncomingEdges({ kind: 'data', port: 'steps' })].sort((left, right) =>
      compareOrderedEdges(left, right, nodesById),
    )

    return {
      outputs: {
        steps: orderedEdges
          .map((edge) => ctx.getOutputFromNode<PresentationStepConfig>(edge.from.nodeId, edge.from.port))
          .filter((step): step is PresentationStepConfig => Boolean(step)),
      },
    }
  },
}

export const presentationSetStepNodeDefinition: NodeDefinition = {
  type: 'presentation.setStep',
  version: 1,
  title: 'Set Step',
  category: 'Presentation',
  inputs: [triggerInput],
  outputs: [actionOutput],
  defaultParams: {
    stepId: '',
  },
  paramsSchema: presentationSetStepParamsSchema,
  evaluate: (node) => {
    const params = presentationSetStepParamsSchema.safeParse(node.params).success
      ? presentationSetStepParamsSchema.parse(node.params)
      : {
          stepId: '',
        }

    return {
      outputs: {
        action: {
          type: 'setStep',
          stepId: params.stepId ?? '',
        } satisfies PresentationActionConfig,
      },
    }
  },
}

export const presentationNextStepNodeDefinition: NodeDefinition = {
  type: 'presentation.nextStep',
  version: 1,
  title: 'Next Step',
  category: 'Presentation',
  inputs: [triggerInput],
  outputs: [actionOutput],
  defaultParams: {},
  paramsSchema: emptyParamsSchema,
  evaluate: () => ({
    outputs: {
      action: {
        type: 'nextStep',
      } satisfies PresentationActionConfig,
    },
  }),
}

export const presentationPrevStepNodeDefinition: NodeDefinition = {
  type: 'presentation.prevStep',
  version: 1,
  title: 'Previous Step',
  category: 'Presentation',
  inputs: [triggerInput],
  outputs: [actionOutput],
  defaultParams: {},
  paramsSchema: emptyParamsSchema,
  evaluate: () => ({
    outputs: {
      action: {
        type: 'prevStep',
      } satisfies PresentationActionConfig,
    },
  }),
}

export const presentationTogglePlayNodeDefinition: NodeDefinition = {
  type: 'presentation.togglePlay',
  version: 1,
  title: 'Toggle Play',
  category: 'Presentation',
  inputs: [triggerInput],
  outputs: [actionOutput],
  defaultParams: {},
  paramsSchema: emptyParamsSchema,
  evaluate: () => ({
    outputs: {
      action: {
        type: 'togglePlay',
      } satisfies PresentationActionConfig,
    },
  }),
}

export const presentationNodeDefinitions: NodeDefinition[] = [
  presentationStepNodeDefinition,
  presentationStepsNodeDefinition,
  presentationSetStepNodeDefinition,
  presentationNextStepNodeDefinition,
  presentationPrevStepNodeDefinition,
  presentationTogglePlayNodeDefinition,
]

function toPresentationStepConfig(
  value: z.infer<typeof presentationStepParamsSchema>,
): PresentationStepConfig {
  return {
    id: value.id,
    ...(isNonEmptyString(value.label) ? { label: value.label } : {}),
    ...(isNonEmptyString(value.title) ? { title: value.title } : {}),
    ...(isNonEmptyString(value.description) ? { description: value.description } : {}),
    ...(isNonEmptyString(value.viewerStateId) ? { viewerStateId: value.viewerStateId } : {}),
    ...(isNonEmptyString(value.viewerVariantId)
      ? { viewerVariantId: value.viewerVariantId }
      : {}),
    ...(hasStringArray(value.visibleSlots) ? { visibleSlots: value.visibleSlots } : {}),
    ...(hasStringArray(value.visibleNodeIds) ? { visibleNodeIds: value.visibleNodeIds } : {}),
    ...(hasStringArray(value.hiddenNodeIds) ? { hiddenNodeIds: value.hiddenNodeIds } : {}),
    ...(isRecord(value.metadata) ? { metadata: value.metadata } : {}),
  }
}

function compareOrderedEdges(
  left: { from: { nodeId: string }; order?: number },
  right: { from: { nodeId: string }; order?: number },
  nodesById: Map<string, { position: { x: number; y: number } }>,
): number {
  const leftHasOrder = typeof left.order === 'number'
  const rightHasOrder = typeof right.order === 'number'

  if (leftHasOrder && rightHasOrder && left.order !== right.order) {
    return (left.order ?? 0) - (right.order ?? 0)
  }

  if (leftHasOrder !== rightHasOrder) {
    return leftHasOrder ? -1 : 1
  }

  const leftNode = nodesById.get(left.from.nodeId)
  const rightNode = nodesById.get(right.from.nodeId)

  if (!leftNode || !rightNode) {
    return 0
  }

  if (leftNode.position.y === rightNode.position.y) {
    return leftNode.position.x - rightNode.position.x
  }

  return leftNode.position.y - rightNode.position.y
}

function hasStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === 'string')
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}
