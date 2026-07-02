/* eslint-disable vue/no-ref-object-reactivity-loss */
import { afterEach, describe, expect, it } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { defineComponent, h, nextTick, ref } from 'vue'
import ASortableListEditor from '@/labs/listEditor/ASortableListEditor.vue'

/**
 * QA 85050 Batch 6 BUG-02 — "editing one nested Zámer marks ALL other Zámery amber".
 *
 * The real cause is a CSS COLOUR CASCADE, not a dirty-state leak. When a PARENT
 * category row is `--unsaved` + `--expanded`, the `_shared.scss` rule
 *   `&--unsaved.a-le-row--expanded .a-le-row-main *  { color: var(--le-warning) }`
 * paints EVERY descendant text orange — including the titles of nested CLEAN
 * child rows. So untouched sibling intentions READ amber although their own row
 * is not `--unsaved` (verified live: sibling `titleColor=rgb(251,140,0)` with
 * `rowUnsaved=false`).
 *
 * Mount a category editor (outer) holding a nested children editor (inner). Make
 * ONLY the outer row unsaved+expanded, keep the inner child rows clean, and
 * assert a clean inner child's title is NOT the warning colour.
 * FAILS today (the child title cascades to orange). Passes once the `--unsaved`
 * text colour is scoped so it does not bleed into nested rows.
 */

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

const ORANGE_WARNING = 'rgb(251, 140, 0)'

describe('QA 85050 BUG-02 — unsaved parent must not colour nested clean child titles', () => {
  it('a clean nested child title stays non-amber when the parent row is unsaved+expanded', async () => {
    const innerModel = ref<Item[]>([
      { id: 11, position: 1, title: 'Child A' },
      { id: 12, position: 2, title: 'Child B' },
    ])
    const outerModel = ref<Item[]>([{ id: 1, position: 1, title: 'Category' }])

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
              factory: (): Item => ({ id: -Date.now(), position: 0, title: '' }),
              compactField: 'title',
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
                    factory: (): Item => ({ id: -Date.now(), position: 0, title: '' }),
                    embedded: true,
                    compactField: 'title',
                  },
                  {
                    item: () => h('div', { class: 'inline-form' }, 'form'),
                  }
                ),
            }
          )
      },
    })
    mounted = mount(Host, { attachTo: document.body, attrs: { style: 'width: 1000px;' } })
    await nextTick()

    // Expand the outer category row → the inner children editor mounts.
    await mounted.findAll('.a-le-row-header')[0].trigger('click')
    await nextTick()

    // Make ONLY the outer (category) row dirty → it becomes --unsaved + --expanded.
    outerModel.value = [{ ...outerModel.value[0], title: 'Category — edited' }]
    await nextTick()

    const outerRow = mounted.findAll('.a-le-row')[0].element as HTMLElement
    expect(outerRow.classList.contains('a-le-row--unsaved')).toBe(true)
    // Header-click opens the row in --editing (or --expanded) mode; the cascade
    // rule fires for both. Either way the nested children editor is mounted.
    expect(
      outerRow.classList.contains('a-le-row--editing') ||
        outerRow.classList.contains('a-le-row--expanded')
    ).toBe(true)

    // The inner child rows are CLEAN (never edited) — their own row is not unsaved.
    const innerRows = Array.from(
      document.querySelectorAll<HTMLElement>('.a-sortable-list-editor--embedded .a-le-row')
    )
    expect(innerRows.length).toBeGreaterThanOrEqual(2)
    for (const innerRow of innerRows) {
      expect(innerRow.classList.contains('a-le-row--unsaved')).toBe(false)
    }

    // BUG-02: an untouched child's TITLE must NOT be painted the amber warning colour.
    const childTitle = innerRows[0].querySelector<HTMLElement>('.a-le-title')
    expect(childTitle).toBeTruthy()
    expect(window.getComputedStyle(childTitle!).color).not.toBe(ORANGE_WARNING)
  })
})
