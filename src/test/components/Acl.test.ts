import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import Acl from '@/components/permission/Acl.vue'
import { useAuthStore } from '@/composables/auth/authStore'
import { defineAuth } from '@/composables/auth/defineAuth'
import { Grant } from '@/model/valueObject/Grant'

// Acl used to watch the whole `currentUsers` map without `deep`, which meant it evaluated once on
// mount and never again. Nobody noticed while every current user was loaded before the first
// component mounted; an admin that loads them on demand notices immediately.

const { useCurrentUser } = defineAuth<`${string}_${string}_${string}`>('brick')

const userWith = (permissions: Record<string, number>) =>
  ({
    id: 1,
    roles: [],
    resolvedPermissions: permissions,
  }) as never

// Wrappers are kept so they can be unmounted between tests. Left mounted, a wrapper from an
// earlier test re-evaluates its computed when the next test writes a current user -- and one
// asking about an `AllowOwner` permission with no subject throws while doing it.
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
    // The whole reason this component exists next to `can()`: templates may render before their
    // system is there, and `canHelper` throws in exactly that case.
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
    // The old version latched on the first `true` and stopped watching, so a revoked permission
    // stayed granted until a reload.
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
    // No permission to check is not the same as a denied one, and there is no system to ask about.
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
    // `AllowOwner` answers per record, so the same permission flips with the subject -- and the
    // old watcher, which latched on the first `true`, could never have noticed.
    useCurrentUser('brick').setCurrentUser(userWith({ brick_menu_ui: Grant.AllowOwner }))
    const wrapper = mountAcl('brick_menu_ui', { createdBy: 2 })
    expect(isVisible(wrapper)).toBe(false)

    await wrapper.setProps({ subject: { createdBy: 1 } } as never)

    expect(isVisible(wrapper)).toBe(true)
  })
})

describe('Acl across systems', () => {
  it('hides the slot while any of the systems is still missing', () => {
    // Values from different systems are handled, not merely tolerated: every system involved has
    // to be loaded. Checking only the first value would leave `canHelper` to throw on the second,
    // which is the one thing this component must never do.
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
