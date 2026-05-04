/* eslint-disable vue/no-ref-object-reactivity-loss */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { computed, defineComponent, h, inject, nextTick, ref } from 'vue'
import { useValidationRegistry } from '@/labs/listEditor/composables/useValidationRegistry'
import {
  useListEditorItemValidation,
  ListEditorValidationKey,
  type ListEditorValidationRegistry,
} from '@/labs/listEditor/composables/useListEditorItemValidation'
import type {
  ListEditorKey,
  ListEditorValidationState,
} from '@/labs/listEditor/types/listEditorTypes'

interface Item {
  id: number
  title: string
  validationState?: ListEditorValidationState
}

let mounted: VueWrapper | null = null

afterEach(() => {
  mounted?.unmount()
  mounted = null
})

const mountWithRegistry = (
  options: Parameters<typeof useValidationRegistry<Item>>[0],
) => {
  let api!: ReturnType<typeof useValidationRegistry<Item>>
  const Host = defineComponent({
    setup() {
      api = useValidationRegistry<Item>(options)
      return () => h('div')
    },
  })
  mounted = mount(Host)
  return api
}

describe('useValidationRegistry', () => {
  describe('priority order: registry → prop → raw', () => {
    it('returns null when nothing flagged', () => {
      const api = mountWithRegistry({})
      const result = api.resolveValidation({ id: 1, title: 'A' }, 1, 0)
      expect(result).toBeNull()
    })

    it('uses raw.validationState when nothing else is set', () => {
      const api = mountWithRegistry({})
      const result = api.resolveValidation(
        { id: 1, title: 'A', validationState: 'invalid' },
        1,
        0,
      )
      expect(result).toBe('invalid')
    })

    it('prop callback wins over raw.validationState', () => {
      const api = mountWithRegistry({
        getValidationState: () => 'warning',
      })
      const result = api.resolveValidation(
        { id: 1, title: 'A', validationState: 'invalid' },
        1,
        0,
      )
      expect(result).toBe('warning')
    })

    it('falls through to raw.validationState when prop returns null', () => {
      const api = mountWithRegistry({
        getValidationState: () => null,
      })
      const result = api.resolveValidation(
        { id: 1, title: 'A', validationState: 'invalid' },
        1,
        0,
      )
      expect(result).toBe('invalid')
    })

    it('ignores unrecognised validation state strings (from raw or prop)', () => {
      const fromRaw = mountWithRegistry({})
      expect(
        fromRaw.resolveValidation(
          // @ts-expect-error — testing runtime validation
          { id: 1, title: 'A', validationState: 'something-else' },
          1,
          0,
        ),
      ).toBeNull()
      const fromProp = mountWithRegistry({
        // @ts-expect-error — testing runtime validation
        getValidationState: () => 'definitely-not-valid',
      })
      expect(
        fromProp.resolveValidation({ id: 1, title: 'A' }, 1, 0),
      ).toBeNull()
    })
  })

  describe('registry via useListEditorItemValidation (provide/inject)', () => {
    it('descendant-registered state wins over prop AND raw', async () => {
      const propGetValidationState = vi
        .fn<(item: Item, key: ListEditorKey, index: number) => ListEditorValidationState>()
        .mockReturnValue('warning')
      let resolveAt!: (
        raw: Item,
        key?: ListEditorKey,
        index?: number,
      ) => ListEditorValidationState

      const Sentinel = defineComponent({
        props: ['k', 's'],
        setup(p) {
          useListEditorItemValidation({
            key: () => p.k as ListEditorKey,
            state: () => p.s as ListEditorValidationState,
          })
          return () => h('span', 'sentinel')
        },
      })

      const Host = defineComponent({
        setup() {
          const api = useValidationRegistry<Item>({
            getValidationState: propGetValidationState,
          })
          resolveAt = api.resolveValidation
          return () =>
            h('div', [
              h(Sentinel, { k: 1, s: 'invalid' }),
              h(Sentinel, { k: 2, s: 'valid' }),
            ])
        },
      })
      mounted = mount(Host)
      await nextTick()

      // Key 1 → registry says 'invalid' (wins over prop's 'warning')
      expect(
        resolveAt({ id: 1, title: 'A', validationState: 'valid' }, 1, 0),
      ).toBe('invalid')
      // Key 2 → registry says 'valid' (still wins)
      expect(
        resolveAt({ id: 2, title: 'B' }, 2, 1),
      ).toBe('valid')
      // No registered key → falls through to prop
      expect(
        resolveAt({ id: 3, title: 'C' }, 3, 2),
      ).toBe('warning')
    })

    it('unregisters on sentinel unmount, falling through to prop again', async () => {
      const stateRef = ref<ListEditorValidationState>('invalid')
      const Sentinel = defineComponent({
        setup() {
          useListEditorItemValidation({
            key: () => 1,
            state: stateRef,
          })
          return () => h('span', 'sentinel')
        },
      })

      let resolveAt!: (
        raw: Item,
        key?: ListEditorKey,
        index?: number,
      ) => ListEditorValidationState
      const visible = ref(true)
      const Host = defineComponent({
        setup() {
          const api = useValidationRegistry<Item>({
            getValidationState: () => 'warning',
          })
          resolveAt = api.resolveValidation
          return () =>
            h('div', visible.value ? [h(Sentinel)] : [])
        },
      })
      mounted = mount(Host)
      await nextTick()

      expect(resolveAt({ id: 1, title: 'A' }, 1, 0)).toBe('invalid')
      visible.value = false
      await nextTick()
      // Sentinel unmounted → fallback to prop ('warning')
      expect(resolveAt({ id: 1, title: 'A' }, 1, 0)).toBe('warning')
    })

    it('reactive state updates propagate without re-registration', async () => {
      const stateRef = ref<ListEditorValidationState>('invalid')
      const Sentinel = defineComponent({
        setup() {
          useListEditorItemValidation({
            key: () => 1,
            state: stateRef,
          })
          return () => h('span', 'sentinel')
        },
      })
      let resolveAt!: (
        raw: Item,
        key?: ListEditorKey,
        index?: number,
      ) => ListEditorValidationState
      const Host = defineComponent({
        setup() {
          const api = useValidationRegistry<Item>({})
          resolveAt = api.resolveValidation
          return () => h('div', [h(Sentinel)])
        },
      })
      mounted = mount(Host)
      await nextTick()

      expect(resolveAt({ id: 1, title: 'A' }, 1, 0)).toBe('invalid')
      stateRef.value = 'valid'
      await nextTick()
      expect(resolveAt({ id: 1, title: 'A' }, 1, 0)).toBe('valid')
      stateRef.value = null
      await nextTick()
      // null state from registry → falls through (and there's no prop or raw)
      expect(resolveAt({ id: 1, title: 'A' }, 1, 0)).toBeNull()
    })

    it('different sentinels for different keys do not collide', async () => {
      const Sentinel = defineComponent({
        props: ['k', 's'],
        setup(p) {
          useListEditorItemValidation({
            key: () => p.k as ListEditorKey,
            state: computed(() => p.s as ListEditorValidationState),
          })
          return () => h('span', String(p.k))
        },
      })
      let resolveAt!: (
        raw: Item,
        key?: ListEditorKey,
        index?: number,
      ) => ListEditorValidationState
      const Host = defineComponent({
        setup() {
          const api = useValidationRegistry<Item>({})
          resolveAt = api.resolveValidation
          return () =>
            h('div', [
              h(Sentinel, { k: 1, s: 'invalid' }),
              h(Sentinel, { k: 2, s: 'warning' }),
              h(Sentinel, { k: 3, s: 'valid' }),
            ])
        },
      })
      mounted = mount(Host)
      await nextTick()
      expect(resolveAt({ id: 1, title: 'A' }, 1, 0)).toBe('invalid')
      expect(resolveAt({ id: 2, title: 'B' }, 2, 1)).toBe('warning')
      expect(resolveAt({ id: 3, title: 'C' }, 3, 2)).toBe('valid')
    })
  })

  describe('graceful handling without key/index', () => {
    it('skips registry lookup when key is undefined', () => {
      const api = mountWithRegistry({
        getValidationState: () => 'invalid',
      })
      // No key provided → registry skipped, prop also skipped (needs key+index)
      // → falls through to raw.validationState which is unset
      expect(api.resolveValidation({ id: 1, title: 'A' })).toBeNull()
    })

    it('does not call prop when index is undefined', () => {
      const propFn = vi.fn().mockReturnValue('invalid')
      const api = mountWithRegistry({ getValidationState: propFn })
      api.resolveValidation({ id: 1, title: 'A' }, 1)
      expect(propFn).not.toHaveBeenCalled()
    })
  })

  describe('provides ListEditorValidationKey', () => {
    it('provides a registry with register + unregister under the well-known InjectionKey', () => {
      let injectedRegistry: ListEditorValidationRegistry | null = null
      const Child = defineComponent({
        setup() {
          injectedRegistry = inject(ListEditorValidationKey, null)
          return () => h('span')
        },
      })
      const Host = defineComponent({
        setup() {
          useValidationRegistry<Item>({})
          return () => h(Child)
        },
      })
      mounted = mount(Host)
      expect(injectedRegistry).not.toBeNull()
      expect(typeof injectedRegistry!.register).toBe('function')
      expect(typeof injectedRegistry!.unregister).toBe('function')
    })
  })
})
