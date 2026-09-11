/* eslint-disable vue/no-ref-object-reactivity-loss */
import { afterEach, describe, expect, it } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { defineComponent, h, nextTick, ref } from 'vue'
import ASortableListEditor from '@/labs/listEditor/ASortableListEditor.vue'
import AListEditor from '@/labs/listEditor/AListEditor.vue'

// QA 85050 Batch-6 BUG-04/05 — content placed in the `#before-item` / `#after-item`
// slots (e.g. PageContents' auto-distribution preview rendered between content rows)
// must NOT inherit the row's unsaved/editing tint. The structural fix renders those
// slots as SIBLINGS of `.a-le-row` inside a `.a-le-row-wrapper`, so slot content can
// never be a DOM descendant of `.a-le-row--unsaved` (or `--editing`). These tests
// assert that invariant directly — cheaper + less brittle than a computed-colour check,
// which the admin-cms e2e (pageContentAdvertAmberLeak.spec.ts) still covers on the real app.

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

const slots = {
  'before-item': () => h('div', { class: 'interstitial-marker interstitial-before' }, 'before'),
  'after-item': () => h('div', { class: 'interstitial-marker interstitial-after' }, 'after'),
  item: () => h('div', { class: 'inline-form' }, 'form'),
}

// The row is both --editing (opened) and --unsaved (dirtied); neither state may reach
// the interstitial markers, which live in the wrapper as siblings of `.a-le-row`.
const assertNoTintLeak = (w: VueWrapper): void => {
  expect(w.findAll('.a-le-row--unsaved').length).toBeGreaterThanOrEqual(1)
  expect(w.findAll('.interstitial-marker').length).toBeGreaterThanOrEqual(2)
  expect(w.findAll('.a-le-row--unsaved .interstitial-marker').length).toBe(0)
  expect(w.findAll('.a-le-row--editing .interstitial-marker').length).toBe(0)
  expect(w.findAll('.a-le-row-wrapper .interstitial-marker').length).toBeGreaterThanOrEqual(2)
}

describe('QA 85050 BUG-04/05 — interstitial slots do not inherit the row tint', () => {
  it('ASortableListEditor: an unsaved+editing row does not tint its #before/#after-item content', async () => {
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
              factory: (): Item => ({ id: -Date.now(), position: 0, title: '' }),
            },
            slots,
          )
      },
    })
    mounted = mount(Host, { attachTo: document.body })
    await nextTick()

    await mounted.findAll('.a-le-row-header')[0].trigger('click')
    await nextTick()
    // Dirty the first item so the row reads unsaved (mirrors the rail-colors harness).
    model.value = [{ ...model.value[0], title: 'Item 1 — edited' }, model.value[1]]
    await nextTick()

    assertNoTintLeak(mounted)
  })

  it('AListEditor: an unsaved+editing row does not tint its #before/#after-item content', async () => {
    const model = ref<Item[]>([
      { id: 1, position: 1, title: 'Item 1' },
      { id: 2, position: 2, title: 'Item 2' },
    ])
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
              factory: (): Item => ({ id: -Date.now(), position: 0, title: '' }),
            },
            slots,
          )
      },
    })
    mounted = mount(Host, { attachTo: document.body })
    await nextTick()

    await mounted.findAll('.a-le-row-header')[0].trigger('click')
    await nextTick()
    model.value = [{ ...model.value[0], title: 'Item 1 — edited' }, model.value[1]]
    await nextTick()

    assertNoTintLeak(mounted)
  })
})

// The wrapper changed which element is the layout item, so two CSS contracts that keyed
// off `.a-le-row` had to move to `.a-le-row-wrapper`. These guard against regressing them
// (both surfaced in the codex review of the fix).
describe('QA 85050 BUG-04/05 — wrapper preserves the row layout contracts', () => {
  const mountSortable = (extraProps: Record<string, unknown>): VueWrapper => {
    const model = ref<Item[]>([
      { id: 1, position: 1, title: 'Item 1' },
      { id: 2, position: 2, title: 'Item 2' },
      { id: 3, position: 3, title: 'Item 3' },
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
              factory: (): Item => ({ id: -Date.now(), position: 0, title: '' }),
              ...extraProps,
            },
            { item: () => h('div', { class: 'inline-form' }, 'form') },
          )
      },
    })
    return mount(Host, { attachTo: document.body })
  }

  it('embedded mode keeps the 4px inter-row gap (now on the wrapper, not the row)', async () => {
    mounted = mountSortable({ embedded: true })
    await nextTick()

    const wrappers = mounted.findAll('.a-le-row-wrapper')
    expect(wrappers.length).toBe(3)
    // Non-last wrappers carry the gap; the last one does not (matches the old
    // `.a-le-row:last-of-type { margin-bottom: 0 }`).
    expect(getComputedStyle(wrappers[0].element).marginBottom).toBe('4px')
    expect(getComputedStyle(wrappers[1].element).marginBottom).toBe('4px')
    expect(getComputedStyle(wrappers[2].element).marginBottom).toBe('0px')
  })

  it('chips mode makes the wrapper the flex item (pill sizing moved off the row)', async () => {
    mounted = mountSortable({ chips: true })
    await nextTick()

    const wrapper = mounted.findAll('.a-le-row-wrapper')[0].element
    const cs = getComputedStyle(wrapper)
    // The wrapper is what `__rows` flex-wraps now, so it must be the sized flex item.
    expect(cs.display).toBe('flex')
    expect(cs.flexGrow).toBe('0')
    expect(cs.flexShrink).toBe('0')
  })
})
