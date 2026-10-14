import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { type Component, defineComponent, h, ref, shallowRef } from 'vue'
import ImageMediaWidgetInner from '@/domains/dam/imageWidget/components/ImageMediaWidgetInner.vue'
import ImageWidgetInner from '@/domains/dam/imageWidget/components/ImageWidgetInner.vue'
import { ImageWidgetUploadConfigKey } from '@/domains/dam/imageWidget/utils/imageWidgetInkectionKeys'
import UploadQueueDialogSingle from '@/domains/dam/uploadQueue/components/UploadQueueDialogSingle.vue'
import { useUploadQueueDialog } from '@/domains/dam/uploadQueue/composables/useUploadQueueDialog'

// The upload dialog of a widget of one image is open, and the widget goes away with its page (in admin-cms the editor
// sent out of the article's room during an upload is taken to the detail of the article). The page kept the dialog
// named, and the next widget of that queue opened it at once, over whatever it was drawn in. The dialog forgets itself
// as it goes. The upload dialog is drawn without its frame.

vi.mock('@/domains/dam/imageWidget/composables/commonAdminImageOptions', () => ({
  useCommonAdminImageOptions: () => ({
    imageClient: () => ({}),
    previewDomain: 'https://img',
    imageWidth: 300,
    imageHeight: 200,
    imageApi: { fetchImage: async (_client: unknown, id: number) => ({ ...image, id }) },
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
  texts: { description: 'listing', source: 'Agency' },
  flags: { showSource: true, internal: false, overrideInternal: false },
  dam: { damId: 'file-7', licenceId: 1, regionPosition: 0, internal: false },
  position: 1,
}
const QUEUE = 'listingImage'

const mounted: VueWrapper[] = []
afterEach(() => {
  mounted.splice(0).forEach((wrapper) => wrapper.unmount())
  useUploadQueueDialog().uploadQueueDialog.value = null
})
const stubs = {
  AssetDetailDialogFrame: true,
  ImageDetailDialogMetadata: true,
  AAssetSelect: true,
  AAssetSelectMedia: true,
  AssetDetailDialog: true,
  AFileInputDialog: true,
  AFileDropzone: true,
}

describe.each<[string, Component]>([
  ['ImageWidgetInner', ImageWidgetInner],
  ['ImageMediaWidgetInner', ImageMediaWidgetInner],
])('the upload dialog of %s', (_name, component) => {
  const isImageWidget = component === ImageWidgetInner
  const mountWidget = async () => {
    const Parent = defineComponent({
      setup: () => {
        const model = ref<number | null>(7)
        return () =>
          h(component as never, {
            queueKey: QUEUE,
            uploadLicence: 1,
            selectLicences: [1],
            ...(isImageWidget
              ? {
                  image,
                  modelValue: model.value,
                  'onUpdate:modelValue': (value: number | null) => (model.value = value),
                }
              : {
                  initialImage: image,
                  image: model.value,
                  'onUpdate:image': (value: number | null) => (model.value = value),
                  media: null,
                }),
          })
      },
    })
    const wrapper = mount(Parent, {
      attachTo: document.body,
      global: {
        provide: {
          [ImageWidgetUploadConfigKey as symbol]: shallowRef({
            licence: 1,
            extSystem: 1,
            licenceName: '',
            extSystemConfig: {},
          }),
        },
        stubs,
      },
    })
    mounted.push(wrapper)
    await flushPromises()
    return wrapper
  }
  const drawsTheUploadDialog = (wrapper: VueWrapper) => wrapper.findComponent(UploadQueueDialogSingle).exists()

  it('opened when the widget goes: the next widget of its queue does not open it', async () => {
    const widget = await mountWidget()
    useUploadQueueDialog().uploadQueueDialog.value = QUEUE
    await flushPromises()
    expect(drawsTheUploadDialog(widget)).toBe(true)

    mounted.splice(mounted.indexOf(widget), 1)
    widget.unmount()
    await flushPromises()
    expect(useUploadQueueDialog().uploadQueueDialog.value).toBeNull()

    const next = await mountWidget()
    expect(drawsTheUploadDialog(next)).toBe(false)
  })

  // Two widgets of one queue key each draw the upload dialog: the one that goes leaves the other's open, and an add of
  // that widget, its dialog named, keeps the upload going.
  it('opened in two widgets of its queue: the one that goes leaves the dialog of the other, the last one forgets it', async () => {
    const one = await mountWidget()
    const other = await mountWidget()
    useUploadQueueDialog().uploadQueueDialog.value = QUEUE
    await flushPromises()
    expect([drawsTheUploadDialog(one), drawsTheUploadDialog(other)]).toEqual([true, true])

    mounted.splice(mounted.indexOf(one), 1)
    one.unmount()
    await flushPromises()
    expect([useUploadQueueDialog().uploadQueueDialog.value, drawsTheUploadDialog(other)]).toEqual([QUEUE, true])

    mounted.splice(mounted.indexOf(other), 1)
    other.unmount()
    await flushPromises()
    expect(useUploadQueueDialog().uploadQueueDialog.value).toBeNull()
  })
})

it('a single upload dialog that goes leaves the upload dialog of another queue named since', async () => {
  useUploadQueueDialog().uploadQueueDialog.value = QUEUE
  const dialog = mount(UploadQueueDialogSingle, {
    props: { queueKey: QUEUE, extSystem: 1, licenceId: 1, fileInputKey: 1, accept: undefined, maxSizes: undefined },
    global: { stubs },
  })
  await flushPromises()
  useUploadQueueDialog().uploadQueueDialog.value = 'anotherQueue'

  dialog.unmount()

  expect(useUploadQueueDialog().uploadQueueDialog.value).toBe('anotherQueue')
})
