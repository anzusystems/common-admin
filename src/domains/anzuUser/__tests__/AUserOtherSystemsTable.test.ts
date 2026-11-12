import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import AUserOtherSystemsTable from '@/domains/anzuUser/components/AUserOtherSystemsTable.vue'
import type { AnyUserSystemDescriptor } from '@/domains/anzuUser/composables/userSystemDescriptor'
import { absentSystem, descriptor, posted, presentSystem } from '@/domains/anzuUser/__tests__/support/userSystems'

// The "other systems" page: one row per system the admin does not manage, with Create where the person is missing.

const router = createRouter({
  history: createMemoryHistory(),
  routes: [{ path: '/', component: { template: '<div />' } }],
})

let mounted: VueWrapper | null = null
let pinia = createPinia()

const mountTable = async (descriptors: AnyUserSystemDescriptor[], sources: AnyUserSystemDescriptor[]) => {
  mounted = mount(AUserOtherSystemsTable, {
    global: { plugins: [router, pinia] },
    props: { descriptors, sources, userId: 42 },
    attachTo: document.body,
  })
  await flushPromises()
  return mounted
}

const click = async (selector: string) => {
  ;(document.querySelector(selector) as HTMLElement).click()
  await flushPromises()
}

beforeEach(async () => {
  pinia = createPinia()
  setActivePinia(pinia)
  await router.push('/')
})

afterEach(() => {
  mounted?.unmount()
  mounted = null
})

describe('AUserOtherSystemsTable', () => {
  it('draws a row for each system it was given', async () => {
    const wrapper = await mountTable(
      [descriptor('dam', 'DAM', presentSystem()), descriptor('blog', 'Blog', absentSystem())],
      [descriptor('cms', 'CMS', presentSystem())]
    )

    expect(wrapper.find('[data-cy="user-system-panel-dam"]').exists()).toBe(true)
    expect(wrapper.find('[data-cy="user-system-panel-blog"]').exists()).toBe(true)
    expect(wrapper.find('[data-cy="user-system-panel-cms"]').exists()).toBe(false)
  })

  it('creates the account a row offers, copying the source record as the server holds it', async () => {
    // The first source is where the operator came from; the person has no account there, so the next one is copied.
    const dam = absentSystem()
    await mountTable(
      [descriptor('dam', 'DAM', dam)],
      [descriptor('contentHub', 'Agentúry', absentSystem()), descriptor('cms', 'CMS', presentSystem({ enabled: true }))]
    )

    await click('[data-cy="user-system-create"]')
    // Copying a person into another system copies whether they are enabled.
    // The dialog has to say a working account is created. In blog and forum that means a public one.
    expect(document.body.textContent).toContain('The account is created ready to use.')

    await click('[data-cy="user-system-create-confirm"]')

    const [body] = posted(dam)
    expect(body.email).toBe('jozef@sme.sk')
    expect(body.enabled).toBe(true)
    // From the library factory, never assembled: a hand-built body would have the backend fill in
    // `ROLE_USER`, leaving an account with a role nobody granted.
    expect(body.roles).toEqual([])
  })

  it('will not post a record the target would refuse, and asks for the missing fields instead', async () => {
    // A person known only in blog, where `person` is not filled, is copied into a system whose profile requires it.
    // A silent copy leaves an account that the target's own edit form refuses to save.
    // The form in this dialog exists to prevent that.
    const cms = absentSystem()
    await mountTable(
      [descriptor('cms', 'CMS', cms, { requiredMetadata: true })],
      [descriptor('blog', 'Blog', presentSystem({ person: { firstName: '', lastName: '', fullName: '' } }))]
    )

    await click('[data-cy="user-system-create"]')
    await click('[data-cy="user-system-create-confirm"]')

    expect(posted(cms)).toEqual([])
    expect(document.querySelector('[data-cy="user-system-create-confirm"]')).not.toBeNull()
  })

  it('gives the page the source record, to name the person', async () => {
    const wrapper = await mountTable(
      [descriptor('dam', 'DAM', presentSystem())],
      [descriptor('contentHub', 'Agentúry', absentSystem()), descriptor('cms', 'CMS', presentSystem())]
    )

    expect((wrapper.vm as unknown as { source: { email: string } | null }).source?.email).toBe('jozef@sme.sk')
  })

  it('re-reads the rows when asked', async () => {
    const dam = presentSystem()
    const wrapper = await mountTable([descriptor('dam', 'DAM', dam)], [descriptor('cms', 'CMS', presentSystem())])
    const before = dam.mock.calls.length

    ;(wrapper.vm as unknown as { refresh: () => void }).refresh()
    await flushPromises()

    expect(dam.mock.calls.length).toBeGreaterThan(before)
  })
})
