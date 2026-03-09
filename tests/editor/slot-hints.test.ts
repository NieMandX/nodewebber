import { describe, expect, it } from 'vitest'
import { getSlotInspectorHints } from '../../apps/editor-app/src/components/slot-hints'

describe('slot inspector hints', () => {
  it('explains default and named slots for slot-capable nodes', () => {
    const hints = getSlotInspectorHints(['children', 'header', 'footer'])

    expect(hints.map((hint) => hint.title)).toEqual(['Default slot', 'Named slots'])
    expect(hints[1]?.description).toContain('header, footer')
  })

  it('explains explicit named-slot-only nodes', () => {
    const hints = getSlotInspectorHints(['actions'])

    expect(hints.map((hint) => hint.title)).toContain('Explicit slot only')
    expect(hints.map((hint) => hint.title)).not.toContain('Default slot')
  })
})
