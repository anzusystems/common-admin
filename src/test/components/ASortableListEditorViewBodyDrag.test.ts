import { describe, it, expect } from 'vitest'
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils'
import { defineComponent, h, nextTick, ref } from 'vue'
import ASortableListEditor from '@/labs/listEditor/ASortableListEditor.vue'

interface Item {
  id: number
  position: number
  title: string
}

const items = (): Item[] => [
  { id: 1, position: 1, title: 'First' },
  { id: 2, position: 2, title: 'Second' },
]

// The DAM image widget renders its tile grid through `#view-body`, so the editor's own rows
// container does not exist in view mode — it mounts only when the user switches to reorder mode.
const mountEditor = () => {
  const model = ref<Item[]>(items())
  const mode = ref<'view' | 'reorder'>('view')
  const Host = defineComponent({
    setup() {
      return () =>
        h(
          ASortableListEditor<Item>,
          {
            modelValue: model.value,
            'onUpdate:modelValue': (v: Item[]) => {
              model.value = v
            },
            mode: mode.value,
            'onUpdate:mode': (v: 'view' | 'reorder') => {
              mode.value = v
            },
            position: 'position',
            compactField: 'title',
          },
          { 'view-body': () => h('div', { class: 'tiles' }, 'tiles') },
        )
    },
  })
  return { wrapper: mount(Host) as VueWrapper, mode }
}

const sortableDisabled = (wrapper: VueWrapper): boolean | null => {
  const rows = wrapper.element.querySelector('.a-sortable-list-editor__rows') as
    | (HTMLElement & Record<string, any>)
    | null
  if (!rows) return null
  const key = Object.keys(rows).find((k) => k.startsWith('Sortable'))
  return key ? rows[key].options.disabled : null
}

describe('ASortableListEditor — rows container mounted on mode switch', () => {
  it('enables SortableJS on the instance created when entering reorder mode', async () => {
    const { wrapper, mode } = mountEditor()
    // View mode renders the consumer slot, so there is no rows container to bind to yet.
    expect(sortableDisabled(wrapper)).toBeNull()

    mode.value = 'reorder'
    await nextTick()
    await flushPromises()

    expect(sortableDisabled(wrapper)).toBe(false)
  })
})
