import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import AFileInputDialog from '@/domains/ui/file/components/AFileInputDialog.vue'

// An image widget with expanded options opens its file choice through `activate()`, on a click of its dropzone. It
// reached for a ref that was never set, and its input exists only while the dialog is open: the click did nothing.

afterEach(() => {
  vi.restoreAllMocks()
  document.querySelectorAll('.v-overlay-container').forEach((node) => (node.innerHTML = ''))
})

describe('AFileInputDialog', () => {
  it('opens the dialog and the file choice on activate', async () => {
    const chooses = vi.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(() => {})
    const wrapper = mount(AFileInputDialog, { attachTo: document.body })

    await (wrapper.vm as unknown as { activate: () => Promise<void> }).activate()
    await flushPromises()

    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([true])
    expect(chooses).toHaveBeenCalledTimes(1)
    wrapper.unmount()
  })
})
