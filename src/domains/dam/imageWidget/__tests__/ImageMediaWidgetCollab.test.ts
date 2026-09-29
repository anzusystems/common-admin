import { describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { defineComponent, h, ref, shallowRef } from 'vue'
import ImageMediaWidgetInner from '@/domains/dam/imageWidget/components/ImageMediaWidgetInner.vue'
import { ImageWidgetUploadConfigKey } from '@/domains/dam/imageWidget/utils/imageWidgetInkectionKeys'
import { useUploadQueuesStore } from '@/domains/dam/uploadQueue/store/uploadQueuesStore'
import { useCollabStateInternal } from '@/domains/collab/composables/collabState'
import { useImageMediaWidgetStore } from '@/domains/dam/imageWidget/store/imageMediaWidgetStore'
import {
  CollabFieldLockStatus,
  type CollabFieldLockStatusPayload,
  CollabFieldLockType,
} from '@/domains/collab/composables/collabEventBus'

// The widget holds an image or a media. Released with a bare id, the other editors could not tell which,
// nor set either: an admin wrote the value under the field name and nobody else saw the new lead image.
// Mounted under a `v-model` parent, as in an admin: there an assigned model shows only after the parent renders, and
// a release that read the models back sent the previous image.

const released = vi.fn()
const acquired = vi.fn()
const fetched = vi.hoisted(() => ({ resolve: null as null | ((value: unknown) => void) }))
vi.mock('@/domains/dam/api/damAssetApi', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  fetchAssetAsCmsMedia: () => new Promise((resolve) => (fetched.resolve = resolve)),
}))
const lock = vi.hoisted(() => ({
  status: null as null | ((payload: CollabFieldLockStatusPayload) => void),
  byUser: null as null | { value: number | null },
}))

vi.mock('@/domains/collab/composables/commonAdminCollabOptions', () => ({
  useCommonAdminCollabOptions: () => ({ collabOptions: ref({ enabled: true }) }),
}))
vi.mock('@/domains/collab/composables/collabField', () => ({
  useCollabField: () => {
    lock.byUser = ref<number | null>(null)
    return {
      releaseCollabFieldLock: released,
      acquireCollabFieldLock: acquired,
      addCollabFieldLockStatusListener: (listener: (payload: CollabFieldLockStatusPayload) => void) =>
        (lock.status = listener),
      lockedByUser: lock.byUser,
    }
  },
}))
vi.mock('@/domains/dam/imageWidget/composables/commonAdminImageOptions', () => ({
  useCommonAdminImageOptions: () => ({
    imageClient: () => ({}),
    previewDomain: 'https://img',
    imageWidth: 300,
    imageHeight: 200,
    imageApi: {
      fetchImage: vi.fn(async (_client: unknown, id: number) => ({
        id,
        texts: { description: 'lead', source: '' },
        flags: { showSource: true, internal: false, overrideInternal: false },
        dam: { damId: `file-${id}`, licenceId: 1, regionPosition: 0, internal: false },
        position: 1,
      })),
      deleteImage: vi.fn(),
      updateImage: vi.fn(async (_client: unknown, id: number, data: object) => ({ ...data, id: id + 1 })),
    },
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

const mountWidget = (queueKey: string, collabStatus = 'active') => {
  const status = ref(collabStatus)
  released.mockClear()
  acquired.mockClear()
  const image = ref<number | null>(7)
  const media = ref<unknown>(null)
  const Parent = defineComponent({
    setup: () => () =>
      h(ImageMediaWidgetInner as never, {
        queueKey,
        uploadLicence: 1,
        selectLicences: [1],
        initialImage,
        image: image.value,
        'onUpdate:image': (value: number | null) => (image.value = value),
        media: media.value,
        'onUpdate:media': (value: unknown) => (media.value = value),
        collab: { room: 'article:1', field: 'leadImageMedia', cachedUsers: {} },
        collabStatus: status.value,
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
        ACollabLockedByUser: true,
      },
    },
  })
  return { wrapper, image, status }
}

const removeImage = async (wrapper: ReturnType<typeof mountWidget>['wrapper']) => {
  await flushPromises()
  await wrapper.find('[aria-label="Edit image"]').trigger('click')
  await flushPromises()
  const remove = [...document.body.querySelectorAll('.v-list-item')].find((item) =>
    /remove/i.test(item.textContent ?? '')
  ) as HTMLElement | undefined
  remove?.click()
  await flushPromises()
}

describe('ImageMediaWidgetInner in a collab room', () => {
  it('releases the field with both what it holds, image and media', async () => {
    const { wrapper, image } = mountWidget('lead-release')
    await removeImage(wrapper)

    // eslint-disable-next-line vue/no-ref-object-reactivity-loss -- final read for an assertion
    expect(image.value).toBeNull()
    expect(released).toHaveBeenCalled()
    expect(released.mock.calls[0]![0]).toEqual({ image: null, media: null })
    wrapper.unmount()
  })

  // A second release is refused by the server, and the widget read the refusal as still holding the lock.
  it('releases the field once for the lock it took', async () => {
    const { wrapper } = mountWidget('lead-once')
    await removeImage(wrapper)
    await flushPromises()

    expect(acquired).toHaveBeenCalledTimes(1)
    expect(released).toHaveBeenCalledTimes(1)
    wrapper.unmount()
  })

  // The metadata dialog is a stub: opened, then confirmed, as the user does with the detail in the store.
  const confirmMetadata = async (
    wrapper: ReturnType<typeof mountWidget>['wrapper'],
    detail: Parameters<ReturnType<typeof useImageMediaWidgetStore>['setDetail']>[0]
  ) => {
    await flushPromises()
    await wrapper.find('[aria-label="Edit image"]').trigger('click')
    await flushPromises()
    const dialog = wrapper.findComponent({ name: 'ImageDetailDialogMetadata' })
    dialog.vm.$emit('update:modelValue', true)
    await flushPromises()
    useImageMediaWidgetStore().setDetail(detail)
    dialog.vm.$emit('confirm')
    await flushPromises()
    await flushPromises()
  }

  it('releases once with the image it saved', async () => {
    const { wrapper } = mountWidget('lead-image-confirm')
    await confirmMetadata(wrapper, { ...initialImage } as never)

    expect(released).toHaveBeenCalledTimes(1)
    expect(released.mock.calls[0]![0]).toEqual({ image: 8, media: null })
    wrapper.unmount()
  })

  it('releases once with the media it picked', async () => {
    const { wrapper } = mountWidget('lead-media-confirm')
    const media = { damMedia: { assetId: 'a1', imageFileId: null, assetType: 'video' }, texts: {} }
    await confirmMetadata(wrapper, media as never)

    expect(released).toHaveBeenCalledTimes(1)
    expect(released.mock.calls[0]![0]).toEqual({ image: null, media })
    wrapper.unmount()
  })

  it('takes no drop while another editor holds the field, whatever an earlier refusal left behind', async () => {
    const { wrapper } = mountWidget('lead-drop')
    await flushPromises()
    lock.status!({ status: CollabFieldLockStatus.Failure, type: CollabFieldLockType.Release } as never)
    lock.byUser!.value = 9
    await flushPromises()

    wrapper.findComponent({ name: 'AFileDropzone' }).vm.$emit('drop', [new File(['x'], 'x.jpg')])
    await flushPromises()

    expect(acquired).not.toHaveBeenCalled()
    expect(wrapper.findComponent({ name: 'UploadQueueDialogSingle' }).exists()).toBe(false)
    wrapper.unmount()
  })

  // The picker closes itself as it answers, and the next dialog opens once the asset is fetched.
  it('keeps the lock while a picked asset is fetched', async () => {
    const { wrapper } = mountWidget('lead-pick')
    await flushPromises()
    await wrapper.find('[aria-label="Edit image"]').trigger('click')
    await flushPromises()
    const picker = wrapper.findComponent({ name: 'AAssetSelectMedia' })
    picker.vm.$emit('update:modelValue', true)
    await flushPromises()
    picker.vm.$emit('confirm', {
      type: 'asset',
      value: [{ id: 'a1', licence: 1, mainFile: { id: 'f1' }, attributes: { assetType: 'video' }, podcasts: [] }],
    })
    picker.vm.$emit('update:modelValue', false)
    await flushPromises()
    expect(released).not.toHaveBeenCalled()

    // Nothing to show: the pick ends without a dialog, and the lock goes.
    fetched.resolve!(null)
    await flushPromises()
    await flushPromises()
    expect(released).toHaveBeenCalledTimes(1)
    // Nor is the metadata dialog left loading: the next upload or edit showed only a spinner.
    expect(wrapper.findComponent({ name: 'ImageDetailDialogMetadata' }).props('loading')).toBe(false)
    wrapper.unmount()
  })

  // A timed-out request answers as a refusal, and the server may have granted it meanwhile.
  it('still releases, with its value, a lock whose answer came back failed', async () => {
    const { wrapper } = mountWidget('lead-timeout')
    await flushPromises()
    await wrapper.find('[aria-label="Edit image"]').trigger('click')
    await flushPromises()
    lock.status!({ status: CollabFieldLockStatus.Failure, type: CollabFieldLockType.Acquire } as never)
    const remove = [...document.body.querySelectorAll('.v-list-item')].find((item) =>
      /remove/i.test(item.textContent ?? '')
    ) as HTMLElement | undefined
    remove?.click()
    await flushPromises()

    expect(released).toHaveBeenCalledTimes(1)
    expect(released.mock.calls[0]![0]).toEqual({ image: null, media: null })
    wrapper.unmount()
  })

  // Sent by the click that closes the menu, a second request raced the menu's release on the server.
  it('asks once, and releases, when the menu is closed by its button before the answer', async () => {
    const { wrapper } = mountWidget('lead-toggle')
    await flushPromises()
    await wrapper.find('[aria-label="Edit image"]').trigger('click')
    await flushPromises()
    await wrapper.find('[aria-label="Edit image"]').trigger('click')
    await flushPromises()

    expect(acquired).toHaveBeenCalledTimes(1)
    expect(released).toHaveBeenCalledTimes(1)
    wrapper.unmount()
  })

  it('asks nothing more in the click that closes the menu after a failed answer', async () => {
    const { wrapper } = mountWidget('lead-toggle-failed')
    await flushPromises()
    await wrapper.find('[aria-label="Edit image"]').trigger('click')
    await flushPromises()
    lock.status!({ status: CollabFieldLockStatus.Failure, type: CollabFieldLockType.Acquire } as never)
    await flushPromises()
    await wrapper.find('[aria-label="Edit image"]').trigger('click')
    await flushPromises()

    expect(acquired).toHaveBeenCalledTimes(1)
    expect(released).toHaveBeenCalledTimes(1)
    wrapper.unmount()
  })

  it('asks again when the menu opens after a refused drop', async () => {
    const { wrapper } = mountWidget('lead-menu-after-drop')
    await flushPromises()
    wrapper.findComponent({ name: 'AFileDropzone' }).vm.$emit('drop', [new File(['x'], 'x.jpg')])
    await flushPromises()
    lock.status!({ status: CollabFieldLockStatus.Failure, type: CollabFieldLockType.Acquire } as never)
    await flushPromises()

    await wrapper.find('[aria-label="Edit image"]').trigger('click')
    await flushPromises()
    expect(acquired).toHaveBeenCalledTimes(2)
    wrapper.unmount()
  })

  it('asks once for two drops while the request is out', async () => {
    const { wrapper } = mountWidget('lead-two-drops')
    await flushPromises()
    const dropzone = wrapper.findComponent({ name: 'AFileDropzone' })
    dropzone.vm.$emit('drop', [new File(['x'], 'x.jpg')])
    dropzone.vm.$emit('drop', [new File(['y'], 'y.jpg')])
    await flushPromises()

    expect(acquired).toHaveBeenCalledTimes(1)
    wrapper.unmount()
  })

  // A request that timed out may have been granted: with no menu or dialog open, nothing else released it.
  it('releases the lock of a drop whose wait for it ran out', { timeout: 15000 }, async () => {
    const { wrapper } = mountWidget('lead-drop-timeout')
    await flushPromises()
    wrapper.findComponent({ name: 'AFileDropzone' }).vm.$emit('drop', [new File(['x'], 'x.jpg')])
    await new Promise((resolve) => setTimeout(resolve, 5600))
    await flushPromises()

    expect(acquired).toHaveBeenCalledTimes(1)
    expect(released).toHaveBeenCalledTimes(1)
    wrapper.unmount()
  })

  // The other editor left: the room is inactive, and the server still holds this editor's lock for whoever comes back.
  it('releases a lock taken in an active room after the room turned inactive', async () => {
    const { wrapper, status } = mountWidget('lead-turned-inactive')
    await flushPromises()
    await wrapper.find('[aria-label="Edit image"]').trigger('click')
    await flushPromises()
    status.value = 'inactive'
    await flushPromises()
    await wrapper.find('[aria-label="Edit image"]').trigger('click')
    await flushPromises()

    expect(acquired).toHaveBeenCalledTimes(1)
    expect(released).toHaveBeenCalledTimes(1)
    wrapper.unmount()
  })

  // A lost connection took the lock on the server; counted still, it was never asked for again.
  it('asks for the lock again when the room is back after a lost connection', async () => {
    const { collabConnected } = useCollabStateInternal()
    collabConnected.value = true
    const { wrapper, status } = mountWidget('lead-reconnect')
    await flushPromises()
    await wrapper.find('[aria-label="Edit image"]').trigger('click')
    await flushPromises()
    lock.status!({ status: CollabFieldLockStatus.Success, type: CollabFieldLockType.Acquire } as never)
    collabConnected.value = false
    status.value = 'inactive'
    await flushPromises()
    collabConnected.value = true
    status.value = 'active'
    await flushPromises()

    expect(acquired).toHaveBeenCalledTimes(2)
    wrapper.unmount()
  })

  // Opened while the editor was alone, the menu took no lock; the other editor arriving did not change that.
  it('asks for the lock when another editor arrives while the menu is open', async () => {
    const { wrapper, status } = mountWidget('lead-arrival', 'inactive')
    await flushPromises()
    await wrapper.find('[aria-label="Edit image"]').trigger('click')
    await flushPromises()
    expect(acquired).not.toHaveBeenCalled()

    status.value = 'active'
    await flushPromises()
    expect(acquired).toHaveBeenCalledTimes(1)
    wrapper.unmount()
  })

  // Released while another drop still waited, a refused release read as the lock held and let that drop upload.
  it('keeps a waiting drop waiting when an earlier drop gives up', { timeout: 20000 }, async () => {
    const { wrapper } = mountWidget('lead-overlapping-drops')
    const addByFiles = vi.spyOn(useUploadQueuesStore(), 'addByFiles').mockResolvedValue(undefined as never)
    await flushPromises()
    const dropzone = wrapper.findComponent({ name: 'AFileDropzone' })
    dropzone.vm.$emit('drop', [new File(['x'], 'x.jpg')])
    await new Promise((resolve) => setTimeout(resolve, 200))
    // Both wait for the one request, which is refused.
    dropzone.vm.$emit('drop', [new File(['y'], 'y.jpg')])
    await flushPromises()
    lock.status!({ status: CollabFieldLockStatus.Failure, type: CollabFieldLockType.Acquire } as never)

    // A release sent meanwhile is refused at once, as the server does.
    const firstDropAt = Date.now()
    while (Date.now() - firstDropAt < 7000 && released.mock.calls.length === 0) {
      await new Promise((resolve) => setTimeout(resolve, 20))
    }
    lock.status!({ status: CollabFieldLockStatus.Failure, type: CollabFieldLockType.Release } as never)
    await new Promise((resolve) => setTimeout(resolve, 700))
    await flushPromises()

    expect(acquired).toHaveBeenCalledTimes(1)
    expect(addByFiles).not.toHaveBeenCalled()
    addByFiles.mockRestore()
    wrapper.unmount()
  })

  // Released when the drop gave up, the lock the open menu asked for went with it: one the server granted after its
  // request timed out, and the confirm's own release, skipped as for a lock already given back.
  it('keeps the lock of a menu opened while a drop waits', { timeout: 15000 }, async () => {
    const { wrapper } = mountWidget('lead-drop-then-menu')
    await flushPromises()
    wrapper.findComponent({ name: 'AFileDropzone' }).vm.$emit('drop', [new File(['x'], 'x.jpg')])
    await flushPromises()
    lock.status!({ status: CollabFieldLockStatus.Failure, type: CollabFieldLockType.Acquire } as never)
    await wrapper.find('[aria-label="Edit image"]').trigger('click')
    await flushPromises()
    lock.status!({ status: CollabFieldLockStatus.Failure, type: CollabFieldLockType.Acquire } as never)
    await new Promise((resolve) => setTimeout(resolve, 5600))
    await flushPromises()

    expect(acquired).toHaveBeenCalledTimes(2)
    expect(released).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  // The refusal of a release sent before a new request answered nothing about that request: read as the lock held, it
  // let the new drop upload before its own answer came.
  it('waits for its own answer when an earlier release is refused meanwhile', { timeout: 20000 }, async () => {
    const { wrapper } = mountWidget('lead-release-then-drop')
    const addByFiles = vi.spyOn(useUploadQueuesStore(), 'addByFiles').mockResolvedValue(undefined as never)
    await flushPromises()
    const dropzone = wrapper.findComponent({ name: 'AFileDropzone' })
    dropzone.vm.$emit('drop', [new File(['x'], 'x.jpg')])
    const firstDropAt = Date.now()
    while (Date.now() - firstDropAt < 7000 && released.mock.calls.length === 0) {
      await new Promise((resolve) => setTimeout(resolve, 20))
    }
    expect(released).toHaveBeenCalledTimes(1)

    dropzone.vm.$emit('drop', [new File(['y'], 'y.jpg')])
    await flushPromises()
    lock.status!({ status: CollabFieldLockStatus.Failure, type: CollabFieldLockType.Release } as never)
    await new Promise((resolve) => setTimeout(resolve, 300))
    await flushPromises()
    expect(addByFiles).not.toHaveBeenCalled()

    lock.status!({ status: CollabFieldLockStatus.Success, type: CollabFieldLockType.Acquire } as never)
    await new Promise((resolve) => setTimeout(resolve, 300))
    await flushPromises()
    expect(addByFiles).toHaveBeenCalledTimes(1)
    addByFiles.mockRestore()
    wrapper.unmount()
  })

  it('asks for the lock again on the next drop when it was refused', async () => {
    const { wrapper } = mountWidget('lead-refused')
    await flushPromises()
    wrapper.findComponent({ name: 'AFileDropzone' }).vm.$emit('drop', [new File(['x'], 'x.jpg')])
    await flushPromises()
    lock.status!({ status: CollabFieldLockStatus.Failure, type: CollabFieldLockType.Acquire } as never)
    await flushPromises()

    wrapper.findComponent({ name: 'AFileDropzone' }).vm.$emit('drop', [new File(['x'], 'x.jpg')])
    await flushPromises()
    expect(acquired).toHaveBeenCalledTimes(2)
    wrapper.unmount()
  })

  it('waits for the answer to its own lock before a drop uploads', async () => {
    const { wrapper } = mountWidget('lead-wait')
    const addByFiles = vi.spyOn(useUploadQueuesStore(), 'addByFiles').mockResolvedValue(undefined as never)
    await flushPromises()
    lock.status!({ status: CollabFieldLockStatus.Failure, type: CollabFieldLockType.Release } as never)

    wrapper.findComponent({ name: 'AFileDropzone' }).vm.$emit('drop', [new File(['x'], 'x.jpg')])
    await flushPromises()
    expect(acquired).toHaveBeenCalledTimes(1)
    expect(addByFiles).not.toHaveBeenCalled()

    lock.status!({ status: CollabFieldLockStatus.Success, type: CollabFieldLockType.Acquire } as never)
    await new Promise((resolve) => setTimeout(resolve, 150))
    await flushPromises()
    expect(addByFiles).toHaveBeenCalledTimes(1)
    addByFiles.mockRestore()
    wrapper.unmount()
  })
})
