import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import type { AxiosInstance } from 'axios'
import AUserSystemOverview from '@/labs/anzuUser/AUserSystemOverview.vue'
import { defineUserSystemDescriptor, type AnyUserSystemDescriptor } from '@/labs/anzuUser/userSystemDescriptor'
import { useUserCrossSystemStore } from '@/labs/anzuUser/userCrossSystemStore'

// The screen the cross-system work is for. What matters here is not the layout but the two answers
// it gives after a search that found nobody: whether creating an account may be offered at all, and
// what the dialog tells the operator is about to happen.

const emptyList = () => ({ status: 200, data: { data: [], totalCount: 0 } })

const notFound = () =>
  Object.assign(new Error('failed'), {
    isAxiosError: true,
    config: { url: '/adm/v1/anzu-user/42' },
    response: { status: 404, data: {} },
  })

const unreachable = () =>
  Object.assign(new Error('failed'), {
    isAxiosError: true,
    config: { url: '/adm/v1/anzu-user/42' },
    response: { status: 503, data: {} },
  })

interface Backend {
  system: string
  request: ReturnType<typeof vi.fn>
  get: ReturnType<typeof vi.fn>
  createNote?: string
}

const descriptorsOf = (backends: Backend[]): AnyUserSystemDescriptor[] =>
  backends.map((item) =>
    defineUserSystemDescriptor({
      system: item.system,
      label: item.system,
      client: () => ({ request: item.request, get: item.get }) as unknown as AxiosInstance,
      entity: 'anzuUser',
      isEnabled: () => true,
      requiredMetadata: false,
      idInput: true,
      createNote: item.createNote,
      endpoints: {
        anzuUser: { get: '/adm/v1/anzu-user/:id', put: '/adm/v1/anzu-user/:id', post: '/adm/v1/anzu-user' },
        base: null,
        permissionGroup: '/adm/v1/permission-group',
        currentUser: '/adm/v1/anzu-user/current',
        list: '/adm/v1/anzu-user',
        probe: 'anzuUser',
      },
    })
  )

const router = createRouter({
  history: createMemoryHistory(),
  routes: [{ path: '/', component: { template: '<div />' } }],
})

let mounted: VueWrapper | null = null
let pinia = createPinia()

const mountOverview = async (backends: Backend[]) => {
  mounted = mount(AUserSystemOverview, {
    global: { plugins: [router, pinia] },
    props: { descriptors: descriptorsOf(backends) },
    attachTo: document.body,
  })
  await flushPromises()
  return mounted
}

const search = async (wrapper: VueWrapper, term: string) => {
  await (wrapper.vm as unknown as { search: (value: string) => Promise<void> }).search(term)
  await flushPromises()
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

describe('after a search that found nobody', () => {
  it('offers to create an account when an address belongs to nobody', async () => {
    // An address search cannot prove absence -- a system holding the same person under a different
    // address answers nothing -- so refusing here would put the whole create flow out of reach of
    // the search people actually use. What makes it safe is that the dialog asks for the id and
    // runs its own authoritative fan-out on it before writing.
    const backends = ['weather', 'blog'].map((system) => ({
      system,
      get: vi.fn().mockResolvedValue(emptyList()),
      request: vi.fn().mockRejectedValue(notFound()),
    }))
    const wrapper = await mountOverview(backends)

    await search(wrapper, 'nobody@sme.sk')

    expect(wrapper.find('[data-cy="cross-system-not-found"]').exists()).toBe(true)
    expect(wrapper.find('[data-cy="cross-system-create-anywhere"]').exists()).toBe(true)
  })

  it('offers it after an id search only when every system answered an authoritative 404', async () => {
    const answered = ['weather', 'blog'].map((system) => ({
      system,
      get: vi.fn().mockResolvedValue(emptyList()),
      request: vi.fn().mockRejectedValue(notFound()),
    }))
    const wrapper = await mountOverview(answered)
    await search(wrapper, '42')
    expect(wrapper.find('[data-cy="cross-system-create-anywhere"]').exists()).toBe(true)
  })

  it('refuses after an id search one system could not answer, and offers a retry instead', async () => {
    // A record that could not be read is not a record that does not exist, and no admin can delete
    // an AnzuUser -- a duplicate identity created on that guess could never be taken back.
    const backends = [
      {
        system: 'weather',
        get: vi.fn().mockResolvedValue(emptyList()),
        request: vi.fn().mockRejectedValue(notFound()),
      },
      {
        system: 'blog',
        get: vi.fn().mockResolvedValue(emptyList()),
        request: vi.fn().mockRejectedValue(unreachable()),
      },
    ]
    const wrapper = await mountOverview(backends)

    await search(wrapper, '42')

    expect(wrapper.find('[data-cy="cross-system-create-anywhere"]').exists()).toBe(false)
    expect(wrapper.find('[data-cy="cross-system-retry-search"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('blog')
  })

  it('tells the operator what having an account in the chosen system means', async () => {
    const backends = [
      {
        system: 'blog',
        get: vi.fn().mockResolvedValue(emptyList()),
        request: vi.fn().mockRejectedValue(notFound()),
        createNote: 'V blogu je to ten istý účet ako na verejnom webe.',
      },
    ]
    const wrapper = await mountOverview(backends)
    await search(wrapper, 'nobody@sme.sk')

    const open = wrapper.find('[data-cy="cross-system-create-anywhere"]')
    await open.trigger('click')
    await flushPromises()

    // Decision 21 is written about this exact flow, and the sentence it asks for is the system's
    // own: in blog and forum an account here is an account on the public web.
    expect(document.body.textContent).toContain('V blogu je to ten istý účet')
    // Nobody to copy from, so it is created switched off -- and the dialog says which of the two.
    expect(document.body.textContent).toContain('The account is created disabled')
  })
})

describe('leaving the page', () => {
  it('does not keep the last person on screen for the next visit', async () => {
    // The store outlives a closed dialog on purpose, so a running bulk action is not lost with it.
    // It is not meant to outlive the page: coming back through the menu showed the previous
    // person's rows and live toggles under an empty search box.
    const found = {
      id: 42,
      email: 'jozef@sme.sk',
      person: { firstName: 'Jozef', lastName: 'Mrkvicka', fullName: 'Jozef Mrkvicka' },
      avatar: { color: '#4CAF50', text: 'JM' },
      enabled: true,
      roles: [],
      permissions: {},
      permissionGroups: [],
      resolvedPermissions: {},
    }
    const wrapper = await mountOverview([
      {
        system: 'weather',
        get: vi.fn().mockResolvedValue(emptyList()),
        request: vi.fn().mockResolvedValue({ status: 200, data: found }),
      },
    ])
    await search(wrapper, '42')
    const store = useUserCrossSystemStore()
    expect(store.results.get('weather')?.user?.id).toBe(42)

    wrapper.unmount()
    mounted = null

    expect(store.results.size).toBe(0)
    expect(store.resolvedId).toBeNull()
  })
})

describe('leaving the page while work is still out', () => {
  const person = (over: Record<string, unknown> = {}) => ({
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

  it('keeps the bulk lock while a run is still writing, so a second one cannot start (B13)', async () => {
    // `cancel()` stops the probes, not the writes: the PUTs of a run go on after the page is gone,
    // and a reset that released the lock let a second run start against the same account while
    // the first was unfinished.
    const puts: Array<(value: unknown) => void> = []
    const request = vi.fn((config: { method: string }) =>
      config.method === 'PUT'
        ? new Promise((resolve) => puts.push(resolve))
        : Promise.resolve({ status: 200, data: person() })
    )
    const backends = [{ system: 'weather', get: vi.fn().mockResolvedValue(emptyList()), request }]

    let wrapper = await mountOverview(backends)
    await search(wrapper, '42')
    await wrapper.get('[data-cy="cross-system-bulk-disable"]').trigger('click')
    await flushPromises()
    ;(document.querySelector('[data-cy="user-bulk-confirm"]') as HTMLElement).click()
    await flushPromises()
    const store = useUserCrossSystemStore()
    expect(puts).toHaveLength(1)

    wrapper.unmount()
    mounted = null
    await flushPromises()
    expect(store.bulkRunning).toBe(true)

    wrapper = await mountOverview(backends)
    await search(wrapper, '42')
    expect(wrapper.get('[data-cy="cross-system-bulk-disable"]').attributes('disabled')).toBeDefined()

    // The run ends and releases the lock itself.
    puts[0]!({ status: 200, data: person({ enabled: false }) })
    await flushPromises()
    expect(store.bulkRunning).toBe(false)
    expect(puts).toHaveLength(1)
  })

  it('does not put a person created after the page was left back on it', async () => {
    // The create dialog is not persistent: click outside, use the menu, and the POST is still out.
    // The search that follows it takes a fresh generation `cancel()` cannot stop, and refilled the
    // store the unmount had just emptied -- that person's rows and live buttons on the next visit.
    let created = false
    let releasePost: (value: unknown) => void = () => {}
    const request = vi.fn((config: { method: string }) => {
      if (config.method === 'POST') return new Promise((resolve) => (releasePost = resolve))
      if (created) return Promise.resolve({ status: 200, data: person({ id: 77, email: 'new@sme.sk' }) })
      return Promise.reject(notFound())
    })
    const wrapper = await mountOverview([{ system: 'blog', get: vi.fn().mockResolvedValue(emptyList()), request }])

    await search(wrapper, 'new@sme.sk')
    await wrapper.get('[data-cy="cross-system-create-anywhere"]').trigger('click')
    await flushPromises()
    const id = document.querySelector('.v-overlay input[type="number"]') as HTMLInputElement
    id.value = '77'
    id.dispatchEvent(new Event('input'))
    const email = document.querySelector('.v-overlay [data-cy="user-email"] input') as HTMLInputElement
    email.value = 'new@sme.sk'
    email.dispatchEvent(new Event('input'))
    await flushPromises()
    ;(document.querySelector('[data-cy="create-anywhere-confirm"]') as HTMLElement).click()
    await flushPromises()
    expect(request.mock.calls.some(([config]) => config.method === 'POST')).toBe(true)

    const store = useUserCrossSystemStore()
    wrapper.unmount()
    mounted = null
    created = true
    releasePost({ status: 201, data: person({ id: 77, email: 'new@sme.sk' }) })
    await flushPromises()

    expect(store.resolvedId).toBeNull()
    expect(store.results.size).toBe(0)
  })
})
