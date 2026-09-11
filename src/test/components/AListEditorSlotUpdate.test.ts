/* eslint-disable vue/no-ref-object-reactivity-loss */
import { afterEach, describe, expect, it } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { defineComponent, h, nextTick, ref } from 'vue'
import AListEditor from '@/labs/listEditor/AListEditor.vue'

interface Item {
  id: number
  position: number
  title: string
}

const items = (): Item[] => [
  { id: 1, position: 1, title: 'First' },
  { id: 2, position: 2, title: 'Second' },
  { id: 3, position: 3, title: 'Third' },
]

let nextTempId = 0
const makeItem = (): Item => ({ id: --nextTempId, position: 0, title: '' })

let mounted: VueWrapper | null = null

afterEach(() => {
  mounted?.unmount()
  mounted = null
})

describe('AListEditor — slot actions.update', () => {
  it('exposes actions.update on the #item slot', () => {
    const received = ref<{ actions?: { update?: (data: Item) => void } } | null>(null)
    const Host = defineComponent({
      setup() {
        const model = ref<Item[]>(items())
        return () =>
          h(
            AListEditor<Item>,
            {
              modelValue: model.value,
              'onUpdate:modelValue': (v: Item[]) => {
                model.value = v
              },
              factory: makeItem,
            },
            {
              'item-compact': (slotProps: { actions?: { update?: (data: Item) => void } }) => {
                received.value = slotProps
                return h('span', 'row')
              },
            },
          )
      },
    })
    mounted = mount(Host)
    expect(typeof received.value?.actions?.update).toBe('function')
  })

  it('actions.update writes a replacement item back through the editor', async () => {
    const model = ref<Item[]>(items())
    const row1Update = ref<((data: Item) => void) | null>(null)
    const Host = defineComponent({
      setup() {
        return () =>
          h(
            AListEditor<Item>,
            {
              modelValue: model.value,
              'onUpdate:modelValue': (v: Item[]) => {
                model.value = v
              },
              factory: makeItem,
            },
            {
              'item-compact': ({
                raw,
                actions,
              }: {
                raw: Item
                actions: { update: (data: Item) => void }
              }) => {
                if (raw.id === 1) row1Update.value = actions.update
                return h('span', String(raw.id))
              },
            },
          )
      },
    })
    mounted = mount(Host)
    await nextTick()
    expect(row1Update.value).not.toBeNull()
    row1Update.value?.({ id: 1, position: 1, title: 'Renamed' })
    await nextTick()
    expect(model.value[0].title).toBe('Renamed')
    // Other rows unchanged
    expect(model.value[1].title).toBe('Second')
    expect(model.value[2].title).toBe('Third')
  })

  it('replacing a property via actions.update updates only that row', async () => {
    const model = ref<Item[]>(items())
    const row2Update = ref<((data: Item) => void) | null>(null)
    const Host = defineComponent({
      setup() {
        return () =>
          h(
            AListEditor<Item>,
            {
              modelValue: model.value,
              'onUpdate:modelValue': (v: Item[]) => {
                model.value = v
              },
              factory: makeItem,
            },
            {
              'item-compact': ({
                raw,
                actions,
              }: {
                raw: Item
                actions: { update: (data: Item) => void }
              }) => {
                if (raw.id === 2) row2Update.value = actions.update
                return h('span', String(raw.id))
              },
            },
          )
      },
    })
    mounted = mount(Host)
    await nextTick()
    expect(row2Update.value).not.toBeNull()
    row2Update.value?.({ id: 2, position: 2, title: 'New Two' })
    await nextTick()
    expect(model.value[1].title).toBe('New Two')
    expect(model.value[0].title).toBe('First')
    expect(model.value[2].title).toBe('Third')
  })
})
