import type { GraphIssue } from '@procedural-web-composer/shared-types'

export interface GraphIssuesPanelProps {
  graphName: string
  issues: GraphIssue[]
}

export function GraphIssuesPanel(props: GraphIssuesPanelProps): JSX.Element {
  if (props.issues.length === 0) {
    return (
      <div className="issues-stack">
        <h3>Graph Issues</h3>
        <p className="muted">No graph-level warnings for {props.graphName}.</p>
      </div>
    )
  }

  return (
    <div className="issues-stack">
      <h3>Graph Issues</h3>
      {props.issues.map((issue, index) => (
        <article key={`${issue.code}-${issue.nodeId ?? 'graph'}-${index}`} className={`issue-card ${issue.severity}`}>
          <strong>{issue.code}</strong>
          <span>{issue.message}</span>
          {issue.nodeId ? <small>Node: {issue.nodeId}</small> : null}
        </article>
      ))}
    </div>
  )
}
