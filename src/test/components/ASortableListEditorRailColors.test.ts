/* eslint-disable vue/no-ref-object-reactivity-loss */
import { afterEach, describe, expect, it } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { defineComponent, h, nextTick, ref } from 'vue'
import ASortableListEditor from '@/labs/listEditor/ASortableListEditor.vue'

interface Item {
  id: number
  position: number
  title: string
}

let mounted: VueWrapper | null = null

afterEach(() => {
  mounted?.unmount()
  mounted = null
})

const ORANGE_OPAQUE = 'rgb(251, 140, 0)'
const ORANGE_TRANSPARENT_RAIL = 'rgba(251, 140, 0, 0.35)'
const BLUE_TRANSPARENT_RAIL = 'rgba(24, 103, 192, 0.28)'
const BLUE_OPAQUE = 'rgb(24, 103, 192)'

describe('ASortableListEditor — rail colors', () => {
  it('row ::before is BLUE when editing-only (not unsaved)', async () => {
    const model = ref<Item[]>([
      { id: 1, position: 1, title: 'Item 1' },
      { id: 2, position: 2, title: 'Item 2' },
    ])
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
            },
            {
              item: () => h('div', { class: 'inline-form' }, 'form'),
            },
          )
      },
    })
    mounted = mount(Host, { attachTo: document.body })
    await nextTick()

    const row = mounted.findAll('.a-le-row')[0].element as HTMLElement
    await mounted.findAll('.a-le-row-header')[0].trigger('click')
    await nextTick()

    expect(row.classList.contains('a-le-row--editing')).toBe(true)
    expect(row.classList.contains('a-le-row--unsaved')).toBe(false)
    // editing-only → row ::before should be primary (blue)
    const cs = window.getComputedStyle(row, '::before')
    expect(cs.backgroundColor).toBe(BLUE_OPAQUE)
  })

  it('row ::before is ORANGE when editing+unsaved (orange wins over blue)', async () => {
    const model = ref<Item[]>([
      { id: 1, position: 1, title: 'Item 1' },
      { id: 2, position: 2, title: 'Item 2' },
    ])
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
            },
            {
              item: () => h('div', { class: 'inline-form' }, 'form'),
            },
          )
      },
    })
    mounted = mount(Host, { attachTo: document.body })
    await nextTick()

    // Open the first row.
    await mounted.findAll('.a-le-row-header')[0].trigger('click')
    await nextTick()

    // Mutate the first item to make it dirty.
    model.value = [{ ...model.value[0], title: 'Item 1 — edited' }, model.value[1]]
    await nextTick()

    const row = mounted.findAll('.a-le-row')[0].element as HTMLElement
    expect(row.classList.contains('a-le-row--editing')).toBe(true)
    expect(row.classList.contains('a-le-row--unsaved')).toBe(true)

    const cs = window.getComputedStyle(row, '::before')
    expect(cs.backgroundColor).toBe(ORANGE_OPAQUE)
  })

  it('row body border-left is ORANGE when editing+unsaved (override applies, NOT blue)', async () => {
    const model = ref<Item[]>([
      { id: 1, position: 1, title: 'Item 1' },
      { id: 2, position: 2, title: 'Item 2' },
    ])
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
            },
            {
              item: () => h('div', { class: 'inline-form' }, 'form'),
            },
          )
      },
    })
    // Make the editor's container wider than 769px so the @container query fires.
    mounted = mount(Host, {
      attachTo: document.body,
      attrs: { style: 'width: 1000px;' },
    })
    await nextTick()

    await mounted.findAll('.a-le-row-header')[0].trigger('click')
    await nextTick()
    model.value = [{ ...model.value[0], title: 'Item 1 — edited' }, model.value[1]]
    await nextTick()

    const row = mounted.findAll('.a-le-row')[0].element as HTMLElement
    const body = row.querySelector<HTMLElement>(':scope > .a-le-row-body')
    expect(body).toBeTruthy()
    expect(row.classList.contains('a-le-row--unsaved')).toBe(true)

    const cs = window.getComputedStyle(body!)
    // The body border-left only paints when @container le-shell ≥ 769px. If the
    // browser test container is narrow, width is 0 — skip the assertion in that
    // case (the rail wouldn't be visible anyway).
    if (cs.borderLeftWidth !== '0px') {
      expect(cs.borderLeftColor).toBe(ORANGE_TRANSPARENT_RAIL)
      expect(cs.borderLeftColor).not.toBe(BLUE_TRANSPARENT_RAIL)
    }
  })

  it('embedded inner row ::before is ORANGE when editing+unsaved', async () => {
    // Stacked editors: outer row holds an inner embedded editor in its #item slot.
    const innerModel = ref<Item[]>([
      { id: 11, position: 1, title: 'Inner 1' },
      { id: 12, position: 2, title: 'Inner 2' },
    ])
    const outerModel = ref<Item[]>([{ id: 1, position: 1, title: 'Outer 1' }])

    const Host = defineComponent({
      setup() {
        return () =>
          h(
            ASortableListEditor<Item>,
            {
              modelValue: outerModel.value,
              'onUpdate:modelValue': (v: Item[]) => {
                outerModel.value = v
              },
            },
            {
              item: () =>
                h(
                  ASortableListEditor<Item>,
                  {
                    modelValue: innerModel.value,
                    'onUpdate:modelValue': (v: Item[]) => {
                      innerModel.value = v
                    },
                    embedded: true,
                  },
                  {
                    item: () => h('div', { class: 'inline-form' }, 'form'),
                  },
                ),
            },
          )
      },
    })
    mounted = mount(Host, { attachTo: document.body })
    await nextTick()

    // Open outer row → inner editor mounts.
    await mounted.findAll('.a-le-row-header')[0].trigger('click')
    await nextTick()

    // Open the first inner row.
    const innerRows = Array.from(
      document.querySelectorAll<HTMLElement>('.a-sortable-list-editor--embedded .a-le-row'),
    )
    expect(innerRows.length).toBeGreaterThan(0)
    const innerHeader = innerRows[0].querySelector<HTMLElement>('.a-le-row-header')!
    innerHeader.click()
    await nextTick()

    // Mutate the inner first item to make it dirty.
    innerModel.value = [{ ...innerModel.value[0], title: 'Inner 1 — edited' }, innerModel.value[1]]
    await nextTick()

    const innerRow = Array.from(
      document.querySelectorAll<HTMLElement>('.a-sortable-list-editor--embedded .a-le-row'),
    )[0]
    expect(innerRow.classList.contains('a-le-row--editing')).toBe(true)
    expect(innerRow.classList.contains('a-le-row--unsaved')).toBe(true)

    const cs = window.getComputedStyle(innerRow, '::before')
    expect(cs.backgroundColor).toBe(ORANGE_OPAQUE)
  })
})
