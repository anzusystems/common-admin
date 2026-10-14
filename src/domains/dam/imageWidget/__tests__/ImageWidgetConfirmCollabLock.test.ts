import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { defineComponent, h, ref, shallowRef } from 'vue'
import ImageWidgetInner from '@/domains/dam/imageWidget/components/ImageWidgetInner.vue'
import { ImageWidgetUploadConfigKey } from '@/domains/dam/imageWidget/utils/imageWidgetInkectionKeys'
import { useImageMediaWidgetStore } from '@/domains/dam/imageWidget/store/imageMediaWidgetStore'
import { useUploadQueueDialog } from '@/domains/dam/uploadQueue/composables/useUploadQueueDialog'

// The lock of the field, when the save of the image answers a confirm whose dialog has been closed meanwhile and
// opened again for another image. That dialog stays open, and holds the lock: the answer does not give it back in a
// room with other editors, where the close or the confirm of that dialog does. Alone in the room the editor holds no
// lock, and the saved image goes to the buffer of the room with the answer, as it did. The form `expandMetadata`
// draws in the page is no dialog opened since: there the answer gives the lock back as before.

const released = vi.fn()
const acquired = vi.fn()
const saves = vi.hoisted(() => ({ answer: [] as Array<() => void> }))

vi.mock('@/domains/collab/composables/commonAdminCollabOptions', () => ({
  useCommonAdminCollabOptions: () => ({ collabOptions: ref({ enabled: true }) }),
}))
vi.mock('@/domains/collab/composables/collabField', () => ({
  useCollabField: () => ({
    releaseCollabFieldLock: released,
    acquireCollabFieldLock: acquired,
    addCollabFieldLockStatusListener: () => undefined,
    lockedByUser: ref<number | null>(null),
  }),
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
        texts: { description: 'listing', source: 'Agency' },
        flags: { showSource: true, internal: false, overrideInternal: false },
        dam: { damId: 'file-7', licenceId: 1, regionPosition: 0, internal: false },
        position: 1,
      })),
      // The image is saved under the next id, once the case lets the save answer.
      updateImage: vi.fn(
        (_client: unknown, id: number, data: object) =>
          new Promise((resolve) => saves.answer.push(() => resolve({ ...data, id: id + 1 })))
      ),
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
  texts: { description: 'listing', source: 'Agency' },
  flags: { showSource: true, internal: false, overrideInternal: false },
  dam: { damId: 'file-7', licenceId: 1, regionPosition: 0, internal: false },
  position: 1,
}
const another = { ...image, texts: { description: 'opened since', source: 'Agency' } }

const mounted: VueWrapper[] = []
afterEach(() => {
  mounted.splice(0).forEach((wrapper) => wrapper.unmount())
  useUploadQueueDialog().uploadQueueDialog.value = null
  saves.answer.length = 0
})

const mountWidget = async (
  queueKey: string,
  collabStatus: 'active' | 'inactive',
  props: Record<string, unknown> = {}
) => {
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
        collabStatus,
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
      },
    },
  })
  mounted.push(wrapper)
  await flushPromises()
  return { wrapper, model, dialog: wrapper.findComponent({ name: 'ImageDetailDialogMetadata' }) }
}
type Dialog = Awaited<ReturnType<typeof mountWidget>>['dialog']
/** The dialog of the widget is opened for an image, as "edit metadata" of its menu opens it. */
const openFor = async (dialog: Dialog, shown: object) => {
  useImageMediaWidgetStore().setDetail(shown as never)
  dialog.vm.$emit('update:modelValue', true)
  await flushPromises()
}
const close = async (dialog: Dialog) => {
  dialog.vm.$emit('close')
  await flushPromises()
}
/** "Confirm" is pressed, and the save of the image is on its way. */
const confirm = async (dialog: Dialog) => {
  dialog.vm.$emit('confirm')
  await flushPromises()
  expect(saves.answer).toHaveLength(1)
}
const saveAnswers = async () => {
  saves.answer[0]!()
  await flushPromises()
  await flushPromises()
}
const givenBackWith = () => released.mock.calls.map(([value]) => value)

describe('the lock of the field of ImageWidgetInner, once the save answers a confirm whose dialog was opened again for another image', () => {
  it('stays with that dialog in a room with other editors: its close gives the lock back, with the saved image', async () => {
    const { model, dialog } = await mountWidget('lock-with-others', 'active')
    await openFor(dialog, image)
    expect(acquired).toHaveBeenCalledTimes(1)
    await confirm(dialog)
    await close(dialog)
    expect(givenBackWith()).toEqual([7])
    await openFor(dialog, another)
    expect(acquired).toHaveBeenCalledTimes(2)
    released.mockClear()

    await saveAnswers()

    expect(model.value).toBe(8)
    expect(dialog.props('modelValue')).toBe(true)
    expect(useImageMediaWidgetStore().detail).toMatchObject({ texts: { description: 'opened since' } })
    expect(givenBackWith()).toEqual([])

    await close(dialog)
    expect(givenBackWith()).toEqual([8])
  })

  it('is not held by an editor alone in the room: the saved image goes to the buffer of the room with the answer', async () => {
    const { model, dialog } = await mountWidget('lock-alone', 'inactive')
    await openFor(dialog, image)
    await confirm(dialog)
    await close(dialog)
    await openFor(dialog, another)
    expect([acquired.mock.calls, givenBackWith()]).toEqual([[], []])

    await saveAnswers()

    expect(model.value).toBe(8)
    expect(dialog.props('modelValue')).toBe(true)
    expect(givenBackWith()).toEqual([8])
  })

  it('is given back with the answer, as before, by the form drawn in the page, also when an upload has put another image into it', async () => {
    const { model, wrapper, dialog } = await mountWidget('lock-of-a-form', 'active', { expandMetadata: true })
    expect(useImageMediaWidgetStore().detail).toMatchObject({ id: 7 })
    await confirm(dialog)
    // An upload of the widget is applied meanwhile: its image is in the form, and the field is locked for it.
    useUploadQueueDialog().uploadQueueDialog.value = 'lock-of-a-form'
    await flushPromises()
    wrapper.findComponent({ name: 'UploadQueueDialogSingle' }).vm.$emit('apply', [{ ...another }])
    useUploadQueueDialog().uploadQueueDialog.value = null
    await flushPromises()
    expect(acquired).toHaveBeenCalledTimes(1)
    expect(givenBackWith()).toEqual([])

    await saveAnswers()

    expect(model.value).toBe(8)
    expect(givenBackWith()).toEqual([8])
    expect(useImageMediaWidgetStore().detail).toMatchObject({ id: 8, texts: { description: 'listing' } })
  })
})
