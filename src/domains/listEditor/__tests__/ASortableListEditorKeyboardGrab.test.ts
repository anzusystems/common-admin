import { afterEach, describe, expect, it } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { userEvent } from 'vitest/browser'
import { defineComponent, h, nextTick, ref } from 'vue'
import ASortableListEditor from '@/domains/listEditor/components/ASortableListEditor.vue'

// "Preskupiť" by keyboard and a drag that ends where it started.

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

let wrapper: VueWrapper | null = null
afterEach(() => {
  wrapper?.unmount()
  wrapper = null
  document.body.innerHTML = ''
})

const mountEditor = async () => {
  const model = ref<Item[]>(items())
  const mode = ref<'view' | 'reorder'>('reorder')
  const Host = defineComponent({
    setup: () => () =>
      h(ASortableListEditor<Item>, {
        modelValue: model.value,
        'onUpdate:modelValue': (v: Item[]) => (model.value = v),
        mode: mode.value,
        'onUpdate:mode': (v: 'view' | 'reorder') => (mode.value = v),
        compactField: 'title',
        unsavedSectionLabel: 'Items',
      }),
  })
  wrapper = mount(Host, { attachTo: document.body })
  await nextTick()
  await flushPromises()
  return { model, mode }
}

const order = (model: { value: Item[] }) => model.value.map((i) => i.id)
const pending = () => wrapper!.find('.a-le-toolbar-status').text()
const rowEl = (id: number) => document.querySelector<HTMLElement>(`.a-le-row[data-id="${id}"]`)!
const grabbed = () => document.querySelectorAll('.a-le-row--grabbed').length
const settle = async () => {
  await nextTick()
  await flushPromises()
}

describe('ASortableListEditor — keyboard in reorder mode', () => {
  it('Enter and Space on a row\'s "move down" button move the row instead of grabbing it', async () => {
    const { model } = await mountEditor()

    rowEl(1).querySelector<HTMLElement>('.a-le-action--down')!.focus()
    await userEvent.keyboard('{Enter}')
    await settle()
    expect(order(model)).toEqual([2, 1, 3])
    expect(grabbed()).toBe(0)

    rowEl(1).querySelector<HTMLElement>('.a-le-action--down')!.focus()
    await userEvent.keyboard(' ')
    await settle()
    expect(order(model)).toEqual([2, 3, 1])
    expect(grabbed()).toBe(0)
  })

  it('Escape after a keyboard grab and move puts the row back and leaves no pending change', async () => {
    const { model, mode } = await mountEditor()

    rowEl(1).focus()
    await userEvent.keyboard('{Enter}')
    await userEvent.keyboard('{ArrowDown}')
    await settle()
    expect(order(model)).toEqual([2, 1, 3])
    expect(pending()).toContain('1 pending change')

    await userEvent.keyboard('{Escape}')
    await settle()
    expect(order(model)).toEqual([1, 2, 3])
    expect(model.value.map((i) => i.position)).toEqual([1, 2, 3])
    expect(pending()).toContain('No pending changes')
    expect(grabbed()).toBe(0)
    expect(mode.value).toBe('reorder')
    await expect.poll(() => document.activeElement?.getAttribute('data-id')).toBe('1')
  })

  it('Escape keeps a move made before the grab', async () => {
    const { model } = await mountEditor()

    rowEl(1).querySelector<HTMLElement>('.a-le-action--down')!.click()
    await settle()
    expect(order(model)).toEqual([2, 1, 3])

    rowEl(1).focus()
    await userEvent.keyboard('{Enter}')
    await userEvent.keyboard('{ArrowDown}')
    await settle()
    expect(order(model)).toEqual([2, 3, 1])

    await userEvent.keyboard('{Escape}')
    await settle()
    expect(order(model)).toEqual([2, 1, 3])
    expect(pending()).toContain('1 pending change')
  })

  it('Enter drops the grab and keeps the move', async () => {
    const { model } = await mountEditor()

    rowEl(1).focus()
    await userEvent.keyboard('{Enter}')
    await userEvent.keyboard('{ArrowDown}')
    await userEvent.keyboard('{Enter}')
    await settle()
    expect(order(model)).toEqual([2, 1, 3])
    expect(grabbed()).toBe(0)
    expect(pending()).toContain('1 pending change')
  })
})

describe('ASortableListEditor — a drag that ends where it started', () => {
  it('is no pending change', async () => {
    const { model } = await mountEditor()
    const handle = rowEl(2).querySelector<HTMLElement>('.a-le-drag-handle')!
    const box = handle.getBoundingClientRect()
    const x = Math.round(box.x + box.width / 2)
    const y = Math.round(box.y + box.height / 2)
    const fire = (type: string, clientY: number, target: EventTarget = document) =>
      target.dispatchEvent(
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
    let dragStarted = false
    fire('pointerdown', y, handle)
    fire('mousedown', y, handle)
    for (const dy of [2, 5, 8, 10, 8, 5, 2, 0]) {
      fire('pointermove', y + dy)
      fire('mousemove', y + dy)
      await new Promise((r) => setTimeout(r, 10))
      dragStarted ||= !!document.querySelector('.a-le-row--ghost, .a-le-row--drag')
    }
    await new Promise((r) => setTimeout(r, 60))
    fire('pointerup', y)
    fire('mouseup', y)
    await settle()

    expect(dragStarted).toBe(true)
    expect(order(model)).toEqual([1, 2, 3])
    expect(pending()).toContain('No pending changes')
  })
})
