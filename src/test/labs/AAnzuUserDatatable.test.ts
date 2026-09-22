import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import type { AxiosInstance } from 'axios'
import AAnzuUserDatatable from '@/labs/anzuUser/AAnzuUserDatatable.vue'
import { resetAnzuUserListFilters } from '@/labs/anzuUser/anzuUserFilter'
import { resetCachedPermissionGroupRegistries } from '@/labs/permissionGroup/cachedPermissionGroups'
import type { AnzuUser } from '@/types/AnzuUser'

const user = (id: number, email: string, groups: number[] = []): AnzuUser =>
  ({
    id,
    email,
    person: { firstName: 'Jozef', lastName: 'Mrkvicka', fullName: 'Jozef Mrkvicka' },
    avatar: { color: '#4CAF50', text: 'JM' },
    enabled: true,
    locale: null,
    roles: [],
    permissions: {},
    permissionGroups: groups,
    resolvedPermissions: {},
    createdBy: 1,
    modifiedBy: 2,
    createdAt: '2026-01-01T00:00:00.000000Z',
    modifiedAt: '2026-01-02T00:00:00.000000Z',
    _resourceName: 'user',
    _system: 'weather',
  }) as unknown as AnzuUser

const router = createRouter({
  history: createMemoryHistory(),
  routes: [{ path: '/', component: { template: '<div />' } }],
})

let mounted: VueWrapper | null = null
let pinia = createPinia()

const mountDatatable = async (slots: Record<string, string> = {}) => {
  const get = vi.fn().mockImplementation((url: string) => {
    // The group cache asks the permission-group endpoint; the list asks the user one.
    if (url.includes('permission-group')) {
      return Promise.resolve({
        status: 200,
        data: { data: [{ id: 7, title: 'Editori', permissions: {} }], totalCount: 1 },
      })
    }
    return Promise.resolve({ status: 200, data: { data: [user(1, 'jozef@sme.sk', [7])], totalCount: 1 } })
  })
  const request = vi.fn().mockResolvedValue({
    status: 200,
    data: { roles: [], defaultGrants: [], config: {}, translation: { subjects: {}, actions: {}, roles: {} } },
  })
  mounted = mount(AAnzuUserDatatable, {
    global: { plugins: [router, pinia] },
    props: {
      client: () => ({ get, request }) as unknown as AxiosInstance,
      system: 'weather',
      detailRoute: () => '/',
      editRoute: () => '/',
    },
    slots,
  })
  await flushPromises()
  await vi.waitFor(() => expect(get).toHaveBeenCalled())
  await flushPromises()
  return { wrapper: mounted, get }
}

beforeEach(async () => {
  pinia = createPinia()
  setActivePinia(pinia)
  resetAnzuUserListFilters()
  resetCachedPermissionGroupRegistries()
  await router.push('/')
  await router.isReady()
})

afterEach(() => {
  mounted?.unmount()
  mounted = null
})

describe('AAnzuUserDatatable', () => {
  it('lists what the endpoint returned', async () => {
    const { wrapper } = await mountDatatable()

    expect(wrapper.text()).toContain('jozef@sme.sk')
  })

  it('names the permission groups instead of leaving the column empty', async () => {
    // Left to the call sites, this column was blank in every one of the nine new lists. The
    // library has the cache -- keyed per system, because id 42 in weather and id 42 in blog are
    // different rows -- so it draws them itself.
    const { wrapper } = await mountDatatable()
    // `defineCached` debounces its batch by 1.5s, so the default one-second wait is too short.
    await vi.waitFor(() => expect(wrapper.text()).toContain('Editori'), { timeout: 6000 })
  })

  it('draws no stray line break where an app has no user cache', async () => {
    const { wrapper } = await mountDatatable()

    expect(wrapper.find('tbody br').exists()).toBe(false)
  })

  it('lets an app draw the creator itself', async () => {
    const { wrapper } = await mountDatatable({ createdBy: '<span class="creator">chip</span>' })

    expect(wrapper.find('.creator').exists()).toBe(true)
    expect(wrapper.find('tbody br').exists()).toBe(true)
  })
})
