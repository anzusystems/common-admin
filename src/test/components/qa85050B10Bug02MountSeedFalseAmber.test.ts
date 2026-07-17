import { afterEach, describe, expect, it } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { defineComponent, h, nextTick, ref, type Ref } from 'vue'
import AListEditor from '@/labs/listEditor/AListEditor.vue'
import ASortableListEditor from '@/labs/listEditor/ASortableListEditor.vue'

/**
 * QA 85050 Batch 10 BUG-02 — "merely OPENING an unchanged row turns it amber and
 * raises '1 nepotvrdená zmena'".
 *
 * A NESTED editor only mounts when its parent row is EXPANDED. At construction the
 * controller runs `ensureKeys` and, for rows the server returns WITHOUT an `id`
 * (embedded value-object DTOs like `{ adSlotName, position }`), mints a NEGATIVE temp
 * id and WRITES IT BACK into the shared model (`useListEditorController.ts:200-205`).
 *
 * The parent baselined earlier, from the pristine server rows. Its dirty hash is
 * `JSON.stringify` of the WHOLE row — nested array included — so the child's mount-time
 * write retroactively invalidates the parent's baseline. Expanding a row to READ it
 * marks it unsaved, with no edit ever made. Verified live: the only field that changed
 * was the added `id: -1`.
 *
 * Invariant violated: a controller must never mutate the model as a side effect of
 * MOUNTING. A mount-time write is invisible to the writer (it baselines the already
 * seeded rows) but visible to every ancestor.
 *
 * FAILS today (expanding flips the parent amber). Passes once temp ids are excluded
 * from the content hash, so seeding a key is not mistaken for a content change.
 */

interface Advert {
  id?: number
  adSlotName: string
  position: number
}
interface Row {
  id: number
  position: number
  title: string
  adverts: Advert[]
}

let mounted: VueWrapper | null = null
afterEach(() => {
  mounted?.unmount()
  mounted = null
})

// Server shape: the nested adverts carry NO `id` — exactly what the API returns for
// these embedded DTOs, and what makes `ensureKeys` mint one on mount.
const serverRows = (): Row[] => [
  { id: 1, position: 1, title: 'Content item', adverts: [{ adSlotName: 'slot_a', position: 1 }] },
]

const buildHost = (model: Ref<Row[]>) =>
  defineComponent({
    setup() {
      return () =>
        h(
          ASortableListEditor<Row>,
          {
            modelValue: model.value,
            'onUpdate:modelValue': (v: Row[]) => {
              model.value = v
            },
            factory: (): Row => ({ id: -1, position: 0, title: '', adverts: [] }),
            compactField: 'title',
          },
          {
            // The nested editor over the id-less rows — mounts only once the parent row expands.
            item: ({ raw }: { raw: Row }) =>
              h(AListEditor<Advert>, {
                modelValue: raw.adverts,
                'onUpdate:modelValue': (v: Advert[]) => {
                  raw.adverts = v
                },
                factory: (): Advert => ({ adSlotName: '', position: 0 }),
                compactField: 'adSlotName',
              }),
          },
        )
    },
  })

describe('QA 85050 B10 BUG-02 — expanding a row must not mark it unsaved', () => {
  it('a mount-time key seed in a nested editor does not flip the parent row amber', async () => {
    const model = ref<Row[]>(serverRows())
    mounted = mount(buildHost(model), { attachTo: document.body, attrs: { style: 'width: 1000px;' } })
    await nextTick()

    // Pre-condition: freshly loaded, collapsed, nothing pending.
    expect(mounted.findAll('.a-le-row--unsaved')).toHaveLength(0)

    // Expand the parent row — READ ONLY. No edit of any kind.
    await mounted.findAll('.a-le-row-header')[0].trigger('click')
    await nextTick()
    await nextTick()

    // ORACLE (fails today): reading a row is not a change, so nothing may be unsaved.
    expect(mounted.findAll('.a-le-row--unsaved')).toHaveLength(0)
  })

  it('a genuinely added nested row STILL bubbles unsaved up to the parent', async () => {
    // Guards the fix against over-reach: excluding temp ids from the hash must not
    // silence a real nested addition (the array content itself still differs).
    const model = ref<Row[]>(serverRows())
    mounted = mount(buildHost(model), { attachTo: document.body, attrs: { style: 'width: 1000px;' } })
    await nextTick()
    await mounted.findAll('.a-le-row-header')[0].trigger('click')
    await nextTick()

    // Add a nested advert row through the nested editor's own add button.
    const add = mounted.findAll('.a-le-row-add')
    await add[add.length - 1].trigger('click')
    await nextTick()
    await nextTick()

    // The parent row must read unsaved — a real pending nested change.
    expect(mounted.findAll('.a-le-row--unsaved').length).toBeGreaterThan(0)
  })
})
