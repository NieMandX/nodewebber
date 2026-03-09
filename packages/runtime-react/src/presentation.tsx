import React from 'react'
import type { PresentationRuntime, PresentationStepConfig } from '@procedural-web-composer/shared-types'
import type { UiNode } from '@procedural-web-composer/ui-tree'
import { useGraphEventController } from './graph-events'

const AUTOPLAY_INTERVAL_MS = 2500

export interface PresentationState {
  activeStepId: string | undefined
  isPlaying: boolean
}

export interface PresentationControllerValue {
  activeStep: PresentationStepConfig | undefined
  activeStepId: string | undefined
  isPlaying: boolean
  nextStep: () => void
  prevStep: () => void
  setStep: (stepId: string) => void
  steps: PresentationStepConfig[]
  togglePlay: () => void
}

const PresentationContext = React.createContext<PresentationControllerValue | null>(null)

export function PresentationProvider(props: {
  children: React.ReactNode
  presentationRuntime: PresentationRuntime | undefined
}): JSX.Element {
  const graphEvents = useGraphEventController()
  const steps = props.presentationRuntime?.steps ?? []
  const [state, setState] = React.useState(() =>
    getInitialPresentationState(props.presentationRuntime),
  )

  React.useEffect(() => {
    setState(getInitialPresentationState(props.presentationRuntime))
  }, [props.presentationRuntime])

  const setStep = React.useCallback(
    (stepId: string) => {
      if (!steps.some((step) => step.id === stepId)) {
        return
      }

      setState((currentState) =>
        currentState.activeStepId === stepId
          ? currentState
          : {
              ...currentState,
              activeStepId: stepId,
            },
      )
    },
    [steps],
  )

  const nextStep = React.useCallback(() => {
    setState((currentState) => ({
      ...currentState,
      activeStepId:
        getNextPresentationStepId(steps, currentState.activeStepId) ??
        currentState.activeStepId,
    }))
  }, [steps])

  const prevStep = React.useCallback(() => {
    setState((currentState) => ({
      ...currentState,
      activeStepId:
        getPreviousPresentationStepId(steps, currentState.activeStepId) ??
        currentState.activeStepId,
    }))
  }, [steps])

  const togglePlay = React.useCallback(() => {
    setState((currentState) => ({
      ...currentState,
      isPlaying: !currentState.isPlaying,
    }))
  }, [])

  React.useEffect(() => {
    if (!graphEvents) {
      return
    }

    return graphEvents.registerPresentationCommands({
      nextStep,
      prevStep,
      setStep,
      togglePlay,
    })
  }, [graphEvents, nextStep, prevStep, setStep, togglePlay])

  React.useEffect(() => {
    if (!state.isPlaying || steps.length < 2) {
      return
    }

    const timer = window.setInterval(() => {
      setState((currentState) => ({
        ...currentState,
        activeStepId:
          getNextPresentationStepId(steps, currentState.activeStepId) ??
          currentState.activeStepId,
      }))
    }, AUTOPLAY_INTERVAL_MS)

    return () => {
      window.clearInterval(timer)
    }
  }, [state.isPlaying, steps])

  const activeStep = getPresentationStepById(steps, state.activeStepId)

  return (
    <PresentationContext.Provider
      value={{
        activeStep,
        activeStepId: state.activeStepId,
        isPlaying: state.isPlaying,
        nextStep,
        prevStep,
        setStep,
        steps,
        togglePlay,
      }}
    >
      {props.children}
    </PresentationContext.Provider>
  )
}

export function PresentationControls(): JSX.Element | null {
  const controller = usePresentationController()

  if (!controller || controller.steps.length === 0) {
    return null
  }

  return (
    <div
      style={{
        position: 'sticky',
        bottom: '16px',
        display: 'grid',
        gap: '10px',
        marginTop: '16px',
        padding: '14px 16px',
        borderRadius: '18px',
        background: 'rgba(250, 244, 236, 0.92)',
        border: '1px solid rgba(31, 27, 23, 0.12)',
        boxShadow: '0 18px 32px rgba(31, 27, 23, 0.08)',
        backdropFilter: 'blur(10px)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'center' }}>
        <div style={{ display: 'grid', gap: '2px' }}>
          <strong style={{ fontSize: '0.92rem' }}>
            {controller.activeStep?.title ??
              controller.activeStep?.label ??
              controller.activeStepId ??
              'Presentation'}
          </strong>
          <span style={{ fontSize: '0.8rem', color: '#6b5d53' }}>
            Step {Math.max(1, getPresentationStepIndex(controller.steps, controller.activeStepId) + 1)} of{' '}
            {controller.steps.length}
          </span>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button type="button" style={controlButtonStyle} onClick={controller.prevStep}>
            Prev
          </button>
          <button type="button" style={controlButtonStyle} onClick={controller.togglePlay}>
            {controller.isPlaying ? 'Pause' : 'Play'}
          </button>
          <button type="button" style={controlButtonStyle} onClick={controller.nextStep}>
            Next
          </button>
        </div>
      </div>
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        {controller.steps.map((step) => {
          const active = controller.activeStepId === step.id

          return (
            <button
              key={step.id}
              type="button"
              style={{
                ...stepChipStyle,
                background: active ? '#1f1b17' : 'transparent',
                color: active ? '#fffaf4' : '#3b2f27',
              }}
              onClick={() => controller.setStep(step.id)}
            >
              {step.label ?? step.title ?? step.id}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export function usePresentationController(): PresentationControllerValue | null {
  return React.useContext(PresentationContext)
}

export function getInitialPresentationState(
  presentationRuntime: PresentationRuntime | undefined,
): PresentationState {
  return {
    activeStepId: presentationRuntime?.initialStepId,
    isPlaying: false,
  }
}

export function getPresentationStepById(
  steps: PresentationStepConfig[],
  stepId: string | undefined,
): PresentationStepConfig | undefined {
  return stepId ? steps.find((step) => step.id === stepId) : undefined
}

export function getPresentationStepIndex(
  steps: PresentationStepConfig[],
  stepId: string | undefined,
): number {
  if (!stepId) {
    return 0
  }

  return Math.max(
    0,
    steps.findIndex((step) => step.id === stepId),
  )
}

export function getNextPresentationStepId(
  steps: PresentationStepConfig[],
  activeStepId: string | undefined,
): string | undefined {
  if (steps.length === 0) {
    return undefined
  }

  const currentIndex = getPresentationStepIndex(steps, activeStepId)
  return steps[Math.min(steps.length - 1, currentIndex + 1)]?.id
}

export function getPreviousPresentationStepId(
  steps: PresentationStepConfig[],
  activeStepId: string | undefined,
): string | undefined {
  if (steps.length === 0) {
    return undefined
  }

  const currentIndex = getPresentationStepIndex(steps, activeStepId)
  return steps[Math.max(0, currentIndex - 1)]?.id
}

export function isUiNodeVisibleForPresentationStep(
  node: UiNode,
  activeStep: PresentationStepConfig | undefined,
): boolean {
  if (!activeStep) {
    return true
  }

  const visibleOnSteps = asStringArray(node.props.visibleOnSteps)
  const hiddenOnSteps = asStringArray(node.props.hiddenOnSteps)

  if (hiddenOnSteps.includes(activeStep.id)) {
    return false
  }

  if ((activeStep.hiddenNodeIds ?? []).includes(node.id)) {
    return false
  }

  if (visibleOnSteps.length > 0) {
    return visibleOnSteps.includes(activeStep.id)
  }

  if ((activeStep.visibleNodeIds ?? []).includes(node.id)) {
    return true
  }

  return true
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : []
}

const controlButtonStyle: React.CSSProperties = {
  minHeight: '38px',
  padding: '0 14px',
  borderRadius: '999px',
  border: '1px solid rgba(31, 27, 23, 0.16)',
  background: '#fffaf4',
  color: '#241b16',
  fontWeight: 600,
  cursor: 'pointer',
}

const stepChipStyle: React.CSSProperties = {
  minHeight: '34px',
  padding: '0 12px',
  borderRadius: '999px',
  border: '1px solid rgba(31, 27, 23, 0.16)',
  fontWeight: 600,
  cursor: 'pointer',
}
