import { describe, expect, it, vi } from 'vitest'
import buttonToViewerState from '../../examples/button-to-viewer-state.json'
import viewerEventsInSubgraph from '../../examples/viewer-events-in-subgraph.json'
import viewerHotspotToState from '../../examples/viewer-hotspot-to-state.json'
import viewerStateRelay from '../../examples/viewer-state-relay.json'
import { evaluateGraphDocument } from '@procedural-web-composer/runtime-core'
import {
  createGraphEventController,
  renderUiTree,
} from '@procedural-web-composer/runtime-react'
import type { GraphEventRuntime } from '@procedural-web-composer/shared-types'
import { createTestRegistry } from '../helpers/create-test-registry'

describe('graph events runtime', () => {
  it('routes viewer hotspot click events into viewer state reactions', () => {
    const registry = createTestRegistry()
    const project = structuredClone(viewerHotspotToState)
    const result = evaluateGraphDocument(project, project.settings.entryGraphId, registry)
    const setState = vi.fn()
    const controller = createGraphEventController(result.eventRuntime)

    controller.registerViewerCommands('node_hotspot_viewer', {
      focusCamera: vi.fn(),
      setState,
      setVariant: vi.fn(),
      showHotspot: vi.fn(),
    })
    controller.emitViewerHotspotClick({
      viewerNodeId: 'node_hotspot_viewer',
      hotspotId: 'door',
    })

    expect(result.root?.kind).toBe('Page')
    expect(result.eventRuntime).toBeDefined()
    expect(() => renderUiTree(result.root!)).not.toThrow()
    expect(setState).toHaveBeenCalledWith('detail')
  })

  it('routes ui.click events into viewer state reactions', () => {
    const registry = createTestRegistry()
    const project = structuredClone(buttonToViewerState)
    const result = evaluateGraphDocument(project, project.settings.entryGraphId, registry)
    const setState = vi.fn()
    const controller = createGraphEventController(result.eventRuntime)

    controller.registerViewerCommands('node_button_viewer', {
      focusCamera: vi.fn(),
      setState,
      setVariant: vi.fn(),
      showHotspot: vi.fn(),
    })
    controller.emitUiClick({
      targetNodeId: 'node_button_trigger',
      data: {
        label: 'Open Detail View',
      },
    })

    expect(setState).toHaveBeenCalledWith('detail')
  })

  it('supports chained relay through events.emit on viewer state change', () => {
    const registry = createTestRegistry()
    const project = structuredClone(viewerStateRelay)
    const result = evaluateGraphDocument(project, project.settings.entryGraphId, registry)
    const onLog = vi.fn()
    const controller = createGraphEventController(result.eventRuntime, { onLog })

    controller.emitViewerStateChange({
      viewerNodeId: 'node_relay_viewer',
      stateId: 'detail',
    })

    expect(onLog).toHaveBeenCalledTimes(1)
    expect(onLog.mock.calls[0]?.[0]?.label).toBe('viewer-relay')
    expect(onLog.mock.calls[0]?.[0]?.payload.type).toBe('viewer.detail.relay')
    expect(onLog.mock.calls[0]?.[0]?.payload.data?.stage).toBe('detail')
  })

  it('guards against event dispatch loops', () => {
    const warnings: string[] = []
    const controller = createGraphEventController(
      {
        graphId: 'graph_loop',
        maxDispatchDepth: 8,
        sources: [
          {
            nodeId: 'node_source',
            graphId: 'graph_loop',
            sourceType: 'ui.onClick',
            outputPort: 'event',
            eventName: 'ui.loop',
            targetNodeId: 'node_button',
          },
        ],
        reactions: [
          {
            nodeId: 'node_relay',
            graphId: 'graph_loop',
            reactionType: 'events.emit',
            inputPort: 'trigger',
            outputPort: 'event',
            eventName: 'ui.loop',
          },
        ],
        edges: [
          {
            edgeId: 'edge_source_relay',
            graphId: 'graph_loop',
            sourceNodeId: 'node_source',
            sourcePort: 'event',
            targetNodeId: 'node_relay',
            targetPort: 'trigger',
          },
          {
            edgeId: 'edge_relay_self',
            graphId: 'graph_loop',
            sourceNodeId: 'node_relay',
            sourcePort: 'event',
            targetNodeId: 'node_relay',
            targetPort: 'trigger',
          },
        ],
      } satisfies GraphEventRuntime,
      {
        onWarning: (warning) => warnings.push(warning.code),
      },
    )

    controller.emitUiClick({
      targetNodeId: 'node_button',
    })

    expect(warnings).toContain('event_dispatch_cycle_detected')
  })

  it('keeps event wiring working inside reusable subgraphs', () => {
    const registry = createTestRegistry()
    const project = structuredClone(viewerEventsInSubgraph)
    const result = evaluateGraphDocument(project, project.settings.entryGraphId, registry)
    const setState = vi.fn()
    const controller = createGraphEventController(result.eventRuntime)

    controller.registerViewerCommands('node_subgraph_panel_viewer', {
      focusCamera: vi.fn(),
      setState,
      setVariant: vi.fn(),
      showHotspot: vi.fn(),
    })
    controller.emitUiClick({
      targetNodeId: 'node_subgraph_panel_button',
    })

    expect(result.root?.kind).toBe('Page')
    expect(result.validation.issues.filter((issue) => issue.severity === 'error')).toHaveLength(0)
    expect(result.issues.filter((issue) => issue.severity === 'error')).toHaveLength(0)
    expect(() => renderUiTree(result.root!)).not.toThrow()
    expect(setState).toHaveBeenCalledWith('detail')
  })
})
