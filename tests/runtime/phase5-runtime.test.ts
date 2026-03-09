import { describe, expect, it } from 'vitest'
import dataCardList from '../../examples/data-card-list.json'
import slotShellLayout from '../../examples/slot-shell-layout.json'
import { evaluateGraphDocument, REPEAT_PREVIEW_WARNING_THRESHOLD } from '@procedural-web-composer/runtime-core'
import { walkUiTree, type UiNode } from '@procedural-web-composer/ui-tree'
import type { NodeDefinition } from '@procedural-web-composer/shared-types'
import { createTestRegistry, emptyParamsSchema } from '../helpers/create-test-registry'
import { createEdge, createGraph, createNode, createProject } from '../helpers/project'

describe('Phase 5 runtime', () => {
  it('resolves named slots into the UI tree', () => {
    const registry = createTestRegistry()
    const project = structuredClone(slotShellLayout)
    const result = evaluateGraphDocument(project, project.settings.entryGraphId, registry)

    expect(result.root?.kind).toBe('Page')

    const shellNode = findFirstUiNode(result.root, (node) => node.kind === 'Shell')

    expect(shellNode?.slots?.header?.[0]?.kind).toBe('Heading')
    expect(shellNode?.slots?.body?.[0]?.kind).toBe('Text')
    expect(shellNode?.slots?.footer?.[0]?.kind).toBe('Button')
  })

  it('reports recursive subgraph evaluation', () => {
    const registry = createTestRegistry()
    const pageGraph = createGraph({
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
          id: 'node_recursive_instance',
          type: 'subgraph.instance',
          x: 200,
          params: {
            subgraphGraphId: 'graph_recursive',
          },
        }),
      ],
      edges: [
        createEdge({
          id: 'edge_page_instance',
          fromNodeId: 'node_page',
          fromPort: 'ui',
          toNodeId: 'node_recursive_instance',
          toPort: 'parent',
          kind: 'structure',
        }),
      ],
    })
    const recursiveGraph = createGraph({
      id: 'graph_recursive',
      name: 'Recursive',
      kind: 'subgraph',
      subgraph: {
        publicParamsSchema: {},
        publicDefaultParams: {},
      },
      nodes: [
        createNode({
          id: 'node_recursive_self',
          type: 'subgraph.instance',
          params: {
            subgraphGraphId: 'graph_recursive',
          },
        }),
      ],
    })
    const project = createProject([pageGraph, recursiveGraph], 'graph_page')

    const result = evaluateGraphDocument(project, 'graph_page', registry)

    expect(result.validation.issues.map((issue) => issue.code)).toContain('subgraph_cycle_detected')
    expect(result.issues.map((issue) => issue.code)).toContain('subgraph_cycle_detected')
  })

  it('renders repeated reusable subgraphs as UI output', () => {
    const registry = createTestRegistry()
    const project = structuredClone(dataCardList)
    const result = evaluateGraphDocument(project, project.settings.entryGraphId, registry)
    const buttonLabels = collectUiNodes(result.root, (node) => node.kind === 'Button').map((node) =>
      String(node.props.label),
    )

    expect(result.root?.kind).toBe('Page')
    expect(buttonLabels).toEqual([
      'Open section',
      'Inspect logic',
      'Preview cards',
    ])
  })

  it('uses data-bound subgraph params before instance params and defaults', () => {
    const registry = createTestRegistry()
    const pageGraph = createGraph({
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
          id: 'node_value',
          type: 'data.value',
          params: { value: 'edge override' },
        }),
        createNode({
          id: 'node_instance',
          type: 'subgraph.instance',
          x: 200,
          params: {
            subgraphGraphId: 'graph_component_text',
            text: 'instance fallback',
          },
        }),
      ],
      edges: [
        createEdge({
          id: 'edge_page_instance',
          fromNodeId: 'node_page',
          fromPort: 'ui',
          toNodeId: 'node_instance',
          toPort: 'parent',
          kind: 'structure',
        }),
        createEdge({
          id: 'edge_value_instance',
          fromNodeId: 'node_value',
          fromPort: 'value',
          toNodeId: 'node_instance',
          toPort: 'text',
          kind: 'data',
        }),
      ],
    })
    const componentGraph = createGraph({
      id: 'graph_component_text',
      name: 'Text Component',
      kind: 'subgraph',
      subgraph: {
        publicParamsSchema: {
          text: { type: 'string' },
        },
        publicDefaultParams: {
          text: 'default fallback',
        },
      },
      nodes: [
        createNode({
          id: 'node_param_text',
          type: 'subgraph.param',
          params: {
            key: 'text',
            fallbackValue: 'param fallback',
          },
        }),
        createNode({
          id: 'node_text',
          type: 'content.text',
          x: 200,
          params: {
            text: 'content fallback',
          },
        }),
      ],
      edges: [
        createEdge({
          id: 'edge_param_text',
          fromNodeId: 'node_param_text',
          fromPort: 'value',
          toNodeId: 'node_text',
          toPort: 'text',
          kind: 'data',
        }),
      ],
    })
    const project = createProject([pageGraph, componentGraph], 'graph_page')

    const result = evaluateGraphDocument(project, 'graph_page', registry)
    const textNode = findFirstUiNode(result.root, (node) => node.kind === 'Text')

    expect(textNode?.props.text).toBe('edge override')
  })

  it('warns when previewing a large repeat list', () => {
    const registry = createTestRegistry()
    const items = Array.from({ length: REPEAT_PREVIEW_WARNING_THRESHOLD + 1 }, () => ({ title: 'Card' }))
    const project = createRepeatProject(items)

    const result = evaluateGraphDocument(project, 'graph_page', registry)

    expect(result.issues.map((issue) => issue.code)).toContain('repeat_large_list')
    expect(result.root?.kind).toBe('Page')
  })

  it('memoizes repeated item subgraph evaluation for identical items when index is unused', () => {
    let evaluateCount = 0
    const memoLeafDefinition: NodeDefinition = {
      type: 'test.memo-leaf',
      version: 1,
      title: 'Memo Leaf',
      category: 'Test',
      inputs: [],
      outputs: [
        {
          key: 'ui',
          valueType: 'ui-node',
        },
      ],
      defaultParams: {},
      paramsSchema: emptyParamsSchema,
      evaluate: (node) => {
        evaluateCount += 1

        return {
          outputs: {
            ui: {
              id: node.id,
              kind: 'Text',
              props: {
                text: 'Memoized item',
              },
              children: [],
            } satisfies UiNode,
          },
        }
      },
    }
    const registry = createTestRegistry([memoLeafDefinition])
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
              id: 'node_items',
              type: 'data.array',
              params: { value: ['same', 'same', 'same'] },
            }),
            createNode({
              id: 'node_repeat',
              type: 'data.repeat',
              x: 200,
              params: {
                itemSubgraphGraphId: 'graph_repeat_item',
              },
            }),
          ],
          edges: [
            createEdge({
              id: 'edge_page_repeat',
              fromNodeId: 'node_page',
              fromPort: 'ui',
              toNodeId: 'node_repeat',
              toPort: 'parent',
              kind: 'structure',
            }),
            createEdge({
              id: 'edge_items_repeat',
              fromNodeId: 'node_items',
              fromPort: 'value',
              toNodeId: 'node_repeat',
              toPort: 'items',
              kind: 'data',
            }),
          ],
        }),
        createGraph({
          id: 'graph_repeat_item',
          name: 'Repeat Item',
          kind: 'subgraph',
          subgraph: {
            publicParamsSchema: {},
            publicDefaultParams: {},
          },
          nodes: [
            createNode({
              id: 'node_leaf',
              type: 'test.memo-leaf',
            }),
          ],
        }),
      ],
      'graph_page',
    )

    const result = evaluateGraphDocument(project, 'graph_page', registry)
    const repeatedTexts = collectUiNodes(result.root, (node) => node.kind === 'Text')

    expect(evaluateCount).toBe(1)
    expect(repeatedTexts).toHaveLength(3)
  })
})

function createRepeatProject(items: unknown[]) {
  return createProject(
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
            id: 'node_items',
            type: 'data.array',
            params: { value: items },
          }),
          createNode({
            id: 'node_repeat',
            type: 'data.repeat',
            x: 200,
            params: {
              itemSubgraphGraphId: 'graph_item',
            },
          }),
        ],
        edges: [
          createEdge({
            id: 'edge_page_repeat',
            fromNodeId: 'node_page',
            fromPort: 'ui',
            toNodeId: 'node_repeat',
            toPort: 'parent',
            kind: 'structure',
          }),
          createEdge({
            id: 'edge_items_repeat',
            fromNodeId: 'node_items',
            fromPort: 'value',
            toNodeId: 'node_repeat',
            toPort: 'items',
            kind: 'data',
          }),
        ],
      }),
      createGraph({
        id: 'graph_item',
        name: 'Item',
        kind: 'subgraph',
        subgraph: {
          publicParamsSchema: {
            item: { type: 'json' },
          },
          publicDefaultParams: {
            item: {},
          },
        },
        nodes: [
          createNode({
            id: 'node_item_text',
            type: 'content.text',
            params: {
              text: 'Repeated item',
            },
          }),
        ],
      }),
    ],
    'graph_page',
  )
}

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

function collectUiNodes(
  root: UiNode | null,
  predicate: (node: UiNode) => boolean,
): UiNode[] {
  if (!root) {
    return []
  }

  const matches: UiNode[] = []

  walkUiTree(root, (node) => {
    if (predicate(node)) {
      matches.push(node)
    }
  })

  return matches
}
