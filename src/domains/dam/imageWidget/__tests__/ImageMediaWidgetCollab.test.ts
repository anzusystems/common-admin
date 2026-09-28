import { describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { defineComponent, h, ref, shallowRef } from 'vue'
import ImageMediaWidgetInner from '@/domains/dam/imageWidget/components/ImageMediaWidgetInner.vue'
import { ImageWidgetUploadConfigKey } from '@/domains/dam/imageWidget/utils/imageWidgetInkectionKeys'

// The widget holds an image or a media. Released with a bare id, the other editors could not tell which,
// nor set either: an admin wrote the value under the field name and nobody else saw the new lead image.
// Mounted under a `v-model` parent, as in an admin: there an assigned model shows only after the parent renders, and
// a release that read the models back sent the previous image.

const released = vi.fn()

vi.mock('@/domains/collab/composables/commonAdminCollabOptions', () => ({
  useCommonAdminCollabOptions: () => ({ collabOptions: ref({ enabled: true }) }),
}))
vi.mock('@/domains/collab/composables/collabField', () => ({
  useCollabField: () => ({
    releaseCollabFieldLock: released,
    acquireCollabFieldLock: vi.fn(),
    addCollabFieldLockStatusListener: vi.fn(),
    lockedByUser: ref<number | null>(null),
  }),
}))
vi.mock('@/domains/dam/imageWidget/composables/commonAdminImageOptions', () => ({
  useCommonAdminImageOptions: () => ({
    imageClient: () => ({}),
    previewDomain: 'https://img',
    imageWidth: 300,
    imageHeight: 200,
    imageApi: { fetchImage: vi.fn(), deleteImage: vi.fn() },
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

describe('ImageMediaWidgetInner in a collab room', () => {
  it('releases the field with both what it holds, image and media', async () => {
    const image = ref<number | null>(7)
    const media = ref<unknown>(null)
    const Parent = defineComponent({
      setup: () => () =>
        h(ImageMediaWidgetInner as never, {
          queueKey: 'lead',
          uploadLicence: 1,
          selectLicences: [1],
          initialImage,
          image: image.value,
          'onUpdate:image': (value: number | null) => (image.value = value),
          media: media.value,
          'onUpdate:media': (value: unknown) => (media.value = value),
          collab: { room: 'article:1', field: 'leadImageMedia', cachedUsers: {} },
          collabStatus: 'active',
        }),
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
    await wrapper.find('[aria-label="Edit image"]').trigger('click')
    await flushPromises()
    const remove = [...document.body.querySelectorAll('.v-list-item')].find((item) =>
      /remove/i.test(item.textContent ?? '')
    ) as HTMLElement | undefined
    remove?.click()
    await flushPromises()

    // eslint-disable-next-line vue/no-ref-object-reactivity-loss -- final read for an assertion
    expect(image.value).toBeNull()
    expect(released).toHaveBeenCalled()
    expect(released.mock.calls[0]![0]).toEqual({ image: null, media: null })
    wrapper.unmount()
  })
})
