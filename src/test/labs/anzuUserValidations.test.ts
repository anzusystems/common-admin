import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { defineComponent, h, ref } from 'vue'
import { useUserMetadataValidation, type UserMetadataValidationOptions } from '@/labs/anzuUser/anzuUserValidations'
import type { BaseUser } from '@/types/AnzuUser'

// Decision 29: how strict the form is, is a property of the system, and the same one for creating
// and for editing. Two profiles only -- e-mail alone, or the full set.

const user = (over: Partial<BaseUser> = {}): BaseUser => ({
  id: 1,
  email: 'jozef@sme.sk',
  person: { firstName: '', lastName: '', fullName: '' },
  avatar: { color: '', text: '' },
  ...over,
})

let mounted: VueWrapper | null = null

const validate = (value: BaseUser, options: Partial<UserMetadataValidationOptions> = {}) => {
  const Harness = defineComponent({
    setup(_props, { expose }) {
      const model = ref(value)
      const { v$ } = useUserMetadataValidation(model, {
        required: false,
        idInput: true,
        isEdit: false,
        ...options,
      })
      // Exposed through a getter: `expose` unwraps refs on the proxy, and a plain `v$` would
      // arrive as the validation object in some paths and as a ref in others.
      expose({ validation: () => v$.value })
      return () => h('div')
    },
  })
  mounted = mount(Harness)
  const v$ = (mounted.vm as unknown as { validation: () => any }).validation()
  v$.$touch()
  return v$
}

beforeEach(() => {
  setActivePinia(createPinia())
})

afterEach(() => {
  mounted?.unmount()
  mounted = null
})

describe('user metadata validation profiles', () => {
  it('requires only the e-mail on the loose profile', () => {
    const v$ = validate(user(), { required: false })

    expect(v$.$invalid).toBe(false)
  })

  it('requires the whole set on the strict profile', () => {
    const v$ = validate(user(), { required: true })

    expect(v$.user.person.firstName.$invalid).toBe(true)
    expect(v$.user.person.lastName.$invalid).toBe(true)
    expect(v$.user.person.fullName.$invalid).toBe(true)
    expect(v$.user.avatar.text.$invalid).toBe(true)
    expect(v$.user.avatar.color.$invalid).toBe(true)
  })

  it('passes the strict profile once every field is filled', () => {
    const v$ = validate(
      user({
        person: { firstName: 'Jozef', lastName: 'Mrkvicka', fullName: 'Jozef Mrkvicka' },
        avatar: { color: '#4CAF50', text: 'JM' },
      }),
      { required: true }
    )

    expect(v$.$invalid).toBe(false)
  })

  it('rejects an e-mail the backend would reject', () => {
    expect(validate(user({ email: 'not-an-email' })).user.email.$invalid).toBe(true)
    expect(validate(user({ email: '' })).user.email.$invalid).toBe(true)
  })

  it('checks the colour by shape, not by length', () => {
    // Seven characters and still not a colour. The admins' `minLength(7)` let this through and the
    // server answered 422.
    expect(validate(user({ avatar: { color: '#GGGGGG', text: '' } })).user.avatar.color.$invalid).toBe(true)
    expect(validate(user({ avatar: { color: '#4CAF50', text: '' } })).user.avatar.color.$invalid).toBe(false)
  })

  it('accepts an empty colour where the profile does not ask for one', () => {
    expect(validate(user(), { required: false }).user.avatar.color.$invalid).toBe(false)
  })

  it('asks for the id while creating where it is typed in, and never on an edit', () => {
    const creating = validate(user({ id: null }), { idInput: true, isEdit: false })
    expect(creating.user.id.$invalid).toBe(true)

    // cms: the backend resolves the id from SSO, so the form does not ask.
    const cmsCreating = validate(user({ id: null }), { idInput: false, isEdit: false })
    expect(cmsCreating.user.id.$invalid).toBe(false)

    // On an edit it is a primary key on display.
    const editing = validate(user({ id: null }), { idInput: true, isEdit: true })
    expect(editing.user.id.$invalid).toBe(false)
  })

  it('keeps the backend length limits', () => {
    expect(validate(user({ email: 'a'.repeat(250) + '@sme.sk' })).user.email.$invalid).toBe(true)
    expect(
      validate(user({ person: { firstName: 'a'.repeat(121), lastName: '', fullName: '' } })).user.person.firstName
        .$invalid
    ).toBe(true)
    expect(validate(user({ avatar: { color: '', text: 'ABCD' } })).user.avatar.text.$invalid).toBe(true)
  })
})
