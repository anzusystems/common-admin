import { describe, it, expect, vi, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, h, nextTick, ref } from 'vue'
import { userEvent } from 'vitest/browser'
import { VAutocomplete } from 'vuetify/components'
import AFormValueObjectOptionsSelect from '@/components/form/AFormValueObjectOptionsSelect.vue'
import type { ValueObjectOption } from '@/types/ValueObject'

vi.mock('@/components/collab/composables/commonAdminCollabOptions', () => ({
  useCommonAdminCollabOptions: () => ({
    collabOptions: ref<{ enabled: boolean }>({ enabled: false }),
  }),
}))

vi.mock('@/components/collab/composables/collabField', () => ({
  useCollabField: () => ({
    releaseCollabFieldLock: vi.fn(),
    changeCollabFieldData: vi.fn(),
    acquireCollabFieldLock: vi.fn(),
    lockedByUser: ref<null>(null),
  }),
}))

// A list with no reading for null: bound to a non-nullable backend enum.
const items: ValueObjectOption<string>[] = [
  { value: 'none', title: 'None' },
  { value: 'gallery', title: 'Gallery' },
  { value: 'video', title: 'Video' },
]

// A tri-state list, where null is one of the three answers rather than the absence of one.
const triStateItems: ValueObjectOption<boolean | null>[] = [
  { value: null, title: 'By system' },
  { value: true, title: 'Yes' },
  { value: false, title: 'No' },
]

// Every mount attaches to the body for the teleported menu, so each one is torn down again: a
// wrapper left mounted keeps its overlay in the document and the next `.v-overlay--active` query
// then reads the previous test's menu.
const mounted: { unmount: () => void }[] = []

// A parent that writes back what the select emits, so a swallowed emit shows up the way the user
// sees it: the field paints the old value back.
const factory = (props: Record<string, unknown> = {}) => {
  const model = ref<unknown>(props.modelValue)
  const emitted: unknown[] = []
  const Host = defineComponent({
    setup() {
      return () =>
        h(AFormValueObjectOptionsSelect, {
          items,
          ...props,
          modelValue: model.value,
          'onUpdate:modelValue': (value: unknown) => {
            emitted.push(value)
            model.value = value
          },
        })
    },
  })
  const wrapper = mount(Host, { attachTo: document.body })
  mounted.push(wrapper)
  return { wrapper, model, emitted }
}

const triStateFactory = (props: Record<string, unknown> = {}) =>
  factory({ items: triStateItems, ...props })

const flush = async () => {
  await nextTick()
  await new Promise((resolve) => setTimeout(resolve, 50))
  await nextTick()
}

type Wrapper = ReturnType<typeof factory>['wrapper']

const inputOf = (wrapper: Wrapper) => wrapper.find('input').element as HTMLInputElement

// VAutocomplete fills the input with the selected title on focus, and clears its selection once
// that text is gone. Real key presses, because a synthetic input event takes a different path
// through Vuetify than a held backspace does.
const backspaceOverTheField = async (wrapper: Wrapper) => {
  const input = inputOf(wrapper)
  await userEvent.click(input)
  await flush()
  for (let press = 0; press < 12; press++) await userEvent.keyboard('{Backspace}')
  await flush()
  expect(input.value, 'the search text is emptied').toBe('')
  return input
}

// VMenu teleports its content, so the options are queried from the document, not from the wrapper.
const openMenu = async (wrapper: Wrapper) => {
  const field = wrapper.find('.v-field')
  await field.trigger('mousedown')
  await field.trigger('click')
  await flush()
}

const optionTitles = () =>
  Array.from(document.querySelectorAll<HTMLElement>('.v-overlay--active .v-list-item')).map(
    (item) => item.textContent?.trim() ?? '',
  )

const clickOption = async (title: string) => {
  const option = Array.from(
    document.querySelectorAll<HTMLElement>('.v-overlay--active .v-list-item'),
  ).find((item) => item.textContent?.trim() === title)
  expect(option, `option "${title}" is offered in the menu`).toBeTruthy()
  option?.click()
  await flush()
}

const selectionText = (wrapper: Wrapper) => wrapper.find('.v-field__input').text()

describe('AFormValueObjectOptionsSelect', () => {
  afterEach(() => {
    mounted.splice(0).forEach((wrapper) => wrapper.unmount())
    document.querySelectorAll('.v-overlay-container').forEach((node) => node.remove())
  })

  describe('a non-clearable list that does not offer null', () => {
    // Regression: emptying the search text emitted null, and bound to a non-nullable backend enum
    // that null poisoned the model — core-cms then 500'd on every following save.
    it('emits nothing when the user backspaces over the field', async () => {
      const { wrapper, model, emitted } = factory({ modelValue: 'gallery' })

      await backspaceOverTheField(wrapper)

      expect(emitted).toEqual([])
      expect(model.value).toBe('gallery')
    })

    it('paints the value back after the blur that follows', async () => {
      const { wrapper, model } = factory({ modelValue: 'gallery' })

      const input = await backspaceOverTheField(wrapper)
      input.blur()
      await flush()

      expect(model.value).toBe('gallery')
      expect(selectionText(wrapper)).toBe('Gallery')
    })

    // One press past empty leaves Vuetify holding a stale selectionIndex, because the refused null
    // kept its selection alive. That costs the typed search term on the next Backspace — a Vuetify
    // bug we cannot reach from here — but the model must survive the sequence either way.
    it('keeps the value when the user backspaces past empty', async () => {
      const { wrapper, model, emitted } = factory({ modelValue: 'gallery' })

      const input = inputOf(wrapper)
      await userEvent.click(input)
      await flush()
      for (let press = 0; press < 8; press++) await userEvent.keyboard('{Backspace}')
      await flush()

      expect(input.value).toBe('')
      expect(emitted).toEqual([])
      expect(model.value).toBe('gallery')
    })

    it('drops a null pushed up by the inner autocomplete', async () => {
      const { wrapper, emitted } = factory({ modelValue: 'gallery' })

      wrapper.findComponent(VAutocomplete).vm.$emit('update:modelValue', null)
      await flush()

      expect(emitted).toEqual([])
    })

    it('still emits a real selection', async () => {
      const { wrapper, model } = factory({ modelValue: 'gallery' })

      await openMenu(wrapper)
      await clickOption('Video')

      expect(model.value).toBe('video')
      expect(selectionText(wrapper)).toBe('Video')
    })

    it('still emits a selection the user retyped their way to', async () => {
      const { wrapper, model } = factory({ modelValue: 'gallery' })

      await backspaceOverTheField(wrapper)
      await userEvent.keyboard('Vid')
      await flush()
      await userEvent.keyboard('{ArrowDown}{Enter}')
      await flush()

      expect(model.value).toBe('video')
    })
  })

  describe('a tri-state list, where null is an offered option', () => {
    it('offers all three options', async () => {
      const { wrapper } = triStateFactory({ modelValue: true })

      await openMenu(wrapper)

      expect(optionTitles()).toEqual(['By system', 'Yes', 'No'])
    })

    // Regression: the null-swallowing guard ate this pick too, so the field snapped back to Yes.
    it('emits null when the user picks the null option over true', async () => {
      const { wrapper, model } = triStateFactory({ modelValue: true })

      await openMenu(wrapper)
      await clickOption('By system')

      expect(model.value).toBeNull()
      expect(selectionText(wrapper)).toBe('By system')
    })

    it('keeps the picked null option through the blur that follows', async () => {
      const { wrapper, model } = triStateFactory({ modelValue: false })

      await openMenu(wrapper)
      await clickOption('By system')
      inputOf(wrapper).blur()
      await flush()

      expect(model.value).toBeNull()
      expect(selectionText(wrapper)).toBe('By system')
    })

    it('emits false when the user picks the false option over null', async () => {
      const { wrapper, model } = triStateFactory({ modelValue: null })

      await openMenu(wrapper)
      await clickOption('No')

      expect(model.value).toBe(false)
      expect(selectionText(wrapper)).toBe('No')
    })

    it('emits true when the user picks the true option over null', async () => {
      const { wrapper, model } = triStateFactory({ modelValue: null })

      await openMenu(wrapper)
      await clickOption('Yes')

      expect(model.value).toBe(true)
      expect(selectionText(wrapper)).toBe('Yes')
    })

    it('renders the null option as the selected one', async () => {
      const { wrapper } = triStateFactory({ modelValue: null })
      await flush()

      expect(selectionText(wrapper)).toBe('By system')
    })

    it('renders the false option as the selected one', async () => {
      const { wrapper } = triStateFactory({ modelValue: false })
      await flush()

      expect(selectionText(wrapper)).toBe('No')
    })

    // The trade of the rule above: a list that offers null cannot tell Vuetify's own clear-on-empty
    // apart from a pick, and null is a legal answer here, so the backspace lands as "By system".
    it('lands on the null option when the user backspaces over the field', async () => {
      const { wrapper, model } = triStateFactory({ modelValue: true })

      await backspaceOverTheField(wrapper)

      expect(model.value).toBeNull()
    })

    it('offers null through a bare item list too', async () => {
      const { wrapper, model } = factory({ modelValue: 'gallery', items: ['gallery', null] })

      await backspaceOverTheField(wrapper)

      expect(model.value).toBeNull()
    })
  })

  describe('when clearing is what the user asked for', () => {
    it('emits null from the clear button', async () => {
      const { wrapper, model } = triStateFactory({ modelValue: true, clearable: true })
      await flush()

      const clearIcon = wrapper.find('.v-field__clearable .v-icon').element as HTMLElement
      clearIcon.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
      clearIcon.click()
      await flush()

      expect(model.value).toBeNull()
    })

    it('emits null when a clearable select is backspaced empty', async () => {
      const { wrapper, model } = factory({ modelValue: 'gallery', clearable: true })

      await backspaceOverTheField(wrapper)

      expect(model.value).toBeNull()
    })

    it('emits null with multiple', async () => {
      const { wrapper, emitted } = factory({ modelValue: ['none'], multiple: true })

      wrapper.findComponent(VAutocomplete).vm.$emit('update:modelValue', null)
      await flush()

      expect(emitted).toEqual([null])
    })
  })
})
