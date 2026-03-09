import { describe, expect, it } from 'vitest'
import { validateGraph } from '@procedural-web-composer/graph-core'
import { createTestRegistry } from '../helpers/create-test-registry'
import { createEdge, createGraph, createNode, createProject } from '../helpers/project'

describe('presentation validation', () => {
  it('warns on duplicate step ids and unknown step references', () => {
    const registry = createTestRegistry()
    const project = createProject(
      [
        createGraph({
          id: 'graph_page',
          name: 'Page',
          kind: 'page',
          nodes: [
            createNode({
              id: 'node_step_a',
              type: 'presentation.step',
              params: {
                id: 'intro',
              },
            }),
            createNode({
              id: 'node_step_b',
              type: 'presentation.step',
              params: {
                id: 'intro',
              },
            }),
            createNode({
              id: 'node_steps',
              type: 'presentation.steps',
              params: {},
            }),
            createNode({
              id: 'node_set_step',
              type: 'presentation.setStep',
              params: {
                stepId: 'missing',
              },
            }),
          ],
          edges: [
            createEdge({
              id: 'edge_step_a',
              fromNodeId: 'node_step_a',
              fromPort: 'step',
              toNodeId: 'node_steps',
              toPort: 'steps',
              kind: 'data',
            }),
            createEdge({
              id: 'edge_step_b',
              fromNodeId: 'node_step_b',
              fromPort: 'step',
              toNodeId: 'node_steps',
              toPort: 'steps',
              kind: 'data',
            }),
          ],
        }),
      ],
      'graph_page',
    )

    const result = validateGraph(project, registry)
    const codes = new Set(result.issues.map((issue) => issue.code))

    expect(codes.has('presentation_step_duplicate_id')).toBe(true)
    expect(codes.has('presentation_step_unknown')).toBe(true)
  })

  it('warns on empty step aggregators and bad visibility references', () => {
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
              id: 'node_text',
              type: 'content.text',
              params: {
                text: 'Hello',
                visibleOnSteps: ['intro', 'detail'],
                hiddenOnSteps: ['detail', 'missing'],
              },
            }),
            createNode({
              id: 'node_step',
              type: 'presentation.step',
              params: {
                id: 'intro',
                viewerStateId: 'unknown-state',
              },
            }),
            createNode({
              id: 'node_steps',
              type: 'presentation.steps',
              params: {},
            }),
          ],
          edges: [
            createEdge({
              id: 'edge_page_text',
              fromNodeId: 'node_page',
              fromPort: 'ui',
              toNodeId: 'node_text',
              toPort: 'parent',
              kind: 'structure',
            }),
          ],
        }),
      ],
      'graph_page',
    )

    const result = validateGraph(project, registry)
    const codes = new Set(result.issues.map((issue) => issue.code))

    expect(codes.has('presentation_steps_empty')).toBe(true)
    expect(codes.has('presentation_step_viewer_state_unknown')).toBe(true)
    expect(codes.has('presentation_visibility_step_unknown')).toBe(true)
    expect(codes.has('presentation_visibility_contradictory')).toBe(true)
  })
})
