import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { defineComponent, h } from 'vue'
import AFormRemoteSwitch from '@/components/form/AFormRemoteSwitch.vue'
import AFormRemoteCheckbox from '@/components/form/AFormRemoteCheckbox.vue'

const wrappers: ReturnType<typeof mount>[] = []
afterEach(() => wrappers.splice(0).forEach((w) => w.unmount()))

describe.each([
  ['switch', AFormRemoteSwitch],
  ['checkbox', AFormRemoteCheckbox],
])('AFormRemote %s', (_name, Component) => {
  it('is usable again after a rejected callback, which still reaches the error handler', async () => {
    const errorHandler = vi.fn()
    const failure = new Error('network')
    const callbackToTrue = vi.fn().mockRejectedValueOnce(failure).mockResolvedValueOnce(true)
    const wrapper = mount(Component as any, {
      props: { modelValue: false, callbackToTrue, callbackToFalse: vi.fn(), label: 'Enabled' },
      attachTo: document.body,
      global: { config: { errorHandler } },
    })
    wrappers.push(wrapper)
    const target = () => (_name === 'switch' ? wrapper.find('button') : wrapper.find('input'))
    await target().trigger('click')
    await flushPromises()
    expect(errorHandler).toHaveBeenCalledTimes(1)
    expect(errorHandler.mock.calls[0]![0]).toBe(failure)
    await target().trigger('click')
    await flushPromises()
    expect(callbackToTrue).toHaveBeenCalledTimes(2)
    expect(wrapper.find('input').attributes('disabled')).toBeUndefined()
  })

  it('a click on the second label toggles the second control, not the first', async () => {
    const first = vi.fn(async () => true)
    const second = vi.fn(async () => true)
    const Two = defineComponent(
      () => () =>
        h(
          'div',
          [first, second].map((cb, n) =>
            h(Component as never, { modelValue: false, callbackToTrue: cb, callbackToFalse: cb, label: 'L' + n })
          )
        )
    )
    const wrapper = mount(Two, { attachTo: document.body })
    wrappers.push(wrapper)
    await flushPromises()
    const labels = wrapper.findAll('label[for]')
    expect(labels[0]!.attributes('for')).not.toBe(labels[1]!.attributes('for'))
    ;(labels[1]!.element as HTMLLabelElement).click()
    await flushPromises()
    expect(first).not.toHaveBeenCalled()
    expect(second).toHaveBeenCalledTimes(1)
  })
})
