import { describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { defineComponent, h, ref } from 'vue'
import AUserCopyPermissionsDialog from '@/domains/anzuUser/components/AUserCopyPermissionsDialog.vue'
import type { AnzuUser } from '@/shared/types/AnzuUser'

// A wizard holds a system's permissions on their own, without the rest of an account, and copies them from
// another user of that system.

describe('AUserCopyPermissionsDialog', () => {
  it('copies roles, groups and grants into a model that holds only those', async () => {
    const permissions = ref({ roles: ['ROLE_OLD'], permissionGroups: [1], permissions: {} })
    const source = { roles: ['ROLE_EDITOR'], permissionGroups: [7, 8], permissions: { dam_asset_read: 2 } }
    const fetchSourceUser = vi.fn(async () => source as unknown as AnzuUser)
    const Host = defineComponent({
      setup: () => () =>
        h(
          AUserCopyPermissionsDialog,
          {
            user: permissions.value,
            'onUpdate:user': (value: typeof permissions.value) => (permissions.value = value),
            fetchSourceUser,
          },
          {
            sourcePicker: ({ select }: { select: (id: number) => void }) =>
              h('button', { class: 'pick', onClick: () => select(5) }),
          }
        ),
    })
    const wrapper = mount(Host, { attachTo: document.body })

    await wrapper.find('[data-cy="user-copy-permissions"]').trigger('click')
    await flushPromises()
    document.querySelector<HTMLElement>('.pick')!.click()
    await flushPromises()
    document.querySelector<HTMLElement>('[data-cy="user-copy-permissions-confirm"]')!.click()
    await flushPromises()

    expect(fetchSourceUser).toHaveBeenCalledWith(5)
    // eslint-disable-next-line vue/no-ref-object-reactivity-loss -- final read for an assertion
    expect(permissions.value).toEqual(source)
    wrapper.unmount()
  })
})
