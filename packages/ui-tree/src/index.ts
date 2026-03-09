export type UiNodeKind =
  | 'Fragment'
  | 'Page'
  | 'Section'
  | 'Stack'
  | 'Heading'
  | 'Text'
  | 'Button'
  | 'Image'

export interface UiNode {
  id: string
  kind: UiNodeKind
  props: Record<string, unknown>
  children: UiNode[]
  styles?: Record<string, unknown>
}

const UI_NODE_KINDS = new Set<UiNodeKind>([
  'Fragment',
  'Page',
  'Section',
  'Stack',
  'Heading',
  'Text',
  'Button',
  'Image',
])

export function isUiNode(value: unknown): value is UiNode {
  if (typeof value !== 'object' || value === null) {
    return false
  }

  const candidate = value as {
    id?: unknown
    kind?: unknown
    props?: unknown
    children?: unknown
    styles?: unknown
  }

  return (
    typeof candidate.id === 'string' &&
    typeof candidate.kind === 'string' &&
    UI_NODE_KINDS.has(candidate.kind as UiNodeKind) &&
    typeof candidate.props === 'object' &&
    candidate.props !== null &&
    Array.isArray(candidate.children) &&
    (candidate.styles === undefined ||
      (typeof candidate.styles === 'object' && candidate.styles !== null))
  )
}

export function walkUiTree(
  root: UiNode,
  visitor: (node: UiNode, parent: UiNode | null) => void,
): void {
  visit(root, null)

  function visit(node: UiNode, parent: UiNode | null): void {
    visitor(node, parent)

    for (const child of node.children) {
      visit(child, node)
    }
  }
}

export function mapUiTree(
  root: UiNode,
  mapper: (node: UiNode, parent: UiNode | null) => UiNode,
): UiNode {
  return visit(root, null)

  function visit(node: UiNode, parent: UiNode | null): UiNode {
    const nextNode = mapper(
      {
        ...node,
        children: node.children.map((child) => visit(child, node)),
      },
      parent,
    )

    return {
      ...nextNode,
      children: nextNode.children,
    }
  }
}
