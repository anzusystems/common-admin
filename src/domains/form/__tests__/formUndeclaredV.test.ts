import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { useVuelidate } from '@vuelidate/core'
import { helpers } from '@vuelidate/validators'
import { defineComponent, h, nextTick, ref } from 'vue'
import AFormSwitch from '@/domains/form/components/AFormSwitch.vue'
import DamExtSystemRemoteAutocomplete from '@/domains/dam/user/components/DamExtSystemRemoteAutocomplete.vue'
import DamAssetLicenceRemoteAutocomplete from '@/domains/dam/user/components/DamAssetLicenceRemoteAutocomplete.vue'

// Admins pass `:v="v$.field"` to these fields. Whatever the component does not declare lands in $attrs.
const mustBeOn = helpers.withMessage('Must be on', (value: boolean) => value === true)

describe(':v on AFormSwitch', () => {
  it('shows the rule message once the field is touched', async () => {
    const Host = defineComponent({
      setup() {
        const model = ref({ enabled: false })
        const v$ = useVuelidate({ model: { enabled: { mustBeOn } } }, { model })
        return () =>
          h(AFormSwitch, {
            modelValue: model.value.enabled,
            'onUpdate:modelValue': (value: boolean) => (model.value.enabled = value),
            label: 'Enabled',
            v: v$.value.model.enabled,
          })
      },
    })
    const wrapper = mount(Host)
    await wrapper.find('input').trigger('focus')
    await wrapper.find('input').trigger('blur')
    await nextTick()
    expect(wrapper.find('.v-messages').text()).toContain('Must be on')
    expect(wrapper.find('[v]').exists()).toBe(false)
    wrapper.unmount()
  })
})

describe(':v on the Dam remote autocompletes', () => {
  const v = { $errors: [{ $message: 'Pick one' }], $touch: vi.fn(), $path: 'licence' }
  const props = { modelValue: null, client: () => ({}) as never }

  // Undeclared, `v` arrives as an attribute, and the attributes fall through to the root component.
  it.each([
    ['DamExtSystemRemoteAutocomplete', () => mount(DamExtSystemRemoteAutocomplete, { props, attrs: { v } })],
    ['DamAssetLicenceRemoteAutocomplete', () => mount(DamAssetLicenceRemoteAutocomplete, { props, attrs: { v } })],
  ])('%s hands it on to AFormRemoteAutocomplete, which shows the message', async (_name, mountField) => {
    const wrapper = mountField()
    await nextTick()
    expect(wrapper.find('.v-messages').text()).toContain('Pick one')
    wrapper.unmount()
  })
})
