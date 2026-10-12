import { beforeEach, describe, expect, it } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import AFileInput from '@/domains/ui/file/components/AFileInput.vue'
import { useAlertsQueue } from '@/domains/system/composables/alertsQueue'
import { commonT } from '@/plugins/i18n'

const carrying = (files: File[]) => {
  const transfer = new DataTransfer()
  files.forEach((file) => transfer.items.add(file))
  return transfer
}

const pick = async (input: HTMLInputElement, ...files: File[]) => {
  input.files = carrying(files).files
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

// The input with a dropzone of its own, as the file dialog of the image widgets has it. A drop can carry several
// files whatever the input takes; the system dialog of an input that takes one hands over one. The real dropzone
// under a real drop; the alerts are read from their queue, which no component of a test shows.
describe('AFileInput with its dropzone', () => {
  const jpeg = (name: string, size = 100) => new File([new Uint8Array(size)], name, { type: 'image/jpeg' })
  const tiff = (name: string) => new File([new Uint8Array(100)], name, { type: 'image/tiff' })
  // The alerts translate through the instance of the plugin, which a test has not installed: the text is what that
  // instance makes of the key.
  const refused = (...names: string[]) => [
    'warning',
    `${commonT('common.system.upload.incorrectFormatSize')}:${names.join(', ')}`,
  ]
  const onlyOne = ['warning', commonT('common.damImage.upload.onlyOneFile')]
  const alerts = () => useAlertsQueue().value.map((alert) => [alert.color, alert.text])
  const emitted = (wrapper: VueWrapper) =>
    (wrapper.emitted('filesInput') ?? []).map(([files]) => (files as File[]).map((file) => file.name))

  beforeEach(() => {
    useAlertsQueue().value = []
  })

  /** Mounted, and its dropzone listening: it starts to once it is drawn. */
  const mountWithDropzone = async (multiple = false) => {
    const wrapper = mount(AFileInput, {
      attachTo: document.body,
      props: { accept: 'image/jpeg', maxSizes: { 'image/jpeg': 1000 }, useDropzone: true, multiple },
    })
    await flushPromises()
    return wrapper
  }
  const drop = async (wrapper: VueWrapper, ...files: File[]) => {
    wrapper
      .find('.a-file-dropzone')
      .element.dispatchEvent(new DragEvent('drop', { dataTransfer: carrying(files), bubbles: true, cancelable: true }))
    await flushPromises()
  }

  describe('that takes one file', () => {
    // The first dropped was taken before the check: refused, it took the file the check lets through with it.
    it.each([
      ['of a type it does not take', () => tiff('scan.tiff'), 'scan.tiff'],
      ['larger than it takes', () => jpeg('huge.jpg', 2000), 'huge.jpg'],
    ])('takes the file dropped after one %s, and names the one it refused', async (_what, first, name) => {
      const wrapper = await mountWithDropzone()

      await drop(wrapper, first(), jpeg('taken.jpg'))

      expect(emitted(wrapper)).toEqual([['taken.jpg']])
      expect(alerts()).toEqual([refused(name)])
      wrapper.unmount()
    })

    // As the image widgets do on their own dropzone: one is taken, and the user is told so.
    it('takes the first of several it could take, and says that only one is taken', async () => {
      const wrapper = await mountWithDropzone()

      await drop(wrapper, jpeg('first.jpg'), jpeg('second.jpg'), jpeg('third.jpg'))

      expect(emitted(wrapper)).toEqual([['first.jpg']])
      expect(alerts()).toEqual([onlyOne])
      wrapper.unmount()
    })

    it('says both, when one is refused and several are left: the first of those is taken', async () => {
      const wrapper = await mountWithDropzone()

      await drop(wrapper, tiff('scan.tiff'), jpeg('first.jpg'), jpeg('second.jpg'))

      expect(emitted(wrapper)).toEqual([['first.jpg']])
      expect(alerts()).toEqual([refused('scan.tiff'), onlyOne])
      wrapper.unmount()
    })

    it('takes a file dropped alone without a word, as before', async () => {
      const wrapper = await mountWithDropzone()

      await drop(wrapper, jpeg('only.jpg'))

      expect(emitted(wrapper)).toEqual([['only.jpg']])
      expect(alerts()).toEqual([])
      wrapper.unmount()
    })

    it('hands over nothing when it takes none of the files dropped, and names them all', async () => {
      const wrapper = await mountWithDropzone()

      await drop(wrapper, tiff('scan.tiff'), jpeg('huge.jpg', 2000))

      expect(emitted(wrapper)).toEqual([[]])
      expect(alerts()).toEqual([refused('scan.tiff', 'huge.jpg')])
      wrapper.unmount()
    })

    // The system dialog of an input without `multiple` hands over one file: what comes through the input is taken
    // as before, the first as it is checked, whatever a script puts into the input.
    it.each<[string, () => File[], string[][], string[][]]>([
      ['one it takes', () => [jpeg('picked.jpg')], [['picked.jpg']], []],
      ['one it does not take', () => [tiff('scan.tiff')], [[]], [refused('scan.tiff')]],
      ['several, the first refused', () => [tiff('scan.tiff'), jpeg('second.jpg')], [[]], [refused('scan.tiff')]],
      ['several it takes', () => [jpeg('first.jpg'), jpeg('second.jpg')], [['first.jpg']], []],
    ])('leaves a pick through its input as it was: %s', async (_what, files, handedOver, said) => {
      const wrapper = await mountWithDropzone()

      await pick(wrapper.find('input[type="file"]').element as HTMLInputElement, ...files())

      expect(emitted(wrapper)).toEqual(handedOver)
      expect(alerts()).toEqual(said)
      wrapper.unmount()
    })
  })

  describe('that takes several files', () => {
    it('takes every file dropped that it can, as before, and says nothing of their number', async () => {
      const wrapper = await mountWithDropzone(true)

      await drop(wrapper, tiff('scan.tiff'), jpeg('first.jpg'), jpeg('second.jpg'))

      expect(emitted(wrapper)).toEqual([['first.jpg', 'second.jpg']])
      expect(alerts()).toEqual([refused('scan.tiff')])
      wrapper.unmount()
    })
  })
})
