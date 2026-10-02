import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { h, nextTick, reactive } from 'vue'
import AUserAndTimeTrackingFields from '@/domains/ui/components/AUserAndTimeTrackingFields.vue'
import type { CachedItem } from '@/domains/cached/composables/defineCached'
import type { AnzuUserMinimal } from '@/shared/types/AnzuUser'
import type { UserAndTimeTrackingData } from '@/shared/types/UserAndTimeTracking'

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: vi.fn() }),
  useRoute: () => ({}),
}))

const user = (id: number, fullName: string): CachedItem<AnzuUserMinimal> => ({
  id,
  email: '',
  person: { firstName: '', lastName: '', fullName },
  avatar: { color: '', text: '' },
  _loaded: true,
})

const makeUsers = (cache: Record<number, CachedItem<AnzuUserMinimal>> = {}) => ({
  getCachedUser: (id: number | null | undefined) => (id ? cache[id] : undefined),
  addToCachedUsers: vi.fn(),
  fetchCachedUsers: vi.fn(),
})

const CREATED = '2026-07-06T17:26:00.000000Z'
const MODIFIED = '2026-07-06T17:27:00.000000Z'

const mountRows = (data: UserAndTimeTrackingData, props: Record<string, unknown> = {}, slots = {}) =>
  mount(AUserAndTimeTrackingFields, { props: { data, ...props }, slots })

describe('AUserAndTimeTrackingFields', () => {
  it('draws the dates only when it has no user cache, as it always has', () => {
    const wrapper = mountRows({ createdAt: CREATED, modifiedAt: MODIFIED, createdBy: 1, modifiedBy: 2 })

    expect(wrapper.text()).toContain('Created')
    expect(wrapper.text()).toContain('Modified')
    expect(wrapper.text()).toContain('06.07.2026')
    expect(wrapper.find('.v-chip').exists()).toBe(false)
  })

  it('puts the users next to the dates and asks the cache for them', () => {
    const users = makeUsers({ 1: user(1, 'Jana Nová'), 2: user(2, 'Peter Starý') })
    const wrapper = mountRows({ createdAt: CREATED, modifiedAt: MODIFIED, createdBy: 1, modifiedBy: 2 }, { users })

    expect(wrapper.text()).toContain('Jana Nová')
    expect(wrapper.text()).toContain('Peter Starý')
    expect(users.addToCachedUsers).toHaveBeenCalledWith([1, 2])
    expect(users.fetchCachedUsers).toHaveBeenCalledTimes(1)
  })

  it('leaves out a user the backend does not send, and draws nothing when all four are missing', () => {
    const users = makeUsers()
    const timeOnly = mountRows({ createdAt: CREATED, modifiedAt: MODIFIED }, { users })
    expect(timeOnly.find('.v-chip').exists()).toBe(false)
    expect(users.addToCachedUsers).not.toHaveBeenCalled()

    const untracked = mountRows({}, { users })
    expect(untracked.text()).toBe('')
  })

  it('hands an empty user to the chip, which shows a dash, without asking for it', () => {
    const users = makeUsers()
    const wrapper = mountRows({ createdAt: CREATED, createdBy: null, modifiedAt: MODIFIED, modifiedBy: 0 }, { users })

    expect(wrapper.findAll('.v-chip')).toHaveLength(0)
    expect(wrapper.text().match(/-/g)?.length).toBeGreaterThanOrEqual(2)
    expect(users.addToCachedUsers).not.toHaveBeenCalled()
  })

  it('keeps the row title and the date when the user is hidden', () => {
    const users = makeUsers({ 1: user(1, 'Jana Nová'), 2: user(2, 'Peter Starý') })
    const wrapper = mountRows(
      { createdAt: CREATED, modifiedAt: MODIFIED, createdBy: 1, modifiedBy: 2 },
      { users, hideCreatedBy: true }
    )

    expect(wrapper.text()).toContain('Created')
    expect(wrapper.text()).toContain('06.07.2026')
    expect(wrapper.text()).not.toContain('Jana Nová')
    expect(users.addToCachedUsers).toHaveBeenCalledWith([2])
  })

  it('keeps the row and the user when the date is hidden', () => {
    const users = makeUsers({ 1: user(1, 'Jana Nová') })
    const wrapper = mountRows({ createdAt: CREATED, createdBy: 1 }, { users, hideCreatedAt: true })

    expect(wrapper.text()).toContain('Created')
    expect(wrapper.text()).toContain('Jana Nová')
    expect(wrapper.text()).not.toContain('06.07.2026')
  })

  it('drops the row when both its date and its user are hidden', () => {
    const users = makeUsers({ 1: user(1, 'Jana Nová') })
    const wrapper = mountRows({ createdAt: CREATED, createdBy: 1 }, { users, hideCreatedAt: true, hideCreatedBy: true })

    expect(wrapper.text()).not.toContain('Created')
  })

  it('draws a row with the user only when the date is missing', () => {
    const users = makeUsers({ 1: user(1, 'Jana Nová') })
    const wrapper = mountRows({ createdBy: 1 }, { users })

    expect(wrapper.text()).toContain('Created')
    expect(wrapper.text()).toContain('Jana Nová')
    expect(wrapper.text()).not.toContain('Modified')
  })

  it('asks again when a replaced record brings a new user, and not when the ids stay the same', async () => {
    const users = makeUsers()
    const holder = reactive<{ data: UserAndTimeTrackingData }>({
      data: { createdAt: CREATED, modifiedAt: MODIFIED, createdBy: 1, modifiedBy: 1 },
    })
    mount({ setup: () => () => h(AUserAndTimeTrackingFields, { data: holder.data, users }) })
    expect(users.addToCachedUsers).toHaveBeenCalledTimes(1)

    holder.data = { ...holder.data, modifiedAt: MODIFIED }
    await nextTick()
    expect(users.addToCachedUsers).toHaveBeenCalledTimes(1)

    holder.data = { ...holder.data, modifiedBy: 3 }
    await nextTick()
    expect(users.addToCachedUsers).toHaveBeenCalledTimes(2)
    expect(users.addToCachedUsers).toHaveBeenLastCalledWith([1, 3])
  })

  it('asks for the users once the cache arrives after the mount', async () => {
    const users = makeUsers()
    const holder = reactive<{ users: ReturnType<typeof makeUsers> | undefined }>({ users: undefined })
    mount({
      setup: () => () =>
        h(AUserAndTimeTrackingFields, { data: { createdAt: CREATED, createdBy: 1 }, users: holder.users }),
    })

    holder.users = users
    await nextTick()

    expect(users.addToCachedUsers).toHaveBeenCalledWith([1])
  })

  it('hands the slot no id for the 0 of a blank record', () => {
    const wrapper = mountRows(
      { createdAt: CREATED, createdBy: 0 },
      {},
      { user: ({ id }: { id: number | null }) => h('span', { class: 'own' }, String(id)) }
    )

    expect(wrapper.find('.own').text()).toBe('null')
  })

  it('lets the admin draw the user through the slot', () => {
    const wrapper = mountRows(
      { createdAt: CREATED, createdBy: 5 },
      {},
      { user: ({ id, field }: { id: number; field: string }) => h('span', { class: 'own' }, `${field}:${id}`) }
    )

    expect(wrapper.find('.own').text()).toBe('createdBy:5')
  })
})
