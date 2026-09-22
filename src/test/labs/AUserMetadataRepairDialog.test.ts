import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import type { AxiosInstance } from 'axios'
import AUserMetadataRepairDialog from '@/labs/anzuUser/AUserMetadataRepairDialog.vue'
import { useUserCrossSystemStore } from '@/labs/anzuUser/userCrossSystemStore'
import { defineUserSystemDescriptor, type AnyUserSystemDescriptor } from '@/labs/anzuUser/userSystemDescriptor'
import { UserSystemAccess, UserSystemLoad, UserSystemPresence } from '@/labs/anzuUser/userSystemState'
import type { AnzuUser } from '@/types/AnzuUser'

const record = (over: Record<string, unknown> = {}) =>
  ({
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
  }) as unknown as AnzuUser

const descriptor = (system: string, label: string, over: Partial<AnyUserSystemDescriptor> = {}) =>
  defineUserSystemDescriptor({
    system,
    label,
    client: () => ({}) as unknown as AxiosInstance,
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
    ...over,
  })

const DESCRIPTORS = [
  descriptor('cms', 'CMS'),
  descriptor('weather', 'Počasie'),
  descriptor('blog', 'Blog', { metadataNote: 'Blog má vlastné meno a priezvisko — tie sa nemenia.' }),
]

let mounted: VueWrapper | null = null
let pinia = createPinia()

const seed = (users: Record<string, AnzuUser>) => {
  const store = useUserCrossSystemStore()
  store.resolvedId = 42
  for (const [system, user] of Object.entries(users)) {
    store.setResult(system, {
      axes: {
        load: UserSystemLoad.Loaded,
        presence: UserSystemPresence.Present,
        access: UserSystemAccess.Ok,
        enabled: user.enabled,
      },
      user,
    })
  }
  return store
}

const mountDialog = async () => {
  mounted = mount(AUserMetadataRepairDialog, {
    global: { plugins: [pinia] },
    props: { descriptors: DESCRIPTORS, open: true },
    attachTo: document.body,
  })
  await flushPromises()
  return mounted
}

const fieldValue = (cy: string) =>
  (document.querySelector(`[data-cy="${cy}"] input`) as HTMLInputElement | null)?.value ?? ''

beforeEach(() => {
  pinia = createPinia()
  setActivePinia(pinia)
})

afterEach(() => {
  mounted?.unmount()
  mounted = null
})

describe('AUserMetadataRepairDialog', () => {
  it('pre-fills from the first system in the configured order that has a record', async () => {
    seed({ weather: record({ email: 'w@sme.sk' }), blog: record({ email: 'b@sme.sk' }) })
    await mountDialog()

    // Never "whichever answered first": the fan-out is parallel, so that would differ every run.
    expect(fieldValue('user-email')).toBe('w@sme.sk')
  })

  it('keeps a deliberate full name when the source is switched to the record that holds it', async () => {
    // cms matches what the names would derive, so its flags start clean. weather does not -- that
    // value was set on purpose, and switching to weather is the operator saying "this is the one".
    const store = seed({
      cms: record({ person: { firstName: 'Jozef', lastName: 'Mrkvicka', fullName: 'Jozef Mrkvicka' } }),
      weather: record({ person: { firstName: 'Jozef', lastName: 'Novak', fullName: 'Ing. Jozef Novak' } }),
    })
    const wrapper = await mountDialog()
    expect(fieldValue('user-fullName')).toBe('Jozef Mrkvicka')

    const select = wrapper.getComponent({ name: 'VSelect' })
    await select.setValue('weather')
    await flushPromises()

    // Deriving here would throw away the very value the operator picked as the source of truth --
    // and then propose writing the derived one into every system.
    expect(fieldValue('user-fullName')).toBe('Ing. Jozef Novak')
    expect(store.resolvedId).toBe(42)
  })

  it('offers a checkbox per differing system and writes only the ticked ones', async () => {
    seed({
      cms: record({ email: 'a@sme.sk' }),
      weather: record({ email: 'b@sme.sk' }),
      blog: record({ email: 'c@sme.sk' }),
    })
    const wrapper = await mountDialog()

    // Source is cms, so weather and blog differ.
    expect(document.querySelector('[data-cy="repair-system-weather"]')).not.toBeNull()
    expect(document.querySelector('[data-cy="repair-system-blog"]')).not.toBeNull()
    expect(document.querySelector('[data-cy="repair-system-cms"]')).toBeNull()

    const blogBox = document.querySelector('[data-cy="repair-system-blog"] input') as HTMLInputElement
    blogBox.click()
    await flushPromises()

    const confirm = document.querySelector('[data-cy="repair-confirm"]') as HTMLElement
    confirm.click()
    await flushPromises()

    const payload = wrapper.emitted('confirm')?.[0]?.[0] as { systems: string[] }
    expect(payload.systems).toEqual(['weather'])
  })

  it('names what a system will not take, so nobody leaves believing it did', async () => {
    seed({ cms: record({ email: 'a@sme.sk' }), blog: record({ email: 'c@sme.sk' }) })
    await mountDialog()

    // Read off the document: `VDialog` teleports its content out of the component's own tree.
    expect(document.body.textContent).toContain('Blog má vlastné meno a priezvisko')
  })

  it('refuses to write anything while one e-mail has two ids behind it', async () => {
    const store = seed({ cms: record({ email: 'a@sme.sk' }), weather: record({ email: 'b@sme.sk' }) })
    store.identityConflict = new Map([
      ['cms', 42],
      ['weather', 99],
    ])
    const wrapper = await mountDialog()

    expect(document.querySelector('[data-cy="repair-identity-conflict"]')).not.toBeNull()
    const confirm = document.querySelector('[data-cy="repair-confirm"]') as HTMLElement
    confirm.click()
    await flushPromises()

    // Silently closing while writing nothing is the failure this guards: the operator would have
    // every reason to believe it worked.
    expect(wrapper.emitted('confirm')).toBeUndefined()
  })

  it('writes to nobody when every system already holds the value', async () => {
    seed({ cms: record(), weather: record() })
    const wrapper = await mountDialog()

    // Nothing differs, so there is nothing to write and no row to tick.
    expect(document.querySelector('[data-cy="repair-system-weather"]')).toBeNull()

    const confirm = document.querySelector('[data-cy="repair-confirm"]') as HTMLElement
    confirm.click()
    await flushPromises()

    expect(wrapper.emitted('confirm')).toBeUndefined()
  })
})
