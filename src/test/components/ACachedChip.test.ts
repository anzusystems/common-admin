import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick, reactive } from 'vue'
import ACachedChip from '@/components/ACachedChip.vue'

// ACachedChip calls useRouter() on setup — stub the router so it mounts without a
// real router instance.
vi.mock('vue-router', () => ({
  useRouter: () => ({ push: vi.fn() }),
  useRoute: () => ({}),
}))

interface CachedEntry {
  name?: string
  _loaded?: boolean
}

// reactive so `getCachedFn(id)` reads are tracked by the component's `cached`
// computed — mutating an entry re-resolves the chip without remounting.
const mountChip = (
  cache: Record<number, CachedEntry>,
  props: Record<string, unknown> = {},
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
  })

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
})
