import { describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { defineComponent, h } from 'vue'
import DamAssetImageRoiSelectLazy from '@/components/damImage/uploadQueue/components/DamAssetImageRoiSelectLazy.vue'

// The upload queue's detail dialogs load the region editor, and cropper.js under it, when it first
// shows. What the dialogs rely on is that the props reach the editor once it is there, and that a
// chunk that fails to arrive leaves a way to try again rather than a spinner forever.

// The real loader by default; a case that needs other chunk behaviour says so with a one-off answer.
const loadDamAssetImageRoiSelect = vi.hoisted(() => vi.fn())
vi.mock('@/components/damImage/uploadQueue/composables/damAssetImageRoiSelectLoader', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@/components/damImage/uploadQueue/composables/damAssetImageRoiSelectLoader')>()
  loadDamAssetImageRoiSelect.mockImplementation(actual.loadDamAssetImageRoiSelect)
  return { ...actual, loadDamAssetImageRoiSelect }
})

const RoiSelectStub = defineComponent({
  name: 'RoiSelectStub',
  props: { extSystem: { type: Number, required: true }, configName: { type: String, required: true } },
  setup: (props) => () => h('div', { 'data-cy': 'roi-select' }, `${props.extSystem}:${props.configName}`),
})

describe('DamAssetImageRoiSelectLazy', () => {
  it('renders the editor with its props once it has loaded', async () => {
    loadDamAssetImageRoiSelect.mockResolvedValueOnce(RoiSelectStub)
    const wrapper = mount(DamAssetImageRoiSelectLazy, { props: { extSystem: 3, configName: 'blog' } })
    expect(wrapper.findComponent({ name: 'VProgressCircular' }).exists()).toBe(true)

    await flushPromises()
    expect(loadDamAssetImageRoiSelect).toHaveBeenCalledTimes(1)
    expect(wrapper.find('[data-cy="roi-select"]').text()).toBe('3:blog')
    wrapper.unmount()
  })

  it('says so when the editor cannot be loaded and loads it on retry', async () => {
    loadDamAssetImageRoiSelect.mockRejectedValueOnce(new Error('chunk failed')).mockResolvedValueOnce(RoiSelectStub)
    const wrapper = mount(DamAssetImageRoiSelectLazy, { props: { extSystem: 3 } })

    await flushPromises()
    expect(wrapper.find('[data-cy="roi-select"]').exists()).toBe(false)
    const retry = wrapper.find('[data-cy="button-retry-roi-select"]')
    expect(retry.exists()).toBe(true)

    await retry.trigger('click')
    await flushPromises()
    expect(loadDamAssetImageRoiSelect).toHaveBeenCalledTimes(2)
    expect(wrapper.find('[data-cy="roi-select"]').text()).toBe('3:default')
    wrapper.unmount()
  })
})

describe('loadDamAssetImageRoiSelect', () => {
  it('resolves to the region editor', async () => {
    const component = (await loadDamAssetImageRoiSelect()) as { __name?: string; name?: string }
    expect(component.__name ?? component.name).toBe('DamAssetImageRoiSelect')
  })
})
