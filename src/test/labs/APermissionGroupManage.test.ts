import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import type { AxiosInstance } from 'axios'
import APermissionGroupManage from '@/labs/permissionGroup/APermissionGroupManage.vue'
import { usePermissionGroupOneStore } from '@/labs/permissionGroup/permissionGroupStore'
import { Grant } from '@/model/valueObject/Grant'

const CONFIG = {
  roles: [],
  defaultGrants: [Grant.Deny, Grant.Allow],
  config: { location: { ui: {} } },
  translation: { subjects: {}, actions: {}, roles: {} },
}

// The config only where the config lives. Answering it to every URL is what let a page that sent
// the editor to the group list pass here as if nothing were wrong.
const request = vi.fn((config: { url?: string }) =>
  config.url?.endsWith('/adm/v1/permissions/config')
    ? Promise.resolve({ status: 200, data: CONFIG })
    : Promise.resolve({ status: 200, data: { data: [], totalCount: 0 } })
)
const client = () => ({ request }) as unknown as AxiosInstance

let mounted: VueWrapper | null = null
// `src/test/setup.ts` installs one pinia into every mount through `config.global.plugins`, and
// that install is what decides which instance the component's stores resolve against. A pinia set
// active in the test alone would not be the one the component uses, so it is passed in as well --
// mount options are applied after the global ones, so this is the instance that wins.
let pinia = createPinia()

const mountManage = async (props: Record<string, unknown> = {}) => {
  mounted = mount(APermissionGroupManage, {
    global: { plugins: [pinia] },
    props: { client, system: 'weather', ...props },
  })
  await flushPromises()
  return mounted
}

beforeEach(() => {
  pinia = createPinia()
  setActivePinia(pinia)
})

afterEach(() => {
  mounted?.unmount()
  mounted = null
})

describe('APermissionGroupManage', () => {
  it('reads the permission config, not the group list, whatever endpoint the page holds', async () => {
    // Every page passed its permission-group endpoint here. The editor used it as the config URL,
    // stored the list as that system's config and crashed on `Object.keys(config.config)`.
    const wrapper = await mountManage({ endPoint: '/adm/v1/permission-group' })

    const urls = request.mock.calls.map(([config]) => config.url)
    expect(urls.some((url) => url?.endsWith('/adm/v1/permissions/config'))).toBe(true)
    expect(urls.some((url) => url?.endsWith('/adm/v1/permission-group'))).toBe(false)
    expect(wrapper.find('[data-cy="permission-allow-all-location"]').exists()).toBe(true)
  })

  it('edits the group the store holds', async () => {
    const store = usePermissionGroupOneStore()
    store.setPermissionGroup({
      id: 7,
      title: 'Editors',
      description: 'desk editors',
      permissions: {},
      createdBy: 1,
      modifiedBy: 1,
      createdAt: '2026-01-01T00:00:00.000000Z',
      modifiedAt: '2026-01-01T00:00:00.000000Z',
      _resourceName: 'permissionGroup',
      _system: 'weather',
    })

    const wrapper = await mountManage()

    expect((wrapper.get('[data-cy="permissionGroup-title"] input').element as HTMLInputElement).value).toBe('Editors')
  })

  it('writes typed text straight back into the store, which is what the page then saves', async () => {
    const store = usePermissionGroupOneStore()
    const wrapper = await mountManage()

    await wrapper.get('[data-cy="permissionGroup-title"] input').setValue('Readers')

    expect(store.permissionGroup.title).toBe('Readers')
  })

  it('carries the permission editor, so a group cannot be edited without its grants', async () => {
    const wrapper = await mountManage()

    expect(wrapper.text()).toContain('location_ui')
    // Not readonly: this is the edit form.
    expect(wrapper.find('[data-cy="permission-allow-all-location"]').exists()).toBe(true)
  })

  it('reports an empty title, which is the one rule the backend also enforces', async () => {
    const wrapper = await mountManage()

    await wrapper.get('[data-cy="permissionGroup-title"] input').setValue('ab')
    await wrapper.get('[data-cy="permissionGroup-title"] input').trigger('blur')
    await flushPromises()

    expect(wrapper.get('[data-cy="permissionGroup-title"]').classes()).toContain('v-input--error')
  })
})
