import exampleProject from '../../../examples/example-project.json'
import { createEditorStore } from '@procedural-web-composer/editor-core'
import { loadProjectDocument } from '@procedural-web-composer/runtime-core'
import { registry } from './registry'

export const editorStore = createEditorStore({
  registry,
  initialProject: loadProjectDocument(exampleProject),
})

