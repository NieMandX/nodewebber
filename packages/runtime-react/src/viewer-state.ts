import type {
  PresentationStepConfig,
  ViewerActionConfig,
  ViewerBlockProps,
  ViewerCameraConfig,
  ViewerEnvironmentConfig,
  ViewerHotspotConfig,
  ViewerModelConfig,
  ViewerSceneStateConfig,
  ViewerVariantConfig,
} from '@procedural-web-composer/shared-types'

export interface ViewerInteractionState {
  activeStateId: string | undefined
  activeVariantId: string | undefined
  activeHotspotId: string | undefined
  focusedCamera: ViewerCameraConfig | undefined
}

export interface ViewerResolvedConfig {
  activeStateId: string | undefined
  activeVariantId: string | undefined
  activeHotspotId: string | undefined
  activeState: ViewerSceneStateConfig | undefined
  activeVariant: ViewerVariantConfig | undefined
  activeHotspot: ViewerHotspotConfig | undefined
  model: ViewerModelConfig | undefined
  modelSrc: string | undefined
  environment: ViewerEnvironmentConfig | undefined
  camera: ViewerCameraConfig | undefined
  title: string | undefined
  description: string | undefined
  hotspots: ViewerHotspotConfig[]
  states: ViewerSceneStateConfig[]
  variants: ViewerVariantConfig[]
  interactionsEnabled: boolean
  stateTransitionMode: 'instant' | 'soft'
}

export function getInitialViewerInteractionState(
  props: ViewerBlockProps,
): ViewerInteractionState {
  const states = getViewerStates(props)
  const activeStateId =
    readString(props.activeStateId) ??
    readString(props.initialStateId) ??
    states.find((state) => state.id === 'default')?.id ??
    states[0]?.id
  const activeState = states.find((state) => state.id === activeStateId)

  return {
    activeStateId,
    activeVariantId: readString(props.activeVariantId) ?? readString(activeState?.activeVariantId),
    activeHotspotId: readString(activeState?.activeHotspotId),
    focusedCamera: undefined,
  }
}

export function resolveViewerConfig(
  props: ViewerBlockProps,
  interactionState: ViewerInteractionState,
  activePresentationStep?: PresentationStepConfig,
): ViewerResolvedConfig {
  const states = getViewerStates(props)
  const variants = getViewerVariants(props)
  const hotspots = props.hotspots ?? []
  const stepDrivenStateId = readString(activePresentationStep?.viewerStateId)
  const stepDrivenVariantId = readString(activePresentationStep?.viewerVariantId)
  const activeStateId =
    readString(props.activeStateId) ??
    interactionState.activeStateId ??
    stepDrivenStateId ??
    readString(props.initialStateId) ??
    states.find((state) => state.id === 'default')?.id ??
    states[0]?.id
  const activeState = states.find((state) => state.id === activeStateId)
  const activeVariantId =
    readString(props.activeVariantId) ??
    interactionState.activeVariantId ??
    stepDrivenVariantId ??
    readString(activeState?.activeVariantId)
  const activeVariant = variants.find((variant) => variant.id === activeVariantId)
  const activeHotspotId =
    interactionState.activeHotspotId ?? readString(activeState?.activeHotspotId)
  const activeHotspot = hotspots.find((hotspot) => hotspot.id === activeHotspotId)
  const baseModel = props.model
  const model =
    activeVariant?.modelSrc && baseModel
      ? {
          ...baseModel,
          src: activeVariant.modelSrc,
        }
      : activeVariant?.modelSrc
        ? {
            src: activeVariant.modelSrc,
            format: baseModel?.format ?? 'auto',
            ...(baseModel?.alt ? { alt: baseModel.alt } : {}),
          }
        : baseModel
  const environment = mergeEnvironment(
    mergeEnvironment(props.environment, activeVariant?.environmentOverride),
    activeState?.environment,
  )
  const camera =
    interactionState.focusedCamera ?? activeState?.camera ?? props.cameraPreset

  return {
    activeStateId,
    activeVariantId,
    activeHotspotId,
    activeState,
    activeVariant,
    activeHotspot,
    model,
    modelSrc: model?.src ?? props.modelSrc,
    environment,
    camera,
    title: activeState?.titleOverride ?? props.title,
    description: activeState?.descriptionOverride ?? props.description,
    hotspots,
    states,
    variants,
    interactionsEnabled: props.interactionsEnabled ?? true,
    stateTransitionMode: props.stateTransitionMode ?? 'soft',
  }
}

export function applyViewerAction(
  action: ViewerActionConfig,
  interactionState: ViewerInteractionState,
): ViewerInteractionState {
  if (action.type === 'setState') {
    return {
      activeStateId: readString(action.stateId),
      activeVariantId: undefined,
      activeHotspotId: undefined,
      focusedCamera: undefined,
    }
  }

  if (action.type === 'setVariant') {
    return {
      ...interactionState,
      activeVariantId: readString(action.variantId),
    }
  }

  if (action.type === 'showHotspot') {
    return {
      ...interactionState,
      activeHotspotId: readString(action.hotspotId),
    }
  }

  const stateId = readString(action.stateId)

  return {
    ...interactionState,
    ...(stateId ? { activeStateId: stateId } : {}),
    focusedCamera: action.camera,
  }
}

export function getHotspotAction(
  hotspot: ViewerHotspotConfig,
): ViewerActionConfig | undefined {
  if (hotspot.onClickAction) {
    return hotspot.onClickAction
  }

  const linkedStateId = readString(hotspot.linkedStateId)

  if (linkedStateId) {
    return {
      type: 'setState',
      stateId: linkedStateId,
    }
  }

  return undefined
}

function getViewerStates(props: ViewerBlockProps): ViewerSceneStateConfig[] {
  return Array.isArray(props.states)
    ? props.states.filter((state): state is ViewerSceneStateConfig => Boolean(readString(state.id)))
    : []
}

function getViewerVariants(props: ViewerBlockProps): ViewerVariantConfig[] {
  return Array.isArray(props.variants)
    ? props.variants.filter((variant): variant is ViewerVariantConfig => Boolean(readString(variant.id)))
    : []
}

function mergeEnvironment(
  base: ViewerEnvironmentConfig | undefined,
  override: ViewerEnvironmentConfig | undefined,
): ViewerEnvironmentConfig | undefined {
  if (!base && !override) {
    return undefined
  }

  return {
    ...(base ?? {}),
    ...(override ?? {}),
  }
}

function readString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined
}
