import { describe, expect, it } from 'vitest'
import { validateGraph } from '@procedural-web-composer/graph-core'
import { createTestRegistry } from '../helpers/create-test-registry'
import { createGraph, createNode, createProject } from '../helpers/project'

describe('viewer validation', () => {
  it('emits viewer warning codes for incomplete config', () => {
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
              id: 'node_viewer_block',
              type: 'viewer.block',
              params: {},
            }),
            createNode({
              id: 'node_viewer_model',
              type: 'viewer.model',
              params: {},
            }),
            createNode({
              id: 'node_viewer_environment',
              type: 'viewer.environment',
              params: { type: 'hdri' },
            }),
            createNode({
              id: 'node_viewer_hotspot',
              type: 'viewer.hotspot',
              params: { label: 'Invalid hotspot' },
            }),
            createNode({
              id: 'node_viewer_camera',
              type: 'viewer.cameraPreset',
              params: { fov: 0, minDistance: 5, maxDistance: 2 },
            }),
            createNode({
              id: 'node_viewer_hotspots',
              type: 'viewer.hotspots',
              params: {},
            }),
          ],
        }),
      ],
      'graph_page',
    )

    const issueCodes = new Set(validateGraph(project, registry).issues.map((issue) => issue.code))

    expect(issueCodes).toContain('viewer_block_model_missing')
    expect(issueCodes).toContain('viewer_model_src_missing')
    expect(issueCodes).toContain('viewer_environment_hdri_missing')
    expect(issueCodes).toContain('viewer_hotspot_position_invalid')
    expect(issueCodes).toContain('viewer_camera_invalid')
    expect(issueCodes).toContain('viewer_hotspots_empty')
  })
})
