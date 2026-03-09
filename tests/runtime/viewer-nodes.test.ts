import { describe, expect, it } from 'vitest'
import viewerBasic from '../../examples/viewer-basic.json'
import viewerHotspots from '../../examples/viewer-hotspots.json'
import viewerInSubgraph from '../../examples/viewer-in-subgraph.json'
import { evaluateGraphDocument } from '@procedural-web-composer/runtime-core'
import { renderUiTree } from '@procedural-web-composer/runtime-react'
import { walkUiTree, type UiNode } from '@procedural-web-composer/ui-tree'
import { createTestRegistry } from '../helpers/create-test-registry'
import { createEdge, createGraph, createNode, createProject } from '../helpers/project'

describe('viewer nodes', () => {
  it('evaluates viewer.block from static params', () => {
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
              id: 'node_viewer',
              type: 'viewer.block',
              x: 200,
              params: {
                title: 'Static Viewer',
                modelSrc: '/models/static.glb',
                background: '#101826',
                loadingMode: 'eager',
                allowOrbit: false,
                showToolbar: false,
                exposure: 1.3,
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
          ],
        }),
      ],
      'graph_page',
    )

    const result = evaluateGraphDocument(project, 'graph_page', registry)
    const viewerNode = findFirstUiNode(result.root, (node) => node.kind === 'ViewerBlock')

    expect(viewerNode?.props.title).toBe('Static Viewer')
    expect(viewerNode?.props.modelSrc).toBe('/models/static.glb')
    expect(viewerNode?.props.loadingMode).toBe('eager')
    expect(viewerNode?.props.allowOrbit).toBe(false)
    expect(viewerNode?.props.showToolbar).toBe(false)
  })

  it('uses connected viewer.model over block fallback params', () => {
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
              id: 'node_model',
              type: 'viewer.model',
              params: {
                src: '/models/connected.glb',
                format: 'glb',
              },
            }),
            createNode({
              id: 'node_viewer',
              type: 'viewer.block',
              x: 200,
              params: {
                title: 'Connected Viewer',
                modelSrc: '/models/fallback.glb',
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
              id: 'edge_model_viewer',
              fromNodeId: 'node_model',
              fromPort: 'model',
              toNodeId: 'node_viewer',
              toPort: 'model',
              kind: 'data',
            }),
          ],
        }),
      ],
      'graph_page',
    )

    const result = evaluateGraphDocument(project, 'graph_page', registry)
    const viewerNode = findFirstUiNode(result.root, (node) => node.kind === 'ViewerBlock')

    expect(viewerNode?.props.modelSrc).toBe('/models/connected.glb')
    expect((viewerNode?.props.model as { format?: string } | undefined)?.format).toBe('glb')
  })

  it('propagates environment, camera, hotspot, and overlay config into the viewer UiNode', () => {
    const registry = createTestRegistry()
    const basicProject = structuredClone(viewerBasic)
    const basicResult = evaluateGraphDocument(basicProject, basicProject.settings.entryGraphId, registry)
    const basicViewerNode = findFirstUiNode(basicResult.root, (node) => node.kind === 'ViewerBlock')
    const hotspotProject = structuredClone(viewerHotspots)
    const hotspotResult = evaluateGraphDocument(hotspotProject, hotspotProject.settings.entryGraphId, registry)
    const hotspotViewerNode = findFirstUiNode(hotspotResult.root, (node) => node.kind === 'ViewerBlock')

    expect((basicViewerNode?.props.environment as { type?: string } | undefined)?.type).toBe('color')
    expect((basicViewerNode?.props.cameraPreset as { mode?: string } | undefined)?.mode).toBe('orbit')
    expect((hotspotViewerNode?.props.hotspots as unknown[] | undefined)?.length).toBe(2)
    expect(hotspotViewerNode?.slots?.overlay?.[0]?.kind).toBe('ViewerOverlay')
  })

  it('renders viewer nodes through runtime-react without crashing', () => {
    const registry = createTestRegistry()
    const project = structuredClone(viewerBasic)
    const result = evaluateGraphDocument(project, project.settings.entryGraphId, registry)

    expect(() => renderUiTree(result.root!)).not.toThrow()
  })

  it('renders shipped viewer sample projects through the preview pipeline', () => {
    const registry = createTestRegistry()
    const samples = [
      structuredClone(viewerBasic),
      structuredClone(viewerHotspots),
      structuredClone(viewerInSubgraph),
    ]

    for (const sample of samples) {
      const result = evaluateGraphDocument(sample, sample.settings.entryGraphId, registry)

      expect(result.root).not.toBeNull()
      expect(result.root?.kind).toBe('Page')
      expect(result.validation.issues.filter((issue) => issue.severity === 'error')).toHaveLength(0)
      expect(result.issues.filter((issue) => issue.severity === 'error')).toHaveLength(0)
      expect(() => renderUiTree(result.root!)).not.toThrow()
    }
  })

  it('supports viewer blocks inside reusable subgraphs', () => {
    const registry = createTestRegistry()
    const project = structuredClone(viewerInSubgraph)
    const result = evaluateGraphDocument(project, project.settings.entryGraphId, registry)
    const viewerNode = findFirstUiNode(result.root, (node) => node.kind === 'ViewerBlock')

    expect(result.root?.kind).toBe('Page')
    expect(viewerNode?.props.modelSrc).toBe('/models/headset.glb')
    expect(findFirstUiNode(result.root, (node) => node.kind === 'Heading')?.props.text).toBe('Headset Viewer')
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
