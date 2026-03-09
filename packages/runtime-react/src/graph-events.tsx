import React from 'react'
import type {
  GraphEventPayload,
  GraphEventReactionBinding,
  GraphEventRuntime,
  ViewerCameraConfig,
} from '@procedural-web-composer/shared-types'

export interface ViewerCommandTarget {
  focusCamera: (camera?: ViewerCameraConfig, stateId?: string) => void
  setState: (stateId: string) => void
  setVariant: (variantId: string) => void
  showHotspot: (hotspotId: string) => void
}

export interface GraphEventWarning {
  code: string
  message: string
  payload?: GraphEventPayload
  nodeId?: string
}

export interface GraphEventLogEntry {
  label?: string
  payload: GraphEventPayload
  nodeId: string
}

export interface GraphEventControllerOptions {
  onLog?: (entry: GraphEventLogEntry) => void
  onWarning?: (warning: GraphEventWarning) => void
}

export interface GraphEventController {
  emitUiClick: (input: {
    targetNodeId: string
    data?: Record<string, unknown>
  }) => void
  emitViewerHotspotClick: (input: {
    viewerNodeId: string
    hotspotId?: string
    data?: Record<string, unknown>
  }) => void
  emitViewerStateChange: (input: {
    viewerNodeId: string
    stateId?: string
    data?: Record<string, unknown>
  }) => void
  hasUiClickBinding: (targetNodeId: string) => boolean
  registerViewerCommands: (
    viewerNodeId: string,
    commands: ViewerCommandTarget,
  ) => () => void
}

const GraphEventContext = React.createContext<GraphEventController | null>(null)

export function createGraphEventController(
  eventRuntime: GraphEventRuntime | undefined,
  options: GraphEventControllerOptions = {},
): GraphEventController {
  const outgoingEdgesBySourceNodeId = new Map<string, GraphEventRuntime['edges']>()
  const reactionsByNodeId = new Map<string, GraphEventReactionBinding>()
  const viewerCommandsByNodeId = new Map<string, ViewerCommandTarget>()
  const sources = eventRuntime?.sources ?? []
  const maxDispatchDepth = eventRuntime?.maxDispatchDepth ?? 12

  for (const edge of eventRuntime?.edges ?? []) {
    outgoingEdgesBySourceNodeId.set(edge.sourceNodeId, [
      ...(outgoingEdgesBySourceNodeId.get(edge.sourceNodeId) ?? []),
      edge,
    ])
  }

  for (const reaction of eventRuntime?.reactions ?? []) {
    reactionsByNodeId.set(reaction.nodeId, reaction)
  }

  return {
    emitUiClick: ({ targetNodeId, data }) => {
      const matchingSources = sources.filter(
        (source) =>
          source.sourceType === 'ui.onClick' &&
          (!source.targetNodeId || source.targetNodeId === targetNodeId),
      )

      for (const source of matchingSources) {
        dispatchFromSource(source.nodeId, {
          type: source.eventName,
          sourceNodeId: source.nodeId,
          data: {
            ...(source.targetNodeId ? { targetNodeId: source.targetNodeId } : {}),
            targetNodeId,
            ...(data ?? {}),
          },
        })
      }
    },
    emitViewerHotspotClick: ({ viewerNodeId, hotspotId, data }) => {
      const matchingSources = sources.filter(
        (source) =>
          source.sourceType === 'viewer.onHotspotClick' &&
          source.viewerBlockNodeId === viewerNodeId &&
          (!source.hotspotId || source.hotspotId === hotspotId),
      )

      for (const source of matchingSources) {
        dispatchFromSource(source.nodeId, {
          type: source.eventName,
          sourceNodeId: source.nodeId,
          data: {
            viewerBlockNodeId: viewerNodeId,
            ...(hotspotId ? { hotspotId } : {}),
            ...(data ?? {}),
          },
        })
      }
    },
    emitViewerStateChange: ({ viewerNodeId, stateId, data }) => {
      const matchingSources = sources.filter(
        (source) =>
          source.sourceType === 'viewer.onStateChange' &&
          source.viewerBlockNodeId === viewerNodeId &&
          (!source.stateId || source.stateId === stateId),
      )

      for (const source of matchingSources) {
        dispatchFromSource(source.nodeId, {
          type: source.eventName,
          sourceNodeId: source.nodeId,
          data: {
            viewerBlockNodeId: viewerNodeId,
            ...(stateId ? { stateId } : {}),
            ...(data ?? {}),
          },
        })
      }
    },
    hasUiClickBinding: (targetNodeId) =>
      sources.some(
        (source) =>
          source.sourceType === 'ui.onClick' &&
          (!source.targetNodeId || source.targetNodeId === targetNodeId),
      ),
    registerViewerCommands: (viewerNodeId, commands) => {
      viewerCommandsByNodeId.set(viewerNodeId, commands)

      return () => {
        const registeredCommands = viewerCommandsByNodeId.get(viewerNodeId)

        if (registeredCommands === commands) {
          viewerCommandsByNodeId.delete(viewerNodeId)
        }
      }
    },
  }

  function dispatchFromSource(
    sourceNodeId: string,
    payload: GraphEventPayload,
    depth = 0,
    path: string[] = [sourceNodeId],
  ): void {
    if (depth >= maxDispatchDepth) {
      options.onWarning?.({
        code: 'event_dispatch_depth_exceeded',
        message: `Graph event dispatch exceeded max depth ${maxDispatchDepth}.`,
        payload,
        nodeId: sourceNodeId,
      })
      return
    }

    for (const edge of outgoingEdgesBySourceNodeId.get(sourceNodeId) ?? []) {
      const reaction = reactionsByNodeId.get(edge.targetNodeId)

      if (!reaction) {
        continue
      }

      if (path.includes(reaction.nodeId)) {
        options.onWarning?.({
          code: 'event_dispatch_cycle_detected',
          message: `Graph event dispatch cycle detected at node "${reaction.nodeId}".`,
          payload,
          nodeId: reaction.nodeId,
        })
        continue
      }

      executeReaction(reaction, payload, depth + 1, [...path, reaction.nodeId])
    }
  }

  function executeReaction(
    reaction: GraphEventReactionBinding,
    payload: GraphEventPayload,
    depth: number,
    path: string[],
  ): void {
    if (reaction.reactionType === 'events.setViewerState') {
      const viewerNodeId =
        reaction.viewerBlockNodeId ?? readString(payload.data?.viewerBlockNodeId)
      const stateId = reaction.stateId ?? readString(payload.data?.stateId)

      if (viewerNodeId && stateId) {
        viewerCommandsByNodeId.get(viewerNodeId)?.setState(stateId)
      }

      return
    }

    if (reaction.reactionType === 'events.setViewerVariant') {
      const viewerNodeId =
        reaction.viewerBlockNodeId ?? readString(payload.data?.viewerBlockNodeId)
      const variantId = reaction.variantId ?? readString(payload.data?.variantId)

      if (viewerNodeId && variantId) {
        viewerCommandsByNodeId.get(viewerNodeId)?.setVariant(variantId)
      }

      return
    }

    if (reaction.reactionType === 'events.focusViewerCamera') {
      const viewerNodeId =
        reaction.viewerBlockNodeId ?? readString(payload.data?.viewerBlockNodeId)
      const stateId = reaction.stateId ?? readString(payload.data?.stateId)

      if (viewerNodeId) {
        viewerCommandsByNodeId.get(viewerNodeId)?.focusCamera(reaction.camera, stateId)
      }

      return
    }

    if (reaction.reactionType === 'events.log') {
      options.onLog?.({
        payload,
        nodeId: reaction.nodeId,
        ...(reaction.label ? { label: reaction.label } : {}),
      })
      return
    }

    if (reaction.reactionType === 'events.emit') {
      dispatchFromSource(
        reaction.nodeId,
        {
          type: reaction.eventName ?? payload.type,
          sourceNodeId: reaction.nodeId,
          data: {
            ...(payload.data ?? {}),
            ...(reaction.payload ?? {}),
          },
        },
        depth,
        path,
      )
    }
  }
}

export function GraphEventProvider(props: {
  eventRuntime: GraphEventRuntime | undefined
  children: React.ReactNode
}): JSX.Element {
  const controller = React.useMemo(
    () =>
      createGraphEventController(props.eventRuntime, {
        onLog: ({ label, payload, nodeId }) => {
          const prefix = label ? `[${label}]` : '[graph-event]'
          console.info(prefix, nodeId, payload)
        },
        onWarning: ({ code, message, payload, nodeId }) => {
          console.warn(`[${code}]`, message, nodeId ?? '', payload ?? '')
        },
      }),
    [props.eventRuntime],
  )

  return <GraphEventContext.Provider value={controller}>{props.children}</GraphEventContext.Provider>
}

export function useGraphEventController(): GraphEventController | null {
  return React.useContext(GraphEventContext)
}

function readString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined
}
