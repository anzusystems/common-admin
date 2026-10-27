import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import Acl from '@/domains/auth/components/Acl.vue'
import { useAuthStore } from '@/domains/auth/store/authStore'
import { defineAuth } from '@/domains/auth/composables/defineAuth'
import { Grant } from '@/domains/auth/valueObject/Grant'

// Acl watched the whole `currentUsers` map without `deep`, so it evaluated once on mount and never again.
// This went unnoticed while all current users were loaded before
// the first mount. It shows immediately when users load on demand.

const { useCurrentUser } = defineAuth<`${string}_${string}_${string}`>('brick')

const userWith = (permissions: Record<string, number>) =>
  ({
    id: 1,
    roles: [],
    resolvedPermissions: permissions,
  }) as never

// Wrappers are kept so they can be unmounted between tests. A wrapper left mounted re-evaluates its computed when
// a later test writes a current user. One asking about an `AllowOwner` permission with no subject throws then.
const wrappers: ReturnType<typeof mount>[] = []

const mountAcl = (permission: string | string[], subject?: object) => {
  const wrapper = mount(Acl, {
    props: { permission, subject } as never,
    slots: { default: '<span class="protected">secret</span>' },
  })
  wrappers.push(wrapper)

  return wrapper
}

const isVisible = (wrapper: ReturnType<typeof mountAcl>) => wrapper.find('.protected').exists()

beforeEach(() => {
  useAuthStore().reset()
})

afterEach(() => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount())
})

describe('Acl', () => {
  it('hides the slot for a system nothing has loaded, instead of throwing', () => {
    // This is why the component exists next to `can()`: templates may
    // render before their system is loaded, and `canHelper` throws then.
    expect(() => mountAcl('brick_menu_ui')).not.toThrow()
    expect(isVisible(mountAcl('brick_menu_ui'))).toBe(false)
  })

  it('shows the slot once its own system arrives', async () => {
    const wrapper = mountAcl('brick_menu_ui')
    expect(isVisible(wrapper)).toBe(false)

    useCurrentUser('brick').setCurrentUser(userWith({ brick_menu_ui: Grant.Allow }))
    await nextTick()

    expect(isVisible(wrapper)).toBe(true)
  })

  it('ignores a different system arriving', async () => {
    const wrapper = mountAcl('brick_menu_ui')

    useCurrentUser('weather').setCurrentUser(userWith({ weather_location_ui: Grant.Allow }))
    await nextTick()

    expect(isVisible(wrapper)).toBe(false)
  })

  it('hides the slot again when the permission is taken away', async () => {
    // The old version latched on the first `true` and stopped
    // watching, so a revoked permission stayed granted until reload.
    useCurrentUser('brick').setCurrentUser(userWith({ brick_menu_ui: Grant.Allow }))
    const wrapper = mountAcl('brick_menu_ui')
    expect(isVisible(wrapper)).toBe(true)

    useCurrentUser('brick').setCurrentUser(userWith({}))
    await nextTick()

    expect(isVisible(wrapper)).toBe(false)
  })

  it('hides the slot for a loaded system that denies the permission', () => {
    useCurrentUser('brick').setCurrentUser(userWith({ brick_menu_ui: Grant.Deny }))

    expect(isVisible(mountAcl('brick_menu_ui'))).toBe(false)
  })

  it('requires every permission of an array (AND)', () => {
    useCurrentUser('brick').setCurrentUser(userWith({ brick_menu_ui: Grant.Allow }))

    expect(isVisible(mountAcl(['brick_menu_ui']))).toBe(true)
    expect(isVisible(mountAcl(['brick_menu_ui', 'brick_menu_edit']))).toBe(false)
  })

  it('shows the slot for an empty array, as it always has', () => {
    expect(isVisible(mountAcl([]))).toBe(true)
  })

  it('re-evaluates when the permission prop changes', async () => {
    useCurrentUser('brick').setCurrentUser(userWith({ brick_menu_ui: Grant.Allow }))
    const wrapper = mountAcl('brick_menu_edit')
    expect(isVisible(wrapper)).toBe(false)

    await wrapper.setProps({ permission: 'brick_menu_ui' } as never)

    expect(isVisible(wrapper)).toBe(true)
  })
})

describe('Acl subject', () => {
  it('re-evaluates when the subject changes', async () => {
    // `AllowOwner` answers per record, so the same permission changes with the
    // subject. A watcher that latched on the first `true` would miss that.
    useCurrentUser('brick').setCurrentUser(userWith({ brick_menu_ui: Grant.AllowOwner }))
    const wrapper = mountAcl('brick_menu_ui', { createdBy: 2 })
    expect(isVisible(wrapper)).toBe(false)

    await wrapper.setProps({ subject: { createdBy: 1 } } as never)

    expect(isVisible(wrapper)).toBe(true)
  })
})

describe('Acl across systems', () => {
  it('hides the slot while any of the systems is still missing', () => {
    // Every system involved must be loaded. Checking only the
    // first value would leave `canHelper` to throw on the second.
    useCurrentUser('brick').setCurrentUser(userWith({ brick_menu_ui: Grant.Allow }))

    expect(() => mountAcl(['brick_menu_ui', 'weather_location_ui'])).not.toThrow()
    expect(isVisible(mountAcl(['brick_menu_ui', 'weather_location_ui']))).toBe(false)
  })

  it('shows the slot once every system involved allows it', async () => {
    useCurrentUser('brick').setCurrentUser(userWith({ brick_menu_ui: Grant.Allow }))
    const wrapper = mountAcl(['brick_menu_ui', 'weather_location_ui'])
    expect(isVisible(wrapper)).toBe(false)

    useCurrentUser('weather').setCurrentUser(userWith({ weather_location_ui: Grant.Allow }))
    await nextTick()

    expect(isVisible(wrapper)).toBe(true)
  })
})
