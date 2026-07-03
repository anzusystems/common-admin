
import { afterEach, describe, expect, it } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { defineComponent, h, nextTick, ref } from 'vue'
import AListEditor from '@/labs/listEditor/AListEditor.vue'

/**
 * QA 85050 Batch 6 BUG-03 — "Vložené reklamné pozície rows stay amber after
 * every save (record exists)".
 *
 * The advert AListEditor (in ContentItemKindArticleListForm) is fed
 * `advertPositionIncludes` rows the server returns with NO `id`
 * (`[{ adSlotName, position }, …]`) and passes NO `get-key`, so the editor's
 * key resolution defaults to `'id'` → every row keys to `undefined`. With ≥2
 * such rows the keys collide: `captureBaseline` stores them in a Map keyed by
 * `undefined`, so the second row overwrites the first and the baseline collapses
 * to a single entry. The content-diff then can't match every live row to its own
 * baseline hash, so rows read `.a-le-row--unsaved` on a plain, untouched load and
 * stay amber after every successful save (the record IS persisted — the amber is
 * a stable-key artefact, not real dirtiness).
 *
 * Mount an AListEditor over ≥2 rows that have NO `id` field and pass NO get-key,
 * then assert that on the initial (clean) render NONE of the rows is
 * `--unsaved`. FAILS today (the colliding `undefined` keys mark them amber).
 * Passes once the advert list gets a stable get-key / backfilled temp ids.
 */

// advertPositionIncludes shape as returned by GET /adm/v1/auto-distribution/[id]:
// no server `id`, only adSlotName + position.
interface AdvertPosition {
  adSlotName: string
  position: number
}

let mounted: VueWrapper | null = null
afterEach(() => {
  mounted?.unmount()
  mounted = null
})

describe('QA 85050 BUG-03 — id-less advert rows must not read unsaved on a clean load', () => {
  it('≥2 saved rows with no id and no get-key stay clear (not --unsaved) on initial render', async () => {
    // Two ALREADY-SAVED server rows, distinct content, NO `id` field.
    const data = ref<AdvertPosition[]>([
      { adSlotName: 'A-slot', position: 1 },
      { adSlotName: 'B-slot', position: 2 },
    ])

    const Host = defineComponent({
      setup() {
        return () =>
          h(AListEditor<AdvertPosition>, {
            modelValue: data.value,
            'onUpdate:modelValue': (v: AdvertPosition[]) => {
              data.value = v
            },
            // Mirrors ContentItemKindArticleListForm: no `get-key` → defaults to 'id'.
            compactField: 'adSlotName',
          })
      },
    })
    mounted = mount(Host, { attachTo: document.body })
    await nextTick()
    await nextTick()

    const rows = Array.from(document.querySelectorAll<HTMLElement>('.a-le-row'))
    // Sanity: both saved rows rendered (this is a clean load, no interaction).
    expect(rows.length).toBe(2)

    // BUG-03: a freshly-loaded, untouched, already-saved list must show ZERO
    // unsaved rows. Today both collide on key `undefined` and read amber.
    const unsaved = rows.filter((r) => r.classList.contains('a-le-row--unsaved'))
    expect(unsaved.length).toBe(0)
  })
})
