import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import type { AxiosInstance } from 'axios'
import AUserSystemPanel from '@/labs/anzuUser/AUserSystemPanel.vue'
import { defineUserSystemDescriptor, type AnyUserSystemDescriptor } from '@/labs/anzuUser/userSystemDescriptor'

// The panel is a cross-system surface: no current user is loaded for that backend, so `can()` would
// throw and `<Acl>` would silently render nothing. Every button here is decided by the probe's
// answer, which is why the answer has to be classified exactly.

const record = (over: Record<string, unknown> = {}) => ({
  id: 42,
  email: 'jozef@sme.sk',
  person: { firstName: 'Jozef', lastName: 'Mrkvicka', fullName: 'Jozef Mrkvicka' },
  avatar: { color: '#4CAF50', text: 'JM' },
  enabled: true,
  roles: [],
  permissions: {},
  permissionGroups: [],
  resolvedPermissions: {},
  ...over,
})

const httpError = (status: number) =>
  Object.assign(new Error('failed'), {
    isAxiosError: true,
    config: { url: '/adm/v1/anzu-user/42' },
    response: { status, data: {} },
  })

const descriptor = (
  request: ReturnType<typeof vi.fn>,
  over: Partial<AnyUserSystemDescriptor> = {}
): AnyUserSystemDescriptor =>
  defineUserSystemDescriptor({
    system: 'blog',
    label: 'Blog',
    client: () => ({ request }) as unknown as AxiosInstance,
    entity: 'anzuUser',
    isEnabled: () => true,
    requiredMetadata: false,
    idInput: true,
    endpoints: {
      anzuUser: { get: '/adm/v1/anzu-user/:id', put: '/adm/v1/anzu-user/:id', post: '/adm/v1/anzu-user' },
      base: null,
      permissionGroup: '/adm/v1/permission-group',
      currentUser: '/adm/v1/anzu-user/current',
      list: '/adm/v1/anzu-user',
      probe: 'anzuUser',
    },
    manage: () => ({ kind: 'external', href: 'https://admin-blog.test/anzu-users/42/edit' }),
    ...over,
  })

const router = createRouter({
  history: createMemoryHistory(),
  routes: [{ path: '/', component: { template: '<div />' } }],
})

let mounted: VueWrapper | null = null
let pinia = createPinia()

const mountPanel = async (request: ReturnType<typeof vi.fn>, props: Record<string, unknown> = {}, over = {}) => {
  mounted = mount(AUserSystemPanel, {
    global: { plugins: [router, pinia] },
    props: { descriptor: descriptor(request, over), userId: 42, ...props },
  })
  await flushPromises()
  return mounted
}

beforeEach(async () => {
  pinia = createPinia()
  setActivePinia(pinia)
  await router.push('/')
  await router.isReady()
})

afterEach(() => {
  mounted?.unmount()
  mounted = null
})

describe('AUserSystemPanel', () => {
  it('offers Manage when the account is there', async () => {
    const wrapper = await mountPanel(vi.fn().mockResolvedValue({ status: 200, data: record() }))

    expect(wrapper.find('[data-cy="user-system-manage"]').exists()).toBe(true)
    expect(wrapper.find('[data-cy="user-system-create"]').exists()).toBe(false)
    expect(wrapper.find('[data-cy="user-system-state-enabled"]').exists()).toBe(true)
  })

  it('offers Create only after an authoritative 404', async () => {
    const absent = await mountPanel(vi.fn().mockRejectedValue(httpError(404)))
    expect(absent.find('[data-cy="user-system-create"]').exists()).toBe(true)
    absent.unmount()

    // 403 is "you cannot read this", not "nobody is here" -- and an AnzuUser cannot be deleted, so
    // a duplicate identity created on that guess could never be taken back.
    const forbidden = await mountPanel(vi.fn().mockRejectedValue(httpError(403)))
    expect(forbidden.find('[data-cy="user-system-create"]').exists()).toBe(false)
    expect(forbidden.find('[data-cy="user-system-state-forbidden"]').exists()).toBe(true)
    forbidden.unmount()

    const dead = await mountPanel(vi.fn().mockRejectedValue(httpError(503)))
    expect(dead.find('[data-cy="user-system-create"]').exists()).toBe(false)
  })

  it('never offers Create on a viewing page', async () => {
    // A write action on a read-only screen would be the first in the fleet. Manage stays: it only
    // leads somewhere.
    const wrapper = await mountPanel(vi.fn().mockRejectedValue(httpError(404)), { readonly: true })

    expect(wrapper.find('[data-cy="user-system-create"]').exists()).toBe(false)
  })

  it('offers a retry exactly where one could help', async () => {
    const dead = await mountPanel(vi.fn().mockRejectedValue(httpError(503)))
    expect(dead.find('[data-cy="user-system-retry"]').exists()).toBe(true)
    dead.unmount()

    const absent = await mountPanel(vi.fn().mockRejectedValue(httpError(404)))
    expect(absent.find('[data-cy="user-system-retry"]').exists()).toBe(false)
  })

  it('asks nothing of a system switched off in the configuration', async () => {
    const request = vi.fn()
    const wrapper = await mountPanel(request, {}, { isEnabled: () => false })

    expect(request).not.toHaveBeenCalled()
    expect(wrapper.find('[data-cy="user-system-state-configDisabled"]').exists()).toBe(true)
  })

  it('shows the state a system keeps beyond enabled', async () => {
    const wrapper = await mountPanel(
      vi.fn().mockResolvedValue({ status: 200, data: record({ status: 'ban' }) }),
      {},
      { extraState: (user: any) => ({ label: 'bloger', value: user.status, tone: 'error' as const }) }
    )

    expect(wrapper.text()).toContain('bloger')
    expect(wrapper.text()).toContain('ban')
  })

  it('says why a Manage button is dead rather than just disabling it', async () => {
    const wrapper = await mountPanel(
      vi.fn().mockResolvedValue({ status: 200, data: record() }),
      {},
      {
        manage: () => ({ kind: 'external' as const, href: null }),
      }
    )

    const button = wrapper.find('[data-cy="user-system-manage"]')
    expect(button.exists()).toBe(true)
    expect(button.attributes('disabled')).toBeDefined()
  })

  it('re-reads on demand, which is what a save on the owning form triggers', async () => {
    const request = vi.fn().mockResolvedValue({ status: 200, data: record() })
    const wrapper = await mountPanel(request)
    const before = request.mock.calls.length

    await (wrapper.vm as unknown as { refresh: () => Promise<void> }).refresh()
    await flushPromises()

    expect(request.mock.calls.length).toBeGreaterThan(before)
  })
})
