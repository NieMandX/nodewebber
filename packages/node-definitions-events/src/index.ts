import { z } from 'zod'
import type {
  GraphEventPayload,
  NodeDefinition,
} from '@procedural-web-composer/shared-types'

const eventOutput = {
  key: 'event',
  valueType: 'event' as const,
}

const triggerInput = {
  key: 'trigger',
  valueType: 'event' as const,
  required: true,
}

const uiOnClickParamsSchema = z
  .object({
    eventName: z.string().optional(),
    targetNodeId: z.string().optional(),
  })
  .passthrough()

const setViewerStateParamsSchema = z
  .object({
    viewerBlockNodeId: z.string().optional(),
    stateId: z.string().optional(),
  })
  .passthrough()

const setViewerVariantParamsSchema = z
  .object({
    viewerBlockNodeId: z.string().optional(),
    variantId: z.string().optional(),
  })
  .passthrough()

const focusViewerCameraParamsSchema = z
  .object({
    viewerBlockNodeId: z.string().optional(),
    camera: z.record(z.unknown()).optional(),
    stateId: z.string().optional(),
  })
  .passthrough()

const emitParamsSchema = z
  .object({
    eventName: z.string().optional(),
    payload: z.record(z.unknown()).optional(),
  })
  .passthrough()

const logParamsSchema = z
  .object({
    label: z.string().optional(),
  })
  .passthrough()

export const uiOnClickNodeDefinition: NodeDefinition = {
  type: 'ui.onClick',
  version: 1,
  title: 'UI Click',
  category: 'Events',
  inputs: [],
  outputs: [eventOutput],
  defaultParams: {
    eventName: 'ui.click',
    targetNodeId: '',
  },
  paramsSchema: uiOnClickParamsSchema,
  evaluate: (node) => {
    const params = uiOnClickParamsSchema.safeParse(node.params).success
      ? uiOnClickParamsSchema.parse(node.params)
      : {
          eventName: 'ui.click',
          targetNodeId: '',
        }

    return {
      outputs: {
        event: {
          type: params.eventName ?? 'ui.click',
          sourceNodeId: node.id,
          ...(isNonEmptyString(params.targetNodeId)
            ? { data: { targetNodeId: params.targetNodeId } }
            : {}),
        } satisfies GraphEventPayload,
      },
    }
  },
}

export const setViewerStateNodeDefinition: NodeDefinition = {
  type: 'events.setViewerState',
  version: 1,
  title: 'Set Viewer State',
  category: 'Events',
  inputs: [triggerInput],
  outputs: [],
  defaultParams: {
    viewerBlockNodeId: '',
    stateId: '',
  },
  paramsSchema: setViewerStateParamsSchema,
  evaluate: () => ({
    outputs: {},
  }),
}

export const setViewerVariantNodeDefinition: NodeDefinition = {
  type: 'events.setViewerVariant',
  version: 1,
  title: 'Set Viewer Variant',
  category: 'Events',
  inputs: [triggerInput],
  outputs: [],
  defaultParams: {
    viewerBlockNodeId: '',
    variantId: '',
  },
  paramsSchema: setViewerVariantParamsSchema,
  evaluate: () => ({
    outputs: {},
  }),
}

export const focusViewerCameraNodeDefinition: NodeDefinition = {
  type: 'events.focusViewerCamera',
  version: 1,
  title: 'Focus Viewer Camera',
  category: 'Events',
  inputs: [triggerInput],
  outputs: [],
  defaultParams: {
    viewerBlockNodeId: '',
    camera: {},
    stateId: '',
  },
  paramsSchema: focusViewerCameraParamsSchema,
  evaluate: () => ({
    outputs: {},
  }),
}

export const emitEventNodeDefinition: NodeDefinition = {
  type: 'events.emit',
  version: 1,
  title: 'Emit Event',
  category: 'Events',
  inputs: [triggerInput],
  outputs: [eventOutput],
  defaultParams: {
    eventName: 'events.emit',
    payload: {},
  },
  paramsSchema: emitParamsSchema,
  evaluate: (node) => {
    const params = emitParamsSchema.safeParse(node.params).success
      ? emitParamsSchema.parse(node.params)
      : {
          eventName: 'events.emit',
          payload: {},
        }

    return {
      outputs: {
        event: {
          type: params.eventName ?? 'events.emit',
          sourceNodeId: node.id,
          ...(params.payload ? { data: params.payload } : {}),
        } satisfies GraphEventPayload,
      },
    }
  },
}

export const logEventNodeDefinition: NodeDefinition = {
  type: 'events.log',
  version: 1,
  title: 'Log Event',
  category: 'Events',
  inputs: [triggerInput],
  outputs: [],
  defaultParams: {
    label: '',
  },
  paramsSchema: logParamsSchema,
  evaluate: () => ({
    outputs: {},
  }),
}

export const eventNodeDefinitions: NodeDefinition[] = [
  uiOnClickNodeDefinition,
  setViewerStateNodeDefinition,
  setViewerVariantNodeDefinition,
  focusViewerCameraNodeDefinition,
  emitEventNodeDefinition,
  logEventNodeDefinition,
]

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}
