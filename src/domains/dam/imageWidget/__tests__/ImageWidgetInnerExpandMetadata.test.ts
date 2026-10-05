import { describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { shallowRef } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import ImageWidgetInner from '@/domains/dam/imageWidget/components/ImageWidgetInner.vue'
import { ImageWidgetUploadConfigKey } from '@/domains/dam/imageWidget/utils/imageWidgetInkectionKeys'
import { useImageMediaWidgetStore } from '@/domains/dam/imageWidget/store/imageMediaWidgetStore'

// With expandMetadata the widget shows the metadata form inline, filled from the store. Handed the
// image itself it fills the store while setup runs, and a reset on mount would empty it again.
const fetchImage = vi.hoisted(() => vi.fn())
vi.mock('@/domains/dam/imageWidget/composables/commonAdminImageOptions', () => ({
  useCommonAdminImageOptions: () => ({
    imageClient: () => ({}),
    previewDomain: 'https://img',
    imageWidth: 300,
    imageHeight: 200,
    imageApi: { fetchImage },
  }),
}))
vi.mock('@/domains/dam/composables/commonAdminCoreDamOptions', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useCommonAdminCoreDamOptions: () => ({ damClient: () => ({}), endPointAsset: '/asset' }),
}))
vi.mock('@/domains/dam/config/composables/damConfigState', () => ({
  useDamConfigState: () => ({ getDamConfigExtSystem: () => undefined, getExtSystemByLicence: async () => 1 }),
}))

const image = {
  id: 7,
  texts: { description: 'lead', source: 'agency' },
  flags: { showSource: true, internal: false, overrideInternal: false },
  dam: { damId: 'file-7', licenceId: 1, regionPosition: 0, internal: false },
  position: 1,
}

const mountWidget = (props: Record<string, unknown>, pinia: ReturnType<typeof createPinia>) =>
  mount(ImageWidgetInner, {
    props: { queueKey: 'embed', uploadLicence: 1, selectLicences: [1], expandMetadata: true, ...props } as any,
    global: {
      plugins: [pinia],
      provide: {
        [ImageWidgetUploadConfigKey as symbol]: shallowRef({
          licence: 1,
          extSystem: 1,
          licenceName: '',
          extSystemConfig: {},
        }),
      },
      stubs: {
        ImageDetailDialogMetadata: true,
        AAssetSelect: true,
        AssetDetailDialog: true,
        UploadQueueDialogSingle: true,
        AFileInputDialog: true,
        AFileDropzone: true,
      },
    },
  })

describe('ImageWidgetInner with expandMetadata', () => {
  it('keeps the image it was handed in the metadata store after mounting', async () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    useImageMediaWidgetStore().setDetail({ ...image, id: 99, texts: { description: 'previous', source: '' } })
    const wrapper = mountWidget({ image, modelValue: 7 }, pinia)
    await flushPromises()
    expect(fetchImage).not.toHaveBeenCalled()
    expect(useImageMediaWidgetStore().detail).toMatchObject({ id: 7, texts: { description: 'lead' } })
    wrapper.unmount()
  })

  it('does not keep what another widget left in the store when it has no image', async () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    useImageMediaWidgetStore().setDetail({ ...image, id: 99, texts: { description: 'previous', source: '' } })
    const wrapper = mountWidget({ modelValue: null }, pinia)
    await flushPromises()
    expect(useImageMediaWidgetStore().detail).toBeNull()
    wrapper.unmount()
  })
})

// `readonly` used to be declared and never read: whoever passed it still got the edit, library and
// upload buttons and the dropzone.
describe('ImageWidgetInner readonly', () => {
  it('keeps the image but offers none of the controls that change it', async () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    const editable = mountWidget({ image, modelValue: 7, expandOptions: true, expandMetadata: false }, pinia)
    await flushPromises()
    expect(editable.findComponent({ name: 'AFileDropzone' }).exists()).toBe(true)
    expect(editable.findAll('.a-image-widget__options .v-btn').length).toBeGreaterThan(0)
    editable.unmount()

    const readonly = mountWidget(
      { image, modelValue: 7, expandOptions: true, expandMetadata: false, readonly: true },
      pinia
    )
    await flushPromises()
    expect(readonly.findComponent({ name: 'AFileDropzone' }).exists()).toBe(false)
    expect(readonly.findAll('.a-image-widget__options .v-btn')).toHaveLength(0)
    expect(readonly.findComponent({ name: 'VImg' }).exists()).toBe(true)
    readonly.unmount()
  })
})
