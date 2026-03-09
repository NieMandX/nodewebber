import { useState } from 'react'
import { NodeInspector, NodePalette, EditorCanvas } from '@procedural-web-composer/editor-reactflow'
import { evaluateGraphDocument } from '@procedural-web-composer/runtime-core'
import { PreviewRenderer } from '@procedural-web-composer/runtime-react'
import { useStore } from 'zustand'
import { editorStore } from './session'
import { registry } from './registry'

export function App(): JSX.Element {
  const project = useStore(editorStore, (state) => state.project)
  const jsonBuffer = useStore(editorStore, (state) => state.jsonBuffer)
  const selectedGraphId = useStore(editorStore, (state) => state.selectedGraphId)
  const canUndo = useStore(editorStore, (state) => state.history.past.length > 0)
  const canRedo = useStore(editorStore, (state) => state.history.future.length > 0)
  const [loadError, setLoadError] = useState<string>()
  const selectedGraph = project.graphs.find((graph) => graph.id === selectedGraphId)
  const runtime = evaluateGraphDocument(project, selectedGraphId, registry)

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
          </div>
          <label className="graph-select">
            <span>Active graph</span>
            <select
              value={selectedGraphId}
              onChange={(event) => editorStore.getState().setSelectedGraph(event.target.value)}
            >
              {project.graphs.map((graph) => (
                <option key={graph.id} value={graph.id}>
                  {graph.name}
                </option>
              ))}
            </select>
          </label>
          <div className="status-badges">
            <span className="status-badge">{selectedGraph?.nodes.length ?? 0} nodes</span>
            <span className="status-badge">
              {runtime.validation.issues.length} validation issue
              {runtime.validation.issues.length === 1 ? '' : 's'}
            </span>
          </div>
        </div>
      </header>

      <aside className="palette-panel panel surface-strong">
        <div className="panel-header">
          <h2>Node Palette</h2>
          <p>Add layout, content, and theme nodes to the active graph.</p>
        </div>
        <NodePalette store={editorStore} registry={registry} />
      </aside>

      <section className="canvas-panel panel surface-muted">
        <div className="panel-header">
          <h2>Graph Canvas</h2>
          <p>Connect handles to create structure, data, and style edges.</p>
        </div>
        <div className="canvas-shell">
          <EditorCanvas store={editorStore} registry={registry} />
        </div>
      </section>

      <aside className="inspector-panel panel surface-strong">
        <div className="panel-header">
          <h2>Inspector</h2>
          <p>Edit params directly against the selected node instance.</p>
        </div>
        <NodeInspector store={editorStore} registry={registry} />
      </aside>

      <section className="json-panel panel surface-strong">
        <div className="panel-header">
          <h2>Project JSON</h2>
          <p>Save the current document or load a new one into the editor state.</p>
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
        <textarea
          className="json-textarea"
          value={jsonBuffer}
          onChange={(event) => editorStore.getState().setJsonBuffer(event.target.value)}
        />
        {loadError ? <p className="error-text">{loadError}</p> : null}
      </section>

      <section className="preview-panel panel surface-preview">
        <div className="panel-header">
          <h2>Live Preview</h2>
          <p>Project JSON → validation → evaluation → UI tree → React render.</p>
        </div>
        <div className="preview-shell">
          <PreviewRenderer root={runtime.root} />
        </div>
        <div className="issues-panel">
          <h3>Issues</h3>
          {runtime.validation.issues.length === 0 && runtime.issues.length === 0 ? (
            <p className="muted">No validation or runtime issues.</p>
          ) : (
            <>
              {runtime.validation.issues.map((issue, index) => (
                <div key={`validation-${index}`} className={`issue-card ${issue.severity}`}>
                  <strong>{issue.code}</strong>
                  <span>{issue.message}</span>
                </div>
              ))}
              {runtime.issues.map((issue, index) => (
                <div key={`runtime-${index}`} className={`issue-card ${issue.severity}`}>
                  <strong>{issue.code}</strong>
                  <span>{issue.message}</span>
                </div>
              ))}
            </>
          )}
        </div>
      </section>
    </div>
  )
}
