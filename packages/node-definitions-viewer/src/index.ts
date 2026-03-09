import { z } from 'zod'
import type { UiNode } from '@procedural-web-composer/ui-tree'
import type {
  NodeDefinition,
  ViewerBlockProps,
  ViewerCameraConfig,
  ViewerEnvironmentConfig,
  ViewerHotspotConfig,
  ViewerModelConfig,
} from '@procedural-web-composer/shared-types'

const parentInput = {
  key: 'parent',
  valueType: 'ui-node' as const,
}

const uiOutput = {
  key: 'ui',
  valueType: 'ui-node' as const,
}

const objectOutput = {
  key: 'value',
  valueType: 'object' as const,
}

const hotspotOutput = {
  key: 'hotspot',
  valueType: 'object' as const,
}

const hotspotListOutput = {
  key: 'hotspots',
  valueType: 'array' as const,
}

const loadingModeSchema = z.enum(['eager', 'lazy'])
const viewerPositionSchema = z.object({
  x: z.number(),
  y: z.number(),
  z: z.number(),
})

const viewerBlockParamsSchema = z.object({
  title: z.string().optional(),
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
}).passthrough()

const viewerModelParamsSchema = z.object({
  src: z.string().optional(),
  format: z.enum(['gltf', 'glb', 'fbx', 'auto']).optional(),
  alt: z.string().optional(),
}).passthrough()

const viewerEnvironmentParamsSchema = z.object({
  type: z.enum(['color', 'hdri']).optional(),
  color: z.string().optional(),
  hdriSrc: z.string().optional(),
  intensity: z.number().optional(),
  rotation: z.number().optional(),
}).passthrough()

const viewerCameraParamsSchema = z.object({
  mode: z.enum(['orbit', 'fixed']).optional(),
  position: viewerPositionSchema.optional(),
  target: viewerPositionSchema.optional(),
  fov: z.number().optional(),
  minDistance: z.number().optional(),
  maxDistance: z.number().optional(),
}).passthrough()

const viewerHotspotParamsSchema = z.object({
  id: z.string().optional(),
  label: z.string().optional(),
  description: z.string().optional(),
  position: viewerPositionSchema.optional(),
}).passthrough()

const viewerOverlayParamsSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  position: z.enum(['top-left', 'top-right', 'bottom-left', 'bottom-right']).optional(),
}).passthrough()

const viewerBlockDefaultParams = {
  title: 'Viewer',
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

const viewerHotspotDefaultParams = {
  id: '',
  label: 'Hotspot',
  description: '',
  position: { x: 0, y: 0, z: 0 },
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
    {
      key: 'model',
      valueType: 'object',
    },
    {
      key: 'environment',
      valueType: 'object',
    },
    {
      key: 'camera',
      valueType: 'object',
    },
    {
      key: 'hotspots',
      valueType: 'array',
    },
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
      (typeof params.modelSrc === 'string' && params.modelSrc.trim().length > 0
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
      ctx.getInput<ViewerHotspotConfig[]>('hotspots') ??
      asHotspotList(params.hotspots)
    const props: ViewerBlockProps = {
      ...(typeof params.title === 'string' && params.title.trim().length > 0
        ? { title: params.title }
        : {}),
      ...(typeof params.posterImage === 'string' && params.posterImage.trim().length > 0
        ? { posterImage: params.posterImage }
        : {}),
      ...(typeof params.background === 'string' && params.background.trim().length > 0
        ? { background: params.background }
        : {}),
      ...(typeof params.exposure === 'number' ? { exposure: params.exposure } : {}),
      allowOrbit: params.allowOrbit ?? true,
      showToolbar: params.showToolbar ?? true,
      loadingMode: params.loadingMode ?? 'lazy',
      ...(resolvedModel ? { model: resolvedModel, modelSrc: resolvedModel.src } : {}),
      ...(resolvedEnvironment ? { environment: resolvedEnvironment } : {}),
      ...(resolvedCamera ? { cameraPreset: resolvedCamera } : {}),
      ...(resolvedHotspots.length > 0 ? { hotspots: resolvedHotspots } : {}),
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
  outputs: [
    {
      key: 'model',
      valueType: 'object',
    },
  ],
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
          ...(typeof params.alt === 'string' && params.alt.trim().length > 0
            ? { alt: params.alt }
            : {}),
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
  outputs: [
    {
      key: 'environment',
      valueType: 'object',
    },
  ],
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
          ...(typeof params.color === 'string' && params.color.trim().length > 0
            ? { color: params.color }
            : {}),
          ...(typeof params.hdriSrc === 'string' && params.hdriSrc.trim().length > 0
            ? { hdriSrc: params.hdriSrc }
            : {}),
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
  outputs: [
    {
      key: 'camera',
      valueType: 'object',
    },
  ],
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
          ...(typeof params.minDistance === 'number'
            ? { minDistance: params.minDistance }
            : {}),
          ...(typeof params.maxDistance === 'number'
            ? { maxDistance: params.maxDistance }
            : {}),
        } satisfies ViewerCameraConfig,
      },
    }
  },
}

export const viewerHotspotNodeDefinition: NodeDefinition = {
  type: 'viewer.hotspot',
  version: 1,
  title: 'Hotspot',
  category: 'Viewer',
  inputs: [],
  outputs: [hotspotOutput],
  defaultParams: viewerHotspotDefaultParams,
  paramsSchema: viewerHotspotParamsSchema,
  evaluate: (node) => {
    const params = viewerHotspotParamsSchema.safeParse(node.params).success
      ? viewerHotspotParamsSchema.parse(node.params)
      : viewerHotspotDefaultParams

    return {
      outputs: {
        hotspot: {
          id:
            typeof params.id === 'string' && params.id.trim().length > 0
              ? params.id
              : node.id,
          ...(typeof params.label === 'string' && params.label.trim().length > 0
            ? { label: params.label }
            : {}),
          ...(typeof params.description === 'string' && params.description.trim().length > 0
            ? { description: params.description }
            : {}),
          ...(params.position ? { position: params.position } : {}),
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
  inputs: [
    {
      key: 'hotspots',
      valueType: 'object',
      multiple: true,
    },
  ],
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
            ...(typeof params.title === 'string' && params.title.trim().length > 0
              ? { title: params.title }
              : {}),
            ...(typeof params.description === 'string' && params.description.trim().length > 0
              ? { description: params.description }
              : {}),
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
  viewerHotspotNodeDefinition,
  viewerHotspotsNodeDefinition,
  viewerOverlayNodeDefinition,
]

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined
}

function asHotspotList(value: unknown): ViewerHotspotConfig[] {
  return Array.isArray(value)
    ? value.filter((item): item is ViewerHotspotConfig => typeof item === 'object' && item !== null)
    : []
}
