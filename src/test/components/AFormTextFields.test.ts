import { afterEach, describe, expect, it } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { computed, defineComponent, h, nextTick, ref } from 'vue'
import useVuelidate from '@vuelidate/core'
import { maxLength, minLength, required, requiredIf, helpers } from '@vuelidate/validators'
import AFormTextField from '@/components/form/AFormTextField.vue'
import AFormTextarea from '@/components/form/AFormTextarea.vue'
import { SubjectScopeKey, SystemScopeKey } from '@/components/injectionKeys'

// Both fields share their label, required-star and error logic, so each case runs on both.
const FIELDS = [
  ['AFormTextField', AFormTextField, 'input'],
  ['AFormTextarea', AFormTextarea, 'textarea'],
] as const

const wrappers: VueWrapper[] = []
afterEach(() => {
  wrappers.splice(0).forEach((w) => w.unmount())
})

type Opts = {
  field: unknown
  rules?: Record<string, unknown>
  props?: Record<string, unknown>
  initial?: string | null
  scope?: boolean
}

/** A parent that owns a vuelidate state `{ article: { title } }` and renders the field on it. */
const mountField = ({ field, rules = {}, props = {}, initial = '', scope = true }: Opts) => {
  const state = ref({ article: { title: initial as string | null } })
  let v$: any
  const Parent = defineComponent({
    setup() {
      v$ = useVuelidate(
        computed(() => ({ article: { title: rules } })),
        state
      )
      return () =>
        h(field as never, {
          modelValue: state.value.article.title,
          'onUpdate:modelValue': (value: string) => (state.value.article.title = value),
          v: v$.value.article.title,
          ...props,
        })
    },
  })
  const wrapper = mount(Parent, {
    attachTo: document.body,
    global: {
      provide: scope ? { [SystemScopeKey as symbol]: 'cms', [SubjectScopeKey as symbol]: 'article' } : {},
      mocks: {},
    },
  })
  wrappers.push(wrapper)
  return { wrapper, state, v$: () => v$.value, child: wrapper.findComponent(field as never) as VueWrapper<any> }
}

const labelText = (w: VueWrapper) => w.find('label').text()

describe.each(FIELDS)('%s', (_name, field, tag) => {
  it('reads the label from the scope and the vuelidate path', () => {
    const { wrapper } = mountField({ field })
    // `t` answers the key itself for a missing message: the path is what is under test.
    expect(labelText(wrapper)).toBe('cms.article.model.title')
  })

  it('prefers an explicit label', () => {
    const { wrapper } = mountField({ field, props: { label: 'Headline' } })
    expect(labelText(wrapper)).toBe('Headline')
  })

  it('answers an empty label without a scope', () => {
    const { wrapper } = mountField({ field, scope: false })
    expect(labelText(wrapper)).toBe('')
  })

  it('hides the label on request', () => {
    const { wrapper } = mountField({ field, props: { hideLabel: true } })
    expect(wrapper.find('label').exists() && labelText(wrapper).length > 0).toBe(false)
  })

  it('stars a field with a `required` rule', () => {
    const { wrapper } = mountField({ field, rules: { required } })
    expect(wrapper.find('label .a-required-mark').exists()).toBe(true)
  })

  it('does not star requiredIf or other rules', () => {
    const { wrapper } = mountField({ field, rules: { requiredIf: requiredIf(true), minLength: minLength(2) } })
    expect(wrapper.find('label .a-required-mark').exists()).toBe(false)
  })

  it('lets the required prop win', () => {
    const { wrapper } = mountField({ field, rules: { required }, props: { required: false } })
    expect(wrapper.find('label .a-required-mark').exists()).toBe(false)
  })

  it('shows no error before the field is touched, and every error after', async () => {
    const withMessage = (msg: string, rule: unknown) => helpers.withMessage(msg, rule as never)
    const { wrapper } = mountField({
      field,
      initial: 'x',
      rules: { minLength: withMessage('Too short.', minLength(3)), other: withMessage('Bad.', () => false) },
    })
    expect(wrapper.find('.v-messages').text()).toBe('')
    await wrapper.find(tag).trigger('blur')
    await flushPromises()
    expect(wrapper.find('.v-messages').text()).toBe('Too short. Bad.')
  })

  it('lets an explicit errorMessage win', async () => {
    const { wrapper } = mountField({ field, rules: { required }, props: { errorMessage: 'Server says no.' } })
    await flushPromises()
    expect(wrapper.find('.v-messages').text()).toBe('Server says no.')
  })

  it('emits update, focus and blur with the current value, and touches on blur', async () => {
    const { wrapper, child, state, v$ } = mountField({ field, initial: 'ab', rules: { maxLength: maxLength(10) } })
    const input = wrapper.find(tag)
    await input.trigger('focus')
    ;(input.element as HTMLInputElement).value = 'abc'
    await input.trigger('input')
    await input.trigger('blur')
    expect(child.emitted('update:modelValue')?.at(-1)).toEqual(['abc'])
    expect(state.value.article.title).toBe('abc')
    expect(child.emitted('focus')?.[0]).toEqual(['ab'])
    expect(child.emitted('blur')?.[0]).toEqual(['abc'])
    expect(v$().article.title.$dirty).toBe(true)
  })

  it('renders diacritics as given', async () => {
    const { wrapper } = mountField({ field, initial: 'Žltý kôň' })
    await nextTick()
    expect((wrapper.find(tag).element as HTMLInputElement).value).toBe('Žltý kôň')
  })

  it('renders null as empty', () => {
    const { wrapper } = mountField({ field, initial: null })
    expect((wrapper.find(tag).element as HTMLInputElement).value).toBe('')
  })

  it('disables on request', () => {
    const { wrapper } = mountField({ field, props: { disabled: true } })
    expect((wrapper.find(tag).element as HTMLInputElement).disabled).toBe(true)
  })

  // No trimming (owner decision): the value is emitted as typed.
  it('emits the value untrimmed', async () => {
    const { wrapper, child } = mountField({ field })
    const input = wrapper.find(tag)
    ;(input.element as HTMLInputElement).value = '  padded  '
    await input.trigger('input')
    expect(child.emitted('update:modelValue')?.at(-1)).toEqual(['  padded  '])
  })
})

describe('AFormTextField only', () => {
  it('passes type, maxlength and placeholder to the input', () => {
    const { wrapper } = mountField({
      field: AFormTextField,
      props: { type: 'number', maxlength: 5, placeholder: 'e.g. 3', persistentPlaceholder: true },
    })
    const input = wrapper.find('input').element as HTMLInputElement
    expect(input.type).toBe('number')
    expect(input.maxLength).toBe(5)
    expect(input.placeholder).toBe('e.g. 3')
  })

  it('exposes focus', async () => {
    const { wrapper, child } = mountField({ field: AFormTextField })
    child.vm.focus()
    await nextTick()
    expect(document.activeElement).toBe(wrapper.find('input').element)
  })
})

describe('AFormTextarea only', () => {
  it('counts against a suggested length and warns past it', async () => {
    const { wrapper } = mountField({ field: AFormTextarea, initial: 'abcdef', props: { suggestedLength: 5 } })
    await wrapper.find('textarea').trigger('focus')
    await flushPromises()
    const counter = wrapper.find('.v-counter')
    expect(counter.text()).toBe('6 / max 5')
    expect(counter.find('.text-warning').exists()).toBe(true)
  })

  it('does not warn at the suggested length', async () => {
    const { wrapper } = mountField({ field: AFormTextarea, initial: 'abcde', props: { suggestedLength: 5 } })
    await wrapper.find('textarea').trigger('focus')
    await flushPromises()
    expect(wrapper.find('.v-counter .text-warning').exists()).toBe(false)
  })

  it('counts characters of text with diacritics', async () => {
    const { wrapper } = mountField({ field: AFormTextarea, initial: 'žťč', props: { suggestedLength: 5 } })
    await wrapper.find('textarea').trigger('focus')
    await flushPromises()
    expect(wrapper.find('.v-counter').text()).toBe('3 / max 5')
  })

  it('starts with the given rows', () => {
    const { wrapper } = mountField({ field: AFormTextarea, props: { rows: 4 } })
    expect(wrapper.find('textarea').attributes('rows')).toBe('4')
  })
})
