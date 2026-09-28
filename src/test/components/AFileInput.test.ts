import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import AFileInput from '@/components/file/AFileInput.vue'

const pick = async (input: HTMLInputElement, file: File) => {
  const transfer = new DataTransfer()
  transfer.items.add(file)
  input.files = transfer.files
  input.dispatchEvent(new Event('change'))
}

describe('AFileInput limits that arrive after mount', () => {
  it('checks a picked file against the accept and max sizes it has now', async () => {
    // What a parent passes before its DAM config is in: nothing accepted.
    const wrapper = mount(AFileInput, { props: { accept: '', maxSizes: {}, multiple: true } })
    await wrapper.setProps({ accept: 'image/jpeg', maxSizes: { 'image/jpeg': 1000 } })

    const photo = new File([new Uint8Array(100)], 'photo.jpg', { type: 'image/jpeg' })
    await pick(wrapper.find('input[type="file"]').element as HTMLInputElement, photo)

    expect(wrapper.find('input[type="file"]').attributes('accept')).toBe('image/jpeg')
    expect(wrapper.emitted('filesInput')?.[0]).toEqual([[photo]])
    wrapper.unmount()
  })
})
