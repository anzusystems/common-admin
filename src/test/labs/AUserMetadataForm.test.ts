import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import AUserMetadataForm from '@/labs/anzuUser/AUserMetadataForm.vue'
import type { BaseUser } from '@/types/AnzuUser'

// Decision 28: the two derived fields keep recomputing until somebody edits them, and the flag is
// seeded from the data rather than starting clean -- a stored value that differs from what the
// names would produce was set on purpose. The cms fixtures carry exactly that case
// (`Anzu` + `User 1` with a full name of `Anzu User1`).

const user = (over: Partial<BaseUser> = {}): BaseUser => ({
  id: 1,
  email: 'jozef@sme.sk',
  person: { firstName: '', lastName: '', fullName: '' },
  avatar: { color: '', text: '' },
  ...over,
})

let mounted: VueWrapper | null = null
let pinia = createPinia()

const mountForm = async (value: BaseUser, props: Record<string, unknown> = {}) => {
  mounted = mount(AUserMetadataForm, {
    global: { plugins: [pinia] },
    props: { user: value, ...props },
  })
  await flushPromises()
  return mounted
}

const input = (wrapper: VueWrapper, cy: string) => wrapper.get(`[data-cy="${cy}"] input`)
const value = (wrapper: VueWrapper, cy: string) => (input(wrapper, cy).element as HTMLInputElement).value

beforeEach(() => {
  pinia = createPinia()
  setActivePinia(pinia)
})

afterEach(() => {
  mounted?.unmount()
  mounted = null
})

describe('AUserMetadataForm derived fields', () => {
  it('fills the full name and the initials from the names', async () => {
    const wrapper = await mountForm(user())

    await input(wrapper, 'user-firstName').setValue('Jozef')
    await input(wrapper, 'user-lastName').setValue('Mrkvicka')
    await flushPromises()

    expect(value(wrapper, 'user-fullName')).toBe('Jozef Mrkvicka')
    expect(value(wrapper, 'user-avatarText')).toBe('JM')
  })

  it('keeps recomputing while nobody has touched them', async () => {
    const wrapper = await mountForm(user())

    await input(wrapper, 'user-firstName').setValue('Jozef')
    await input(wrapper, 'user-lastName').setValue('Mrkvicka')
    await input(wrapper, 'user-lastName').setValue('Novak')
    await flushPromises()

    expect(value(wrapper, 'user-fullName')).toBe('Jozef Novak')
    expect(value(wrapper, 'user-avatarText')).toBe('JN')
  })

  it('stops recomputing the moment the field is edited by hand', async () => {
    const wrapper = await mountForm(user())

    await input(wrapper, 'user-firstName').setValue('Jozef')
    await input(wrapper, 'user-lastName').setValue('Mrkvicka')
    await input(wrapper, 'user-fullName').setValue('Dr. Jozef Mrkvicka')
    await input(wrapper, 'user-lastName').setValue('Novak')
    await flushPromises()

    expect(value(wrapper, 'user-fullName')).toBe('Dr. Jozef Mrkvicka')
    // The initials were not touched, so they still follow.
    expect(value(wrapper, 'user-avatarText')).toBe('JN')
  })

  it('treats a stored value that differs from the names as set on purpose', async () => {
    // The cms fixture: a full name nobody would derive from those two names.
    const wrapper = await mountForm(user({ person: { firstName: 'Anzu', lastName: 'User 1', fullName: 'Anzu User1' } }))

    await input(wrapper, 'user-firstName').setValue('Anzu2')
    await flushPromises()

    expect(value(wrapper, 'user-fullName')).toBe('Anzu User1')
  })

  it('goes on deriving a stored value that matches what the names produce', async () => {
    const wrapper = await mountForm(
      user({ person: { firstName: 'Jozef', lastName: 'Mrkvicka', fullName: 'Jozef Mrkvicka' } })
    )

    await input(wrapper, 'user-lastName').setValue('Novak')
    await flushPromises()

    expect(value(wrapper, 'user-fullName')).toBe('Jozef Novak')
  })

  it('says where the value comes from until it is edited', async () => {
    const wrapper = await mountForm(user())

    expect(wrapper.text()).toContain('Derived from the first and last name.')

    await input(wrapper, 'user-fullName').setValue('Something else')
    await input(wrapper, 'user-avatarText').setValue('XX')
    await flushPromises()

    expect(wrapper.text()).not.toContain('Derived from the first and last name.')
  })

  it('writes nothing while readonly, which is what makes one component serve detail too', async () => {
    // `randomColor: true` on purpose. Without it the colour picker's watcher never reaches the
    // branch that writes, so the assertion below would hold with or without the guard -- which is
    // what the test used to do.
    const value = user({ person: { firstName: 'Jozef', lastName: 'Mrkvicka', fullName: 'Jozef Mrkvicka' } })
    const wrapper = await mountForm(value, { readonly: true, randomColor: true })

    expect(wrapper.find('[data-cy="user-firstName"] input').exists()).toBe(false)
    expect(wrapper.text()).toContain('Jozef Mrkvicka')
    // The watcher is `immediate`, so an empty colour would be filled in on open and the page would
    // report unsaved changes before anyone touched anything.
    expect(value.avatar.color).toBe('')
  })

  it('does fill an empty colour where the form is editable, which is the behaviour being guarded', async () => {
    // The other half of the pair: a guard nothing would trip is a guard nothing proves.
    const value = user()
    await mountForm(value, { randomColor: true })
    await flushPromises()

    expect(value.avatar.color).toMatch(/^#[0-9A-Fa-f]{6}$/)
  })

  it('hands the typed id back as a number, not as the string the input holds', async () => {
    // Vue applies model modifiers inside `emit`, so `.number` is not decoration on a component:
    // without it the create body carries `"id": "42"` against a declared `IntegerIdNullable`.
    const value = user({ id: null })
    const wrapper = await mountForm(value, { idInput: true, isEdit: false })

    const idInput = wrapper.findAll('input').find((input) => input.attributes('type') === 'number')!
    await idInput.setValue('42')
    await flushPromises()

    expect(value.id).toBe(42)
  })
})

describe('AUserMetadataForm id field', () => {
  it('is a field while creating where the id is typed in', async () => {
    const wrapper = await mountForm(user({ id: null }), { idInput: true, isEdit: false })

    expect(wrapper.text()).toContain('ID')
    expect(wrapper.findAll('input').some((i) => i.attributes('type') === 'number')).toBe(true)
  })

  it('is read-only on an edit, because it is the key every other system looks this person up by', async () => {
    const wrapper = await mountForm(user({ id: 42 }), { idInput: true, isEdit: true })

    expect(wrapper.findAll('input').some((i) => i.attributes('type') === 'number')).toBe(false)
    expect(wrapper.text()).toContain('42')
  })

  it('is not drawn at all where the backend resolves it from SSO', async () => {
    const wrapper = await mountForm(user({ id: null }), { idInput: false, isEdit: false })

    expect(wrapper.findAll('input').some((i) => i.attributes('type') === 'number')).toBe(false)
  })
})

describe('AUserMetadataForm note', () => {
  it('shows the system note, so the operator is told what will not be written', async () => {
    const wrapper = await mountForm(user(), {
      note: 'Blog has its own first and last name -- those do not change.',
    })

    expect(wrapper.text()).toContain('Blog has its own first and last name')
  })
})
