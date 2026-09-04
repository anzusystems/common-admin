import { describe, it, expect, vi } from 'vitest'
import { ref } from 'vue'
import { validateAllAndReveal } from '@/labs/listEditor/utils/revealInvalidRows'

// The shared "validate + reveal" used by all three editors' validateAll override
// (AListEditor / ASortableListEditor / ANestedSortableListEditor) — QA 85050 B4-17.
describe('validateAllAndReveal', () => {
  it('returns valid and does NOT reveal any row when validateAll passes', () => {
    const reveal = vi.fn()
    const controller = { validateAll: () => true, invalidKeys: ref(new Set([1, 2])) }
    expect(validateAllAndReveal(controller, reveal)).toBe(true)
    expect(reveal).not.toHaveBeenCalled()
  })

  it('returns invalid and reveals EVERY invalid key when validateAll fails', () => {
    const reveal = vi.fn()
    const controller = { validateAll: () => false, invalidKeys: ref(new Set([1, 3])) }
    expect(validateAllAndReveal(controller, reveal)).toBe(false)
    expect(reveal.mock.calls.map((c) => c[0]).sort()).toEqual([1, 3])
  })
})
