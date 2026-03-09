import { useState } from 'react'
import exampleProject from '../../../examples/example-project.json'
import { loadProjectDocument, evaluateProjectDocument } from '@procedural-web-composer/runtime-core'
import { PreviewRenderer } from '@procedural-web-composer/runtime-react'
import { registry } from './registry'

const initialJson = JSON.stringify(exampleProject, null, 2)

export function App(): JSX.Element {
  const [json, setJson] = useState(initialJson)
  const [loadError, setLoadError] = useState<string>()

  let project = loadProjectDocument(exampleProject)

  try {
    project = loadProjectDocument(json)
  } catch {
    project = loadProjectDocument(exampleProject)
  }

  const runtime = evaluateProjectDocument(project, registry)

  return (
    <div className="preview-shell">
      <header className="preview-header">
        <div>
          <p className="eyebrow">Preview Runtime</p>
          <h1>Intermediate UI tree renderer</h1>
        </div>
        <button
          type="button"
          className="button accent"
          onClick={() => {
            try {
              loadProjectDocument(json)
              setLoadError(undefined)
            } catch (error) {
              setLoadError(error instanceof Error ? error.message : 'Invalid project JSON.')
            }
          }}
        >
          Validate JSON
        </button>
      </header>

      <section className="panel json-panel">
        <div className="panel-header">
          <h2>Project JSON</h2>
          <p>Edit the document directly and validate it through the runtime pipeline.</p>
        </div>
        <textarea className="json-textarea" value={json} onChange={(event) => setJson(event.target.value)} />
        {loadError ? <p className="error-text">{loadError}</p> : null}
      </section>

      <section className="panel preview-panel">
        <div className="panel-header">
          <h2>Rendered page</h2>
          <p>Validation and evaluation happen locally in the browser.</p>
        </div>
        <div className="preview-stage">
          <PreviewRenderer root={runtime.root} eventRuntime={runtime.eventRuntime} />
        </div>
      </section>

      <section className="panel issues-panel">
        <div className="panel-header">
          <h2>Runtime output</h2>
          <p>{runtime.validation.issues.length + runtime.issues.length} issues total.</p>
        </div>
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
      </section>
    </div>
  )
}
