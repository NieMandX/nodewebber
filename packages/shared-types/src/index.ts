import type { UiNode } from '@procedural-web-composer/ui-tree'

export type EdgeKind = 'data' | 'structure' | 'style' | 'event'

export type ValueType =
  | 'string'
  | 'number'
  | 'boolean'
  | 'unknown'
  | 'object'
  | 'array'
  | 'ui-node'
  | 'ui-children'
  | 'style-token'
  | 'theme'

export interface PortableParamSchemaField {
  type: 'string' | 'number' | 'boolean' | 'enum' | 'json' | 'string-or-number'
  options?: string[]
}

export type PortableParamSchema = Record<string, PortableParamSchemaField>

export interface GraphSubgraphMetadata {
  publicParamsSchema?: PortableParamSchema
  publicDefaultParams?: Record<string, unknown>
  publicSlots?: string[]
}

export interface SubgraphDefinition {
  graphId: string
  title: string
  publicParamsSchema: PortableParamSchema
  publicDefaultParams: Record<string, unknown>
  publicSlots: string[]
}

export interface ProjectDocument {
  version: string
  meta: {
    id: string
    name: string
    createdAt: string
    updatedAt: string
  }
  settings: {
    entryGraphId: string
    themeMode?: 'light' | 'dark'
  }
  graphs: GraphDocument[]
  assets: AssetReference[]
}

export interface GraphDocument {
  id: string
  name: string
  kind: 'page' | 'component' | 'subgraph'
  nodes: NodeInstance[]
  edges: EdgeInstance[]
  subgraph?: GraphSubgraphMetadata
  viewport?: {
    x: number
    y: number
    zoom: number
  }
}

export interface NodeInstance {
  id: string
  type: string
  version: number
  label?: string
  position: {
    x: number
    y: number
  }
  params: Record<string, unknown>
  ui?: {
    collapsed?: boolean
    width?: number
  }
}

export interface EdgeInstance {
  id: string
  from: {
    nodeId: string
    port: string
  }
  to: {
    nodeId: string
    port: string
  }
  kind: EdgeKind
  order?: number
  slot?: string
}

export interface AssetReference {
  id: string
  kind: 'image' | 'video' | 'file'
  name: string
  url: string
}

export interface PortDefinition {
  key: string
  valueType: ValueType
  required?: boolean
  multiple?: boolean
}

export interface RuntimeIssue {
  code: string
  message: string
  severity: 'error' | 'warning'
  graphId?: string
  nodeId?: string
  edgeId?: string
}

export interface GraphIssue {
  code: string
  message: string
  severity: 'error' | 'warning'
  graphId?: string
  nodeId?: string
  edgeId?: string
  path?: string
}

export interface ThemeValue {
  colors: {
    background: string
    surface: string
    text: string
    accent: string
  }
  typography: {
    fontFamily: string
    headingScale: number
    bodySize: string
  }
}

export interface ViewerVector3 {
  x: number
  y: number
  z: number
}

export interface ViewerModelConfig {
  src: string
  format?: 'gltf' | 'glb' | 'fbx' | 'auto'
  alt?: string
}

export interface ViewerEnvironmentConfig {
  type?: 'color' | 'hdri'
  color?: string
  hdriSrc?: string
  intensity?: number
  rotation?: number
}

export interface ViewerCameraConfig {
  mode?: 'orbit' | 'fixed'
  position?: ViewerVector3
  target?: ViewerVector3
  fov?: number
  minDistance?: number
  maxDistance?: number
}

export interface ViewerHotspotConfig {
  id?: string
  label?: string
  description?: string
  position?: ViewerVector3
}

export interface ViewerBlockProps {
  title?: string
  modelSrc?: string
  model?: ViewerModelConfig
  environment?: ViewerEnvironmentConfig
  cameraPreset?: ViewerCameraConfig
  background?: string
  exposure?: number
  allowOrbit?: boolean
  showToolbar?: boolean
  loadingMode?: 'eager' | 'lazy'
  posterImage?: string
  hotspots?: ViewerHotspotConfig[]
}

export interface ViewerOverlayProps {
  title?: string
  description?: string
  position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
}

export interface EvaluationContext {
  project: ProjectDocument
  graph: GraphDocument
  node: NodeInstance
  registry: NodeDefinitionResolver
  getInput: <T = unknown>(port: string) => T | undefined
  getInputs: <T = unknown>(port: string) => T[]
  getIncomingEdges: (options?: {
    port?: string
    kind?: EdgeKind
  }) => EdgeInstance[]
  getOutgoingEdges: (options?: {
    port?: string
    kind?: EdgeKind
  }) => EdgeInstance[]
  getOutputFromNode: <T = unknown>(nodeId: string, port: string) => T | undefined
}

export interface EvaluationResult {
  outputs: Record<string, unknown>
  issues?: RuntimeIssue[]
}

export interface NodeDefinition {
  type: string
  version: number
  title: string
  category: string
  slots?: string[]
  inputs: PortDefinition[]
  outputs: PortDefinition[]
  defaultParams: Record<string, unknown>
  paramsSchema: unknown
  evaluate: (node: NodeInstance, ctx: EvaluationContext) => EvaluationResult
}

export interface NodeDefinitionResolver {
  getNodeDefinition: (type: string) => NodeDefinition | undefined
  listNodeDefinitions: () => NodeDefinition[]
}

export interface NodeEvaluationRecord {
  nodeId: string
  nodeType: string
  outputs: Record<string, unknown>
  issues: RuntimeIssue[]
}

export interface GraphEvaluation {
  order: string[]
  results: Record<string, NodeEvaluationRecord>
  issues: RuntimeIssue[]
}

export interface GraphValidationResult {
  valid: boolean
  issues: GraphIssue[]
}

export interface ProjectRuntimeResult {
  graph: GraphDocument | undefined
  root: UiNode | null
  evaluation?: GraphEvaluation
  validation: GraphValidationResult
  issues: RuntimeIssue[]
}
