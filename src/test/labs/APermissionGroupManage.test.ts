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

const client = () => ({ request: vi.fn().mockResolvedValue({ status: 200, data: CONFIG }) }) as unknown as AxiosInstance

let mounted: VueWrapper | null = null
// `src/test/setup.ts` installs one pinia into every mount through `config.global.plugins`, and
// that install is what decides which instance the component's stores resolve against. A pinia set
// active in the test alone would not be the one the component uses, so it is passed in as well --
// mount options are applied after the global ones, so this is the instance that wins.
let pinia = createPinia()

const mountManage = async () => {
  mounted = mount(APermissionGroupManage, { global: { plugins: [pinia] }, props: { client, system: 'weather' } })
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
