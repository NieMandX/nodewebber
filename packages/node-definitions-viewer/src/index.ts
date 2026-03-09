import { z } from 'zod'
import type { UiNode } from '@procedural-web-composer/ui-tree'
import type {
  NodeDefinition,
  ViewerActionConfig,
  ViewerBlockProps,
  ViewerCameraConfig,
  ViewerEnvironmentConfig,
  ViewerHotspotConfig,
  ViewerModelConfig,
  ViewerSceneStateConfig,
  ViewerVariantConfig,
} from '@procedural-web-composer/shared-types'

const parentInput = {
  key: 'parent',
  valueType: 'ui-node' as const,
}

const uiOutput = {
  key: 'ui',
  valueType: 'ui-node' as const,
}

const hotspotOutput = {
  key: 'hotspot',
  valueType: 'object' as const,
}

const hotspotListOutput = {
  key: 'hotspots',
  valueType: 'array' as const,
}

const sceneStateOutput = {
  key: 'sceneState',
  valueType: 'object' as const,
}

const sceneStateListOutput = {
  key: 'states',
  valueType: 'array' as const,
}

const viewerActionOutput = {
  key: 'viewerAction',
  valueType: 'object' as const,
}

const variantOutput = {
  key: 'variant',
  valueType: 'object' as const,
}

const variantListOutput = {
  key: 'variants',
  valueType: 'array' as const,
}

const loadingModeSchema = z.enum(['eager', 'lazy'])
const stateTransitionModeSchema = z.enum(['instant', 'soft'])
const viewerPositionSchema = z.object({
  x: z.number(),
  y: z.number(),
  z: z.number(),
})

const viewerBlockParamsSchema = z
  .object({
    title: z.string().optional(),
    description: z.string().optional(),
    modelSrc: z.string().optional(),
    posterImage: z.string().optional(),
    allowOrbit: z.boolean().optional(),
    showToolbar: z.boolean().optional(),
    loadingMode: loadingModeSchema.optional(),
    background: z.string().optional(),
    exposure: z.number().optional(),
    model: z.record(z.unknown()).optional(),
    environment: z.record(z.unknown()).optional(),
    camera: z.record(z.unknown()).optional(),
    hotspots: z.array(z.record(z.unknown())).optional(),
    states: z.array(z.record(z.unknown())).optional(),
    variants: z.array(z.record(z.unknown())).optional(),
    initialStateId: z.string().optional(),
    activeStateId: z.string().optional(),
    activeVariantId: z.string().optional(),
    interactionsEnabled: z.boolean().optional(),
    stateTransitionMode: stateTransitionModeSchema.optional(),
  })
  .passthrough()

const viewerModelParamsSchema = z
  .object({
    src: z.string().optional(),
    format: z.enum(['gltf', 'glb', 'fbx', 'auto']).optional(),
    alt: z.string().optional(),
  })
  .passthrough()

const viewerEnvironmentParamsSchema = z
  .object({
    type: z.enum(['color', 'hdri']).optional(),
    color: z.string().optional(),
    hdriSrc: z.string().optional(),
    intensity: z.number().optional(),
    rotation: z.number().optional(),
  })
  .passthrough()

const viewerCameraParamsSchema = z
  .object({
    mode: z.enum(['orbit', 'fixed']).optional(),
    position: viewerPositionSchema.optional(),
    target: viewerPositionSchema.optional(),
    fov: z.number().optional(),
    minDistance: z.number().optional(),
    maxDistance: z.number().optional(),
  })
  .passthrough()

const viewerStateParamsSchema = z
  .object({
    id: z.string().optional(),
    label: z.string().optional(),
    camera: z.record(z.unknown()).optional(),
    environment: z.record(z.unknown()).optional(),
    activeVariantId: z.string().optional(),
    activeHotspotId: z.string().optional(),
    titleOverride: z.string().optional(),
    descriptionOverride: z.string().optional(),
    metadata: z.record(z.unknown()).optional(),
  })
  .passthrough()

const viewerVariantParamsSchema = z
  .object({
    id: z.string().optional(),
    label: z.string().optional(),
    modelSrc: z.string().optional(),
    environmentOverride: z.record(z.unknown()).optional(),
  })
  .passthrough()

const viewerActionParamsSchema = z
  .object({
    stateId: z.string().optional(),
    variantId: z.string().optional(),
    hotspotId: z.string().optional(),
    camera: z.record(z.unknown()).optional(),
  })
  .passthrough()

const viewerHotspotParamsSchema = z
  .object({
    id: z.string().optional(),
    label: z.string().optional(),
    description: z.string().optional(),
    position: viewerPositionSchema.optional(),
    onClickAction: z.record(z.unknown()).optional(),
    linkedStateId: z.string().optional(),
  })
  .passthrough()

const viewerOverlayParamsSchema = z
  .object({
    title: z.string().optional(),
    description: z.string().optional(),
    position: z.enum(['top-left', 'top-right', 'bottom-left', 'bottom-right']).optional(),
  })
  .passthrough()

const viewerBlockDefaultParams = {
  title: 'Viewer',
  description: '',
  modelSrc: '',
  posterImage: '',
  allowOrbit: true,
  showToolbar: true,
  loadingMode: 'lazy' as const,
  background: '#0f1724',
  exposure: 1,
  model: {},
  environment: {
    type: 'color',
    color: '#0f1724',
    intensity: 1,
    rotation: 0,
  },
  camera: {
    mode: 'orbit',
    position: { x: 2.6, y: 1.4, z: 3.6 },
    target: { x: 0, y: 0, z: 0 },
    fov: 40,
    minDistance: 1.5,
    maxDistance: 6,
  },
  hotspots: [] as ViewerHotspotConfig[],
  states: [] as ViewerSceneStateConfig[],
  variants: [] as ViewerVariantConfig[],
  initialStateId: '',
  activeStateId: '',
  activeVariantId: '',
  interactionsEnabled: true,
  stateTransitionMode: 'soft' as const,
}

const viewerModelDefaultParams = {
  src: '',
  format: 'auto' as const,
  alt: '',
}

const viewerEnvironmentDefaultParams = {
  type: 'color' as const,
  color: '#0f1724',
  hdriSrc: '',
  intensity: 1,
  rotation: 0,
}

const viewerCameraDefaultParams = {
  mode: 'orbit' as const,
  position: { x: 2.6, y: 1.4, z: 3.6 },
  target: { x: 0, y: 0, z: 0 },
  fov: 40,
  minDistance: 1.5,
  maxDistance: 6,
}

const viewerStateDefaultParams = {
  id: 'default',
  label: 'Default state',
  camera: {},
  environment: {},
  activeVariantId: '',
  activeHotspotId: '',
  titleOverride: '',
  descriptionOverride: '',
  metadata: {},
}

const viewerVariantDefaultParams = {
  id: 'default',
  label: 'Default variant',
  modelSrc: '',
  environmentOverride: {},
}

const viewerActionDefaultParams = {
  stateId: '',
  variantId: '',
  hotspotId: '',
  camera: {},
}

const viewerHotspotDefaultParams = {
  id: '',
  label: 'Hotspot',
  description: '',
  position: { x: 0, y: 0, z: 0 },
  onClickAction: {},
  linkedStateId: '',
}

const viewerOverlayDefaultParams = {
  title: 'Viewer overlay',
  description: '',
  position: 'top-right' as const,
}

export const viewerBlockNodeDefinition: NodeDefinition = {
  type: 'viewer.block',
  version: 1,
  title: 'Viewer Block',
  category: 'Viewer',
  slots: ['children', 'overlay'],
  inputs: [
    parentInput,
    { key: 'model', valueType: 'object' },
    { key: 'environment', valueType: 'object' },
    { key: 'camera', valueType: 'object' },
    { key: 'hotspots', valueType: 'array' },
    { key: 'states', valueType: 'array' },
    { key: 'initialState', valueType: 'string' },
    { key: 'activeState', valueType: 'string' },
    { key: 'variants', valueType: 'array' },
    { key: 'variant', valueType: 'string' },
    { key: 'interactionsEnabled', valueType: 'boolean' },
  ],
  outputs: [uiOutput],
  defaultParams: viewerBlockDefaultParams,
  paramsSchema: viewerBlockParamsSchema,
  evaluate: (node, ctx) => {
    const params = viewerBlockParamsSchema.safeParse(node.params).success
      ? viewerBlockParamsSchema.parse(node.params)
      : viewerBlockDefaultParams
    const fallbackModel = asRecord(params.model)
    const resolvedModel =
      ctx.getInput<ViewerModelConfig>('model') ??
      (fallbackModel as ViewerModelConfig | undefined) ??
      (isNonEmptyString(params.modelSrc)
        ? {
            src: params.modelSrc,
            format: 'auto',
          }
        : undefined)
    const resolvedEnvironment =
      ctx.getInput<ViewerEnvironmentConfig>('environment') ??
      (asRecord(params.environment) as ViewerEnvironmentConfig | undefined)
    const resolvedCamera =
      ctx.getInput<ViewerCameraConfig>('camera') ??
      (asRecord(params.camera) as ViewerCameraConfig | undefined)
    const resolvedHotspots =
      ctx.getInput<ViewerHotspotConfig[]>('hotspots') ?? asHotspotList(params.hotspots)
    const resolvedStates =
      ctx.getInput<ViewerSceneStateConfig[]>('states') ?? asSceneStateList(params.states)
    const resolvedVariants =
      ctx.getInput<ViewerVariantConfig[]>('variants') ?? asVariantList(params.variants)
    const resolvedInitialStateId =
      readInputString(ctx.getInput('initialState')) ?? readString(params.initialStateId)
    const resolvedActiveStateId =
      readInputString(ctx.getInput('activeState')) ?? readString(params.activeStateId)
    const resolvedActiveVariantId =
      readInputString(ctx.getInput('variant')) ?? readString(params.activeVariantId)
    const interactionsEnabled =
      ctx.getInput<boolean>('interactionsEnabled') ?? params.interactionsEnabled ?? true
    const props: ViewerBlockProps = {
      ...(isNonEmptyString(params.title) ? { title: params.title } : {}),
      ...(isNonEmptyString(params.description) ? { description: params.description } : {}),
      ...(isNonEmptyString(params.posterImage) ? { posterImage: params.posterImage } : {}),
      ...(isNonEmptyString(params.background) ? { background: params.background } : {}),
      ...(typeof params.exposure === 'number' ? { exposure: params.exposure } : {}),
      allowOrbit: params.allowOrbit ?? true,
      showToolbar: params.showToolbar ?? true,
      loadingMode: params.loadingMode ?? 'lazy',
      interactionsEnabled,
      stateTransitionMode: params.stateTransitionMode ?? 'soft',
      ...(resolvedModel ? { model: resolvedModel, modelSrc: resolvedModel.src } : {}),
      ...(resolvedEnvironment ? { environment: resolvedEnvironment } : {}),
      ...(resolvedCamera ? { cameraPreset: resolvedCamera } : {}),
      ...(resolvedHotspots.length > 0 ? { hotspots: resolvedHotspots } : {}),
      ...(resolvedStates.length > 0 ? { states: resolvedStates } : {}),
      ...(resolvedVariants.length > 0 ? { variants: resolvedVariants } : {}),
      ...(resolvedInitialStateId ? { initialStateId: resolvedInitialStateId } : {}),
      ...(resolvedActiveStateId ? { activeStateId: resolvedActiveStateId } : {}),
      ...(resolvedActiveVariantId ? { activeVariantId: resolvedActiveVariantId } : {}),
    }

    return {
      outputs: {
        ui: {
          id: node.id,
          kind: 'ViewerBlock',
          props: props as Record<string, unknown>,
          children: [],
          styles: {
            background: params.background ?? viewerBlockDefaultParams.background,
            borderRadius: '24px',
            overflow: 'hidden',
          },
        } satisfies UiNode,
      },
    }
  },
}

export const viewerModelNodeDefinition: NodeDefinition = {
  type: 'viewer.model',
  version: 1,
  title: 'Model',
  category: 'Viewer',
  inputs: [],
  outputs: [{ key: 'model', valueType: 'object' }],
  defaultParams: viewerModelDefaultParams,
  paramsSchema: viewerModelParamsSchema,
  evaluate: (node) => {
    const params = viewerModelParamsSchema.safeParse(node.params).success
      ? viewerModelParamsSchema.parse(node.params)
      : viewerModelDefaultParams

    return {
      outputs: {
        model: {
          src: params.src ?? '',
          format: params.format ?? 'auto',
          ...(isNonEmptyString(params.alt) ? { alt: params.alt } : {}),
        } satisfies ViewerModelConfig,
      },
    }
  },
}

export const viewerEnvironmentNodeDefinition: NodeDefinition = {
  type: 'viewer.environment',
  version: 1,
  title: 'Environment',
  category: 'Viewer',
  inputs: [],
  outputs: [{ key: 'environment', valueType: 'object' }],
  defaultParams: viewerEnvironmentDefaultParams,
  paramsSchema: viewerEnvironmentParamsSchema,
  evaluate: (node) => {
    const params = viewerEnvironmentParamsSchema.safeParse(node.params).success
      ? viewerEnvironmentParamsSchema.parse(node.params)
      : viewerEnvironmentDefaultParams

    return {
      outputs: {
        environment: {
          type: params.type ?? 'color',
          ...(isNonEmptyString(params.color) ? { color: params.color } : {}),
          ...(isNonEmptyString(params.hdriSrc) ? { hdriSrc: params.hdriSrc } : {}),
          ...(typeof params.intensity === 'number' ? { intensity: params.intensity } : {}),
          ...(typeof params.rotation === 'number' ? { rotation: params.rotation } : {}),
        } satisfies ViewerEnvironmentConfig,
      },
    }
  },
}

export const viewerCameraPresetNodeDefinition: NodeDefinition = {
  type: 'viewer.cameraPreset',
  version: 1,
  title: 'Camera Preset',
  category: 'Viewer',
  inputs: [],
  outputs: [{ key: 'camera', valueType: 'object' }],
  defaultParams: viewerCameraDefaultParams,
  paramsSchema: viewerCameraParamsSchema,
  evaluate: (node) => {
    const params = viewerCameraParamsSchema.safeParse(node.params).success
      ? viewerCameraParamsSchema.parse(node.params)
      : viewerCameraDefaultParams

    return {
      outputs: {
        camera: {
          mode: params.mode ?? 'orbit',
          ...(params.position ? { position: params.position } : {}),
          ...(params.target ? { target: params.target } : {}),
          ...(typeof params.fov === 'number' ? { fov: params.fov } : {}),
          ...(typeof params.minDistance === 'number' ? { minDistance: params.minDistance } : {}),
          ...(typeof params.maxDistance === 'number' ? { maxDistance: params.maxDistance } : {}),
        } satisfies ViewerCameraConfig,
      },
    }
  },
}

export const viewerStateNodeDefinition: NodeDefinition = {
  type: 'viewer.state',
  version: 1,
  title: 'Scene State',
  category: 'Viewer',
  inputs: [],
  outputs: [sceneStateOutput],
  defaultParams: viewerStateDefaultParams,
  paramsSchema: viewerStateParamsSchema,
  evaluate: (node) => {
    const params = viewerStateParamsSchema.safeParse(node.params).success
      ? viewerStateParamsSchema.parse(node.params)
      : viewerStateDefaultParams
    const camera = asRecord(params.camera)
    const environment = asRecord(params.environment)
    const metadata = asRecord(params.metadata)

    return {
      outputs: {
        sceneState: {
          id: readString(params.id) ?? node.id,
          ...(isNonEmptyString(params.label) ? { label: params.label } : {}),
          ...(camera ? { camera: camera as ViewerCameraConfig } : {}),
          ...(environment ? { environment: environment as ViewerEnvironmentConfig } : {}),
          ...(isNonEmptyString(params.activeVariantId)
            ? { activeVariantId: params.activeVariantId }
            : {}),
          ...(isNonEmptyString(params.activeHotspotId)
            ? { activeHotspotId: params.activeHotspotId }
            : {}),
          ...(isNonEmptyString(params.titleOverride)
            ? { titleOverride: params.titleOverride }
            : {}),
          ...(isNonEmptyString(params.descriptionOverride)
            ? { descriptionOverride: params.descriptionOverride }
            : {}),
          ...(metadata ? { metadata } : {}),
        } satisfies ViewerSceneStateConfig,
      },
    }
  },
}

export const viewerStatesNodeDefinition: NodeDefinition = {
  type: 'viewer.states',
  version: 1,
  title: 'Scene States',
  category: 'Viewer',
  inputs: [{ key: 'states', valueType: 'object', multiple: true }],
  outputs: [sceneStateListOutput],
  defaultParams: {},
  paramsSchema: z.object({}).passthrough(),
  evaluate: (_, ctx) => ({
    outputs: {
      states: ctx.getInputs<ViewerSceneStateConfig>('states'),
    },
  }),
}

export const viewerVariantNodeDefinition: NodeDefinition = {
  type: 'viewer.variant',
  version: 1,
  title: 'Variant',
  category: 'Viewer',
  inputs: [],
  outputs: [variantOutput],
  defaultParams: viewerVariantDefaultParams,
  paramsSchema: viewerVariantParamsSchema,
  evaluate: (node) => {
    const params = viewerVariantParamsSchema.safeParse(node.params).success
      ? viewerVariantParamsSchema.parse(node.params)
      : viewerVariantDefaultParams

    return {
      outputs: {
        variant: {
          id: readString(params.id) ?? node.id,
          ...(isNonEmptyString(params.label) ? { label: params.label } : {}),
          ...(isNonEmptyString(params.modelSrc) ? { modelSrc: params.modelSrc } : {}),
          ...(asRecord(params.environmentOverride)
            ? { environmentOverride: params.environmentOverride as ViewerEnvironmentConfig }
            : {}),
        } satisfies ViewerVariantConfig,
      },
    }
  },
}

export const viewerVariantsNodeDefinition: NodeDefinition = {
  type: 'viewer.variants',
  version: 1,
  title: 'Variants',
  category: 'Viewer',
  inputs: [{ key: 'variants', valueType: 'object', multiple: true }],
  outputs: [variantListOutput],
  defaultParams: {},
  paramsSchema: z.object({}).passthrough(),
  evaluate: (_, ctx) => ({
    outputs: {
      variants: ctx.getInputs<ViewerVariantConfig>('variants'),
    },
  }),
}

export const viewerFocusCameraNodeDefinition: NodeDefinition = {
  type: 'viewer.focusCamera',
  version: 1,
  title: 'Focus Camera',
  category: 'Viewer',
  inputs: [],
  outputs: [viewerActionOutput],
  defaultParams: viewerActionDefaultParams,
  paramsSchema: viewerActionParamsSchema,
  evaluate: (node) => {
    const params = viewerActionParamsSchema.safeParse(node.params).success
      ? viewerActionParamsSchema.parse(node.params)
      : viewerActionDefaultParams

    return {
      outputs: {
        viewerAction: {
          type: 'focusCamera',
          ...(asRecord(params.camera) ? { camera: params.camera as ViewerCameraConfig } : {}),
          ...(isNonEmptyString(params.stateId) ? { stateId: params.stateId } : {}),
        } satisfies ViewerActionConfig,
      },
    }
  },
}

export const viewerSetStateNodeDefinition: NodeDefinition = {
  type: 'viewer.setState',
  version: 1,
  title: 'Set State',
  category: 'Viewer',
  inputs: [],
  outputs: [viewerActionOutput],
  defaultParams: viewerActionDefaultParams,
  paramsSchema: viewerActionParamsSchema,
  evaluate: (node) => {
    const params = viewerActionParamsSchema.safeParse(node.params).success
      ? viewerActionParamsSchema.parse(node.params)
      : viewerActionDefaultParams

    return {
      outputs: {
        viewerAction: {
          type: 'setState',
          stateId: readString(params.stateId) ?? '',
        } satisfies ViewerActionConfig,
      },
    }
  },
}

export const viewerSetVariantNodeDefinition: NodeDefinition = {
  type: 'viewer.setVariant',
  version: 1,
  title: 'Set Variant',
  category: 'Viewer',
  inputs: [],
  outputs: [viewerActionOutput],
  defaultParams: viewerActionDefaultParams,
  paramsSchema: viewerActionParamsSchema,
  evaluate: (node) => {
    const params = viewerActionParamsSchema.safeParse(node.params).success
      ? viewerActionParamsSchema.parse(node.params)
      : viewerActionDefaultParams

    return {
      outputs: {
        viewerAction: {
          type: 'setVariant',
          variantId: readString(params.variantId) ?? '',
        } satisfies ViewerActionConfig,
      },
    }
  },
}

export const viewerShowHotspotNodeDefinition: NodeDefinition = {
  type: 'viewer.showHotspot',
  version: 1,
  title: 'Show Hotspot',
  category: 'Viewer',
  inputs: [],
  outputs: [viewerActionOutput],
  defaultParams: viewerActionDefaultParams,
  paramsSchema: viewerActionParamsSchema,
  evaluate: (node) => {
    const params = viewerActionParamsSchema.safeParse(node.params).success
      ? viewerActionParamsSchema.parse(node.params)
      : viewerActionDefaultParams

    return {
      outputs: {
        viewerAction: {
          type: 'showHotspot',
          hotspotId: readString(params.hotspotId) ?? '',
        } satisfies ViewerActionConfig,
      },
    }
  },
}

export const viewerHotspotNodeDefinition: NodeDefinition = {
  type: 'viewer.hotspot',
  version: 1,
  title: 'Hotspot',
  category: 'Viewer',
  inputs: [{ key: 'onClickAction', valueType: 'object' }],
  outputs: [hotspotOutput],
  defaultParams: viewerHotspotDefaultParams,
  paramsSchema: viewerHotspotParamsSchema,
  evaluate: (node, ctx) => {
    const params = viewerHotspotParamsSchema.safeParse(node.params).success
      ? viewerHotspotParamsSchema.parse(node.params)
      : viewerHotspotDefaultParams
    const connectedAction = ctx.getInput<ViewerActionConfig>('onClickAction')
    const fallbackAction = asActionConfig(params.onClickAction)
    const linkedStateId = readString(params.linkedStateId)
    const resolvedAction =
      connectedAction ??
      fallbackAction ??
      (linkedStateId
        ? ({
            type: 'setState',
            stateId: linkedStateId,
          } satisfies ViewerActionConfig)
        : undefined)

    return {
      outputs: {
        hotspot: {
          id: isNonEmptyString(params.id) ? params.id : node.id,
          ...(isNonEmptyString(params.label) ? { label: params.label } : {}),
          ...(isNonEmptyString(params.description) ? { description: params.description } : {}),
          ...(params.position ? { position: params.position } : {}),
          ...(resolvedAction ? { onClickAction: resolvedAction } : {}),
          ...(linkedStateId ? { linkedStateId } : {}),
        } satisfies ViewerHotspotConfig,
      },
    }
  },
}

export const viewerHotspotsNodeDefinition: NodeDefinition = {
  type: 'viewer.hotspots',
  version: 1,
  title: 'Hotspots',
  category: 'Viewer',
  inputs: [{ key: 'hotspots', valueType: 'object', multiple: true }],
  outputs: [hotspotListOutput],
  defaultParams: {},
  paramsSchema: z.object({}).passthrough(),
  evaluate: (_, ctx) => ({
    outputs: {
      hotspots: ctx.getInputs<ViewerHotspotConfig>('hotspots'),
    },
  }),
}

export const viewerOverlayNodeDefinition: NodeDefinition = {
  type: 'viewer.overlay',
  version: 1,
  title: 'Viewer Overlay',
  category: 'Viewer',
  inputs: [parentInput],
  outputs: [uiOutput],
  defaultParams: viewerOverlayDefaultParams,
  paramsSchema: viewerOverlayParamsSchema,
  evaluate: (node) => {
    const params = viewerOverlayParamsSchema.safeParse(node.params).success
      ? viewerOverlayParamsSchema.parse(node.params)
      : viewerOverlayDefaultParams

    return {
      outputs: {
        ui: {
          id: node.id,
          kind: 'ViewerOverlay',
          props: {
            ...(isNonEmptyString(params.title) ? { title: params.title } : {}),
            ...(isNonEmptyString(params.description) ? { description: params.description } : {}),
            position: params.position ?? 'top-right',
          },
          children: [],
        } satisfies UiNode,
      },
    }
  },
}

export const viewerNodeDefinitions: NodeDefinition[] = [
  viewerBlockNodeDefinition,
  viewerModelNodeDefinition,
  viewerEnvironmentNodeDefinition,
  viewerCameraPresetNodeDefinition,
  viewerStateNodeDefinition,
  viewerStatesNodeDefinition,
  viewerVariantNodeDefinition,
  viewerVariantsNodeDefinition,
  viewerFocusCameraNodeDefinition,
  viewerSetStateNodeDefinition,
  viewerSetVariantNodeDefinition,
  viewerShowHotspotNodeDefinition,
  viewerHotspotNodeDefinition,
  viewerHotspotsNodeDefinition,
  viewerOverlayNodeDefinition,
]

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined
}

function asHotspotList(value: unknown): ViewerHotspotConfig[] {
  return Array.isArray(value)
    ? value
        .map((item) => asRecord(item))
        .filter((item): item is Record<string, unknown> => Boolean(item))
        .map((item) => {
          const onClickAction = asActionConfig(item.onClickAction)

          return {
            ...(isNonEmptyString(item.id) ? { id: item.id } : {}),
            ...(isNonEmptyString(item.label) ? { label: item.label } : {}),
            ...(isNonEmptyString(item.description) ? { description: item.description } : {}),
            ...(hasVector3(item.position) ? { position: item.position } : {}),
            ...(onClickAction ? { onClickAction } : {}),
            ...(isNonEmptyString(item.linkedStateId) ? { linkedStateId: item.linkedStateId } : {}),
          }
        })
    : []
}

function asSceneStateList(value: unknown): ViewerSceneStateConfig[] {
  return Array.isArray(value)
    ? value
        .map((item) => asRecord(item))
        .filter((item): item is Record<string, unknown> => Boolean(item))
        .map((item, index) => {
          const camera = asRecord(item.camera)
          const environment = asRecord(item.environment)
          const metadata = asRecord(item.metadata)

          return {
            id: readString(item.id) ?? `state-${index + 1}`,
            ...(isNonEmptyString(item.label) ? { label: item.label } : {}),
            ...(camera ? { camera: camera as ViewerCameraConfig } : {}),
            ...(environment ? { environment: environment as ViewerEnvironmentConfig } : {}),
            ...(isNonEmptyString(item.activeVariantId)
              ? { activeVariantId: item.activeVariantId }
              : {}),
            ...(isNonEmptyString(item.activeHotspotId)
              ? { activeHotspotId: item.activeHotspotId }
              : {}),
            ...(isNonEmptyString(item.titleOverride)
              ? { titleOverride: item.titleOverride }
              : {}),
            ...(isNonEmptyString(item.descriptionOverride)
              ? { descriptionOverride: item.descriptionOverride }
              : {}),
            ...(metadata ? { metadata } : {}),
          }
        })
    : []
}

function asVariantList(value: unknown): ViewerVariantConfig[] {
  return Array.isArray(value)
    ? value
        .map((item) => asRecord(item))
        .filter((item): item is Record<string, unknown> => Boolean(item))
        .map((item, index) => ({
          id: readString(item.id) ?? `variant-${index + 1}`,
          ...(isNonEmptyString(item.label) ? { label: item.label } : {}),
          ...(isNonEmptyString(item.modelSrc) ? { modelSrc: item.modelSrc } : {}),
          ...(asRecord(item.environmentOverride)
            ? { environmentOverride: item.environmentOverride as ViewerEnvironmentConfig }
            : {}),
        }))
    : []
}

function asActionConfig(value: unknown): ViewerActionConfig | undefined {
  const record = asRecord(value)

  if (!record || !isNonEmptyString(record.type)) {
    return undefined
  }

  if (record.type === 'focusCamera') {
    return {
      type: 'focusCamera',
      ...(asRecord(record.camera) ? { camera: record.camera as ViewerCameraConfig } : {}),
      ...(isNonEmptyString(record.stateId) ? { stateId: record.stateId } : {}),
    }
  }

  if (record.type === 'setState') {
    return {
      type: 'setState',
      stateId: readString(record.stateId) ?? '',
    }
  }

  if (record.type === 'setVariant') {
    return {
      type: 'setVariant',
      variantId: readString(record.variantId) ?? '',
    }
  }

  if (record.type === 'showHotspot') {
    return {
      type: 'showHotspot',
      hotspotId: readString(record.hotspotId) ?? '',
    }
  }

  return undefined
}

function readInputString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined
}

function readString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function hasVector3(value: unknown): value is { x: number; y: number; z: number } {
  return Boolean(
    value &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      typeof (value as { x?: unknown }).x === 'number' &&
      typeof (value as { y?: unknown }).y === 'number' &&
      typeof (value as { z?: unknown }).z === 'number',
  )
}
