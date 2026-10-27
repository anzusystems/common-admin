import { beforeEach, describe, expect, it } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import AFileInput from '@/domains/ui/file/components/AFileInput.vue'
import { useAlertsQueue } from '@/domains/system/composables/alertsQueue'
import { createI18n } from 'vue-i18n'
import { commonT } from '@/plugins/i18n'
import cs from '@/locales/cs'
import en from '@/locales/en'
import sk from '@/locales/sk'

// The general file input with one file, under a drop of several, takes the first and tells the user.
// The message used to reuse the DAM image widget text
// `common.damImage.upload.onlyOneFile`. It now has its own key with the same words.

const carrying = (files: File[]) => {
  const transfer = new DataTransfer()
  files.forEach((file) => transfer.items.add(file))
  return transfer
}
const jpeg = (name: string) => new File([new Uint8Array(100)], name, { type: 'image/jpeg' })

beforeEach(() => {
  useAlertsQueue().value = []
})

describe('AFileInput of one file, under a drop of several', () => {
  it('says that only one is taken in its own text', async () => {
    const wrapper = mount(AFileInput, {
      attachTo: document.body,
      props: { accept: 'image/jpeg', maxSizes: { 'image/jpeg': 1000 }, useDropzone: true },
    })
    await flushPromises()

    wrapper.find('.a-file-dropzone').element.dispatchEvent(
      new DragEvent('drop', {
        dataTransfer: carrying([jpeg('a.jpg'), jpeg('b.jpg')]),
        bubbles: true,
        cancelable: true,
      })
    )
    await flushPromises()

    expect(useAlertsQueue().value.map((alert) => [alert.color, alert.text])).toEqual([
      ['warning', commonT('common.system.upload.onlyOneFile')],
    ])
    wrapper.unmount()
  })

  it.each(['sk', 'en', 'cs'])('has the words of the image widgets in %s', (locale) => {
    const { t } = createI18n({ legacy: false, locale, fallbackLocale: false, messages: { sk, en, cs } }).global

    expect(t('common.system.upload.onlyOneFile')).toBe(t('common.damImage.upload.onlyOneFile'))
    expect(t('common.system.upload.onlyOneFile')).not.toBe('common.system.upload.onlyOneFile')
  })
})
