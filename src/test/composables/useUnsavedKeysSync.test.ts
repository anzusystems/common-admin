/* eslint-disable vue/no-ref-object-reactivity-loss */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { computed, defineComponent, h, nextTick, ref } from 'vue'
import { useUnsavedKeysSync } from '@/labs/listEditor/composables/useUnsavedKeysSync'
import type { ListEditorKey } from '@/labs/listEditor/types/listEditorTypes'

let mounted: VueWrapper | null = null

afterEach(() => {
  mounted?.unmount()
  mounted = null
})

const mountWithSync = (
  setup: () => ReturnType<typeof useUnsavedKeysSync>,
) => {
  let api!: ReturnType<typeof useUnsavedKeysSync>
  const Host = defineComponent({
    setup() {
      api = setup()
      return () => h('div')
    },
  })
  mounted = mount(Host)
  return api
}

describe('useUnsavedKeysSync', () => {
  describe('hasUnsavedChanges + unsavedCount', () => {
    it('mirror the internal set (empty + non-empty)', () => {
      const source = ref<ListEditorKey[]>([])
      const internal = computed<Set<ListEditorKey>>(
        () => new Set(source.value),
      )
      const model = ref(new Set<ListEditorKey>())
      const api = mountWithSync(() =>
        useUnsavedKeysSync({
          unsavedKeysModel: model,
          internalUnsavedKeys: internal,
          onClearAll: vi.fn(),
          onClearKey: vi.fn(),
        }),
      )
      expect(api.hasUnsavedChanges.value).toBe(false)
      expect(api.unsavedCount.value).toBe(0)
      source.value = [1, 2, 3]
      expect(api.hasUnsavedChanges.value).toBe(true)
      expect(api.unsavedCount.value).toBe(3)
    })
  })

  describe('internal → external sync', () => {
    it('writes a fresh Set into the model on initial mount when internal is non-empty', async () => {
      const source = ref<ListEditorKey[]>([1, 2])
      const internal = computed<Set<ListEditorKey>>(
        () => new Set(source.value),
      )
      const model = ref(new Set<ListEditorKey>())
      mountWithSync(() =>
        useUnsavedKeysSync({
          unsavedKeysModel: model,
          internalUnsavedKeys: internal,
          onClearAll: vi.fn(),
          onClearKey: vi.fn(),
        }),
      )
      // immediate watcher runs
      await nextTick()
      expect([...model.value]).toEqual([1, 2])
    })

    it('updates model when internal grows', async () => {
      const source = ref<ListEditorKey[]>([])
      const internal = computed<Set<ListEditorKey>>(
        () => new Set(source.value),
      )
      const model = ref(new Set<ListEditorKey>())
      mountWithSync(() =>
        useUnsavedKeysSync({
          unsavedKeysModel: model,
          internalUnsavedKeys: internal,
          onClearAll: vi.fn(),
          onClearKey: vi.fn(),
        }),
      )
      await nextTick()
      expect(model.value.size).toBe(0)
      source.value = [1]
      await nextTick()
      expect([...model.value]).toEqual([1])
      source.value = [1, 2, 3]
      await nextTick()
      expect([...model.value]).toEqual([1, 2, 3])
    })

    it('updates model when internal shrinks', async () => {
      const source = ref<ListEditorKey[]>([1, 2, 3])
      const internal = computed<Set<ListEditorKey>>(
        () => new Set(source.value),
      )
      const model = ref(new Set<ListEditorKey>())
      mountWithSync(() =>
        useUnsavedKeysSync({
          unsavedKeysModel: model,
          internalUnsavedKeys: internal,
          onClearAll: vi.fn(),
          onClearKey: vi.fn(),
        }),
      )
      await nextTick()
      source.value = [1]
      await nextTick()
      expect([...model.value]).toEqual([1])
    })

    it('does NOT trigger a model write when the new internal set equals the model', async () => {
      const source = ref<ListEditorKey[]>([1, 2])
      const internal = computed<Set<ListEditorKey>>(
        () => new Set(source.value),
      )
      const model = ref(new Set<ListEditorKey>([1, 2]))
      const initialModelRef = model.value
      mountWithSync(() =>
        useUnsavedKeysSync({
          unsavedKeysModel: model,
          internalUnsavedKeys: internal,
          onClearAll: vi.fn(),
          onClearKey: vi.fn(),
        }),
      )
      await nextTick()
      // Same Set identity preserved when contents match — proves the
      // setsEqual short-circuit works.
      expect(model.value).toBe(initialModelRef)
    })
  })

  describe('external → internal: full clear', () => {
    it('calls onClearAll when consumer sets model to empty Set while internal is non-empty', async () => {
      // Production-realistic initial state: internal is empty at mount (the
      // editor's dirty baseline is captured at construct time, so isItemDirty
      // returns false for all rows initially). Then a user action grows
      // internal, and the consumer later clears the model after a save.
      const source = ref<ListEditorKey[]>([])
      const internal = computed<Set<ListEditorKey>>(
        () => new Set(source.value),
      )
      const model = ref(new Set<ListEditorKey>())
      const onClearAll = vi.fn()
      const onClearKey = vi.fn()
      mountWithSync(() =>
        useUnsavedKeysSync({
          unsavedKeysModel: model,
          internalUnsavedKeys: internal,
          onClearAll,
          onClearKey,
        }),
      )
      await nextTick()
      // Internal grows: editor → model sync runs, suppressNext set + cleared.
      source.value = [1, 2]
      await nextTick()
      expect(model.value.size).toBe(2)
      // Consumer clears the model (e.g. after a successful save).
      model.value = new Set()
      await nextTick()
      expect(onClearAll).toHaveBeenCalledTimes(1)
      expect(onClearKey).not.toHaveBeenCalled()
    })

    it('does NOT call onClearAll when the model write came from the internal sync', async () => {
      const source = ref<ListEditorKey[]>([])
      const internal = computed<Set<ListEditorKey>>(
        () => new Set(source.value),
      )
      const model = ref(new Set<ListEditorKey>())
      const onClearAll = vi.fn()
      mountWithSync(() =>
        useUnsavedKeysSync({
          unsavedKeysModel: model,
          internalUnsavedKeys: internal,
          onClearAll,
          onClearKey: vi.fn(),
        }),
      )
      await nextTick()
      // Internal grows → suppressNext is set → model watcher should NO-OP
      // when it sees the resulting model write.
      source.value = [1, 2]
      await nextTick()
      expect(onClearAll).not.toHaveBeenCalled()
    })
  })

  describe('external → internal: per-key clear', () => {
    it('calls onClearKey for each key removed from the model that was internal-present', async () => {
      const source = ref<ListEditorKey[]>([])
      const internal = computed<Set<ListEditorKey>>(
        () => new Set(source.value),
      )
      const model = ref(new Set<ListEditorKey>())
      const onClearAll = vi.fn()
      const onClearKey = vi.fn()
      mountWithSync(() =>
        useUnsavedKeysSync({
          unsavedKeysModel: model,
          internalUnsavedKeys: internal,
          onClearAll,
          onClearKey,
        }),
      )
      await nextTick()
      // Grow internal first (suppressed sync writes the model).
      source.value = [1, 2, 3]
      await nextTick()
      expect(model.value.size).toBe(3)
      // Consumer drops keys 1 and 2 from the model (e.g., per-row baseline
      // reset) while keeping 3.
      model.value = new Set([3])
      await nextTick()
      expect(onClearAll).not.toHaveBeenCalled()
      expect(onClearKey).toHaveBeenCalledTimes(2)
      const calledWith = onClearKey.mock.calls.map((c) => c[0]).sort()
      expect(calledWith).toEqual([1, 2])
    })
  })

  describe('clearUnsavedState imperative API', () => {
    it('clearUnsavedState() with no key calls onClearAll', () => {
      const internal = computed<Set<ListEditorKey>>(() => new Set([1]))
      const model = ref(new Set<ListEditorKey>())
      const onClearAll = vi.fn()
      const onClearKey = vi.fn()
      const api = mountWithSync(() =>
        useUnsavedKeysSync({
          unsavedKeysModel: model,
          internalUnsavedKeys: internal,
          onClearAll,
          onClearKey,
        }),
      )
      api.clearUnsavedState()
      expect(onClearAll).toHaveBeenCalledTimes(1)
      expect(onClearKey).not.toHaveBeenCalled()
    })

    it('clearUnsavedState(key) calls onClearKey with that key', () => {
      const internal = computed<Set<ListEditorKey>>(() => new Set([1, 2]))
      const model = ref(new Set<ListEditorKey>())
      const onClearAll = vi.fn()
      const onClearKey = vi.fn()
      const api = mountWithSync(() =>
        useUnsavedKeysSync({
          unsavedKeysModel: model,
          internalUnsavedKeys: internal,
          onClearAll,
          onClearKey,
        }),
      )
      api.clearUnsavedState(2)
      expect(onClearKey).toHaveBeenCalledTimes(1)
      expect(onClearKey).toHaveBeenCalledWith(2)
      expect(onClearAll).not.toHaveBeenCalled()
    })
  })
})
