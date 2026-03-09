import { describe, expect, it, vi } from 'vitest'
import presentationBasic from '../../examples/presentation-basic.json'
import presentationButtonNav from '../../examples/presentation-button-nav.json'
import presentationSubgraphStory from '../../examples/presentation-subgraph-story.json'
import presentationViewerStory from '../../examples/presentation-viewer-story.json'
import { evaluateGraphDocument } from '@procedural-web-composer/runtime-core'
import {
  createGraphEventController,
  getNextPresentationStepId,
  getPresentationStepById,
  getPreviousPresentationStepId,
  isUiNodeVisibleForPresentationStep,
  PreviewRenderer,
  renderUiTree,
  resolveViewerConfig,
} from '@procedural-web-composer/runtime-react'
import type { ViewerBlockProps } from '@procedural-web-composer/shared-types'
import { walkUiTree, type UiNode } from '@procedural-web-composer/ui-tree'
import { createTestRegistry } from '../helpers/create-test-registry'

describe('presentation runtime', () => {
  it('propagates presentation steps into runtime and viewer props', () => {
    const registry = createTestRegistry()
    const project = structuredClone(presentationViewerStory)
    const result = evaluateGraphDocument(project, project.settings.entryGraphId, registry)
    const viewerNode = findFirstUiNode(result.root, (node) => node.kind === 'ViewerBlock')

    expect(result.presentationRuntime?.steps).toHaveLength(2)
    expect((viewerNode?.props.presentationSteps as unknown[] | undefined)?.length).toBe(2)
  })

  it('applies presentation steps after defaults but before baseline story fallback', () => {
    const props: ViewerBlockProps = {
      title: 'Viewer',
      model: { src: '/models/base.glb', format: 'glb' },
      states: [
        { id: 'overview' },
        { id: 'detail' },
      ],
      variants: [
        { id: 'day', modelSrc: '/models/day.glb' },
        { id: 'night', modelSrc: '/models/night.glb' },
      ],
      initialStateId: 'overview',
      interactionsEnabled: true,
      stateTransitionMode: 'soft',
    }
    const activeStep = {
      id: 'detail-step',
      viewerStateId: 'detail',
      viewerVariantId: 'day',
    }

    const stepResolved = resolveViewerConfig(
      props,
      {
        activeStateId: undefined,
        activeVariantId: undefined,
        activeHotspotId: undefined,
        focusedCamera: undefined,
      },
      activeStep,
    )
    const interactionResolved = resolveViewerConfig(
      props,
      {
        activeStateId: 'overview',
        activeVariantId: 'night',
        activeHotspotId: undefined,
        focusedCamera: undefined,
      },
      activeStep,
    )

    expect(stepResolved.activeStateId).toBe('detail')
    expect(stepResolved.activeVariantId).toBe('day')
    expect(interactionResolved.activeStateId).toBe('overview')
    expect(interactionResolved.activeVariantId).toBe('night')
  })

  it('computes next and previous steps deterministically', () => {
    const registry = createTestRegistry()
    const project = structuredClone(presentationBasic)
    const result = evaluateGraphDocument(project, project.settings.entryGraphId, registry)
    const steps = result.presentationRuntime?.steps ?? []

    expect(getNextPresentationStepId(steps, 'intro')).toBe('detail')
    expect(getPreviousPresentationStepId(steps, 'detail')).toBe('intro')
  })

  it('routes button clicks into presentation next and prev actions', () => {
    const registry = createTestRegistry()
    const project = structuredClone(presentationButtonNav)
    const result = evaluateGraphDocument(project, project.settings.entryGraphId, registry)
    const nextStep = vi.fn()
    const prevStep = vi.fn()
    const controller = createGraphEventController(result.eventRuntime)

    controller.registerPresentationCommands({
      nextStep,
      prevStep,
      setStep: vi.fn(),
      togglePlay: vi.fn(),
    })
    controller.emitUiClick({
      targetNodeId: 'node_nav_next',
    })
    controller.emitUiClick({
      targetNodeId: 'node_nav_prev',
    })

    expect(nextStep).toHaveBeenCalledTimes(1)
    expect(prevStep).toHaveBeenCalledTimes(1)
  })

  it('respects step-driven UI visibility rules', () => {
    const registry = createTestRegistry()
    const project = structuredClone(presentationBasic)
    const result = evaluateGraphDocument(project, project.settings.entryGraphId, registry)
    const introStep = getPresentationStepById(result.presentationRuntime?.steps ?? [], 'intro')
    const detailStep = getPresentationStepById(result.presentationRuntime?.steps ?? [], 'detail')
    const introNode = findUiNodeById(result.root, 'node_basic_intro')
    const detailNode = findUiNodeById(result.root, 'node_basic_detail')

    expect(introNode).toBeDefined()
    expect(detailNode).toBeDefined()
    expect(isUiNodeVisibleForPresentationStep(introNode!, introStep)).toBe(true)
    expect(isUiNodeVisibleForPresentationStep(detailNode!, introStep)).toBe(false)
    expect(isUiNodeVisibleForPresentationStep(introNode!, detailStep)).toBe(false)
    expect(isUiNodeVisibleForPresentationStep(detailNode!, detailStep)).toBe(true)
  })

  it('keeps presentation flows working inside reusable subgraphs and preview controls render', () => {
    const registry = createTestRegistry()
    const project = structuredClone(presentationSubgraphStory)
    const result = evaluateGraphDocument(project, project.settings.entryGraphId, registry)

    expect(result.root?.kind).toBe('Page')
    expect(result.presentationRuntime?.steps).toHaveLength(2)
    expect(() => renderUiTree(result.root!)).not.toThrow()
    expect(() =>
      PreviewRenderer({
        root: result.root,
        eventRuntime: result.eventRuntime,
        presentationRuntime: result.presentationRuntime,
      }),
    ).not.toThrow()
  })
})

function findFirstUiNode(
  root: UiNode | null,
  predicate: (node: UiNode) => boolean,
): UiNode | undefined {
  if (!root) {
    return undefined
  }

  let match: UiNode | undefined
  walkUiTree(root, (node) => {
    if (!match && predicate(node)) {
      match = node
    }
  })

  return match
}

function findUiNodeById(root: UiNode | null, nodeId: string): UiNode | undefined {
  return findFirstUiNode(root, (node) => node.id === nodeId)
}
