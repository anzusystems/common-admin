import { describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { defineComponent, h, ref, shallowRef } from 'vue'
import ImageWidgetInner from '@/domains/dam/imageWidget/components/ImageWidgetInner.vue'
import { ImageWidgetUploadConfigKey } from '@/domains/dam/imageWidget/utils/imageWidgetInkectionKeys'
import { useImageMediaWidgetStore } from '@/domains/dam/imageWidget/store/imageMediaWidgetStore'
import { useUploadQueuesStore } from '@/domains/dam/uploadQueue/store/uploadQueuesStore'
import {
  CollabFieldLockStatus,
  type CollabFieldLockStatusPayload,
  CollabFieldLockType,
} from '@/domains/collab/composables/collabEventBus'

// A second release of the field's lock is refused by the server, and the widget read the refusal as the lock still
// held: the next drop uploaded without waiting for its own lock, also while another editor held the field.

const released = vi.fn()
const acquired = vi.fn()
const copied = vi.hoisted(() => ({ resolve: null as null | ((value: unknown) => void) }))
vi.mock('@/domains/dam/api/damImageApi', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  copyToLicence: () => new Promise((resolve) => (copied.resolve = resolve)),
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
        texts: { description: 'listing', source: '' },
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

const image = {
  id: 7,
  texts: { description: 'listing', source: '' },
  flags: { showSource: true, internal: false, overrideInternal: false },
  dam: { damId: 'file-7', licenceId: 1, regionPosition: 0, internal: false },
  position: 1,
}

const mountWidget = (queueKey: string) => {
  released.mockClear()
  acquired.mockClear()
  const model = ref<number | null>(7)
  const Parent = defineComponent({
    setup: () => () =>
      h(ImageWidgetInner as never, {
        queueKey,
        uploadLicence: 1,
        selectLicences: [1],
        image,
        modelValue: model.value,
        'onUpdate:modelValue': (value: number | null) => (model.value = value),
        collab: { room: 'article:1', field: 'listingImage', cachedUsers: new Map() },
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
        AAssetSelect: true,
        AssetDetailDialog: true,
        UploadQueueDialogSingle: true,
        AFileInputDialog: true,
        AFileDropzone: true,
        ACollabLockedByUser: true,
      },
    },
  })
  return { wrapper, model }
}

const openMenu = async (wrapper: ReturnType<typeof mountWidget>['wrapper']) => {
  await flushPromises()
  await wrapper.find('[aria-label="Edit image"]').trigger('click')
  await flushPromises()
}

const drop = (wrapper: ReturnType<typeof mountWidget>['wrapper']) =>
  wrapper.findComponent({ name: 'AFileDropzone' }).vm.$emit('drop', [new File(['x'], 'x.jpg')])

describe('ImageWidgetInner in a collab room', () => {
  it('releases the field once, with no image, after a remove', async () => {
    const { wrapper, model } = mountWidget('listing-remove')
    await openMenu(wrapper)
    const remove = [...document.body.querySelectorAll('.v-list-item')].find((item) =>
      /remove/i.test(item.textContent ?? '')
    ) as HTMLElement | undefined
    remove?.click()
    await flushPromises()
    await flushPromises()

    // eslint-disable-next-line vue/no-ref-object-reactivity-loss -- final read for an assertion
    expect(model.value).toBeNull()
    expect(acquired).toHaveBeenCalledTimes(1)
    expect(released).toHaveBeenCalledTimes(1)
    expect(released.mock.calls[0]![0]).toBeNull()
    wrapper.unmount()
  })

  it('releases once with the image it saved', async () => {
    const { wrapper } = mountWidget('listing-confirm')
    await openMenu(wrapper)
    const dialog = wrapper.findComponent({ name: 'ImageDetailDialogMetadata' })
    dialog.vm.$emit('update:modelValue', true)
    await flushPromises()
    useImageMediaWidgetStore().setDetail({ ...image } as never)
    dialog.vm.$emit('confirm')
    await flushPromises()
    await flushPromises()

    expect(released).toHaveBeenCalledTimes(1)
    expect(released.mock.calls[0]![0]).toBe(8)
    wrapper.unmount()
  })

  it('takes no drop while another editor holds the field, whatever an earlier refusal left behind', async () => {
    const { wrapper } = mountWidget('listing-drop')
    await flushPromises()
    lock.status!({ status: CollabFieldLockStatus.Failure, type: CollabFieldLockType.Release } as never)
    lock.byUser!.value = 9
    await flushPromises()

    drop(wrapper)
    await flushPromises()

    expect(acquired).not.toHaveBeenCalled()
    expect(wrapper.findComponent({ name: 'UploadQueueDialogSingle' }).exists()).toBe(false)
    wrapper.unmount()
  })

  // The picker closes itself as it answers, and the upload of the copy opens only once the copy is made.
  it('keeps the lock while a picked asset is copied into the licence', async () => {
    const { wrapper } = mountWidget('listing-pick')
    await openMenu(wrapper)
    const picker = wrapper.findComponent({ name: 'AAssetSelect' })
    picker.vm.$emit('update:modelValue', true)
    await flushPromises()
    picker.vm.$emit('confirm', {
      type: 'asset',
      value: [{ id: 'a1', licence: 2, mainFile: { id: 'f1' } }],
      copyToLicence: 1,
    })
    picker.vm.$emit('update:modelValue', false)
    await flushPromises()
    expect(released).not.toHaveBeenCalled()

    // Nothing copied: the pick ends without a dialog, and the lock goes.
    copied.resolve!([])
    await flushPromises()
    await flushPromises()
    expect(released).toHaveBeenCalledTimes(1)
    wrapper.unmount()
  })

  // A timed-out request answers as a refusal, and the server may have granted it meanwhile.
  it('still releases, with its value, a lock whose answer came back failed', async () => {
    const { wrapper } = mountWidget('listing-timeout')
    await openMenu(wrapper)
    lock.status!({ status: CollabFieldLockStatus.Failure, type: CollabFieldLockType.Acquire } as never)
    const remove = [...document.body.querySelectorAll('.v-list-item')].find((item) =>
      /remove/i.test(item.textContent ?? '')
    ) as HTMLElement | undefined
    remove?.click()
    await flushPromises()

    expect(released).toHaveBeenCalledTimes(1)
    expect(released.mock.calls[0]![0]).toBeNull()
    wrapper.unmount()
  })

  // Sent by the click that closes the menu, a second request raced the menu's release on the server.
  it('asks once, and releases, when the menu is closed by its button before the answer', async () => {
    const { wrapper } = mountWidget('listing-toggle')
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
    const { wrapper } = mountWidget('listing-toggle-failed')
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
    const { wrapper } = mountWidget('listing-menu-after-drop')
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
    const { wrapper } = mountWidget('listing-two-drops')
    await flushPromises()
    const dropzone = wrapper.findComponent({ name: 'AFileDropzone' })
    dropzone.vm.$emit('drop', [new File(['x'], 'x.jpg')])
    dropzone.vm.$emit('drop', [new File(['y'], 'y.jpg')])
    await flushPromises()

    expect(acquired).toHaveBeenCalledTimes(1)
    wrapper.unmount()
  })

  it('asks for the lock again on the next drop when it was refused', async () => {
    const { wrapper } = mountWidget('listing-refused')
    await flushPromises()
    drop(wrapper)
    await flushPromises()
    lock.status!({ status: CollabFieldLockStatus.Failure, type: CollabFieldLockType.Acquire } as never)
    await flushPromises()

    drop(wrapper)
    await flushPromises()
    expect(acquired).toHaveBeenCalledTimes(2)
    wrapper.unmount()
  })

  it('waits for the answer to its own lock before a drop uploads', async () => {
    const { wrapper } = mountWidget('listing-wait')
    const addByFiles = vi.spyOn(useUploadQueuesStore(), 'addByFiles').mockResolvedValue(undefined as never)
    await flushPromises()
    lock.status!({ status: CollabFieldLockStatus.Failure, type: CollabFieldLockType.Release } as never)

    drop(wrapper)
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
