import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import type { AxiosInstance } from 'axios'
import APermissionGroupDatatable from '@/labs/permissionGroup/APermissionGroupDatatable.vue'
import { resetPermissionGroupListFilters } from '@/labs/permissionGroup/permissionGroupFilter'
import type { PermissionGroup } from '@/types/PermissionGroup'

const group = (id: number, title: string): PermissionGroup => ({
  id,
  title,
  description: '',
  permissions: { weather_location_ui: 2 },
  createdBy: 1,
  modifiedBy: 2,
  createdAt: '2026-01-01T00:00:00.000000Z',
  modifiedAt: '2026-01-02T00:00:00.000000Z',
  _resourceName: 'permissionGroup',
  _system: 'weather',
})

const router = createRouter({
  history: createMemoryHistory(),
  routes: [
    { path: '/', component: { template: '<div />' } },
    { path: '/:pathMatch(.*)*', component: { template: '<div />' } },
  ],
})

let mounted: VueWrapper | null = null
// See the note in `APermissionGroupManage.test.ts`: the mount's own pinia is the one that counts.
let pinia = createPinia()

const mountDatatable = async (props: Record<string, unknown> = {}) => {
  const get = vi.fn().mockResolvedValue({
    status: 200,
    data: { data: [group(1, 'Editors'), group(2, 'Readers')], totalCount: 2 },
  })
  mounted = mount(APermissionGroupDatatable, {
    global: { plugins: [router, pinia] },
    props: {
      client: () => ({ get }) as unknown as AxiosInstance,
      system: 'weather',
      detailRoute: (item: PermissionGroup) => `/permission-groups/${item.id}`,
      editRoute: (item: PermissionGroup) => `/permission-groups/${item.id}/edit`,
      ...props,
    },
  })
  await flushPromises()
  // The list call is debounced by `useDebounceFn`, and the mount only queues it.
  await vi.waitFor(() => expect(get).toHaveBeenCalled())
  await flushPromises()
  return { wrapper: mounted, get }
}

beforeEach(async () => {
  pinia = createPinia()
  setActivePinia(pinia)
  resetPermissionGroupListFilters()
  await router.push('/')
  await router.isReady()
})

afterEach(() => {
  mounted?.unmount()
  mounted = null
})

describe('APermissionGroupDatatable', () => {
  it('lists what the endpoint returned', async () => {
    const { wrapper } = await mountDatatable()

    expect(wrapper.text()).toContain('Editors')
    expect(wrapper.text()).toContain('Readers')
  })

  it('counts the grants of a group rather than printing them', async () => {
    const { wrapper } = await mountDatatable()

    // Read out of the cell, not off the row: the fixture's ids, createdBy and dates all contain a
    // "1", so a search over the whole table would match whatever the cell rendered.
    const cells = wrapper.findAll('tbody tr:first-child td')
    const grants = cells.find((cell) => cell.find('.v-chip').exists())!
    expect(grants.text().trim()).toBe('1')
  })

  it('emits the row, leaving the destination to the app', async () => {
    const { wrapper } = await mountDatatable()

    await wrapper.findAll('tbody tr')[0].trigger('click')

    expect(wrapper.emitted('rowClick')?.[0]?.[0]).toMatchObject({ id: 1 })
  })

  it('offers edit only when the app says the operator may', async () => {
    const withoutRight = await mountDatatable()
    expect(withoutRight.wrapper.find('.mdi-pencil').exists()).toBe(false)
    withoutRight.wrapper.unmount()

    const withRight = await mountDatatable({ canUpdate: true })
    expect(withRight.wrapper.find('.mdi-pencil').exists()).toBe(true)
  })

  it('asks the endpoint it was given, not a hard-coded one', async () => {
    const { get } = await mountDatatable({ endPoint: '/adm/v1/custom-permission-group' })

    expect(get.mock.calls[0][0]).toContain('/adm/v1/custom-permission-group')
  })

  it('draws no stray line break where an app has no user cache to fill the slot with', async () => {
    const { wrapper } = await mountDatatable()

    // The break used to render whether or not anything followed it.
    expect(wrapper.find('tbody br').exists()).toBe(false)
  })

  it('leaves the creator chip to the app, which owns the user cache', async () => {
    const get = vi.fn().mockResolvedValue({ status: 200, data: { data: [group(1, 'Editors')], totalCount: 1 } })
    mounted = mount(APermissionGroupDatatable, {
      global: { plugins: [router, pinia] },
      props: {
        client: () => ({ get }) as unknown as AxiosInstance,
        system: 'weather',
        detailRoute: () => '/',
        editRoute: () => '/',
      },
      slots: { createdBy: '<span class="created-by-slot">chip</span>' },
    })
    await flushPromises()
    await vi.waitFor(() => expect(get).toHaveBeenCalled())
    await flushPromises()

    expect(mounted.find('.created-by-slot').exists()).toBe(true)
  })
})
