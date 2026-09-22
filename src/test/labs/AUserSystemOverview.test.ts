import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import type { AxiosInstance } from 'axios'
import AUserSystemOverview from '@/labs/anzuUser/AUserSystemOverview.vue'
import { defineUserSystemDescriptor, type AnyUserSystemDescriptor } from '@/labs/anzuUser/userSystemDescriptor'

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
