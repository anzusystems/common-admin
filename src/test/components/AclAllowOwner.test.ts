import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import Acl from '@/components/permission/Acl.vue'
import { useAuthStore } from '@/composables/auth/authStore'
import { defineAuth } from '@/composables/auth/defineAuth'
import { Grant } from '@/model/valueObject/Grant'

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
