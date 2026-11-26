import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'
import { userEvent } from 'vitest/browser'
import { defineComponent, h, nextTick, ref } from 'vue'

import ANestedSortableListEditor from '@/domains/listEditor/components/ANestedSortableListEditor.vue'
import type { NestedTree } from '@/domains/listEditor/types/listEditorTypes'

// "Preskupiť" of a tree by keyboard and a drag that ends where it started.

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
  children: [leaf(1, 'A', 1), leaf(2, 'B', 2), leaf(3, 'C', 3)],
  meta: { dirty: false },
})

let wrapper: VueWrapper | null = null
afterEach(() => {
  wrapper?.unmount()
  wrapper = null
  document.body.innerHTML = ''
})

const mountEditor = async () => {
  const model = ref<NestedTree<Row>>(tree())
  const mode = ref<'view' | 'reorder'>('reorder')
  const Host = defineComponent({
    setup: () => () =>
      h(ANestedSortableListEditor<Row>, {
        modelValue: model.value,
        'onUpdate:modelValue': (v: NestedTree<Row>) => (model.value = v),
        mode: mode.value,
        'onUpdate:mode': (v: 'view' | 'reorder') => (mode.value = v),
        maxDepth: 2,
        compactField: 'title',
      }),
  })
  wrapper = mount(Host, { attachTo: document.body })
  await settle()
  return { model, mode }
}

const settle = async () => {
  await nextTick()
  await flushPromises()
  await nextTick()
}
const shape = (m: { value: NestedTree<Row> }) =>
  m.value.children
    .map((n) => n.data.title + (n.children?.length ? `(${n.children.map((c) => c.data.title).join('')})` : ''))
    .join('')
const anyDirty = (m: { value: NestedTree<Row> }) => {
  const all = m.value.children.flatMap((n) => [n, ...(n.children ?? [])])
  return all.some((n) => n.meta.dirty)
}
const pending = () => wrapper!.find('.a-le-toolbar-status').text()
const rowWrapper = (id: number) => document.querySelector<HTMLElement>(`.a-le-row-wrapper[data-id="${id}"]`)!

describe('ANestedSortableListEditor — keyboard grab', () => {
  it('Escape after a grab and move puts the row back and leaves no pending change', async () => {
    const { model, mode } = await mountEditor()

    rowWrapper(2).focus()
    await userEvent.keyboard('{Enter}')
    await userEvent.keyboard('{ArrowDown}')
    await settle()
    expect(shape(model)).toBe('ACB')
    expect(pending()).toContain('1 pending change')

    await userEvent.keyboard('{Escape}')
    await settle()
    expect(shape(model)).toBe('ABC')
    expect(anyDirty(model)).toBe(false)
    expect(pending()).toContain('No pending changes')
    expect(mode.value).toBe('reorder')
  })

  it('Escape after a grab and indent puts the row back to its level', async () => {
    const { model } = await mountEditor()

    rowWrapper(2).focus()
    await userEvent.keyboard('{Enter}')
    await userEvent.keyboard('{ArrowRight}')
    await settle()
    expect(shape(model)).toBe('A(B)C')
    await expect.poll(() => document.activeElement?.getAttribute('data-id')).toBe('2')

    await userEvent.keyboard('{Escape}')
    await settle()
    expect(shape(model)).toBe('ABC')
    expect(model.value.children[1]!.data.parent).toBeNull()
    expect(pending()).toContain('No pending changes')
  })

  it('Enter drops the grab and keeps the move', async () => {
    const { model } = await mountEditor()

    rowWrapper(2).focus()
    await userEvent.keyboard('{Enter}')
    await userEvent.keyboard('{ArrowDown}')
    await userEvent.keyboard('{Enter}')
    await settle()
    expect(shape(model)).toBe('ACB')
    expect(pending()).toContain('1 pending change')
  })
})

describe('ANestedSortableListEditor — drag', () => {
  // Drag B by its handle onto C, `fraction` of the way down C's row.
  const dragBOntoC = async (fraction: number) => {
    const handle = rowWrapper(2).querySelector<HTMLElement>('.a-le-drag-handle')!
    const target = rowWrapper(3).querySelector<HTMLElement>('.a-le-row')!
    const hb = handle.getBoundingClientRect()
    const tb = target.getBoundingClientRect()
    const x = Math.round(hb.x + hb.width / 2)
    const startY = Math.round(hb.y + hb.height / 2)
    const endY = Math.round(tb.y + tb.height * fraction)
    const fire = (type: string, clientY: number, el: EventTarget = document) =>
      el.dispatchEvent(
        new MouseEvent(type, {
          bubbles: true,
          cancelable: true,
          clientX: x,
          clientY,
          button: 0,
          buttons: type.endsWith('up') ? 0 : 1,
          view: window,
        })
      )
    fire('pointerdown', startY, handle)
    fire('mousedown', startY, handle)
    const steps = 12
    for (let i = 1; i <= steps; i++) {
      const y = Math.round(startY + ((endY - startY) * i) / steps)
      fire('pointermove', y)
      fire('mousemove', y)
      await new Promise((r) => setTimeout(r, 10))
    }
    await new Promise((r) => setTimeout(r, 60))
    fire('pointerup', endY)
    fire('mouseup', endY)
    await settle()
  }

  it('onto the lower half of the next row moves it (the drag itself works)', async () => {
    const { model } = await mountEditor()
    await dragBOntoC(0.75)
    expect(shape(model)).toBe('ACB')
    expect(pending()).toContain('1 pending change')
  })

  it('onto the gap it already sits in is no change', async () => {
    const { model } = await mountEditor()
    await dragBOntoC(0.25)
    expect(shape(model)).toBe('ABC')
    expect(anyDirty(model)).toBe(false)
    expect(pending()).toContain('No pending changes')
  })
})
