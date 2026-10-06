import { afterEach, describe, expect, it } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import useVuelidate from '@vuelidate/core'
import { defineComponent, h } from 'vue'
import ACustomDataForm from '@/domains/customDataForm/components/ACustomDataForm.vue'
import ACustomDataFormHiddenPart from '@/domains/customDataForm/components/ACustomDataFormHiddenPart.vue'
import { useCustomDataForm } from '@/domains/customDataForm/composables/useCustomDataForm'
import type { CustomDataFormElement } from '@/domains/customDataForm/types/CustomDataForm'
import { CustomDataFormElementType } from '@/domains/customDataForm/types/CustomDataFormElementTypes'

const wrappers: VueWrapper[] = []
afterEach(() => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount())
  // "Show all" is one choice for every form.
  useCustomDataForm().showAll.value = false
})

const element = (
  property: string,
  position: number,
  attributes: Partial<CustomDataFormElement['attributes']> = {}
): CustomDataFormElement => ({
  id: property,
  property,
  name: property,
  position,
  attributes: {
    type: CustomDataFormElementType.String,
    minValue: null,
    maxValue: null,
    minCount: null,
    maxCount: null,
    required: true,
    searchable: false,
    readonly: false,
    ...attributes,
  },
})

const SCOPE = 'customDataFormTest'
type Values = Record<string, unknown>
const props = (modelValue: Values, elements = [element('pinned', 1), element('other', 2)]) => ({
  modelValue,
  elements,
  pinnedCount: 1,
  validationScope: SCOPE,
})
const mountForm = (formProps: ReturnType<typeof props>) => {
  const wrapper = mount(ACustomDataForm, { attachTo: document.body, props: formProps })
  wrappers.push(wrapper)
  return wrapper
}
const validate = (wrapper: VueWrapper) => (wrapper.vm as unknown as { validate: () => Promise<boolean> }).validate()
// The block of the elements behind "show all".
const hiddenPart = (wrapper: VueWrapper) => wrapper.findComponent(ACustomDataFormHiddenPart)
const toggleButton = (wrapper: VueWrapper) => wrapper.find('button').element as HTMLButtonElement
const toggle = async (wrapper: VueWrapper) => {
  await wrapper.find('button').trigger('click')
  await flushPromises()
}

describe('ACustomDataForm: the elements behind "show all"', () => {
  // They are rendered too, hidden: a save has to answer for them as well.
  it('are validated under a named scope', async () => {
    const wrapper = mountForm(props({ pinned: 'filled', other: '' }))
    await flushPromises()
    expect(await validate(wrapper)).toBe(false)

    await wrapper.setProps({ modelValue: { pinned: 'filled', other: 'filled' } })
    await flushPromises()
    expect(await validate(wrapper)).toBe(true)
  })

  it('are shown when one of them fails the form’s own validate(), with its message', async () => {
    const wrapper = mountForm(props({ pinned: 'filled', other: '' }))
    await flushPromises()
    expect(hiddenPart(wrapper).isVisible()).toBe(false)

    await validate(wrapper)
    await flushPromises()
    expect(hiddenPart(wrapper).isVisible()).toBe(true)
    expect(hiddenPart(wrapper).find('.v-messages').text()).not.toBe('')
  })

  // How the pages save: a collector of the same scope above the form is touched.
  it('are shown when the collector above the form is touched and one of them is invalid', async () => {
    let touch!: () => void
    const Page = defineComponent({
      setup() {
        const v$ = useVuelidate({ $scope: SCOPE })
        touch = () => v$.value.$touch()
        return () => h(ACustomDataForm, props({ pinned: 'filled', other: '' }))
      },
    })
    const wrapper = mount(Page, { attachTo: document.body })
    wrappers.push(wrapper)
    await flushPromises()
    expect(hiddenPart(wrapper).isVisible()).toBe(false)

    touch()
    await flushPromises()
    expect(hiddenPart(wrapper).isVisible()).toBe(true)
  })

  it('cannot be hidden while one of them fails, stay open once it is fixed, and can be hidden then', async () => {
    const wrapper = mountForm(props({ pinned: 'filled', other: '' }))
    await flushPromises()
    expect(toggleButton(wrapper).disabled).toBe(false)
    await validate(wrapper)
    await flushPromises()

    // A press that did nothing would say nothing: the button is disabled instead.
    expect(toggleButton(wrapper).disabled).toBe(true)
    // A second save that fails finds it open.
    expect(await validate(wrapper)).toBe(false)
    expect(hiddenPart(wrapper).isVisible()).toBe(true)

    await wrapper.setProps({ modelValue: { pinned: 'filled', other: 'filled' } })
    await flushPromises()
    expect(hiddenPart(wrapper).isVisible()).toBe(true)
    expect(toggleButton(wrapper).disabled).toBe(false)

    await toggle(wrapper)
    expect(hiddenPart(wrapper).isVisible()).toBe(false)
  })

  // Without a save: the user opened them, left one of two invalid, and reaches for "hide".
  it('cannot be hidden while one of them shows a message, also when the others were never touched', async () => {
    const wrapper = mountForm(
      props({ pinned: 'filled', first: '', second: '' }, [
        element('pinned', 1),
        element('first', 2),
        element('second', 3),
      ])
    )
    await flushPromises()
    await toggle(wrapper)
    expect(hiddenPart(wrapper).isVisible()).toBe(true)
    expect(toggleButton(wrapper).disabled).toBe(false)

    await hiddenPart(wrapper).find('textarea').trigger('blur')
    await flushPromises()
    expect(hiddenPart(wrapper).find('.v-messages').text()).not.toBe('')
    expect(toggleButton(wrapper).disabled).toBe(true)
  })

  it('stay hidden when a save passes, and when what fails is a pinned element', async () => {
    const passing = mountForm(props({ pinned: 'filled', other: 'filled' }))
    const pinnedFails = mountForm(props({ pinned: '', other: 'filled' }))
    await flushPromises()
    expect([await validate(passing), await validate(pinnedFails)]).toEqual([true, false])
    await flushPromises()
    expect([hiddenPart(passing).isVisible(), hiddenPart(pinnedFails).isVisible()]).toEqual([false, false])

    // After a save, an edit that makes a pinned element invalid does not open them either.
    await passing.setProps({ modelValue: { pinned: '', other: 'filled' } })
    await flushPromises()
    expect(hiddenPart(passing).isVisible()).toBe(false)
  })

  it('are opened for every form by the button, and by a failure only in the form it is in', async () => {
    const first = mountForm(props({ pinned: 'filled', other: '' }))
    const second = mountForm(props({ pinned: 'filled', other: 'filled' }))
    await flushPromises()

    await validate(first)
    await flushPromises()
    expect([hiddenPart(first).isVisible(), hiddenPart(second).isVisible()]).toEqual([true, false])

    await toggle(second)
    expect([hiddenPart(first).isVisible(), hiddenPart(second).isVisible()]).toEqual([true, true])
  })

  // "Hide" is one choice for every form, as "show all" is.
  it('are hidden by the button in every form that shows no error, and stay open in one that does', async () => {
    const fixed = mountForm(props({ pinned: 'filled', other: '' }))
    const failing = mountForm(props({ pinned: 'filled', other: '' }))
    const pressed = mountForm(props({ pinned: 'filled', other: 'filled' }))
    await flushPromises()
    await validate(fixed)
    await validate(failing)
    await fixed.setProps({ modelValue: { pinned: 'filled', other: 'filled' } })
    await toggle(pressed)
    const visible = () => [fixed, failing, pressed].map((wrapper) => hiddenPart(wrapper).isVisible())
    expect(visible()).toEqual([true, true, true])

    await toggle(pressed)
    expect(visible()).toEqual([false, true, false])
    // "Show all" is off for the page: once fixed, the one left open is hidden by its own button.
    await failing.setProps({ modelValue: { pinned: 'filled', other: 'filled' } })
    await flushPromises()
    await toggle(failing)
    expect(visible()).toEqual([false, false, false])
  })

  it('are counted once each by a collector without a scope above the form', async () => {
    let failing!: () => number
    const Page = defineComponent({
      setup() {
        const v$ = useVuelidate()
        failing = () => {
          v$.value.$touch()
          return v$.value.$errors.length
        }
        return () => h(ACustomDataForm, props({ pinned: '', other: '' }))
      },
    })
    const wrapper = mount(Page, { attachTo: document.body })
    wrappers.push(wrapper)
    await flushPromises()
    expect(failing()).toBe(2)
  })
})

describe('ACustomDataForm: what an element validates', () => {
  // The user cannot change it, and the server does not validate it.
  it('nothing, when it is read-only', async () => {
    const wrapper = mountForm(
      props({ pinned: 'filled', other: '' }, [element('pinned', 1), element('other', 2, { readonly: true })])
    )
    await flushPromises()
    expect(await validate(wrapper)).toBe(true)
  })

  it('a number that is cleared is no value: an optional one can be emptied, a required one says so', async () => {
    const number = (required: boolean) =>
      element('count', 1, { type: CustomDataFormElementType.Integer, required, minValue: 1, maxValue: 10 })
    const optional = mountForm(props({ count: 5 }, [number(false)]))
    await flushPromises()
    await optional.find('input').setValue('')
    await flushPromises()
    const emitted = optional.emitted('update:modelValue')!.at(-1)![0] as Values
    expect(emitted.count).toBeNull()

    await optional.setProps({ modelValue: emitted })
    await flushPromises()
    expect(await validate(optional)).toBe(true)

    const required = mountForm(props({ count: null }, [number(true)]))
    await flushPromises()
    expect(await validate(required)).toBe(false)
  })

  it('a required switch that was never set shows its message', async () => {
    const wrapper = mountForm(props({}, [element('agreed', 1, { type: CustomDataFormElementType.Boolean })]))
    await flushPromises()
    expect(await validate(wrapper)).toBe(false)
    await flushPromises()
    expect(wrapper.find('.v-messages').text()).not.toBe('')

    await wrapper.setProps({ modelValue: { agreed: false } })
    await flushPromises()
    expect(await validate(wrapper)).toBe(true)
  })
})
