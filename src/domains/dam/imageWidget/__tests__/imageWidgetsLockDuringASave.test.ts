import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { type Component, defineComponent, h, ref, shallowRef } from 'vue'
import ImageMediaWidgetInner from '@/domains/dam/imageWidget/components/ImageMediaWidgetInner.vue'
import ImageWidgetInner from '@/domains/dam/imageWidget/components/ImageWidgetInner.vue'
import { useImageMediaWidgetStore } from '@/domains/dam/imageWidget/store/imageMediaWidgetStore'
import { ImageWidgetUploadConfigKey } from '@/domains/dam/imageWidget/utils/imageWidgetInkectionKeys'
import { useUploadQueueDialog } from '@/domains/dam/uploadQueue/composables/useUploadQueueDialog'

// The lock of the field of the two widgets of one image in an article open by two editors, while the save of a
// "confirm" of the image dialog is on its way. Closed before the save answered, the dialog gave the lock back with the
// image the field had before, and the release of the answer, as for a lock already given back, never sent the saved
// image to the other editor. The lock is the confirm's till it is over: given back with the saved image once the save
// answers, with what the field had when it fails. A menu or picker of the widget opened meanwhile keeps it, and the
// saved image is sent to the room without it. A widget taken away while its confirm runs gives it back all the
// same. The dialog of the image and the collaboration are stand-ins; the save of the image answers when the case
// lets it.

const released = vi.fn()
const acquired = vi.fn()
const changed = vi.fn()
const saves = vi.hoisted(() => ({ waiting: [] as Array<{ answer: () => void; fail: () => void }> }))

vi.mock('@/domains/collab/composables/commonAdminCollabOptions', () => ({
  useCommonAdminCollabOptions: () => ({ collabOptions: ref({ enabled: true }) }),
}))
vi.mock('@/domains/collab/composables/collabField', () => ({
  useCollabField: (_room: string, field: string) => ({
    releaseCollabFieldLock: (value: unknown) => released(field, value),
    acquireCollabFieldLock: () => acquired(field),
    changeCollabFieldData: (value: unknown) => changed(field, value),
    addCollabFieldLockStatusListener: () => undefined,
    lockedByUser: ref<number | null>(null),
  }),
}))
vi.mock('@/domains/dam/imageWidget/composables/commonAdminImageOptions', () => {
  // An image is saved under the next id (a new one under 8), once the case lets the save answer.
  const held = (id: number | undefined, data: object) =>
    new Promise((resolve, reject) =>
      saves.waiting.push({
        answer: () => resolve({ ...data, id: id ? id + 1 : 8 }),
        fail: () => reject(new Error('the image was not saved')),
      })
    )
  return {
    useCommonAdminImageOptions: () => ({
      imageClient: () => ({}),
      previewDomain: 'https://img',
      imageWidth: 300,
      imageHeight: 200,
      imageApi: {
        fetchImage: vi.fn(async (_client: unknown, id: number) => ({ ...image, id })),
        updateImage: vi.fn((_client: unknown, id: number, data: object) => held(id, data)),
        createImage: vi.fn((_client: unknown, data: object) => held(undefined, data)),
      },
    }),
  }
})
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
/** The image of a pick or an upload for a widget without an image: it has no id yet. */
const picked = {
  texts: { description: 'picked', source: 'Agency' },
  flags: image.flags,
  dam: { ...image.dam, damId: 'file-9' },
  position: 1,
}

const mounted: VueWrapper[] = []
afterEach(() => {
  mounted.splice(0).forEach((wrapper) => wrapper.unmount())
  useUploadQueueDialog().uploadQueueDialog.value = null
  saves.waiting.length = 0
})

describe.each<[string, Component]>([
  ['ImageWidgetInner', ImageWidgetInner],
  ['ImageMediaWidgetInner', ImageMediaWidgetInner],
])('the lock of the field of %s in a room with other editors', (_name, component) => {
  const isImageWidget = component === ImageWidgetInner
  /** What the field is given back with, as each widget sends it: the image id, or the image and the media. */
  const valueOf = (id: number | null) => (isImageWidget ? id : { image: id, media: null })

  /** The widget of a field of the article: of an image, or of none. */
  const mountWidget = async (field: string, imageId: number | null = 7) => {
    const model = ref<number | null>(imageId)
    const Parent = defineComponent({
      setup: () => () =>
        h(component as never, {
          queueKey: field,
          uploadLicence: 1,
          selectLicences: [1],
          ...(isImageWidget
            ? {
                image: imageId ? image : undefined,
                modelValue: model.value,
                'onUpdate:modelValue': (value: number | null) => (model.value = value),
              }
            : {
                initialImage: imageId ? image : undefined,
                image: model.value,
                'onUpdate:image': (value: number | null) => (model.value = value),
                media: null,
              }),
          collab: { room: 'article:1', field, cachedUsers: new Map() },
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
          AAssetSelectMedia: true,
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
    // Found anew each time: once another widget is mounted with stand-ins of its own, this one draws its dialog anew
    // with those.
    return { wrapper, model, dialog: () => wrapper.findComponent({ name: 'ImageDetailDialogMetadata' }) }
  }
  type Dialog = Awaited<ReturnType<typeof mountWidget>>['dialog']
  /** The dialog of the widget is opened for an image, as "edit metadata", a pick or an upload opens it. */
  const openFor = async (dialog: Dialog, shown: object) => {
    useImageMediaWidgetStore().setDetail(structuredClone(shown) as never)
    dialog().vm.$emit('update:modelValue', true)
    await flushPromises()
  }
  const close = async (dialog: Dialog) => {
    dialog().vm.$emit('close')
    await flushPromises()
  }
  /** "Confirm" is pressed, and the save of the image is on its way. */
  const confirm = async (dialog: Dialog) => {
    dialog().vm.$emit('confirm')
    await flushPromises()
    expect(saves.waiting).toHaveLength(1)
  }
  const saveAnswers = async (how: 'answer' | 'fail' = 'answer') => {
    saves.waiting.shift()![how]()
    await flushPromises()
    await flushPromises()
  }
  const givenBack = () => released.mock.calls
  /** What was sent to the room as the value of the field, the lock kept. */
  const sent = () => changed.mock.calls
  /** The menu of the widget is opened and closed again, as by its button and a click beside it. */
  const menuOpenedAndClosed = async (wrapper: VueWrapper) => {
    const menu = wrapper.findComponent({ name: 'VMenu' })
    menu.vm.$emit('update:modelValue', true)
    await flushPromises()
    menu.vm.$emit('update:modelValue', false)
    await flushPromises()
  }
  /** Each case starts from a widget whose dialog is open over its image, with the lock taken for it. */
  const confirmedAndClosed = async () => {
    released.mockClear()
    acquired.mockClear()
    changed.mockClear()
    const widget = await mountWidget('listingImage')
    await openFor(widget.dialog, image)
    expect(acquired.mock.calls).toEqual([['listingImage']])
    await confirm(widget.dialog)
    await close(widget.dialog)
    return widget
  }

  it('is kept by the confirm when its dialog is closed before the save answers, and given back with the saved image once it has', async () => {
    const { model } = await confirmedAndClosed()
    expect(givenBack()).toEqual([])

    await saveAnswers()

    expect(model.value).toBe(8)
    expect(givenBack()).toEqual([['listingImage', valueOf(8)]])
    expect(sent()).toEqual([])
  })

  // The answer gave the lock back while they were open: a pick confirmed in the picker then changed the field, and
  // the other editor was not told.
  it.each<[string, (wrapper: VueWrapper) => VueWrapper]>([
    [
      'the library picker',
      (wrapper) => wrapper.findComponent({ name: isImageWidget ? 'AAssetSelect' : 'AAssetSelectMedia' }),
    ],
    ['the menu', (wrapper) => wrapper.findComponent({ name: 'VMenu' })],
  ])(
    'stays with %s of the widget opened meanwhile: the answer sends the saved image, and its close gives the lock back with it',
    async (_what, ofTheWidget) => {
      const { wrapper, model } = await confirmedAndClosed()
      ofTheWidget(wrapper).vm.$emit('update:modelValue', true)
      await flushPromises()

      await saveAnswers()

      expect(model.value).toBe(8)
      expect(givenBack()).toEqual([])
      expect(sent()).toEqual([['listingImage', valueOf(8)]])

      ofTheWidget(wrapper).vm.$emit('update:modelValue', false)
      await flushPromises()
      expect(givenBack()).toEqual([['listingImage', valueOf(8)]])
    }
  )

  // Taken away, as by the pin of a sidebar widget that draws a copy of it elsewhere, the widget writes nothing of
  // the answer: the field keeps what it had, and the copy shows that. Its lock is a message to the room, not a write
  // into the page: it was never given back, and the field stayed locked for the other editor.
  it.each<['answer' | 'fail']>([['answer'], ['fail']])(
    'is given back by a widget taken away while its confirm runs, once the save is over (%s), with what its field has',
    async (how) => {
      const { wrapper } = await confirmedAndClosed()
      mounted.splice(mounted.indexOf(wrapper), 1)
      wrapper.unmount()
      expect(givenBack()).toEqual([])

      await saveAnswers(how)

      expect(givenBack()).toEqual([['listingImage', valueOf(7)]])
      expect(sent()).toEqual([])
    }
  )

  // A copy of the widget drawn in its place takes the lock of the same field for a dialog of its own while the save
  // of the widget taken away is on its way. The server takes the two as one editor's: the late release of the widget
  // taken away freed the lock the copy held, and the other editor could change the field under its open dialog.
  it('is left by a widget taken away to the widget drawn in its place, once that one has taken the lock of the field', async () => {
    const { wrapper } = await confirmedAndClosed()
    mounted.splice(mounted.indexOf(wrapper), 1)
    wrapper.unmount()
    const copy = await mountWidget('listingImage')
    await openFor(copy.dialog, image)
    expect(acquired.mock.calls).toEqual([['listingImage'], ['listingImage']])

    await saveAnswers()

    expect(givenBack()).toEqual([])
    await close(copy.dialog)
    expect(givenBack()).toEqual([['listingImage', valueOf(7)]])
  })

  // The dialog of another pick or upload sets what the field ends with, also under the id saved here when this was a
  // create (the image of that dialog takes it). Sent at the answer, that id reached the other editor, whose widget
  // reads an image again only when the id changes: it went on showing this image after that dialog had saved its own.
  it('sends nothing at the answer while the dialog of another pick of the widget is open: the field goes with its release', async () => {
    const { model, dialog } = await confirmedAndClosed()
    await openFor(dialog, { ...image, texts: { description: 'of another pick', source: 'Agency' } })

    await saveAnswers()

    expect(model.value).toBe(8)
    expect([givenBack(), sent()]).toEqual([[], []])
    await close(dialog)
    expect(givenBack()).toEqual([['listingImage', valueOf(8)]])
    expect(sent()).toEqual([])
  })

  it('is given back with the image the field had when that save fails', async () => {
    const { model } = await confirmedAndClosed()
    expect(givenBack()).toEqual([])

    await saveAnswers('fail')

    expect(model.value).toBe(7)
    expect(givenBack()).toEqual([['listingImage', valueOf(7)]])
  })

  it('is not given back by the menu of the widget opened and closed meanwhile either', async () => {
    const { wrapper } = await confirmedAndClosed()
    await menuOpenedAndClosed(wrapper)
    expect(givenBack()).toEqual([])

    await saveAnswers()

    expect(givenBack()).toEqual([['listingImage', valueOf(8)]])
  })

  it('is given back once, with the saved image, by the answer that closes the dialog, as before', async () => {
    released.mockClear()
    const { model, dialog } = await mountWidget('listingImage')
    await openFor(dialog, image)
    await confirm(dialog)

    await saveAnswers()

    expect(model.value).toBe(8)
    expect(dialog().props('modelValue')).toBe(false)
    expect(givenBack()).toEqual([['listingImage', valueOf(8)]])
  })

  // The store of the image dialog is one for the page: by the time the save answers, what it shows is the image of
  // the dialog of another widget, opened after this one was closed. That dialog is not this confirm's to keep open,
  // to empty, or to give the created image to.
  it('is given back with the created image when the dialog of another widget is open by then, which keeps its image', async () => {
    released.mockClear()
    const first = await mountWidget('listingImage', null)
    const second = await mountWidget('leadImage', null)
    await openFor(first.dialog, picked)
    await confirm(first.dialog)
    await close(first.dialog)
    await openFor(second.dialog, { ...picked, texts: { description: 'of the second', source: 'Agency' } })
    expect(givenBack()).toEqual([])

    await saveAnswers()

    expect(first.model.value).toBe(8)
    expect(givenBack()).toEqual([['listingImage', valueOf(8)]])
    expect(second.dialog().props('modelValue')).toBe(true)
    expect(useImageMediaWidgetStore().detail).toEqual({
      ...picked,
      texts: { description: 'of the second', source: 'Agency' },
    })
  })
})
