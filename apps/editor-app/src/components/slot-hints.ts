export interface SlotInspectorHint {
  title: string
  description: string
}

export function getSlotInspectorHints(slotNames: string[]): SlotInspectorHint[] {
  const normalizedSlotNames = [...new Set(
    slotNames
      .map((slotName) => slotName.trim())
      .filter((slotName) => slotName.length > 0),
  )]

  if (normalizedSlotNames.length === 0) {
    return []
  }

  const hints: SlotInspectorHint[] = []
  const namedSlots = normalizedSlotNames.filter((slotName) => slotName !== 'children')

  if (normalizedSlotNames.includes('children')) {
    hints.push({
      title: 'Default slot',
      description: 'Use a structure edge without a slot name, or set slot to "children".',
    })
  }

  if (namedSlots.length > 0) {
    hints.push({
      title: 'Named slots',
      description: `Use structure edges with slot set to: ${namedSlots.join(', ')}.`,
    })
  }

  if (normalizedSlotNames.length === 1 && normalizedSlotNames[0] !== 'children') {
    hints.push({
      title: 'Explicit slot only',
      description: 'This node does not use the default children slot.',
    })
  }

  return hints
}
