import { describe, expect, it } from 'vitest'
import { validateGraph } from '@procedural-web-composer/graph-core'
import { createTestRegistry } from '../helpers/create-test-registry'
import { createEdge, createGraph, createNode, createProject } from '../helpers/project'

describe('slot and data validation issue codes', () => {
  it('surfaces slot and data misuse with stable issue codes', () => {
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
              id: 'node_heading',
              type: 'content.heading',
              x: 200,
              params: { text: 'Heading', level: 1, align: 'left' },
            }),
            createNode({
              id: 'node_value',
              type: 'data.value',
              params: { value: 'Bound value' },
            }),
            createNode({
              id: 'node_array',
              type: 'data.array',
              params: { value: ['a'] },
            }),
            createNode({
              id: 'node_repeat',
              type: 'data.repeat',
              x: 320,
              params: {},
            }),
            createNode({
              id: 'node_instance',
              type: 'subgraph.instance',
              x: 420,
              params: {
                subgraphGraphId: 'graph_component',
              },
            }),
          ],
          edges: [
            createEdge({
              id: 'edge_page_heading',
              fromNodeId: 'node_page',
              fromPort: 'ui',
              toNodeId: 'node_heading',
              toPort: 'parent',
              kind: 'structure',
              slot: 'footer',
            }),
            createEdge({
              id: 'edge_value_heading',
              fromNodeId: 'node_value',
              fromPort: 'value',
              toNodeId: 'node_heading',
              toPort: 'text',
              kind: 'data',
              slot: 'children',
            }),
            createEdge({
              id: 'edge_array_repeat',
              fromNodeId: 'node_array',
              fromPort: 'value',
              toNodeId: 'node_repeat',
              toPort: 'items',
              kind: 'data',
            }),
            createEdge({
              id: 'edge_value_instance_unknown',
              fromNodeId: 'node_value',
              fromPort: 'value',
              toNodeId: 'node_instance',
              toPort: 'unknownParam',
              kind: 'data',
            }),
          ],
        }),
        createGraph({
          id: 'graph_component',
          name: 'Component',
          kind: 'subgraph',
          subgraph: {
            publicParamsSchema: {
              title: { type: 'string' },
            },
            publicDefaultParams: {
              title: 'Card title',
            },
            publicSlots: ['children', 'children'],
          },
          nodes: [
            createNode({
              id: 'node_slot',
              type: 'subgraph.slot',
              params: {
                name: 'actions',
              },
            }),
          ],
        }),
      ],
      'graph_page',
    )

    const issueCodes = new Set(validateGraph(project, registry).issues.map((issue) => issue.code))

    expect(issueCodes).toContain('slot_on_non_structure_edge')
    expect(issueCodes).toContain('structure_slot_unknown')
    expect(issueCodes).toContain('subgraph_public_param_missing')
    expect(issueCodes).toContain('repeat_template_missing')
    expect(issueCodes).toContain('subgraph_public_slots_duplicate')
    expect(issueCodes).toContain('subgraph_slot_undeclared')
  })
})
