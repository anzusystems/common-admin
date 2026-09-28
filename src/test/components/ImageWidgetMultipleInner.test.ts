import { describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { defineComponent, h, shallowRef } from 'vue'
import ImageWidgetMultipleInner from '@/components/damImage/uploadQueue/components/ImageWidgetMultipleInner.vue'
import { ImageWidgetUploadConfigKey } from '@/components/damImage/composables/imageWidgetInkectionKeys'
import { useImageStore } from '@/components/damImage/uploadQueue/composables/imageStore'

// The widget keeps its rows in one global store. A widget opened on an entity with no images must
// not show, nor save onto that entity, the rows the previous entity's widget left there.
const image = (id: number) => ({
  id,
  texts: { description: `img ${id}`, source: '' },
  flags: { showSource: true, internal: false, overrideInternal: false },
  dam: { damId: `file-${id}`, licenceId: 1, regionPosition: 0, internal: false },
  position: id,
})
const imageApi = vi.hoisted(() => ({
  fetchImageListByIds: vi.fn(async (_c: unknown, ids: number[]) => ids.map((id) => image(id))),
  bulkUpdateImages: vi.fn(async (_c: unknown, items: unknown[]) => items),
  deleteImage: vi.fn(),
}))
vi.mock('@/components/damImage/composables/commonAdminImageOptions', () => ({
  useCommonAdminImageOptions: () => ({ imageClient: () => ({}), imageApi }),
}))
vi.mock('@/components/dam/assetSelect/composables/commonAdminCoreDamOptions', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useCommonAdminCoreDamOptions: () => ({ damClient: () => ({}), endPointAsset: '/asset', showSourceEnabled: true }),
}))
vi.mock('@/components/damImage/uploadQueue/api/damfetchAssetListByFileIdsMultipleLicences', () => ({
  fetchAssetListByFileIdsMultipleLicences: async () => [],
}))
vi.mock('@/components/damImage/uploadQueue/composables/damConfigState', () => ({
  useDamConfigState: () => ({ getDamConfigExtSystem: () => undefined, getExtSystemByLicence: async () => 1 }),
}))

const Editor = defineComponent({
  name: 'ASortableListEditor',
  setup: (_, { slots, expose }) => (expose({ commit: () => undefined }), () => h('div', slots['view-body']?.())),
})
const Item = defineComponent({ name: 'ImageWidgetMultipleItem', setup: () => () => h('div', { class: 'row' }) })

const mountWidget = (modelValue: number[]) =>
  mount(ImageWidgetMultipleInner, {
    props: { modelValue, queueKey: 'gallery', uploadLicence: 1, selectLicences: [1] },
    global: {
      provide: {
        [ImageWidgetUploadConfigKey as symbol]: shallowRef({
          licence: 1,
          extSystem: 1,
          licenceName: '',
          extSystemConfig: {},
        }),
      },
      stubs: {
        ASortableListEditor: Editor,
        ImageWidgetMultipleItem: Item,
        AAssetSelect: true,
        AFileInput: true,
        AFileDropzone: true,
        UploadQueueDialog: true,
        AssetDetailDialog: true,
        ImageWidgetMultipleLimitDialog: true,
      },
    },
  })

describe('ImageWidgetMultipleInner and the global image store', () => {
  it('opens an entity without images empty and saves it empty', async () => {
    const galleryA = mountWidget([1, 2, 3])
    await flushPromises()
    expect(galleryA.findAll('.row')).toHaveLength(3)
    galleryA.unmount()

    const galleryB = mountWidget([])
    await flushPromises()
    expect(galleryB.findAll('.row')).toHaveLength(0)
    expect(await (galleryB.vm as any).saveImages()).toBe(true)
    expect(imageApi.bulkUpdateImages).toHaveBeenLastCalledWith(expect.anything(), [])
    expect(galleryB.emitted('update:modelValue')?.at(-1)).toEqual([[]])
    expect(useImageStore().maxPosition).toBe(0)
    galleryB.unmount()
  })
})
