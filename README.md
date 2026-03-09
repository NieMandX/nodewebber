# Procedural Web Composer

A TypeScript monorepo MVP for a node-based procedural web composer. A `ProjectDocument` is validated, evaluated into an intermediate `UiNode` tree, and rendered through React.

## Stack

- `pnpm` workspace
- `turbo`
- TypeScript
- React + Vite
- React Flow
- Zustand
- Zod

## Monorepo layout

```text
apps/
  editor-app/         Graph editor with palette, canvas, inspector, JSON I/O, and live preview
  preview-app/        Standalone runtime preview for project JSON
packages/
  ui-tree/            UiNode model, strict UiNodeKind union, and tree helpers
  shared-types/       Cross-package graph, runtime, and editor contracts
  shared-utils/       Small shared helpers and theme normalization
  graph-core/         Schemas, serialization, graph validation, diagnostics, cycle detection, topo sort
  graph-engine/       Dependency graph construction and node evaluation
  node-registry/      Node definition registry API
  node-definitions-layout/
  node-definitions-basic/
  node-definitions-style/
  runtime-core/       Project loading, validation, evaluation, UiNode tree assembly
  runtime-react/      UiNode -> React renderer
  editor-core/        Zustand editor store and graph mutation actions
  editor-reactflow/   React Flow adapter, palette, and inspector UI
examples/
  example-project.json
```

## Pipeline

```text
Project JSON
  -> graph validation
  -> graph evaluation
  -> intermediate UiNode tree
  -> React preview renderer
```

## Package responsibilities

### `graph-core`

- Owns document schemas and JSON parse/serialize helpers.
- Validates graph shape, nodes, edges, required ports, and cycles.
- Exposes structured graph diagnostics for orphan UI nodes, unused themes, disconnected nodes, and page-node issues.
- Exposes `detectCycles()` and `topoSort()`.

### `ui-tree`

- Owns the intermediate UI tree model.
- Defines `UiNode`, strict `UiNodeKind`, and helpers like `isUiNode()`, `walkUiTree()`, and `mapUiTree()`.

### `graph-engine`

- Builds dependency maps from graph edges.
- Computes evaluation order.
- Executes node definitions against an `EvaluationContext`.

### `runtime-core`

- Loads a `ProjectDocument`.
- Runs validation and node evaluation.
- Builds the intermediate `UiNode` tree from evaluated `ui` outputs and `structure` edges.
- Uses optional `edge.order` on structure edges for stable child ordering, then falls back to node position for backward compatibility.

### `runtime-react`

- Converts `UiNode` trees into React elements.
- Keeps React concerns isolated from graph/runtime logic.

### `editor-core`

- Holds editor state in a Zustand vanilla store.
- Implements `addNode`, `removeNode`, `connectNodes`, `updateNodeParam`, `loadProject`, and `saveProject`.

### `editor-reactflow`

- Adapts graph documents to React Flow nodes and edges.
- Handles connections, selection, deletion, palette actions, and generic param editing.

### `node-registry`

- Registers node definitions during bootstrap and can be frozen afterward to prevent accidental runtime mutation.

## MVP node set

- Layout: `layout.page`, `layout.section`, `layout.stack`
- Content: `content.heading`, `content.text`, `content.button`, `content.image`
- Style: `style.theme`

`style.theme` produces a theme object. `layout.page` consumes that theme through a style edge. Layout and content nodes produce `ui` outputs. Structure edges connect `ui -> parent` to define hierarchy and may optionally include `edge.order` for explicit child ordering.

## Commands

```bash
pnpm install
pnpm dev:editor
pnpm dev:preview
pnpm build
pnpm typecheck
```

## Notes

- `graph-core` has no React dependency.
- Runtime packages only produce and render the intermediate UI tree.
- `UiNode` and `UiNodeKind` now live in `ui-tree`, not `shared-types`.
- Disconnected nodes are surfaced as graph validation warnings via `validateGraph()`, and the structured diagnostics API remains available through `getGraphDiagnostics()`.
- The implementation intentionally excludes backend, auth, collaboration, AI, subgraphs, export, animation, events, and complex CSS.
- The editor inspector uses a generic param editor; nested objects such as theme tokens are edited as JSON.
