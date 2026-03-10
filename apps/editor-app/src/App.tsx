import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { evaluateGraphDocument, loadProjectDocument } from '@procedural-web-composer/runtime-core'
import { PreviewRenderer } from '@procedural-web-composer/runtime-react'
import { useStore } from 'zustand'
import { GraphIssuesPanel } from './components/GraphIssuesPanel'
import { EditorCanvas } from './components/EditorCanvas'
import { NodeInspector } from './components/NodeInspector'
import { NodePalette } from './components/NodePalette'
import { SubgraphMetadataPanel } from './components/SubgraphMetadataPanel'
import { registry } from './registry'
import { sampleProjects } from './sample-projects'
import { editorStore } from './session'

export function App(): JSX.Element {
  const shellRef = useRef<HTMLDivElement>(null)
  const headerRef = useRef<HTMLElement>(null)
  const dragStateRef = useRef<ResizeDragState | null>(null)
  const project = useStore(editorStore, (state) => state.project)
  const jsonBuffer = useStore(editorStore, (state) => state.jsonBuffer)
  const selectedGraphId = useStore(editorStore, (state) => state.selectedGraphId)
  const selectedNodeIds = useStore(editorStore, (state) => state.selectedNodeIds)
  const canUndo = useStore(editorStore, (state) => state.history.past.length > 0)
  const canRedo = useStore(editorStore, (state) => state.history.future.length > 0)
  const [loadError, setLoadError] = useState<string>()
  const [conversionError, setConversionError] = useState<string>()
  const [activeResizeHandle, setActiveResizeHandle] = useState<ResizeHandleKind | null>(null)
  const [layout, setLayout] = useState<EditorLayoutState>({
    leftColPx: 280,
    rightColPx: 320,
    topRowFr: 1,
    bottomRowFr: 0.95,
  })
  const selectedGraph = project.graphs.find((graph) => graph.id === selectedGraphId)
  const runtime = evaluateGraphDocument(project, selectedGraphId, registry)
  const selectedGraphIssues = runtime.validation.issues.filter((issue) =>
    belongsToGraph(issue.graphId, selectedGraphId),
  )
  const selectedGraphRuntimeIssues = runtime.issues.filter((issue) =>
    belongsToGraph(issue.graphId, selectedGraphId),
  )

  useEffect(() => {
    const handleResize = (): void => {
      if (!shellRef.current || !headerRef.current) {
        return
      }

      setLayout((current) => clampLayoutState(current, shellRef.current!, headerRef.current!))
    }

    window.addEventListener('resize', handleResize)
    handleResize()

    return () => window.removeEventListener('resize', handleResize)
  }, [])

  useEffect(() => {
    if (!activeResizeHandle) {
      return
    }

    const onPointerMove = (event: PointerEvent): void => {
      if (!shellRef.current || !headerRef.current || !dragStateRef.current) {
        return
      }

      const metrics = getShellMetrics(shellRef.current)
      const seamSizePx = getSeamSizePx(shellRef.current)
      const totalHorizontalSpace = metrics.contentWidth - seamSizePx * 2
      const minTopSpace = MIN_TOP_PANEL_HEIGHT
      const minBottomSpace = MIN_BOTTOM_PANEL_HEIGHT
      const minCenterWidth = MIN_CENTER_PANEL_WIDTH

      if (dragStateRef.current.kind === 'left') {
        const maxLeft = Math.max(
          MIN_LEFT_PANEL_WIDTH,
          totalHorizontalSpace - dragStateRef.current.layout.rightColPx - minCenterWidth,
        )
        const nextLeft = clamp(event.clientX - metrics.contentLeft, MIN_LEFT_PANEL_WIDTH, maxLeft)

        setLayout((current) => ({
          ...current,
          leftColPx: nextLeft,
        }))
        return
      }

      if (dragStateRef.current.kind === 'right') {
        const maxRight = Math.max(
          MIN_RIGHT_PANEL_WIDTH,
          totalHorizontalSpace - dragStateRef.current.layout.leftColPx - minCenterWidth,
        )
        const nextRight = clamp(
          metrics.contentLeft + metrics.contentWidth - event.clientX,
          MIN_RIGHT_PANEL_WIDTH,
          maxRight,
        )

        setLayout((current) => ({
          ...current,
          rightColPx: nextRight,
        }))
        return
      }

      const headerHeight = headerRef.current.getBoundingClientRect().height
      const verticalSpace = Math.max(
        minTopSpace + minBottomSpace,
        metrics.contentHeight - headerHeight - seamSizePx,
      )
      const nextTopHeightPx = clamp(
        event.clientY - (metrics.contentTop + headerHeight),
        minTopSpace,
        Math.max(minTopSpace, verticalSpace - minBottomSpace),
      )
      const totalFr = dragStateRef.current.layout.topRowFr + dragStateRef.current.layout.bottomRowFr
      const nextTopFr = (nextTopHeightPx / verticalSpace) * totalFr

      setLayout((current) => ({
        ...current,
        topRowFr: nextTopFr,
        bottomRowFr: totalFr - nextTopFr,
      }))
    }

    const onPointerUp = (): void => {
      dragStateRef.current = null
      setActiveResizeHandle(null)
    }

    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)

    return () => {
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
    }
  }, [activeResizeHandle])

  const startResize = (kind: ResizeHandleKind, event: React.PointerEvent<HTMLDivElement>): void => {
    if (window.matchMedia('(max-width: 1200px)').matches) {
      return
    }

    if (!shellRef.current || !headerRef.current) {
      return
    }

    dragStateRef.current = {
      kind,
      layout,
    }
    setActiveResizeHandle(kind)
    event.preventDefault()
  }

  const shellStyle: CSSProperties & Record<string, string> = {
    '--left-col-width': `${Math.round(layout.leftColPx)}px`,
    '--right-col-width': `${Math.round(layout.rightColPx)}px`,
    '--top-row-size': `${layout.topRowFr.toFixed(4)}fr`,
    '--bottom-row-size': `${layout.bottomRowFr.toFixed(4)}fr`,
  }

  return (
    <div
      ref={shellRef}
      className={`editor-shell${activeResizeHandle ? ` resizing-${activeResizeHandle}` : ''}`}
      style={shellStyle}
    >
      <header ref={headerRef} className="app-header">
        <div>
          <p className="eyebrow">Procedural Web Composer</p>
          <h1>Node-based page authoring MVP</h1>
        </div>
        <div className="header-actions">
          <div className="json-actions">
            <button
              type="button"
              className="button chrome"
              onClick={() => editorStore.getState().undo()}
              disabled={!canUndo}
            >
              Undo
            </button>
            <button
              type="button"
              className="button chrome"
              onClick={() => editorStore.getState().redo()}
              disabled={!canRedo}
            >
              Redo
            </button>
            <button
              type="button"
              className="button chrome"
              disabled={selectedNodeIds.length === 0}
              onClick={() => {
                const suggestedName = window.prompt('Component name', '')

                if (suggestedName === null) {
                  return
                }

                const result = editorStore.getState().convertSelectionToSubgraph({
                  ...(suggestedName.trim() ? { name: suggestedName.trim() } : {}),
                })

                setConversionError(result.ok ? undefined : result.error)
              }}
            >
              Convert to component
            </button>
          </div>
          <label className="graph-select">
            <span>Active graph</span>
            <select
              value={selectedGraphId}
              onChange={(event) => editorStore.getState().setSelectedGraph(event.target.value)}
            >
              {project.graphs.map((graph) => (
                <option key={graph.id} value={graph.id}>
                  {graph.name} ({graph.kind})
                </option>
              ))}
            </select>
          </label>
          <div className="status-badges">
            <span className="status-badge">{selectedGraph?.nodes.length ?? 0} nodes</span>
            <span className="status-badge">
              {selectedGraphIssues.length} graph issue
              {selectedGraphIssues.length === 1 ? '' : 's'}
            </span>
            <span className="status-badge">
              {selectedGraphRuntimeIssues.length} runtime issue
              {selectedGraphRuntimeIssues.length === 1 ? '' : 's'}
            </span>
          </div>
        </div>
      </header>

      <aside className="palette-panel panel surface-strong">
        <div className="panel-header">
          <h2>Node Palette</h2>
          <p>Add layout, content, data, theme, and reusable component nodes to the active graph.</p>
        </div>
        <NodePalette store={editorStore} registry={registry} />
      </aside>

      <section className="canvas-panel panel surface-muted">
        <div className="panel-header">
          <h2>Graph Canvas</h2>
          <p>Drag nodes from the palette, wire handles, and inspect warnings live.</p>
        </div>
        <div className="canvas-shell">
          <EditorCanvas store={editorStore} registry={registry} issues={selectedGraphIssues} />
        </div>
      </section>

      <aside className="inspector-panel panel surface-strong">
        <div className="panel-header">
          <h2>Inspector</h2>
          <p>Edit component metadata, then inspect selected nodes and instances.</p>
        </div>
        <SubgraphMetadataPanel store={editorStore} />
        <NodeInspector store={editorStore} registry={registry} issues={selectedGraphIssues} />
      </aside>

      <section className="json-panel panel surface-strong">
        <div className="panel-header">
          <h2>Project JSON</h2>
          <p>Save the current document, load JSON, or switch to a sample project.</p>
        </div>
        <div className="json-actions">
          <button
            type="button"
            className="button chrome"
            onClick={() => {
              editorStore.getState().saveProject()
              setLoadError(undefined)
            }}
          >
            Save JSON
          </button>
          <button
            type="button"
            className="button accent"
            onClick={() => {
              const result = editorStore.getState().loadProjectFromJson(jsonBuffer)
              setLoadError(result.ok ? undefined : result.error)
            }}
          >
            Load JSON
          </button>
        </div>
        <div className="sample-projects">
          <span className="field-caption">Sample projects</span>
          <div className="sample-actions">
            {sampleProjects.map((sample) => (
              <button
                key={sample.key}
                type="button"
                className="button chrome"
                onClick={() => {
                  editorStore.getState().loadProject(loadProjectDocument(sample.document))
                  setLoadError(undefined)
                }}
              >
                {sample.label}
              </button>
            ))}
          </div>
        </div>
        <textarea
          className="json-textarea"
          value={jsonBuffer}
          onChange={(event) => editorStore.getState().setJsonBuffer(event.target.value)}
        />
        {loadError ? <p className="error-text">{loadError}</p> : null}
        {conversionError ? <p className="error-text">{conversionError}</p> : null}
      </section>

      <section className="preview-panel panel surface-preview">
        <div className="panel-header">
          <h2>Live Preview</h2>
          <p>Project JSON → validation → evaluation → UI tree → React render.</p>
        </div>
        <div className="preview-shell">
          <PreviewRenderer
            root={runtime.root}
            eventRuntime={runtime.eventRuntime}
            presentationRuntime={runtime.presentationRuntime}
            embedded
          />
        </div>
        <GraphIssuesPanel
          graphName={selectedGraph?.name ?? 'Unknown graph'}
          issues={selectedGraphIssues}
        />
        <div className="issues-panel">
          <h3>Runtime Issues</h3>
          {selectedGraphRuntimeIssues.length === 0 ? (
            <p className="muted">No runtime issues for the active graph.</p>
          ) : (
            selectedGraphRuntimeIssues.map((issue, index) => (
              <div
                key={`runtime-${issue.code}-${issue.nodeId ?? 'graph'}-${index}`}
                className={`issue-card ${issue.severity}`}
              >
                <strong>{issue.code}</strong>
                <span>{issue.message}</span>
              </div>
            ))
          )}
        </div>
      </section>

      <div
        className="panel-splitter vertical left"
        onPointerDown={(event) => startResize('left', event)}
        role="separator"
        aria-orientation="vertical"
      />
      <div
        className="panel-splitter vertical right"
        onPointerDown={(event) => startResize('right', event)}
        role="separator"
        aria-orientation="vertical"
      />
      <div
        className="panel-splitter horizontal row"
        onPointerDown={(event) => startResize('row', event)}
        role="separator"
        aria-orientation="horizontal"
      />
    </div>
  )
}

function belongsToGraph(issueGraphId: string | undefined, selectedGraphId: string): boolean {
  return issueGraphId === undefined || issueGraphId === selectedGraphId
}

type ResizeHandleKind = 'left' | 'right' | 'row'

interface ResizeDragState {
  kind: ResizeHandleKind
  layout: EditorLayoutState
}

interface EditorLayoutState {
  leftColPx: number
  rightColPx: number
  topRowFr: number
  bottomRowFr: number
}

interface ShellMetrics {
  contentLeft: number
  contentTop: number
  contentWidth: number
  contentHeight: number
}

const MIN_LEFT_PANEL_WIDTH = 220
const MIN_RIGHT_PANEL_WIDTH = 260
const MIN_CENTER_PANEL_WIDTH = 520
const MIN_TOP_PANEL_HEIGHT = 220
const MIN_BOTTOM_PANEL_HEIGHT = 220

function getShellMetrics(shell: HTMLElement): ShellMetrics {
  const rect = shell.getBoundingClientRect()
  const computed = window.getComputedStyle(shell)
  const paddingLeft = parseFloat(computed.paddingLeft) || 0
  const paddingRight = parseFloat(computed.paddingRight) || 0
  const paddingTop = parseFloat(computed.paddingTop) || 0
  const paddingBottom = parseFloat(computed.paddingBottom) || 0

  return {
    contentLeft: rect.left + paddingLeft,
    contentTop: rect.top + paddingTop,
    contentWidth: rect.width - paddingLeft - paddingRight,
    contentHeight: rect.height - paddingTop - paddingBottom,
  }
}

function getSeamSizePx(shell: HTMLElement): number {
  const computed = window.getComputedStyle(shell)
  const parsed = parseFloat(computed.getPropertyValue('--panel-seam-size'))
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 3
}

function clampLayoutState(
  current: EditorLayoutState,
  shell: HTMLElement,
  header: HTMLElement,
): EditorLayoutState {
  if (window.matchMedia('(max-width: 1200px)').matches) {
    return current
  }

  const metrics = getShellMetrics(shell)
  const seamSizePx = getSeamSizePx(shell)
  const totalHorizontalSpace = metrics.contentWidth - seamSizePx * 2
  const clampedLeft = clamp(
    current.leftColPx,
    MIN_LEFT_PANEL_WIDTH,
    Math.max(
      MIN_LEFT_PANEL_WIDTH,
      totalHorizontalSpace - current.rightColPx - MIN_CENTER_PANEL_WIDTH,
    ),
  )
  const clampedRight = clamp(
    current.rightColPx,
    MIN_RIGHT_PANEL_WIDTH,
    Math.max(
      MIN_RIGHT_PANEL_WIDTH,
      totalHorizontalSpace - clampedLeft - MIN_CENTER_PANEL_WIDTH,
    ),
  )
  const adjustedLeft = clamp(
    clampedLeft,
    MIN_LEFT_PANEL_WIDTH,
    Math.max(
      MIN_LEFT_PANEL_WIDTH,
      totalHorizontalSpace - clampedRight - MIN_CENTER_PANEL_WIDTH,
    ),
  )
  const headerHeight = header.getBoundingClientRect().height
  const verticalSpace = Math.max(
    MIN_TOP_PANEL_HEIGHT + MIN_BOTTOM_PANEL_HEIGHT,
    metrics.contentHeight - headerHeight - seamSizePx,
  )
  const totalFr = current.topRowFr + current.bottomRowFr
  const topRatio = clamp(
    current.topRowFr / totalFr,
    MIN_TOP_PANEL_HEIGHT / verticalSpace,
    1 - MIN_BOTTOM_PANEL_HEIGHT / verticalSpace,
  )

  return {
    leftColPx: adjustedLeft,
    rightColPx: clampedRight,
    topRowFr: topRatio * totalFr,
    bottomRowFr: (1 - topRatio) * totalFr,
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}
