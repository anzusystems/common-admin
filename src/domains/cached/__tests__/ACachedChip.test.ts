import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { h, nextTick, reactive } from 'vue'
import ACachedChip from '@/domains/cached/components/ACachedChip.vue'

// ACachedChip calls useRouter() on setup — stub the router so it mounts without a
// real router instance.
vi.mock('vue-router', () => ({
  useRouter: () => ({ push: vi.fn() }),
  useRoute: () => ({}),
}))

interface CachedEntry {
  name?: string
  _loaded?: boolean
  _unresolved?: boolean
}

// reactive so `getCachedFn(id)` reads are tracked by the component's `cached`
// computed — mutating an entry re-resolves the chip without remounting.
const mountChip = (
  cache: Record<number, CachedEntry>,
  props: Record<string, unknown> = {},
  slots: Record<string, (slotProps: { id: number }) => unknown> = {}
) =>
  mount(ACachedChip, {
    props: {
      id: 7,
      displayTextPath: 'name',
      route: 'x',
      textOnly: true,
      getCachedFn: (id: number) => cache[id],
      ...props,
    },
    slots,
  })

const unresolvedSlot = { unresolved: ({ id }: { id: number }) => h('span', { class: 'placeholder' }, `none:${id}`) }

describe('ACachedChip', () => {
  // U-13: a cached id renders its resolved name, not the bare id.
  it('renders the resolved name, not the raw id, when the id is in the cache', () => {
    const cache = reactive<Record<number, CachedEntry>>({
      7: { name: 'Resolved Seven', _loaded: true },
    })
    const wrapper = mountChip(cache)
    expect(wrapper.text()).toContain('Resolved Seven')
    expect(wrapper.text()).not.toContain('7')
  })

  // U-13: the documented escape hatch — fallbackIdText surfaces the raw id when the
  // entry is unresolved.
  it('renders the id only when fallbackIdText is set', () => {
    const cache = reactive<Record<number, CachedEntry>>({})
    const wrapper = mountChip(cache, { fallbackIdText: true })
    expect(wrapper.text()).toContain('7')
  })

  // U-14: spinner shows while unresolved, then clears once the id resolves.
  it('shows a spinner while unresolved then clears it once the id resolves', async () => {
    const cache = reactive<Record<number, CachedEntry>>({})
    const wrapper = mountChip(cache)
    expect(wrapper.find('.v-progress-circular').exists()).toBe(true)

    cache[7] = { name: 'Seven', _loaded: true }
    await nextTick()

    expect(wrapper.find('.v-progress-circular').exists()).toBe(false)
    expect(wrapper.text()).toContain('Seven')
  })

  // U-14: an entry that is present but still loading (`_loaded: false`) does NOT
  // count as resolved — the spinner persists.
  it('keeps spinning while the cache entry is _loaded:false', async () => {
    const cache = reactive<Record<number, CachedEntry>>({ 7: { _loaded: false } })
    const wrapper = mountChip(cache)
    await nextTick()
    expect(wrapper.find('.v-progress-circular').exists()).toBe(true)
  })

  // An item the fetch could not resolve has only its placeholder: an empty name drew an empty chip.
  it('shows the id of an item that could not be loaded, without a spinner', () => {
    const cache = reactive<Record<number, CachedEntry>>({ 7: { name: '', _loaded: false, _unresolved: true } })
    const wrapper = mountChip(cache)
    expect(wrapper.text()).toContain('#7')
    expect(wrapper.find('.v-progress-circular').exists()).toBe(false)
    expect(wrapper.find('[title]').attributes('title')).toBe('The record could not be loaded')
  })

  it('does not link an item that could not be loaded', () => {
    const cache = reactive<Record<number, CachedEntry>>({ 7: { name: '', _loaded: false, _unresolved: true } })
    const wrapper = mountChip(cache, { textOnly: false })
    expect(wrapper.find('.mdi-arrow-top-right').exists()).toBe(false)
    expect(wrapper.findComponent({ name: 'VTooltip' }).exists()).toBe(true)
  })

  // A cache whose id means nothing to a reader (a doc id next to a count) draws its own placeholder.
  it('draws the unresolved slot in place of the id, with the id and the tooltip kept', () => {
    const cache = reactive<Record<number, CachedEntry>>({ 7: { name: '', _loaded: false, _unresolved: true } })
    const wrapper = mountChip(cache, {}, unresolvedSlot)
    expect(wrapper.find('.placeholder').text()).toBe('none:7')
    expect(wrapper.text()).not.toContain('#7')
    expect(wrapper.find('[title]').attributes('title')).toBe('The record could not be loaded')
  })

  it('draws the unresolved slot in a chip too, which keeps its tooltip', () => {
    const cache = reactive<Record<number, CachedEntry>>({ 7: { name: '', _loaded: false, _unresolved: true } })
    const wrapper = mountChip(cache, { textOnly: false }, unresolvedSlot)
    expect(wrapper.find('.v-chip .placeholder').text()).toBe('none:7')
    expect(wrapper.findComponent({ name: 'VTooltip' }).exists()).toBe(true)
  })

  it('drops the unresolved slot once an item queued again loads', async () => {
    const cache = reactive<Record<number, CachedEntry>>({ 7: { name: '', _loaded: false, _unresolved: true } })
    const wrapper = mountChip(cache, {}, unresolvedSlot)
    expect(wrapper.find('.placeholder').exists()).toBe(true)

    cache[7] = { name: 'Seven', _loaded: true }
    await nextTick()

    expect(wrapper.find('.placeholder').exists()).toBe(false)
    expect(wrapper.text()).toContain('Seven')
    expect(wrapper.find('[title]').exists()).toBe(false)
  })

  it('leaves the unresolved slot out for a resolved item and when the caller gives a title', () => {
    const cache = reactive<Record<number, CachedEntry>>({
      7: { name: 'Seven', _loaded: true },
      8: { name: '', _loaded: false, _unresolved: true },
    })
    const resolved = mountChip(cache, {}, unresolvedSlot)
    expect(resolved.find('.placeholder').exists()).toBe(false)
    expect(resolved.text()).toContain('Seven')

    const titled = mountChip(cache, { id: 8, title: 'Given' }, unresolvedSlot)
    expect(titled.find('.placeholder').exists()).toBe(false)
    expect(titled.text()).toContain('Given')
  })
})
