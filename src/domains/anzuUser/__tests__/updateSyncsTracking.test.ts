import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { defineComponent, h } from 'vue'
import type { AxiosInstance } from 'axios'
import { useAnzuUserActions } from '@/domains/anzuUser/composables/anzuUserActions'
import { usePermissionGroupActions } from '@/domains/permission/group/composables/permissionGroupActions'

// After a save the form stays open. The update has to bring the tracking of the saved record into the
// store -- or the form shows the time and user from before the save -- and, for a user, before the
// unsaved-changes baseline is taken, or that write would mark the saved form as unsaved.

const record = () => ({
  id: 5,
  email: 'u5@sme.sk',
  enabled: true,
  roles: [],
  permissionGroups: [],
  permissions: {},
  resolvedPermissions: {},
  person: { firstName: 'U', lastName: '5', fullName: 'U 5' },
  avatar: { color: '#000000', text: 'U' },
  title: 'G5',
  description: '',
  createdAt: '2026-01-01T00:00:00Z',
  modifiedAt: '2026-01-01T00:00:00Z',
  createdBy: 1,
  modifiedBy: 1,
  _resourceName: 'x',
  _system: 'cms',
})

// The server answers a PUT with the saved record: its own modification time and user.
const request = vi.fn((config: { method?: string; data?: unknown }) => {
  if (config.method?.toUpperCase() === 'PUT') {
    const body = JSON.parse(String(config.data ?? '{}'))
    return Promise.resolve({ status: 200, data: { ...body, modifiedAt: '2026-10-02T10:00:00Z', modifiedBy: 2 } })
  }
  return Promise.resolve({ status: 200, data: record() })
})
const client = () => ({ request }) as unknown as AxiosInstance

let pinia = createPinia()
beforeEach(() => {
  pinia = createPinia()
  setActivePinia(pinia)
  request.mockClear()
})
const inComponent = <T>(fn: () => T): T => {
  let out!: T
  mount(defineComponent({ setup: () => ((out = fn()), () => h('div')) }), { global: { plugins: [pinia] } })
  return out
}

describe('an update brings the tracking of the saved record into the form', () => {
  it('anzuUser, before the unsaved-changes baseline', async () => {
    const actions = inComponent(() => useAnzuUserActions({ client, system: 'cms' }))
    await actions.fetchAnzuUser(5)
    actions.markPristine()

    await expect(actions.updateAnzuUser()).resolves.toBe(true)

    expect(actions.anzuUser.value.modifiedBy).toBe(2)
    expect(actions.anzuUser.value.modifiedAt).toBe('2026-10-02T10:00:00Z')
    expect(actions.anzuUser.value.createdBy).toBe(1)
    expect(actions.isDirty.value).toBe(false)
  })

  it('permissionGroup', async () => {
    const actions = inComponent(() => usePermissionGroupActions({ client, system: 'cms' } as never))
    await actions.fetchPermissionGroup(5)

    await expect(actions.updatePermissionGroup()).resolves.toBe(true)

    expect(actions.permissionGroup.value.modifiedBy).toBe(2)
    expect(actions.permissionGroup.value.modifiedAt).toBe('2026-10-02T10:00:00Z')
  })
})
