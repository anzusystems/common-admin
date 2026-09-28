import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { defineComponent, h } from 'vue'
import type { AxiosInstance } from 'axios'
import { useAnzuUserActions } from '@/domains/anzuUser/composables/anzuUserActions'
import { usePermissionGroupActions } from '@/domains/permission/group/composables/permissionGroupActions'

const record = (id: number) => ({
  id,
  email: `u${id}@sme.sk`,
  enabled: true,
  roles: [],
  permissionGroups: [],
  permissions: {},
  resolvedPermissions: {},
  person: { firstName: 'U', lastName: String(id), fullName: `U ${id}` },
  avatar: { color: '#000000', text: 'U' },
  title: `G${id}`,
  description: '',
  _resourceName: 'x',
  _system: 'cms',
})
// GET of 5 and 8 answer, GET of 7 fails, GET of 9 answers whenever the test settles `slow`, every PUT
// answers with its body.
let slow: { promise: Promise<{ status: number; data: unknown }>; settle: (status: number) => void }
const request = vi.fn((config: { method?: string; url?: string; data?: unknown }) => {
  if (config.method?.toUpperCase() === 'PUT')
    return Promise.resolve({ status: 200, data: JSON.parse(String(config.data ?? '{}')) })
  if (config.url?.endsWith('/9')) return slow.promise
  if (config.url?.endsWith('/5')) return Promise.resolve({ status: 200, data: record(5) })
  if (config.url?.endsWith('/8')) return Promise.resolve({ status: 200, data: record(8) })
  return Promise.resolve({ status: 500, data: {} })
})
const client = () => ({ request }) as unknown as AxiosInstance

let pinia = createPinia()
beforeEach(() => {
  pinia = createPinia()
  setActivePinia(pinia)
  request.mockClear()
  let settle!: (status: number) => void
  const promise = new Promise<{ status: number; data: unknown }>((resolve) => {
    settle = (status) => resolve({ status, data: status === 200 ? record(9) : {} })
  })
  slow = { promise, settle }
})
const inComponent = <T>(fn: () => T): T => {
  let out!: T
  mount(defineComponent({ setup: () => ((out = fn()), () => h('div')) }), { global: { plugins: [pinia] } })
  return out
}
const putUrls = () => request.mock.calls.filter(([c]) => c.method?.toUpperCase() === 'PUT').map(([c]) => c.url)

describe('stale single-record fetch', () => {
  it('anzuUser: Save after a failed fetch of 7 does not write to 5', async () => {
    const actions = inComponent(() => useAnzuUserActions({ client, system: 'cms' }))
    await actions.fetchAnzuUser(5)
    expect(actions.anzuUser.value.id).toBe(5)
    await actions.fetchAnzuUser(7)
    await actions.updateAnzuUser()
    expect(putUrls().some((u) => u?.endsWith('/5'))).toBe(false)
  })

  it('permissionGroup: Save after a failed fetch of 7 does not write to 5', async () => {
    const actions = inComponent(() => usePermissionGroupActions({ client, system: 'cms' } as never))
    await actions.fetchPermissionGroup(5)
    await actions.fetchPermissionGroup(7)
    await actions.updatePermissionGroup()
    expect(putUrls()).toEqual([])
  })
})

describe.each([
  [
    'anzuUser',
    (system: string) => {
      const a = inComponent(() => useAnzuUserActions({ client, system }))
      return {
        fetch: a.fetchAnzuUser,
        id: () => a.anzuUser.value.id,
        loading: () => a.loadingAnzuUser.value,
        reset: () => a.resetAnzuUserStore(system),
        type: (value: string) => (a.anzuUser.value.email = value),
        typed: () => a.anzuUser.value.email,
      }
    },
  ],
  [
    'permissionGroup',
    (system: string) => {
      const a = inComponent(() => usePermissionGroupActions({ client, system } as never))
      return {
        fetch: a.fetchPermissionGroup,
        id: () => a.permissionGroup.value.id,
        loading: () => a.loadingPermissionGroup.value,
        reset: () => a.resetPermissionGroupStore(),
        type: (value: string) => (a.permissionGroup.value.title = value),
        typed: () => a.permissionGroup.value.title,
      }
    },
  ],
])('%s: an older fetch answering late', (_name, setup) => {
  // One record store serves every page and every system (cms users vs content-hub users).
  it.each([
    ['fails', 500],
    ['succeeds', 200],
  ])('leaves the newer record of another page alone when it %s', async (_how, status) => {
    const pageA = setup('cms')
    const pageB = setup('contentHub')
    const older = pageA.fetch(9)
    await pageB.fetch(8)
    expect(pageB.id()).toBe(8)
    slow.settle(status)
    await older
    expect(pageB.id()).toBe(8)
    expect(pageB.loading()).toBe(false)
  })

  // A create page resets the store on mount and never fetches; the edit page left behind still has one
  // in flight.
  it.each([
    ['fails', 500],
    ['succeeds', 200],
  ])('leaves a form reset after it alone when it %s', async (_how, status) => {
    const editPage = setup('cms')
    const createPage = setup('cms')
    const older = editPage.fetch(9)
    createPage.reset()
    createPage.type('typed on the create page')
    slow.settle(status)
    await older
    expect(createPage.typed()).toBe('typed on the create page')
    expect(createPage.id()).not.toBe(9)
    expect(createPage.loading()).toBe(false)
  })
})
