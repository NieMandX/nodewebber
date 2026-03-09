import { useState } from 'react'
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
  const project = useStore(editorStore, (state) => state.project)
  const jsonBuffer = useStore(editorStore, (state) => state.jsonBuffer)
  const selectedGraphId = useStore(editorStore, (state) => state.selectedGraphId)
  const selectedNodeIds = useStore(editorStore, (state) => state.selectedNodeIds)
  const canUndo = useStore(editorStore, (state) => state.history.past.length > 0)
  const canRedo = useStore(editorStore, (state) => state.history.future.length > 0)
  const [loadError, setLoadError] = useState<string>()
  const [conversionError, setConversionError] = useState<string>()
  const selectedGraph = project.graphs.find((graph) => graph.id === selectedGraphId)
  const runtime = evaluateGraphDocument(project, selectedGraphId, registry)
  const selectedGraphIssues = runtime.validation.issues.filter((issue) =>
    belongsToGraph(issue.graphId, selectedGraphId),
  )
  const selectedGraphRuntimeIssues = runtime.issues.filter((issue) =>
    belongsToGraph(issue.graphId, selectedGraphId),
  )

  return (
    <div className="editor-shell">
      <header className="app-header">
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
    </div>
  )
}

function belongsToGraph(issueGraphId: string | undefined, selectedGraphId: string): boolean {
  return issueGraphId === undefined || issueGraphId === selectedGraphId
}
