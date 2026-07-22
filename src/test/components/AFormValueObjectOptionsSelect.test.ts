import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick, ref } from 'vue'
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

const items: ValueObjectOption<string>[] = [
  { value: 'none', title: 'None' },
  { value: 'gallery', title: 'Gallery' },
  { value: 'video', title: 'Video' },
]

const factory = (props: Record<string, unknown> = {}) =>
  mount(AFormValueObjectOptionsSelect, {
    props: { modelValue: 'none', items, ...props },
    attachTo: document.body,
  })

const flush = async () => {
  await nextTick()
  await new Promise((resolve) => setTimeout(resolve, 50))
  await nextTick()
}

describe('AFormValueObjectOptionsSelect', () => {
  describe('when clearable is false (default)', () => {
    it('swallows a null coming from the inner VAutocomplete', async () => {
      const wrapper = factory()

      wrapper.findComponent(VAutocomplete).vm.$emit('update:modelValue', null)
      await flush()

      expect(wrapper.emitted('update:modelValue')).toBeUndefined()
    })

    // Regression: a non-clearable select bound to a non-nullable backend enum used to emit null
    // as soon as the user emptied the search text, which then failed API deserialization.
    it('keeps the value when the user empties the search text', async () => {
      const wrapper = factory()
      const input = wrapper.find('input').element as HTMLInputElement

      input.focus()
      await flush()

      input.value = ''
      input.dispatchEvent(new Event('input', { bubbles: true }))
      await flush()

      const emittedValues = (wrapper.emitted('update:modelValue') ?? []).flat()
      expect(emittedValues).not.toContain(null)
      expect(wrapper.findComponent(VAutocomplete).props('modelValue')).toBe('none')
    })

    it('still emits a real selection', async () => {
      const wrapper = factory()

      wrapper.findComponent(VAutocomplete).vm.$emit('update:modelValue', 'video')
      await flush()

      expect(wrapper.emitted('update:modelValue')?.[0]).toEqual(['video'])
    })

    it('emits null when the value already is null', async () => {
      const wrapper = factory({ modelValue: null })

      wrapper.findComponent(VAutocomplete).vm.$emit('update:modelValue', null)
      await flush()

      expect(wrapper.emitted('update:modelValue')?.[0]).toEqual([null])
    })
  })

  describe('when clearing is legitimate', () => {
    it('emits null with clearable', async () => {
      const wrapper = factory({ clearable: true })

      wrapper.findComponent(VAutocomplete).vm.$emit('update:modelValue', null)
      await flush()

      expect(wrapper.emitted('update:modelValue')?.[0]).toEqual([null])
    })

    it('emits null with multiple', async () => {
      const wrapper = factory({ multiple: true, modelValue: ['none'] })

      wrapper.findComponent(VAutocomplete).vm.$emit('update:modelValue', null)
      await flush()

      expect(wrapper.emitted('update:modelValue')?.[0]).toEqual([null])
    })
  })
})
