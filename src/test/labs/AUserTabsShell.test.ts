import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter, type Router } from 'vue-router'
import type { AxiosInstance } from 'axios'
import AUserTabsShell from '@/labs/anzuUser/AUserTabsShell.vue'
import { defineUserSystemDescriptor, type AnyUserSystemDescriptor } from '@/labs/anzuUser/userSystemDescriptor'
import { OTHER_SYSTEMS_TAB } from '@/labs/anzuUser/userTabs'

// The tab bar takes its tabs as a prop rather than deriving them from the descriptor array: the
// list depends on the route, not on what the admin owns. admin-inhouse owns four systems and has
// two tabs, because the system is part of the path.

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

const descriptor = (
  system: string,
  label: string,
  request: ReturnType<typeof vi.fn>,
  requiredMetadata = false
): AnyUserSystemDescriptor =>
  defineUserSystemDescriptor({
    system,
    label,
    client: () => ({ request }) as unknown as AxiosInstance,
    entity: 'anzuUser',
    isEnabled: () => true,
    requiredMetadata,
    idInput: true,
    endpoints: {
      anzuUser: { get: '/adm/v1/anzu-user/:id', put: '/adm/v1/anzu-user/:id', post: '/adm/v1/anzu-user' },
      base: null,
      permissionGroup: '/adm/v1/permission-group',
      currentUser: '/adm/v1/anzu-user/current',
      list: '/adm/v1/anzu-user',
      probe: 'anzuUser',
    },
    manage: () => ({ kind: 'external', href: 'https://example.test/users/42/edit' }),
  })

let mounted: VueWrapper | null = null
let pinia = createPinia()
let router: Router

const mountShell = async (props: Record<string, unknown> = {}, query = '', navigate = true) => {
  const request = vi.fn().mockResolvedValue({ status: 200, data: record() })
  if (navigate) await router.replace('/users/42' + query)
  mounted = mount(AUserTabsShell, {
    global: { plugins: [router, pinia] },
    props: {
      userId: 42,
      owner: 'cms',
      ownedTabs: ['cms', 'contentHub'],
      descriptors: [
        descriptor('cms', 'CMS', request),
        descriptor('contentHub', 'Agentúry', request),
        descriptor('dam', 'DAM', request),
      ],
      ...props,
    },
    slots: { default: '<div class="owner-form">the form</div>' },
  })
  await flushPromises()
  return { wrapper: mounted, request }
}

beforeEach(async () => {
  pinia = createPinia()
  setActivePinia(pinia)
  router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/users/:id', component: { template: '<div />' } }],
  })
  await router.push('/users/42')
  await router.isReady()
})

afterEach(() => {
  mounted?.unmount()
  mounted = null
})

describe('AUserTabsShell', () => {
  it('draws the tabs it was given, in order, plus one for the rest', async () => {
    const { wrapper } = await mountShell()

    const labels = wrapper.findAll('.v-tab').map((tab) => tab.text())
    expect(labels[0]).toContain('CMS')
    expect(labels[1]).toContain('Agentúry')
    expect(labels[2]).toContain('Other systems')
    expect(labels).toHaveLength(3)
  })

  it('opens on the owning tab and puts the form in it', async () => {
    const { wrapper } = await mountShell()

    expect(wrapper.find('.owner-form').exists()).toBe(true)
  })

  it('costs no foreign call until a tab is opened', async () => {
    // Lazy by construction: `VWindowItem` renders its content on first activation, which is why
    // the plan dropped the pseudo-tab that would have asked for all eight up front.
    const { request } = await mountShell()

    expect(request).not.toHaveBeenCalled()
  })

  it('writes the open tab into the url with replace, so Back leaves the page', async () => {
    // Navigated first, then spied, then mounted: the write under test is the one the shell makes
    // when it settles on a tab, and here it settles on the owning one because the link named a tab
    // that no longer exists.
    await router.replace('/users/42?tab=elections')
    const replace = vi.spyOn(router, 'replace')
    const push = vi.spyOn(router, 'push')

    await mountShell({}, '', false)

    expect(router.currentRoute.value.query.tab).toBe('cms')
    // `replace`, never `push`: with `push` the Back button would walk through the tabs instead of
    // leaving the page.
    expect(replace).toHaveBeenCalled()
    expect(push).not.toHaveBeenCalled()
  })

  it('opens the tab a link names', async () => {
    const { wrapper } = await mountShell({}, '?tab=' + OTHER_SYSTEMS_TAB)

    expect(wrapper.findAll('.v-window-item').length).toBeGreaterThan(0)
    expect(router.currentRoute.value.query.tab).toBe(OTHER_SYSTEMS_TAB)
  })

  it('ignores a tab that no longer exists and opens the owning one', async () => {
    // A system dropped out of the configuration since the link was sent. An error would help nobody.
    await mountShell({}, '?tab=elections')

    await vi.waitFor(() => expect(router.currentRoute.value.query.tab).toBe('cms'))
  })

  it('lists exactly the systems that have no tab of their own', async () => {
    const { wrapper } = await mountShell({}, '?tab=' + OTHER_SYSTEMS_TAB)
    await flushPromises()

    expect(wrapper.find('[data-cy="user-system-panel-dam"]').exists()).toBe(true)
    expect(wrapper.find('[data-cy="user-system-panel-cms"]').exists()).toBe(false)
  })

  it('marks the owning tab when the form holds unsaved work', async () => {
    const clean = await mountShell({ unsavedChanges: false })
    expect(clean.wrapper.find('[data-cy="user-tab-unsaved"]').exists()).toBe(false)
    clean.wrapper.unmount()

    const dirty = await mountShell({ unsavedChanges: true })
    expect(dirty.wrapper.find('[data-cy="user-tab-unsaved"]').exists()).toBe(true)
  })

  it('creates the account the panel offers, copying the owner record as the server holds it', async () => {
    // The whole reason the shell owns this: the panel that offers Create is here, and the page
    // would only be passing the call through. Until it did, the button opened a dialog whose
    // Confirm did nothing at all.
    const owner = vi.fn().mockResolvedValue({ status: 200, data: record({ enabled: true }) })
    const absent = vi
      .fn()
      .mockRejectedValueOnce(
        Object.assign(new Error('failed'), {
          isAxiosError: true,
          config: { url: '/adm/v1/anzu-user/42' },
          response: { status: 404, data: {} },
        })
      )
      .mockResolvedValue({ status: 201, data: record() })

    await router.replace('/users/42?tab=' + OTHER_SYSTEMS_TAB)
    mounted = mount(AUserTabsShell, {
      global: { plugins: [router, pinia] },
      props: {
        userId: 42,
        owner: 'cms',
        ownedTabs: ['cms'],
        descriptors: [descriptor('cms', 'CMS', owner), descriptor('dam', 'DAM', absent)],
      },
      slots: { default: '<div class="owner-form">the form</div>' },
      attachTo: document.body,
    })
    await flushPromises()
    await vi.waitFor(() => expect(absent).toHaveBeenCalled())
    await flushPromises()

    const create = document.querySelector('[data-cy="user-system-create"]') as HTMLElement
    expect(create).not.toBeNull()
    create.click()
    await flushPromises()

    // Copying a person into another system copies whether they are switched on, so the dialog has
    // to say a working account is coming into being -- in blog and forum that means a public one.
    expect(document.body.textContent).toContain('The account is created ready to use.')

    const confirm = document.querySelector('[data-cy="user-system-create-confirm"]') as HTMLElement
    confirm.click()
    await flushPromises()
    await vi.waitFor(() => expect(absent.mock.calls.length).toBeGreaterThan(1))

    const posted = absent.mock.calls.find((call) => call[0].method?.toUpperCase() === 'POST')
    expect(posted).toBeDefined()
    const body = JSON.parse(posted![0].data)
    expect(body.email).toBe('jozef@sme.sk')
    expect(body.enabled).toBe(true)
    // From the library factory, never assembled: a hand-built body would have the backend fill in
    // `ROLE_USER`, leaving an account with a role nobody granted.
    expect(body.roles).toEqual([])
  })

  it('will not post a record the target would refuse, and asks for the missing fields instead', async () => {
    // The plan's own example: a person known only in blog, where `person` is filled for nobody,
    // copied into a system whose profile requires it. A silent copy leaves an account the target's
    // own edit form then refuses to save, which is what the form in this dialog exists to prevent.
    const owner = vi.fn().mockResolvedValue({
      status: 200,
      data: record({ person: { firstName: '', lastName: '', fullName: '' } }),
    })
    const absent = vi
      .fn()
      .mockRejectedValueOnce(
        Object.assign(new Error('failed'), {
          isAxiosError: true,
          config: { url: '/adm/v1/anzu-user/42' },
          response: { status: 404, data: {} },
        })
      )
      .mockResolvedValue({ status: 201, data: record() })

    await router.replace('/users/42?tab=' + OTHER_SYSTEMS_TAB)
    mounted = mount(AUserTabsShell, {
      global: { plugins: [router, pinia] },
      props: {
        userId: 42,
        owner: 'blog',
        ownedTabs: ['blog'],
        descriptors: [descriptor('blog', 'Blog', owner), descriptor('cms', 'CMS', absent, true)],
      },
      slots: { default: '<div class="owner-form">the form</div>' },
      attachTo: document.body,
    })
    await flushPromises()
    await vi.waitFor(() => expect(absent).toHaveBeenCalled())
    await flushPromises()

    ;(document.querySelector('[data-cy="user-system-create"]') as HTMLElement).click()
    await flushPromises()
    ;(document.querySelector('[data-cy="user-system-create-confirm"]') as HTMLElement).click()
    await flushPromises()

    expect(absent.mock.calls.some((call) => call[0].method?.toUpperCase() === 'POST')).toBe(false)
    // And the dialog is still open, with the form to fill in.
    expect(document.querySelector('[data-cy="user-system-create-confirm"]')).not.toBeNull()
  })

  it('re-reads the panels when the page says the form was saved', async () => {
    const { wrapper, request } = await mountShell({}, '?tab=' + OTHER_SYSTEMS_TAB)
    await vi.waitFor(() => expect(request).toHaveBeenCalled())
    const before = request.mock.calls.length

    await (wrapper.vm as unknown as { refresh: () => void }).refresh()
    await flushPromises()

    // `VWindowItem` hides a panel with `v-show` rather than unmounting it, so without this it would
    // go on showing what it read before the save -- and creating an account elsewhere copies from
    // exactly that snapshot.
    expect(request.mock.calls.length).toBeGreaterThan(before)
  })
})
