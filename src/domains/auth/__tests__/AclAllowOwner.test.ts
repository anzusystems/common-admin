import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import Acl from '@/domains/auth/components/Acl.vue'
import { useAuthStore } from '@/domains/auth/store/authStore'
import { defineAuth } from '@/domains/auth/composables/defineAuth'
import { Grant } from '@/domains/auth/valueObject/Grant'

const { useCurrentUser } = defineAuth<`${string}_${string}_${string}`>('brick')
const userWith = (permissions: Record<string, number>) =>
  ({ id: 1, roles: [], resolvedPermissions: permissions }) as never

const wrappers: ReturnType<typeof mount>[] = []
beforeEach(() => useAuthStore().reset())
afterEach(() => wrappers.splice(0).forEach((w) => w.unmount()))

describe('Acl with an AllowOwner grant and no subject', () => {
  it('hides the slot instead of throwing out of render', () => {
    useCurrentUser('brick').setCurrentUser(userWith({ brick_menu_ui: Grant.AllowOwner }))
    const errorHandler = vi.fn()
    let wrapper: ReturnType<typeof mount> | undefined
    expect(() => {
      wrapper = mount(Acl, {
        props: { permission: 'brick_menu_ui' } as never,
        slots: { default: '<span class="protected">secret</span>' },
        global: { config: { errorHandler } },
      })
      wrappers.push(wrapper)
    }).not.toThrow()
    expect(errorHandler).not.toHaveBeenCalled()
    expect(wrapper!.find('.protected').exists()).toBe(false)
  })
})
