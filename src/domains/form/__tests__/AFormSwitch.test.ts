import { afterEach, describe, expect, it } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { defineComponent, h } from 'vue'
import { VForm } from 'vuetify/components/VForm'
import AFormSwitch from '@/domains/form/components/AFormSwitch.vue'

const wrappers: VueWrapper[] = []
afterEach(() => {
  wrappers.splice(0).forEach((w) => w.unmount())
})

const mountSwitch = (props: Record<string, unknown>, formReadonly?: boolean) => {
  const field = () => h(AFormSwitch, { modelValue: false, label: 'Enabled', ...props })
  const wrapper = mount(
    defineComponent({
      setup: () => () => (formReadonly === undefined ? field() : h(VForm, { readonly: formReadonly }, field)),
    }),
    { attachTo: document.body }
  )
  wrappers.push(wrapper)
  return wrapper
}

// A readonly switch does not change when clicked.
const changesOnClick = async (wrapper: VueWrapper) => {
  await wrapper.find('input').trigger('click')
  return (wrapper.findComponent(AFormSwitch).emitted('update:modelValue') ?? []).length > 0
}

describe('AFormSwitch readonly', () => {
  it('is readonly on request', async () => {
    expect(await changesOnClick(mountSwitch({ readonly: true }))).toBe(false)
    expect(await changesOnClick(mountSwitch({}))).toBe(true)
  })

  // Not set is not `false`: an explicit `false` would win over the form.
  it('leaves readonly to a readonly VForm around it', async () => {
    expect(await changesOnClick(mountSwitch({}, true))).toBe(false)
  })
})
