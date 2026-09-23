import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { notify } from '@kyvg/vue3-notification'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import type { AxiosInstance } from 'axios'
import APermissionEditor from '@/labs/permission/APermissionEditor.vue'
import { Grant } from '@/model/valueObject/Grant'
import type { Permissions } from '@/types/Permission'

// The warning is a parity row of its own: "allow all" silently widening a deliberate deny is the
// one way this button could grant access nobody asked for, and the count is how the operator
// learns it did not.
vi.mock('@kyvg/vue3-notification', () => ({ notify: vi.fn() }))

const CONFIG = {
  roles: [],
  defaultGrants: [Grant.Deny, Grant.AllowOwner, Grant.Allow],
  config: {
    // An acl key is `<system>_<subject>_<action>`, so the config's subject carries the prefix.
    weather_location: { ui: {}, create: {}, update: {}, read: { grants: [Grant.Deny] } },
  },
  translation: { subjects: {}, actions: {}, roles: {} },
}

const client = () => ({ request: vi.fn().mockResolvedValue({ status: 200, data: CONFIG }) }) as unknown as AxiosInstance

let mounted: VueWrapper | null = null
// Passed into the mount, not only set active: `src/test/setup.ts` installs a shared pinia through
// `config.global.plugins`, and the component would otherwise read the config out of that one.
let pinia = createPinia()

const mountEditor = async (permissions: Permissions, props: Record<string, unknown> = {}) => {
  mounted = mount(APermissionEditor, {
    global: { plugins: [pinia] },
    props: { client, system: 'weather', modelValue: permissions, ...props },
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

describe('APermissionEditor', () => {
  it('draws a row per action of every subject the backend declares', async () => {
    const wrapper = await mountEditor({})

    expect(wrapper.text()).toContain('weather_location_ui')
    expect(wrapper.text()).toContain('weather_location_read')
  })

  it('allows every action of a subject that offers allow', async () => {
    const wrapper = await mountEditor({})

    await wrapper.get('[data-cy="permission-allow-all-weather_location"]').trigger('click')

    const emitted = wrapper.emitted('update:modelValue')?.at(-1)?.[0] as Permissions
    expect(emitted.weather_location_ui).toBe(Grant.Allow)
    expect(emitted.weather_location_create).toBe(Grant.Allow)
    expect(emitted.weather_location_update).toBe(Grant.Allow)
    // `read` only offers deny, so "allow all" cannot invent a grant the backend rejects.
    expect(emitted.weather_location_read).toBeUndefined()
  })

  it('leaves an explicit deny alone, because widening it is the one thing this button must not do', async () => {
    const wrapper = await mountEditor({
      weather_location_update: Grant.Deny,
      weather_location_create: Grant.AllowOwner,
    })

    await wrapper.get('[data-cy="permission-allow-all-weather_location"]').trigger('click')

    const emitted = wrapper.emitted('update:modelValue')?.at(-1)?.[0] as Permissions
    expect(emitted.weather_location_update).toBe(Grant.Deny)
    expect(emitted.weather_location_create).toBe(Grant.AllowOwner)
    expect(emitted.weather_location_ui).toBe(Grant.Allow)
  })

  it('says how many it left alone, so the operator is not left to notice', async () => {
    const wrapper = await mountEditor({
      weather_location_update: Grant.Deny,
      weather_location_create: Grant.AllowOwner,
    })

    await wrapper.get('[data-cy="permission-allow-all-weather_location"]').trigger('click')

    expect(notify).toHaveBeenCalledOnce()
    const payload = vi.mocked(notify).mock.calls[0][0] as { type: string; text: string }
    expect(payload.type).toBe('warning')
    expect(String(payload.text)).toContain('2')
  })

  it('says nothing when there was nothing to leave alone', async () => {
    const wrapper = await mountEditor({})

    await wrapper.get('[data-cy="permission-allow-all-weather_location"]').trigger('click')

    expect(notify).not.toHaveBeenCalled()
  })

  it('has neither a grant column nor allow-all when readonly', async () => {
    const wrapper = await mountEditor({}, { readonly: true })

    expect(wrapper.find('[data-cy="permission-allow-all-weather_location"]').exists()).toBe(false)
    expect(wrapper.findAll('thead th')).toHaveLength(2)
  })

  it('has both when it is an editor', async () => {
    const wrapper = await mountEditor({})

    expect(wrapper.findAll('thead th')).toHaveLength(3)
  })
})
