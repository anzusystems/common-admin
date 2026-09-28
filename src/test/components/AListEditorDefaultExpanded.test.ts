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

const mountEditor = (defaultExpanded: boolean, extra: Record<string, unknown> = {}) => {
  const model = ref<Item[]>(items())
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
            compactField: 'title',
            defaultExpanded,
            ...extra,
          },
          {
            item: ({ raw }: { raw: Item }) =>
              h('input', { class: 'edit-input', 'data-id': raw.id, value: raw.title }),
          },
        )
    },
  })
  mounted = mount(Host)
  return { wrapper: mounted, model }
}

describe('AListEditor — defaultExpanded', () => {
  it('renders the #item slot for every row on mount when true', async () => {
    const { wrapper } = mountEditor(true)
    await nextTick()
    const inputs = wrapper.findAll('.edit-input')
    expect(inputs).toHaveLength(3)
    expect(inputs[0].attributes('data-id')).toBe('1')
    expect(inputs[2].attributes('data-id')).toBe('3')
  })

  it('does not render #item slot rows when false (default collapsed behavior)', async () => {
    const { wrapper } = mountEditor(false)
    await nextTick()
    expect(wrapper.findAll('.edit-input')).toHaveLength(0)
  })

  it('hides the edit pencil when defaultExpanded is true', async () => {
    const { wrapper } = mountEditor(true)
    await nextTick()
    expect(wrapper.findAll('.a-le-action--edit')).toHaveLength(0)
  })

  it('shows the edit pencil when defaultExpanded is false', async () => {
    const { wrapper } = mountEditor(false)
    await nextTick()
    expect(wrapper.findAll('.a-le-action--edit').length).toBeGreaterThan(0)
  })

  it('row click is a no-op when defaultExpanded is true', async () => {
    const { wrapper } = mountEditor(true)
    await nextTick()
    await wrapper.find('.a-le-row-header').trigger('click')
    await nextTick()
    // All rows still show #item; nothing collapsed.
    expect(wrapper.findAll('.edit-input')).toHaveLength(3)
    // The row is not marked clickable.
    expect(wrapper.find('.a-le-row').classes()).not.toContain('a-le-row--clickable')
  })

  it('newly added rows render the #item slot immediately', async () => {
    const { wrapper, model } = mountEditor(true)
    await nextTick()
    model.value.push({ id: 4, position: 4, title: 'Fourth' })
    await nextTick()
    expect(wrapper.findAll('.edit-input')).toHaveLength(4)
  })

  it('hides the default inline Save/Cancel footer when defaultExpanded with onItemSave', async () => {
    const { wrapper } = mountEditor(true, { onItemSave: () => {} })
    await nextTick()
    expect(wrapper.findAll('.a-le-row-footer')).toHaveLength(0)
  })

  it('shows the default inline Save/Cancel footer when defaultExpanded is false', async () => {
    const { wrapper } = mountEditor(false, { onItemSave: () => {} })
    await nextTick()
    // Open the first row via edit pencil
    await wrapper.find('.a-le-action--edit').trigger('click')
    await nextTick()
    expect(wrapper.findAll('.a-le-row-footer').length).toBeGreaterThan(0)
  })

  it('slot scope `editing` is true for every row when defaultExpanded', async () => {
    const observedEditing: boolean[] = []
    const model = ref<Item[]>(items())
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
              compactField: 'title',
              defaultExpanded: true,
            },
            {
              item: (props: { editing: boolean }) => {
                observedEditing.push(props.editing)
                return h('div', 'form')
              },
            },
          )
      },
    })
    mounted = mount(Host)
    await nextTick()
    expect(observedEditing.every((e) => e === true)).toBe(true)
    expect(observedEditing).toHaveLength(3)
  })
})
