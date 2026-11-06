import { describe, expect, it } from 'vitest'
import { computed } from 'vue'
import { createUnsavedSectionRegistry } from '@/domains/unsavedGuard/composables/useUnsavedSection'

describe('unsaved section registry', () => {
  it('names each dirty section once, in the order first registered', () => {
    const registry = createUnsavedSectionRegistry()
    registry.register(
      Symbol('a'),
      computed(() => [{ label: 'Layouts', dirty: true }])
    )
    registry.register(
      Symbol('b'),
      computed(() => [{ label: 'Adverts', dirty: true }])
    )
    registry.register(
      Symbol('c'),
      computed(() => [
        { label: 'Layouts', dirty: true },
        { label: 'Teleport', dirty: false },
      ])
    )
    expect(registry.dirtyLabels.value).toEqual(['Layouts', 'Adverts'])
  })
})
