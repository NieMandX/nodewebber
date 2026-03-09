import { describe, expect, it } from 'vitest'
import viewerHotspotActions from '../../examples/viewer-hotspot-actions.json'
import viewerSceneStates from '../../examples/viewer-scene-states.json'
import viewerStateSubgraph from '../../examples/viewer-state-subgraph.json'
import viewerVariants from '../../examples/viewer-variants.json'
import { evaluateGraphDocument } from '@procedural-web-composer/runtime-core'
import {
  applyViewerAction,
  getInitialViewerInteractionState,
  renderUiTree,
  resolveViewerConfig,
} from '@procedural-web-composer/runtime-react'
import type { ViewerBlockProps } from '@procedural-web-composer/shared-types'
import { walkUiTree, type UiNode } from '@procedural-web-composer/ui-tree'
import { validateGraph } from '@procedural-web-composer/graph-core'
import { createTestRegistry } from '../helpers/create-test-registry'
import { createEdge, createGraph, createNode, createProject } from '../helpers/project'

describe('viewer interactions', () => {
  it('propagates scene states into viewer.block props', () => {
    const registry = createTestRegistry()
    const project = structuredClone(viewerSceneStates)
    const result = evaluateGraphDocument(project, project.settings.entryGraphId, registry)
    const viewerNode = findFirstUiNode(result.root, (node) => node.kind === 'ViewerBlock')

    expect((viewerNode?.props.states as unknown[] | undefined)?.length).toBe(2)
    expect(viewerNode?.props.initialStateId).toBe('default')
    expect(viewerNode?.props.interactionsEnabled).toBe(true)
  })

  it('wires hotspot onClick actions into hotspot config objects', () => {
    const registry = createTestRegistry()
    const project = structuredClone(viewerHotspotActions)
    const result = evaluateGraphDocument(project, project.settings.entryGraphId, registry)
    const viewerNode = findFirstUiNode(result.root, (node) => node.kind === 'ViewerBlock')
    const hotspots = (viewerNode?.props.hotspots as Array<{ id?: string; onClickAction?: { type?: string } }> | undefined) ?? []

    expect(hotspots.find((hotspot) => hotspot.id === 'door')?.onClickAction?.type).toBe('setState')
    expect(hotspots.find((hotspot) => hotspot.id === 'dash')?.onClickAction?.type).toBe('focusCamera')
    expect(hotspots.find((hotspot) => hotspot.id === 'body')?.onClickAction?.type).toBe('setVariant')
  })

  it('resolves active state and variant precedence in renderer helpers', () => {
    const props: ViewerBlockProps = {
      title: 'Base title',
      description: 'Base description',
      model: { src: '/models/base.glb', format: 'glb' },
      environment: { type: 'color', color: '#111827', intensity: 1 },
      states: [
        {
          id: 'default',
          label: 'Default',
          activeVariantId: 'night',
        },
        {
          id: 'detail',
          label: 'Detail',
          titleOverride: 'Detail title',
          descriptionOverride: 'Detail description',
          environment: { type: 'color', color: '#1f2937', intensity: 0.8 },
        },
      ],
      variants: [
        {
          id: 'night',
          label: 'Night',
          modelSrc: '/models/night.glb',
          environmentOverride: { type: 'color', color: '#0b1220', intensity: 0.65 },
        },
        {
          id: 'studio',
          label: 'Studio',
          modelSrc: '/models/studio.glb',
          environmentOverride: { type: 'color', color: '#dbe6f5', intensity: 1.2 },
        },
      ],
      initialStateId: 'default',
      activeStateId: 'detail',
      activeVariantId: 'studio',
      interactionsEnabled: true,
      stateTransitionMode: 'soft',
    }

    const resolved = resolveViewerConfig(props, {
      activeStateId: 'default',
      activeVariantId: 'night',
    })

    expect(resolved.activeStateId).toBe('detail')
    expect(resolved.activeVariantId).toBe('studio')
    expect(resolved.modelSrc).toBe('/models/studio.glb')
    expect(resolved.title).toBe('Detail title')
    expect(resolved.description).toBe('Detail description')
    expect(resolved.environment?.color).toBe('#1f2937')
  })

  it('applies viewer actions as lightweight local interaction state', () => {
    const props: ViewerBlockProps = {
      states: [{ id: 'default' }, { id: 'detail' }],
      variants: [{ id: 'night' }],
      initialStateId: 'default',
      interactionsEnabled: true,
      stateTransitionMode: 'instant',
    }
    const initialState = getInitialViewerInteractionState(props)
    const afterStateAction = applyViewerAction({ type: 'setState', stateId: 'detail' }, initialState)
    const afterVariantAction = applyViewerAction({ type: 'setVariant', variantId: 'night' }, afterStateAction)

    expect(afterStateAction.activeStateId).toBe('detail')
    expect(afterVariantAction.activeVariantId).toBe('night')
  })

  it('renders interactive viewer samples through the preview pipeline', () => {
    const registry = createTestRegistry()
    const samples = [
      structuredClone(viewerSceneStates),
      structuredClone(viewerHotspotActions),
      structuredClone(viewerVariants),
      structuredClone(viewerStateSubgraph),
    ]

    for (const sample of samples) {
      const result = evaluateGraphDocument(sample, sample.settings.entryGraphId, registry)
      const validationErrors = result.validation.issues.filter((issue) => issue.severity === 'error')
      const runtimeErrors = result.issues.filter((issue) => issue.severity === 'error')

      expect(result.root).not.toBeNull()
      expect(validationErrors, sample.meta.name).toHaveLength(0)
      expect(runtimeErrors, sample.meta.name).toHaveLength(0)
      expect(() => renderUiTree(result.root!)).not.toThrow()
    }
  })

  it('keeps interactive viewer blocks working inside reusable subgraphs', () => {
    const registry = createTestRegistry()
    const project = structuredClone(viewerStateSubgraph)
    const result = evaluateGraphDocument(project, project.settings.entryGraphId, registry)
    const viewerNode = findFirstUiNode(result.root, (node) => node.kind === 'ViewerBlock')

    expect(result.root?.kind).toBe('Page')
    expect((viewerNode?.props.states as unknown[] | undefined)?.length).toBe(2)
    expect(viewerNode?.props.modelSrc).toBe('/models/table.glb')
  })

  it('surfaces warnings for invalid interactive viewer references', () => {
    const registry = createTestRegistry()
    const project = createProject(
      [
        createGraph({
          id: 'graph_page',
          name: 'Page',
          kind: 'page',
          nodes: [
            createNode({
              id: 'node_page',
              type: 'layout.page',
              params: { maxWidth: 960, padding: 24 },
            }),
            createNode({
              id: 'node_block',
              type: 'viewer.block',
              params: {
                modelSrc: '/models/example.glb',
                interactionsEnabled: false,
              },
            }),
            createNode({
              id: 'node_state_a',
              type: 'viewer.state',
              params: { id: 'default' },
            }),
            createNode({
              id: 'node_state_b',
              type: 'viewer.state',
              params: { id: 'default' },
            }),
            createNode({
              id: 'node_states',
              type: 'viewer.states',
              params: {},
            }),
            createNode({
              id: 'node_variant_a',
              type: 'viewer.variant',
              params: { id: 'night' },
            }),
            createNode({
              id: 'node_variant_b',
              type: 'viewer.variant',
              params: { id: 'night' },
            }),
            createNode({
              id: 'node_variants',
              type: 'viewer.variants',
              params: {},
            }),
            createNode({
              id: 'node_action_state',
              type: 'viewer.setState',
              params: { stateId: 'missing-state' },
            }),
            createNode({
              id: 'node_action_variant',
              type: 'viewer.setVariant',
              params: { variantId: 'missing-variant' },
            }),
            createNode({
              id: 'node_action_hotspot',
              type: 'viewer.showHotspot',
              params: { hotspotId: 'missing-hotspot' },
            }),
            createNode({
              id: 'node_hotspot_a',
              type: 'viewer.hotspot',
              params: {
                id: 'door',
                label: 'Door',
                position: { x: 0, y: 0, z: 0 },
                linkedStateId: 'missing-state',
              },
            }),
            createNode({
              id: 'node_hotspot_b',
              type: 'viewer.hotspot',
              params: {
                id: 'dash',
                label: 'Dash',
                position: { x: 1, y: 0, z: 0 },
              },
            }),
            createNode({
              id: 'node_hotspot_c',
              type: 'viewer.hotspot',
              params: {
                id: 'roof',
                label: 'Roof',
                position: { x: 0, y: 1, z: 0 },
              },
            }),
            createNode({
              id: 'node_hotspots',
              type: 'viewer.hotspots',
              params: {},
            }),
          ],
          edges: [
            createEdge({
              id: 'edge_page_block',
              fromNodeId: 'node_page',
              fromPort: 'ui',
              toNodeId: 'node_block',
              toPort: 'parent',
              kind: 'structure',
            }),
            createEdge({
              id: 'edge_state_a_states',
              fromNodeId: 'node_state_a',
              fromPort: 'sceneState',
              toNodeId: 'node_states',
              toPort: 'states',
              kind: 'data',
            }),
            createEdge({
              id: 'edge_state_b_states',
              fromNodeId: 'node_state_b',
              fromPort: 'sceneState',
              toNodeId: 'node_states',
              toPort: 'states',
              kind: 'data',
            }),
            createEdge({
              id: 'edge_states_block',
              fromNodeId: 'node_states',
              fromPort: 'states',
              toNodeId: 'node_block',
              toPort: 'states',
              kind: 'data',
            }),
            createEdge({
              id: 'edge_variant_a_variants',
              fromNodeId: 'node_variant_a',
              fromPort: 'variant',
              toNodeId: 'node_variants',
              toPort: 'variants',
              kind: 'data',
            }),
            createEdge({
              id: 'edge_variant_b_variants',
              fromNodeId: 'node_variant_b',
              fromPort: 'variant',
              toNodeId: 'node_variants',
              toPort: 'variants',
              kind: 'data',
            }),
            createEdge({
              id: 'edge_variants_block',
              fromNodeId: 'node_variants',
              fromPort: 'variants',
              toNodeId: 'node_block',
              toPort: 'variants',
              kind: 'data',
            }),
            createEdge({
              id: 'edge_action_state_hotspot',
              fromNodeId: 'node_action_state',
              fromPort: 'viewerAction',
              toNodeId: 'node_hotspot_a',
              toPort: 'onClickAction',
              kind: 'data',
            }),
            createEdge({
              id: 'edge_action_variant_hotspot',
              fromNodeId: 'node_action_variant',
              fromPort: 'viewerAction',
              toNodeId: 'node_hotspot_b',
              toPort: 'onClickAction',
              kind: 'data',
            }),
            createEdge({
              id: 'edge_action_hotspot_hotspot',
              fromNodeId: 'node_action_hotspot',
              fromPort: 'viewerAction',
              toNodeId: 'node_hotspot_c',
              toPort: 'onClickAction',
              kind: 'data',
            }),
            createEdge({
              id: 'edge_hotspot_a_group',
              fromNodeId: 'node_hotspot_a',
              fromPort: 'hotspot',
              toNodeId: 'node_hotspots',
              toPort: 'hotspots',
              kind: 'data',
            }),
            createEdge({
              id: 'edge_hotspot_b_group',
              fromNodeId: 'node_hotspot_b',
              fromPort: 'hotspot',
              toNodeId: 'node_hotspots',
              toPort: 'hotspots',
              kind: 'data',
            }),
            createEdge({
              id: 'edge_hotspot_c_group',
              fromNodeId: 'node_hotspot_c',
              fromPort: 'hotspot',
              toNodeId: 'node_hotspots',
              toPort: 'hotspots',
              kind: 'data',
            }),
            createEdge({
              id: 'edge_hotspots_block',
              fromNodeId: 'node_hotspots',
              fromPort: 'hotspots',
              toNodeId: 'node_block',
              toPort: 'hotspots',
              kind: 'data',
            }),
          ],
        }),
      ],
      'graph_page',
    )

    const issueCodes = new Set(validateGraph(project, registry).issues.map((issue) => issue.code))

    expect(issueCodes).toContain('viewer_state_duplicate_id')
    expect(issueCodes).toContain('viewer_variant_duplicate_id')
    expect(issueCodes).toContain('viewer_action_state_unknown')
    expect(issueCodes).toContain('viewer_action_variant_unknown')
    expect(issueCodes).toContain('viewer_action_hotspot_unknown')
    expect(issueCodes).toContain('viewer_hotspot_linked_state_missing')
    expect(issueCodes).toContain('viewer_interactions_disabled')
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
