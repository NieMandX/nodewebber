import { describe, expect, it } from 'vitest'
import { validateGraph } from '@procedural-web-composer/graph-core'
import { createTestRegistry } from '../helpers/create-test-registry'
import { createEdge, createGraph, createNode, createProject } from '../helpers/project'

describe('graph event validation', () => {
  it('warns when event edges are connected to non-event ports', () => {
    const registry = createTestRegistry()
    const project = createProject(
      [
        createGraph({
          id: 'graph_page',
          name: 'Page',
          kind: 'page',
          nodes: [
            createNode({
              id: 'node_value',
              type: 'data.value',
              params: {
                value: true,
              },
            }),
            createNode({
              id: 'node_reaction',
              type: 'events.setViewerState',
              params: {
                viewerBlockNodeId: 'node_viewer',
                stateId: 'detail',
              },
            }),
          ],
          edges: [
            createEdge({
              id: 'edge_invalid_event',
              fromNodeId: 'node_value',
              fromPort: 'value',
              toNodeId: 'node_reaction',
              toPort: 'trigger',
              kind: 'event',
            }),
          ],
        }),
      ],
      'graph_page',
    )

    const result = validateGraph(project, registry)

    expect(result.issues.some((issue) => issue.code === 'event_edge_port_invalid')).toBe(true)
  })

  it('warns on missing viewer targets and invalid event reactions', () => {
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
              params: {
                maxWidth: 960,
                padding: 24,
              },
            }),
            createNode({
              id: 'node_viewer',
              type: 'viewer.block',
              params: {
                modelSrc: '/models/example.glb',
                interactionsEnabled: true,
              },
            }),
            createNode({
              id: 'node_viewer_secondary',
              type: 'viewer.block',
              params: {
                modelSrc: '/models/secondary.glb',
                interactionsEnabled: true,
              },
            }),
            createNode({
              id: 'node_state_default',
              type: 'viewer.state',
              params: {
                id: 'default',
              },
            }),
            createNode({
              id: 'node_states',
              type: 'viewer.states',
              params: {},
            }),
            createNode({
              id: 'node_source_missing_target',
              type: 'viewer.onStateChange',
              params: {
                eventName: 'viewer.state.any',
              },
            }),
            createNode({
              id: 'node_source_bad_state',
              type: 'viewer.onStateChange',
              params: {
                viewerBlockNodeId: 'node_viewer',
                stateId: 'missing',
              },
            }),
            createNode({
              id: 'node_reaction_bad_state',
              type: 'events.setViewerState',
              params: {
                viewerBlockNodeId: 'node_viewer',
                stateId: 'missing',
              },
            }),
            createNode({
              id: 'node_reaction_missing_viewer',
              type: 'events.setViewerVariant',
              params: {
                variantId: 'night',
              },
            }),
            createNode({
              id: 'node_reaction_focus',
              type: 'events.focusViewerCamera',
              params: {
                viewerBlockNodeId: 'node_viewer',
              },
            }),
          ],
          edges: [
            createEdge({
              id: 'edge_page_viewer',
              fromNodeId: 'node_page',
              fromPort: 'ui',
              toNodeId: 'node_viewer',
              toPort: 'parent',
              kind: 'structure',
            }),
            createEdge({
              id: 'edge_page_viewer_secondary',
              fromNodeId: 'node_page',
              fromPort: 'ui',
              toNodeId: 'node_viewer_secondary',
              toPort: 'parent',
              kind: 'structure',
            }),
            createEdge({
              id: 'edge_state_states',
              fromNodeId: 'node_state_default',
              fromPort: 'sceneState',
              toNodeId: 'node_states',
              toPort: 'states',
              kind: 'data',
            }),
            createEdge({
              id: 'edge_states_viewer',
              fromNodeId: 'node_states',
              fromPort: 'states',
              toNodeId: 'node_viewer',
              toPort: 'states',
              kind: 'data',
            }),
          ],
        }),
      ],
      'graph_page',
    )

    const result = validateGraph(project, registry)
    const codes = new Set(result.issues.map((issue) => issue.code))

    expect(codes.has('viewer_event_target_missing')).toBe(true)
    expect(codes.has('event_viewer_state_unknown')).toBe(true)
    expect(codes.has('event_reaction_viewer_missing')).toBe(true)
    expect(codes.has('event_focus_camera_incomplete')).toBe(true)
  })
})
