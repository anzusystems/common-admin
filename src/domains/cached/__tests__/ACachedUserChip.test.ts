import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick, reactive } from 'vue'
import ACachedUserChip from '@/domains/cached/components/ACachedUserChip.vue'
import { COMMON_CONFIG } from '@/shared/commonConfig'
import type { CachedItem } from '@/domains/cached/composables/defineCached'
import type { AnzuUserMinimal } from '@/shared/types/AnzuUser'

const push = vi.fn()
vi.mock('vue-router', () => ({
  useRouter: () => ({ push }),
  useRoute: () => ({}),
}))

type Entry = CachedItem<AnzuUserMinimal & { nickname?: string }>

const user = (id: number, fullName: string, email = 'someone@example.com'): Entry => ({
  id,
  email,
  person: { firstName: '', lastName: '', fullName },
  avatar: { color: '', text: '' },
  _loaded: true,
})

const mountChip = (cache: Record<number, Entry>, props: Record<string, unknown> = {}) =>
  mount(ACachedUserChip, {
    props: {
      id: 7,
      getCachedFn: (id: number | null | undefined) => (id ? cache[id] : undefined),
      ...props,
    },
  })

describe('ACachedUserChip', () => {
  it('draws the full name of a loaded user', () => {
    const wrapper = mountChip(reactive({ 7: user(7, 'Jana Nová') }))
    expect(wrapper.text()).toContain('Jana Nová')
  })

  it('falls back to the e-mail prefix, then to the id, when the cache carries no name', () => {
    expect(mountChip(reactive({ 7: user(7, '', 'jana@example.com') })).text()).toContain('jana')
    expect(mountChip(reactive({ 7: user(7, '', '') })).text()).toContain('#7')
  })

  it('takes the label from titleFn when it gives one', () => {
    const cache = reactive({ 7: { ...user(7, 'Jana Nová'), nickname: 'janka' } })
    const wrapper = mountChip(cache, { titleFn: (u: Entry) => u.nickname ?? '' })
    expect(wrapper.text()).toContain('janka')
  })

  it('spins until the user loads', async () => {
    const cache = reactive<Record<number, Entry>>({ 7: { ...user(7, ''), _loaded: false } })
    const wrapper = mountChip(cache)
    expect(wrapper.find('.v-progress-circular').exists()).toBe(true)

    cache[7] = user(7, 'Jana Nová')
    await nextTick()

    expect(wrapper.find('.v-progress-circular').exists()).toBe(false)
    expect(wrapper.text()).toContain('Jana Nová')
  })

  it('shows the id of a user that could not be loaded, without a link', () => {
    const cache = reactive({ 7: { ...user(7, ''), _loaded: false, _unresolved: true } })
    const wrapper = mountChip(cache, { routeName: '/users/[id]' })

    expect(wrapper.find('[data-cy="cached-user-chip-unresolved"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('#7')
    expect(wrapper.find('.v-progress-circular').exists()).toBe(false)
    expect(wrapper.findComponent({ name: 'VTooltip' }).exists()).toBe(true)
    expect(wrapper.find(`.${COMMON_CONFIG.CHIP.ICON.LINK}`).exists()).toBe(false)
  })

  it('does not link when the click is disabled', async () => {
    push.mockClear()
    const wrapper = mountChip(reactive({ 7: user(7, 'Jana Nová') }), { routeName: '/users/[id]', disableClick: true })

    expect(wrapper.find(`.${COMMON_CONFIG.CHIP.ICON.LINK}`).exists()).toBe(false)
    await wrapper.find('.v-chip').trigger('click')
    expect(push).not.toHaveBeenCalled()
  })

  it('shows a dash for no id, including the 0 of a blank record', () => {
    expect(mountChip({}, { id: null }).text()).toBe('-')
    expect(mountChip({}, { id: 0 }).text()).toBe('-')
  })

  it('links to the route with the route icon and to an external url with the external icon', async () => {
    const cache = reactive({ 7: user(7, 'Jana Nová') })

    const internal = mountChip(cache, { routeName: '/users/[id]' })
    expect(internal.find(`.${COMMON_CONFIG.CHIP.ICON.LINK}`).exists()).toBe(true)
    await internal.find('.v-chip').trigger('click')
    expect(push).toHaveBeenCalledWith({ name: '/users/[id]', params: { id: 7 } })

    const external = mountChip(cache, { externalUrlTemplate: 'https://cms/users/:id' })
    expect(external.find(`.${COMMON_CONFIG.CHIP.ICON.LINK_EXTERNAL}`).exists()).toBe(true)

    const none = mountChip(cache)
    expect(none.find(`.${COMMON_CONFIG.CHIP.ICON.LINK}`).exists()).toBe(false)
  })
})
