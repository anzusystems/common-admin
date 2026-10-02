import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { defineComponent, h, ref, shallowRef } from 'vue'
import ImageWidgetInner from '@/domains/dam/imageWidget/components/ImageWidgetInner.vue'
import { ImageWidgetUploadConfigKey } from '@/domains/dam/imageWidget/utils/imageWidgetInkectionKeys'
import { useImageMediaWidgetStore } from '@/domains/dam/imageWidget/store/imageMediaWidgetStore'
import { useUploadQueuesStore } from '@/domains/dam/uploadQueue/store/uploadQueuesStore'
import { useUploadQueueDialog } from '@/domains/dam/uploadQueue/composables/useUploadQueueDialog'
import { useCollabStateInternal } from '@/domains/collab/composables/collabState'
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
const deleted = vi.hoisted(() => ({
  resolve: null as null | ((value: unknown) => void),
  reject: null as null | ((reason: unknown) => void),
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
      deleteImage: vi.fn(() => new Promise((resolve, reject) => Object.assign(deleted, { resolve, reject }))),
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

// A failed try leaves its widget mounted, and the next try clicked that one's menu items.
const mountedWrappers: VueWrapper[] = []
afterEach(() => {
  mountedWrappers.splice(0).forEach((wrapper) => {
    if (wrapper.exists()) wrapper.unmount()
  })
})

const mountWidget = (
  queueKey: string,
  collabStatus = 'active',
  props: Record<string, unknown> = {},
  stubs: Record<string, unknown> = {}
) => {
  const status = ref(collabStatus)
  // Shared: an upload left open by an earlier test, or by a failed try of this one, counts as a dialog open here.
  useUploadQueueDialog().uploadQueueDialog.value = null
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
        collabStatus: status.value,
        ...props,
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
        ...stubs,
      },
    },
  })
  mountedWrappers.push(wrapper)
  return { wrapper, model, status }
}

const openMenu = async (wrapper: ReturnType<typeof mountWidget>['wrapper']) => {
  await flushPromises()
  await wrapper.find('[aria-label="Edit image"]').trigger('click')
  await flushPromises()
}

// A menu just closed opens again only once its transition is over.
const reopenMenu = async (wrapper: ReturnType<typeof mountWidget>['wrapper']) => {
  await new Promise((resolve) => setTimeout(resolve, 400))
  await wrapper.find('[aria-label="Edit image"]').trigger('click')
  await flushPromises()
}

const removeImage = async (wrapper: ReturnType<typeof mountWidget>['wrapper']) => {
  await openMenu(wrapper)
  const remove = [...document.body.querySelectorAll('.v-list-item')].find((item) =>
    /remove/i.test(item.textContent ?? '')
  ) as HTMLElement | undefined
  remove!.click()
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

  // Left loading, the metadata dialog showed only a spinner for the next upload or edit.
  it('leaves the metadata dialog not loading after a pick that ends early', async () => {
    const { wrapper } = mountWidget('listing-pick-early')
    await openMenu(wrapper)
    const picker = wrapper.findComponent({ name: 'AAssetSelect' })
    picker.vm.$emit('confirm', { type: 'asset', value: [{ id: 'a1', licence: 1, mainFile: null }] })
    await flushPromises()

    expect(wrapper.findComponent({ name: 'ImageDetailDialogMetadata' }).props('loading')).toBe(false)
    wrapper.unmount()
  })

  // A request that timed out may have been granted: with no menu or dialog open, nothing else released it.
  it('releases the lock of a drop whose wait for it ran out', { timeout: 15000 }, async () => {
    const { wrapper } = mountWidget('listing-drop-timeout')
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
    const { wrapper, status } = mountWidget('listing-turned-inactive')
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
    const { wrapper, status } = mountWidget('listing-reconnect')
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
    const { wrapper, status } = mountWidget('listing-arrival', 'inactive')
    await flushPromises()
    await wrapper.find('[aria-label="Edit image"]').trigger('click')
    await flushPromises()
    expect(acquired).not.toHaveBeenCalled()

    status.value = 'active'
    await flushPromises()
    expect(acquired).toHaveBeenCalledTimes(1)
    wrapper.unmount()
  })

  // Picked while alone and confirmed after the other editor arrived, the image never reached the room.
  it('asks for the lock when another editor arrives while a dialog is open', async () => {
    const { wrapper, status } = mountWidget('listing-arrival-dialog', 'inactive')
    await flushPromises()
    await wrapper.find('[aria-label="Edit image"]').trigger('click')
    await flushPromises()
    wrapper.findComponent({ name: 'AAssetSelect' }).vm.$emit('update:modelValue', true)
    await flushPromises()
    await wrapper.find('[aria-label="Edit image"]').trigger('click')
    await flushPromises()
    expect(acquired).not.toHaveBeenCalled()

    status.value = 'active'
    await flushPromises()
    expect(acquired).toHaveBeenCalledTimes(1)
    wrapper.unmount()
  })

  // With `expandOptions` the buttons open the dialogs directly, and only the menu asked for the lock: the confirm then
  // sent nothing, and the field was not locked for the others meanwhile.
  it('asks for the lock for a dialog opened by an `expandOptions` button, and releases it on close', async () => {
    const { wrapper } = mountWidget('listing-expand-options', 'active', { expandOptions: true })
    await flushPromises()
    await wrapper
      .findAll('button')
      .find((button) => button.text().includes('Edit image'))!
      .trigger('click')
    await flushPromises()
    expect(acquired).toHaveBeenCalledTimes(1)

    wrapper.findComponent({ name: 'ImageDetailDialogMetadata' }).vm.$emit('update:modelValue', false)
    await flushPromises()
    expect(released).toHaveBeenCalledTimes(1)
    wrapper.unmount()
  })

  // The menu closes on the click, before the delete is answered: its release went out with the image still there, and
  // the reset's own was skipped as for a lock already given back.
  it('keeps the lock till the image is deleted, then releases it with none', async () => {
    const { wrapper } = mountWidget('listing-delete-api', 'active', { callDeleteApiOnRemove: true })
    await removeImage(wrapper)
    expect(released).not.toHaveBeenCalled()

    deleted.resolve!(undefined)
    await flushPromises()
    expect(released).toHaveBeenCalledTimes(1)
    expect(released.mock.calls[0]![0]).toEqual(null)
    wrapper.unmount()
  })

  it('releases the lock with the image kept when the delete fails', async () => {
    const { wrapper } = mountWidget('listing-delete-api-failed', 'active', { callDeleteApiOnRemove: true })
    await removeImage(wrapper)
    deleted.reject!(new Error('delete failed'))
    await flushPromises()

    expect(released).toHaveBeenCalledTimes(1)
    expect(released.mock.calls[0]![0]).toEqual(7)
    wrapper.unmount()
  })

  it('keeps the lock of a menu opened again while a delete fails', async () => {
    const { wrapper } = mountWidget('listing-delete-api-menu', 'active', { callDeleteApiOnRemove: true })
    await removeImage(wrapper)
    await reopenMenu(wrapper)
    deleted.reject!(new Error('delete failed'))
    await flushPromises()
    expect(released).not.toHaveBeenCalled()

    await wrapper.find('[aria-label="Edit image"]').trigger('click')
    await flushPromises()
    expect(released).toHaveBeenCalledTimes(1)
    expect(released.mock.calls[0]![0]).toEqual(7)
    wrapper.unmount()
  })

  // A dialog opened and cancelled while the delete ran released the lock with the image still there.
  it('keeps the lock through a dialog cancelled while the image is deleted', async () => {
    const { wrapper } = mountWidget('listing-delete-api-dialog', 'active', { callDeleteApiOnRemove: true })
    await removeImage(wrapper)
    await reopenMenu(wrapper)
    const picker = wrapper.findComponent({ name: 'AAssetSelect' })
    picker.vm.$emit('update:modelValue', true)
    await flushPromises()
    await wrapper.find('[aria-label="Edit image"]').trigger('click')
    await flushPromises()
    picker.vm.$emit('update:modelValue', false)
    await flushPromises()
    expect(released).not.toHaveBeenCalled()

    deleted.resolve!(undefined)
    await flushPromises()
    expect(released).toHaveBeenCalledTimes(1)
    expect(released.mock.calls[0]![0]).toEqual(null)
    wrapper.unmount()
  })

  // The menu's button is disabled while another editor holds the field; the `expandOptions` ones opened their dialogs.
  it('disables the `expandOptions` buttons while another editor holds the field', async () => {
    // Its activator only: the upload button is the dialog's.
    const fileInputDialog = defineComponent({
      setup:
        (_, { slots }) =>
        () =>
          h('div', slots.activator?.({ props: {} })),
    })
    const { wrapper } = mountWidget(
      'listing-expand-options-locked',
      'active',
      { expandOptions: true },
      { AFileInputDialog: fileInputDialog }
    )
    await flushPromises()
    lock.byUser!.value = 9
    await flushPromises()

    const labels = ['Edit image', 'Upload image']
    const buttons = wrapper
      .findAll('button')
      .filter((button) => button.classes('mr-2') || labels.some((label) => button.text().includes(label)))
    expect(buttons.map((button) => button.text())).toEqual(
      expect.arrayContaining([expect.stringContaining('Upload image')])
    )
    buttons.forEach((button) => expect(button.attributes('disabled')).toBeDefined())
    wrapper.unmount()
  })

  // Deleted while a dialog opened meanwhile was open, the lock went with the reset, and the dialog's confirm sent nothing.
  it('leaves the lock to a dialog still open when the image is deleted', async () => {
    const { wrapper } = mountWidget('listing-delete-api-dialog-open', 'active', { callDeleteApiOnRemove: true })
    await removeImage(wrapper)
    await reopenMenu(wrapper)
    const picker = wrapper.findComponent({ name: 'AAssetSelect' })
    picker.vm.$emit('update:modelValue', true)
    await flushPromises()
    await wrapper.find('[aria-label="Edit image"]').trigger('click')
    await flushPromises()
    deleted.resolve!(undefined)
    await flushPromises()
    expect(released).not.toHaveBeenCalled()

    picker.vm.$emit('update:modelValue', false)
    await flushPromises()
    expect(released).toHaveBeenCalledTimes(1)
    expect(released.mock.calls[0]![0]).toEqual(null)
    wrapper.unmount()
  })

  it('leaves the lock to a dialog still open when the delete fails', async () => {
    const { wrapper } = mountWidget('listing-delete-api-dialog-failed', 'active', { callDeleteApiOnRemove: true })
    await removeImage(wrapper)
    await reopenMenu(wrapper)
    const picker = wrapper.findComponent({ name: 'AAssetSelect' })
    picker.vm.$emit('update:modelValue', true)
    await flushPromises()
    await wrapper.find('[aria-label="Edit image"]').trigger('click')
    await flushPromises()
    deleted.reject!(new Error('delete failed'))
    await flushPromises()
    expect(released).not.toHaveBeenCalled()

    picker.vm.$emit('update:modelValue', false)
    await flushPromises()
    expect(released).toHaveBeenCalledTimes(1)
    expect(released.mock.calls[0]![0]).toEqual(7)
    wrapper.unmount()
  })

  // Alone the editor holds no lock for a menu to release later: left to its close, the removal never reached the buffer.
  it('releases a removal alone with the menu open again when the image is deleted', async () => {
    const { wrapper } = mountWidget('listing-delete-api-alone', 'inactive', { callDeleteApiOnRemove: true })
    await removeImage(wrapper)
    await reopenMenu(wrapper)
    deleted.resolve!(undefined)
    await flushPromises()

    expect(released).toHaveBeenCalledTimes(1)
    expect(released.mock.calls[0]![0]).toEqual(null)
    wrapper.unmount()
  })

  // Alone, the editor takes no lock, and the value goes to the buffer for whoever joins: the widgets are not asked
  // for their state when someone does.
  it('releases with its value in a room the editor is alone in, with no lock taken', async () => {
    const { wrapper } = mountWidget('listing-alone-remove', 'inactive')
    await removeImage(wrapper)

    expect(acquired).not.toHaveBeenCalled()
    expect(released).toHaveBeenCalledTimes(1)
    expect(released.mock.calls[0]![0]).toEqual(null)
    wrapper.unmount()
  })

  // Refused while the other editor held the field, the menu's lock was not asked for again once that editor was back.
  it('asks again for a refused lock when another editor arrives while the menu is open', async () => {
    const { wrapper, status } = mountWidget('listing-arrival-refused')
    await flushPromises()
    await wrapper.find('[aria-label="Edit image"]').trigger('click')
    await flushPromises()
    lock.status!({ status: CollabFieldLockStatus.Failure, type: CollabFieldLockType.Acquire } as never)
    status.value = 'inactive'
    await flushPromises()
    status.value = 'active'
    await flushPromises()

    expect(acquired).toHaveBeenCalledTimes(2)
    wrapper.unmount()
  })

  // A dialog opened from the menu holds the lock the menu asked for: released when the drop gave up, the confirm's own
  // release was skipped as for a lock already given back.
  it('keeps the lock of a dialog opened while a drop waits', { timeout: 15000 }, async () => {
    const { wrapper } = mountWidget('listing-drop-then-dialog')
    await flushPromises()
    wrapper.findComponent({ name: 'AFileDropzone' }).vm.$emit('drop', [new File(['x'], 'x.jpg')])
    await flushPromises()
    lock.status!({ status: CollabFieldLockStatus.Failure, type: CollabFieldLockType.Acquire } as never)
    await wrapper.find('[aria-label="Edit image"]').trigger('click')
    await flushPromises()
    lock.status!({ status: CollabFieldLockStatus.Failure, type: CollabFieldLockType.Acquire } as never)
    wrapper.findComponent({ name: 'AAssetSelect' }).vm.$emit('update:modelValue', true)
    await flushPromises()
    await wrapper.find('[aria-label="Edit image"]').trigger('click')
    await new Promise((resolve) => setTimeout(resolve, 5600))
    await flushPromises()

    // The menu's, then the dialog's for the lock the menu's left unconfirmed.
    expect(acquired).toHaveBeenCalledTimes(3)
    expect(released).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  // Released while another drop still waited, a refused release read as the lock held and let that drop upload.
  it('keeps a waiting drop waiting when an earlier drop gives up', { timeout: 20000 }, async () => {
    const { wrapper } = mountWidget('listing-overlapping-drops')
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
    const { wrapper } = mountWidget('listing-drop-then-menu')
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
    const { wrapper } = mountWidget('listing-release-then-drop')
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
