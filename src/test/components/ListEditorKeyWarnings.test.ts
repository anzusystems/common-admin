import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { defineComponent, h, nextTick, ref, type Ref } from 'vue'
import AListEditor from '@/labs/listEditor/AListEditor.vue'

interface Item {
  id?: number
  position: number
  title: string
}

let mounted: VueWrapper | null = null
let warnSpy: MockInstance

// Only the editor's own warnings — other libraries may warn too.
const editorWarnings = () =>
  warnSpy.mock.calls.map((c) => String(c[0])).filter((m) => m.startsWith('[list-editor]'))

beforeEach(() => {
  warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
})

afterEach(() => {
  mounted?.unmount()
  mounted = null
  warnSpy.mockRestore()
})

const cloneList = (list: Ref<Item[]>) => {
  list.value = [...list.value]
}

const mountWith = (data: Ref<Item[]>) => {
  const Host = defineComponent({
    setup() {
      return () =>
        h(AListEditor<Item>, {
          modelValue: data.value,
          'onUpdate:modelValue': (v: Item[]) => {
            data.value = v
          },
          compactField: 'title',
        })
    },
  })
  mounted = mount(Host, { attachTo: document.body })
}

describe('list editor row-key warnings', () => {
  it('warns when rows share a key (duplicate ids)', async () => {
    const data = ref<Item[]>([
      { id: 1, position: 1, title: 'A' },
      { id: 1, position: 2, title: 'B' },
    ])
    mountWith(data)
    await nextTick()
    expect(editorWarnings().some((m) => m.includes('duplicate row keys'))).toBe(true)
  })

  it('warns when rows resolve to an undefined key (missing key-field)', async () => {
    const data = ref<Item[]>([
      { position: 1, title: 'A' },
      { position: 2, title: 'B' },
    ])
    mountWith(data)
    await nextTick()
    expect(editorWarnings().some((m) => m.includes('undefined key'))).toBe(true)
  })

  it('stays silent for unique keys', async () => {
    const data = ref<Item[]>([
      { id: 1, position: 1, title: 'A' },
      { id: 2, position: 2, title: 'B' },
    ])
    mountWith(data)
    await nextTick()
    expect(editorWarnings()).toEqual([])
  })

  it('warns once per offending signature, again for a new offender', async () => {
    const data = ref<Item[]>([
      { id: 1, position: 1, title: 'A' },
      { id: 1, position: 2, title: 'B' },
    ])
    mountWith(data)
    await nextTick()
    expect(editorWarnings().length).toBe(1)

    // Same offending state in a new array → no re-warn (deduplicated).
    cloneList(data)
    await nextTick()
    expect(editorWarnings().length).toBe(1)

    // A different duplicate key set warns again.
    data.value = [
      { id: 2, position: 1, title: 'C' },
      { id: 2, position: 2, title: 'D' },
    ]
    await nextTick()
    expect(editorWarnings().length).toBe(2)
  })
})
