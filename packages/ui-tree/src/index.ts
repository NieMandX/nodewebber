export type UiNodeKind =
  | 'Fragment'
  | 'Page'
  | 'Section'
  | 'Stack'
  | 'Shell'
  | 'Heading'
  | 'Text'
  | 'Button'
  | 'Image'

export interface UiNode {
  id: string
  kind: UiNodeKind
  props: Record<string, unknown>
  children: UiNode[]
  slots?: Record<string, UiNode[]>
  styles?: Record<string, unknown>
}

const UI_NODE_KINDS = new Set<UiNodeKind>([
  'Fragment',
  'Page',
  'Section',
  'Stack',
  'Shell',
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
    slots?: unknown
    styles?: unknown
  }

  return (
    typeof candidate.id === 'string' &&
    typeof candidate.kind === 'string' &&
    UI_NODE_KINDS.has(candidate.kind as UiNodeKind) &&
    typeof candidate.props === 'object' &&
    candidate.props !== null &&
    Array.isArray(candidate.children) &&
    (candidate.slots === undefined || isUiSlots(candidate.slots)) &&
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

    for (const [slotName, slotChildren] of Object.entries(node.slots ?? {})) {
      if (slotName === 'children') {
        continue
      }

      for (const child of slotChildren) {
        visit(child, node)
      }
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
        ...(node.slots
          ? {
              slots: Object.fromEntries(
                Object.entries(node.slots).map(([slotName, slotChildren]) => [
                  slotName,
                  slotName === 'children'
                    ? node.children.map((child) => visit(child, node))
                    : slotChildren.map((child) => visit(child, node)),
                ]),
              ),
            }
          : {}),
      },
      parent,
    )

    return {
      ...nextNode,
      children: nextNode.children,
      ...(nextNode.slots ? { slots: nextNode.slots } : {}),
    }
  }
}

function isUiSlots(value: unknown): value is Record<string, UiNode[]> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false
  }

  return Object.values(value).every(
    (slotChildren) =>
      Array.isArray(slotChildren) && slotChildren.every((child) => isUiNode(child)),
  )
}
