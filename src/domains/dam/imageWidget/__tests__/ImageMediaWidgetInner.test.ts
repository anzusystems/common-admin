import { describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { shallowRef } from 'vue'
import ImageMediaWidgetInner from '@/domains/dam/imageWidget/components/ImageMediaWidgetInner.vue'
import { ImageWidgetUploadConfigKey } from '@/domains/dam/imageWidget/utils/imageWidgetInkectionKeys'
import { useImageMediaWidgetStore } from '@/domains/dam/imageWidget/store/imageMediaWidgetStore'

// With expandMetadata the widget puts what it shows into the metadata store as it mounts. The
// immediate watcher that does it runs before the store is taken, so it must not reach for it.
vi.mock('@/domains/dam/imageWidget/composables/commonAdminImageOptions', () => ({
  useCommonAdminImageOptions: () => ({
    imageClient: () => ({}),
    previewDomain: 'https://img',
    imageWidth: 300,
    imageHeight: 200,
    imageApi: { fetchImage: vi.fn() },
  }),
}))
vi.mock('@/domains/dam/composables/commonAdminCoreDamOptions', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useCommonAdminCoreDamOptions: () => ({ damClient: () => ({}), endPointAsset: '/asset' }),
}))
vi.mock('@/domains/dam/config/composables/damConfigState', () => ({
  useDamConfigState: () => ({ getDamConfigExtSystem: () => undefined, getExtSystemByLicence: async () => 1 }),
}))

const initialImage = {
  id: 7,
  texts: { description: 'lead', source: '' },
  flags: { showSource: true, internal: false, overrideInternal: false },
  dam: { damId: 'file-7', licenceId: 1, regionPosition: 0, internal: false },
  position: 1,
}
const media = { extService: 'damVideo', damMedia: { imageFileId: 'file-9', assetId: 'a9', licenceId: 1 } }

describe('ImageMediaWidgetInner with expandMetadata', () => {
  it.each([
    ['an initial image', { initialImage, image: 7, media: null }, 'lead'],
    ['a media', { image: null, media }, 'file-9'],
  ])('mounts on %s and fills the metadata store', async (_, models, expected) => {
    const errors: unknown[] = []
    const wrapper = mount(ImageMediaWidgetInner, {
      props: { queueKey: 'lead', uploadLicence: 1, selectLicences: [1], expandMetadata: true, ...models } as any,
      global: {
        config: { errorHandler: (err) => void errors.push(err) },
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
          AAssetSelectMedia: true,
          AssetDetailDialog: true,
          UploadQueueDialogSingle: true,
          AFileInputDialog: true,
          AFileDropzone: true,
        },
      },
    })
    await flushPromises()
    expect(errors.map(String)).toEqual([])
    expect(JSON.stringify(useImageMediaWidgetStore().detail)).toContain(expected)
    wrapper.unmount()
  })
})
