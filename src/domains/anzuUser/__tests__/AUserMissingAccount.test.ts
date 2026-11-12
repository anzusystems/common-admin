import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import AUserMissingAccount from '@/domains/anzuUser/components/AUserMissingAccount.vue'
import type { AnyUserSystemDescriptor } from '@/domains/anzuUser/composables/userSystemDescriptor'
import { absentSystem, descriptor, posted, presentSystem } from '@/domains/anzuUser/__tests__/support/userSystems'

// A user page whose system holds no account for the person stays in its tabs and offers to create one.

const router = createRouter({
  history: createMemoryHistory(),
  routes: [{ path: '/', component: { template: '<div />' } }],
})

let mounted: VueWrapper | null = null
let pinia = createPinia()

const mountMissing = async (target: AnyUserSystemDescriptor, sources: AnyUserSystemDescriptor[]) => {
  mounted = mount(AUserMissingAccount, {
    global: { plugins: [router, pinia] },
    props: { descriptor: target, userId: 42, sources },
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

describe('AUserMissingAccount', () => {
  it('says the person has no account here and offers to create one', async () => {
    const wrapper = await mountMissing(descriptor('contentHub', 'Agentúry', absentSystem()), [
      descriptor('cms', 'CMS', presentSystem()),
    ])

    expect(wrapper.text()).toContain('No account here')
    expect(wrapper.find('[data-cy="user-system-create"]').exists()).toBe(true)
    expect(wrapper.find('[data-cy="user-system-no-write"]').exists()).toBe(false)
  })

  it('says the operator may not write there instead of offering to create', async () => {
    const wrapper = await mountMissing(
      descriptor('contentHub', 'Agentúry', absentSystem(), { canWrite: (action) => action !== 'create' }),
      [descriptor('cms', 'CMS', presentSystem())]
    )

    expect(wrapper.find('[data-cy="user-system-create"]').exists()).toBe(false)
    expect(wrapper.find('[data-cy="user-system-no-write"]').text()).toBe('No right to write')
  })

  it('copies the first system that holds the person and reports the new account', async () => {
    const target = absentSystem()
    const wrapper = await mountMissing(descriptor('brick', 'Brick', target), [
      descriptor('weather', 'Weather', absentSystem()),
      descriptor('dailyTools', 'Daily tools', presentSystem({ enabled: true })),
    ])

    await click('[data-cy="user-system-create"]')
    // The account is copied switched on because the source is. In blog and forum that is a public account.
    expect(document.body.textContent).toContain('The account is created ready to use.')

    await click('[data-cy="user-system-create-confirm"]')

    const [body] = posted(target)
    expect(body).toMatchObject({ id: 42, email: 'jozef@sme.sk', enabled: true, roles: [] })
    expect(wrapper.emitted('created')).toHaveLength(1)
  })

  it('creates nothing when no system can give the record', async () => {
    const target = absentSystem()
    const wrapper = await mountMissing(descriptor('brick', 'Brick', target), [
      descriptor('weather', 'Weather', absentSystem()),
    ])

    await click('[data-cy="user-system-create"]')
    // Nothing prefilled the dialog, so the e-mail is typed in for the form to pass.
    const email = document.querySelector('[data-cy="user-email"] input') as HTMLInputElement
    email.value = 'jozef@sme.sk'
    email.dispatchEvent(new Event('input'))
    await flushPromises()
    await click('[data-cy="user-system-create-confirm"]')

    expect(posted(target)).toEqual([])
    expect(wrapper.emitted('created')).toBeUndefined()
  })
})
