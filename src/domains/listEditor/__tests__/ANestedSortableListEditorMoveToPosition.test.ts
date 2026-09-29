import { afterEach, describe, expect, it } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { defineComponent, h, nextTick, ref } from 'vue'
import ANestedSortableListEditor from '@/domains/listEditor/components/ANestedSortableListEditor.vue'
import LeNestedRow from '@/domains/listEditor/components/internal/LeNestedRow.vue'
import type { NestedTree } from '@/domains/listEditor/types/listEditorTypes'

interface Row {
  id: number
  position: number
  parent: number | null
  title: string
}

const leaf = (id: number, title: string, position: number) => ({
  data: { id, position, parent: null, title },
  children: [],
  meta: { dirty: false },
})
const tree = (): NestedTree<Row> => ({
  children: [leaf(1, 'A', 1), leaf(2, 'B', 2), leaf(3, 'C', 3), leaf(4, 'D', 4)],
  meta: { dirty: false },
})

let wrapper: VueWrapper | null = null
afterEach(() => {
  wrapper?.unmount()
  wrapper = null
  document.body.innerHTML = ''
})

const mountEditor = () => {
  const model = ref<NestedTree<Row>>(tree())
  const Host = defineComponent({
    setup: () => () =>
      h(ANestedSortableListEditor<Row>, {
        modelValue: model.value,
        'onUpdate:modelValue': (v: NestedTree<Row>) => (model.value = v),
        maxDepth: 2,
        showMoveToPosition: true,
        compactField: 'title',
      }),
  })
  wrapper = mount(Host, { attachTo: document.body })
  return { model }
}

type RowProps = { vi: { key: number }; callbacks: { openMoveToPosition: (vi: unknown) => void } }
const rowProps = (row: { props: () => unknown }) => row.props() as RowProps

// Open the row's "Move to position" action, type a 1-based position into the dialog, confirm.
const moveViaDialog = async (key: number, position: number) => {
  const row = rowProps(wrapper!.findAllComponents(LeNestedRow).find((r) => rowProps(r).vi.key === key)!)
  row.callbacks.openMoveToPosition(row.vi)
  await flushPromises()
  await nextTick()
  const input = document.querySelector<HTMLInputElement>('input[type="number"]')!
  input.value = String(position)
  input.dispatchEvent(new Event('input', { bubbles: true }))
  await nextTick()
  Array.from(document.querySelectorAll<HTMLButtonElement>('button'))
    .find((b) => b.textContent?.trim() === 'Move')!
    .click()
  await flushPromises()
}

const order = (m: { value: NestedTree<Row> }) => m.value.children.map((n) => n.data.title).join('')

describe('ANestedSortableListEditor — move to position', () => {
  it('moving B from position 2 to 3 lands it at 3', async () => {
    const { model } = mountEditor()
    await moveViaDialog(2, 3)
    expect(order(model)).toBe('ACBD')
  })

  it('moving B from position 2 to 4 (last) lands it last', async () => {
    const { model } = mountEditor()
    await moveViaDialog(2, 4)
    expect(order(model)).toBe('ACDB')
  })

  it('moving C from position 3 to 1 (upwards) lands it first', async () => {
    const { model } = mountEditor()
    await moveViaDialog(3, 1)
    expect(order(model)).toBe('CABD')
  })
})
