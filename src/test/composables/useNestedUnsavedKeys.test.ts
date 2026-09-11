import { describe, expect, it } from 'vitest'
import { useNestedUnsavedKeys } from '@/labs/listEditor/composables/useNestedUnsavedKeys'

describe('useNestedUnsavedKeys', () => {
  it('starts with an empty merged set and zero count', () => {
    const api = useNestedUnsavedKeys()
    expect(api.merged.value.size).toBe(0)
    expect(api.count.value).toBe(0)
  })

  it('getForParent returns an empty Set for unknown parents', () => {
    const api = useNestedUnsavedKeys()
    const result = api.getForParent(42)
    expect(result instanceof Set).toBe(true)
    expect(result.size).toBe(0)
  })

  it('setForParent stores a non-empty set and exposes it via getForParent', () => {
    const api = useNestedUnsavedKeys()
    api.setForParent(1, new Set([10, 11]))
    expect(api.getForParent(1).size).toBe(2)
    expect(api.getForParent(1).has(10)).toBe(true)
    expect(api.getForParent(1).has(11)).toBe(true)
  })

  it('setForParent with empty set drops the entry', () => {
    const api = useNestedUnsavedKeys()
    api.setForParent(1, new Set([10]))
    expect(api.count.value).toBe(1)
    api.setForParent(1, new Set())
    expect(api.count.value).toBe(0)
    expect(api.getForParent(1).size).toBe(0)
  })

  it('merged keys use prefix-merging to avoid id=0 collisions', () => {
    const api = useNestedUnsavedKeys()
    // Two newly-created child rows under different parents both have id 0
    // (factory default until the API assigns a real id). Without the prefix
    // merge they'd dedupe to a single Set entry; with it, they stay distinct.
    api.setForParent(1, new Set([0]))
    api.setForParent(2, new Set([0]))
    expect(api.count.value).toBe(2)
    expect(api.merged.value.has('1:0')).toBe(true)
    expect(api.merged.value.has('2:0')).toBe(true)
  })

  it('count tracks the merged set across multiple parents', () => {
    const api = useNestedUnsavedKeys()
    api.setForParent(1, new Set([10, 11]))
    api.setForParent(2, new Set([20]))
    api.setForParent(3, new Set([30, 31, 32]))
    expect(api.count.value).toBe(6)
    expect(api.merged.value.size).toBe(6)
  })

  it('replacing a parent set updates only that parent', () => {
    const api = useNestedUnsavedKeys()
    api.setForParent(1, new Set([10, 11]))
    api.setForParent(2, new Set([20]))
    expect(api.count.value).toBe(3)
    api.setForParent(1, new Set([10]))
    expect(api.count.value).toBe(2)
    expect(api.merged.value.has('1:10')).toBe(true)
    expect(api.merged.value.has('1:11')).toBe(false)
    expect(api.merged.value.has('2:20')).toBe(true)
  })

  it('handles mixed key types (number parent + string child, vice versa)', () => {
    const api = useNestedUnsavedKeys()
    api.setForParent(1, new Set(['a', 'b']))
    api.setForParent('p', new Set([10, 20]))
    expect(api.count.value).toBe(4)
    expect(api.merged.value.has('1:a')).toBe(true)
    expect(api.merged.value.has('1:b')).toBe(true)
    expect(api.merged.value.has('p:10')).toBe(true)
    expect(api.merged.value.has('p:20')).toBe(true)
  })

  it('merged is reactive: changes propagate to dependents', async () => {
    const api = useNestedUnsavedKeys()
    let observedSize = -1
    const stop = (await import('vue')).watchEffect(() => {
      observedSize = api.merged.value.size
    })
    expect(observedSize).toBe(0)
    api.setForParent(1, new Set([10]))
    await Promise.resolve() // flush reactivity
    expect(observedSize).toBe(1)
    api.setForParent(1, new Set([10, 11]))
    await Promise.resolve()
    expect(observedSize).toBe(2)
    api.setForParent(1, new Set())
    await Promise.resolve()
    expect(observedSize).toBe(0)
    stop()
  })
})
