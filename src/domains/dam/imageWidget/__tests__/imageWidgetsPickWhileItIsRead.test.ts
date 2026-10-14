import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { type Component, defineComponent, h, ref, shallowRef } from 'vue'
import ImageMediaWidgetInner from '@/domains/dam/imageWidget/components/ImageMediaWidgetInner.vue'
import ImageWidgetInner from '@/domains/dam/imageWidget/components/ImageWidgetInner.vue'
import { useImageMediaWidgetStore } from '@/domains/dam/imageWidget/store/imageMediaWidgetStore'
import { ImageWidgetUploadConfigKey } from '@/domains/dam/imageWidget/utils/imageWidgetInkectionKeys'
import { useUploadQueueDialog } from '@/domains/dam/uploadQueue/composables/useUploadQueueDialog'
import { useUploadQueuesStore } from '@/domains/dam/uploadQueue/store/uploadQueuesStore'

// A pick in the library of a widget of one image: the widget reads the picked asset before its dialog shows the image.
// The widget of an image or a media showed nothing while it read, and the editor could open the dialog of another
// widget meanwhile; the answer then covered that dialog with this one and replaced its form through the store of the
// dialog, which is one for the page: what the editor had typed there was lost. The dialog shows its loading at once
// now, in both widgets, and the answer is put into it only while it still loads for that pick. The dialog of the image
// and the collaboration are stand-ins; the reads of the asset answer when the case lets them.

const released = vi.fn()
const held = vi.hoisted(() => ({
  reads: [] as Array<{ answer: () => void; fail: () => void }>,
  copies: [] as Array<() => void>,
}))
const read = <T>(answer: T) =>
  new Promise<T>((resolve, reject) =>
    held.reads.push({ answer: () => resolve(answer), fail: () => reject(new Error('the asset was not read')) })
  )

vi.mock('@/domains/collab/composables/commonAdminCollabOptions', () => ({
  useCommonAdminCollabOptions: () => ({ collabOptions: ref({ enabled: true }) }),
}))
vi.mock('@/domains/collab/composables/collabField', () => ({
  useCollabField: (_room: string, field: string) => ({
    releaseCollabFieldLock: (value: unknown) => released(field, value),
    acquireCollabFieldLock: () => undefined,
    changeCollabFieldData: () => undefined,
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
    imageApi: { fetchImage: vi.fn(async (_client: unknown, id: number) => ({ ...image, id })) },
  }),
}))
vi.mock('@/domains/dam/api/damAssetApi', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  fetchAsset: (_client: unknown, _endPoint: string, id: string) =>
    read({ id, authors: [], metadata: { customData: { description: `of ${id}` } } }),
  fetchAssetAsCmsMedia: () => read({ title: 'the media', authorNames: [] }),
}))
vi.mock('@/domains/dam/api/damImageApi', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  copyToLicence: () =>
    new Promise((resolve) =>
      held.copies.push(() => resolve([{ result: 'copy', targetAsset: 'asset-copied', targetMainFile: 'file-copied' }]))
    ),
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
/** What the editor has typed in the form of the dialog of the other widget. */
const typed = { ...image, texts: { description: 'typed by the editor', source: 'Agency' } }
/** An asset as the list of the picker has it. */
const listed = (id: string, assetType = 'image', more: object = {}) => ({
  id,
  licence: 1,
  mainFile: { id: `file-of-${id}` },
  mainFileInternal: false,
  attributes: { assetType },
  podcasts: [],
  ...more,
})

const mounted: VueWrapper[] = []
afterEach(async () => {
  mounted.splice(0).forEach((wrapper) => wrapper.unmount())
  useUploadQueueDialog().uploadQueueDialog.value = null
  held.reads.splice(0).forEach((one) => one.answer())
  held.copies.splice(0).forEach((answer) => answer())
  await flushPromises()
})

const mountOf = async (component: Component, field: string) => {
  const isImageWidget = component === ImageWidgetInner
  const model = ref<number | null>(7)
  const Parent = defineComponent({
    setup: () => () =>
      h(component as never, {
        queueKey: field,
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
  // Found anew each time: once another widget is mounted with stand-ins of its own, this one draws them anew.
  return {
    dialog: () => wrapper.findComponent({ name: 'ImageDetailDialogMetadata' }),
    picker: () => wrapper.findComponent({ name: isImageWidget ? 'AAssetSelect' : 'AAssetSelectMedia' }),
  }
}
type Widget = Awaited<ReturnType<typeof mountOf>>

/** The asset is confirmed in the picker of the widget, which closes; its read is on its way. */
const pick = async (widget: Widget, asset: object) => {
  widget.picker().vm.$emit('update:modelValue', true)
  await flushPromises()
  widget.picker().vm.$emit('confirm', { type: 'asset', value: [asset], copyToLicence: 1 })
  widget.picker().vm.$emit('update:modelValue', false)
  await flushPromises()
}
const answerReads = async (how: 'answer' | 'fail' = 'answer') => {
  while (held.reads.length > 0) {
    held.reads.shift()![how]()
    await flushPromises()
  }
}
const shown = () => useImageMediaWidgetStore().detail
const isOpen = (widget: Widget) => widget.dialog().props('modelValue') as boolean
const loads = (widget: Widget) => widget.dialog().props('loading') as boolean
/** The dialog of the widget is opened for its image, and the editor types in its form. */
const openAndType = async (widget: Widget) => {
  useImageMediaWidgetStore().setDetail(structuredClone(typed))
  widget.dialog().vm.$emit('update:modelValue', true)
  await flushPromises()
}

describe.each<[string, Component]>([
  ['ImageWidgetInner', ImageWidgetInner],
  ['ImageMediaWidgetInner', ImageMediaWidgetInner],
])('a pick of an image in %s while its asset is read', (_name, component) => {
  const isImageWidget = component === ImageWidgetInner
  const valueOf = (id: number | null) => (isImageWidget ? id : { image: id, media: null })

  it('shows the dialog loading at once, and the picked image once it is read', async () => {
    const widget = await mountOf(component, 'listingImage')
    await pick(widget, listed('asset-9'))

    expect([isOpen(widget), loads(widget), shown()]).toEqual([true, true, null])

    await answerReads()
    expect([isOpen(widget), loads(widget)]).toEqual([true, false])
    expect(shown()).toMatchObject({ texts: { description: 'of asset-9' }, dam: { damId: 'file-of-asset-9' } })
  })

  it('closed by the editor while it loads: the answer opens nothing, and the lock goes back with the image the field has', async () => {
    const widget = await mountOf(component, 'listingImage')
    await pick(widget, listed('asset-9'))
    widget.dialog().vm.$emit('close')
    await flushPromises()

    await answerReads()

    expect([isOpen(widget), loads(widget), shown()]).toEqual([false, false, null])
    expect(released.mock.calls).toEqual([['listingImage', valueOf(7)]])
  })

  it('closed while it loads: the dialog of another widget opened meanwhile keeps what the editor typed in it', async () => {
    const widget = await mountOf(component, 'listingImage')
    const another = await mountOf(ImageWidgetInner, 'socialImage')
    await pick(widget, listed('asset-9'))
    widget.dialog().vm.$emit('close')
    await flushPromises()
    await openAndType(another)

    await answerReads()

    expect([isOpen(widget), isOpen(another)]).toEqual([false, true])
    expect(shown()).toEqual(typed)
  })

  // The store of the dialog is the page's: what it holds by the answer is another dialog's form. The dialog that
  // loaded for the pick closes: it shows that form too, and its confirm would save it as the image of this widget.
  it('never replaces the form of the dialog of another widget opened over it while it loads, and closes', async () => {
    const widget = await mountOf(component, 'listingImage')
    const another = await mountOf(ImageWidgetInner, 'socialImage')
    await pick(widget, listed('asset-9'))
    await openAndType(another)

    await answerReads()

    expect([isOpen(widget), loads(widget), isOpen(another)]).toEqual([false, false, true])
    expect(shown()).toEqual(typed)
  })

  it.each<['before' | 'after']>([['before'], ['after']])(
    'picked again after it was closed: the first answer, coming %s the second, is not taken, and the dialog loads till the second',
    async (when) => {
      const widget = await mountOf(component, 'listingImage')
      await pick(widget, listed('asset-9'))
      const first = held.reads.splice(0)
      widget.dialog().vm.$emit('close')
      await flushPromises()
      await pick(widget, listed('asset-10'))
      const firstAnswers = async () => {
        first.forEach((one) => one.answer())
        await flushPromises()
        await flushPromises()
      }

      if (when === 'before') {
        await firstAnswers()
        expect([isOpen(widget), loads(widget), shown()]).toEqual([true, true, null])
      }
      await answerReads()
      if (when === 'after') {
        await firstAnswers()
        // And whatever that answer has gone on to read.
        await answerReads()
      }

      expect([isOpen(widget), loads(widget)]).toEqual([true, false])
      expect(shown()).toMatchObject({ dam: { damId: 'file-of-asset-10' } })
    }
  )

  // An image of another licence is copied into the licence of the upload, and the upload dialog shows the copy. The
  // dialog loads till then, so that nothing else is opened meanwhile: nothing was shown, and the upload dialog covered
  // a dialog of another widget opened since, whose form its "Save and apply" replaced.
  describe('copied into the licence of the upload', () => {
    const queueKey = 'listingImage'
    const copyOnItsWay = async () => {
      const queued = vi.spyOn(useUploadQueuesStore(), 'addByCopyToLicence').mockResolvedValue(undefined as never)
      const widget = await mountOf(component, queueKey)
      await pick(widget, listed('asset-9', 'image', { licence: 2 }))
      // The image and media widget learns what the asset is first.
      if (component === ImageMediaWidgetInner) await answerReads()
      expect(held.copies).toHaveLength(1)
      return { widget, queued }
    }
    const copyAnswers = async () => {
      held.copies.shift()!()
      await flushPromises()
      await flushPromises()
    }
    const uploadDialog = () => useUploadQueueDialog().uploadQueueDialog.value

    it('loads till the asset is copied, and the upload dialog then takes the place of the dialog', async () => {
      const { widget, queued } = await copyOnItsWay()
      expect([isOpen(widget), loads(widget), uploadDialog()]).toEqual([true, true, null])

      await copyAnswers()

      expect([isOpen(widget), loads(widget), uploadDialog()]).toEqual([false, false, queueKey])
      expect(queued).toHaveBeenCalledTimes(1)
      queued.mockRestore()
    })

    it.each<[string, (widget: Widget, another: Widget) => Promise<void>]>([
      [
        'closed by the editor',
        async (widget) => {
          widget.dialog().vm.$emit('close')
          await flushPromises()
        },
      ],
      ['with the dialog of another widget opened over it', async (_widget, another) => openAndType(another)],
    ])(
      '%s while it loads: the copy opens no upload dialog, and leaves the form of another dialog',
      async (_how, meanwhile) => {
        const { widget, queued } = await copyOnItsWay()
        const another = await mountOf(ImageWidgetInner, 'socialImage')
        await meanwhile(widget, another)
        const inTheStore = shown()

        await copyAnswers()

        expect([isOpen(widget), loads(widget), uploadDialog(), queued.mock.calls]).toEqual([false, false, null, []])
        expect(shown()).toEqual(inTheStore)
        queued.mockRestore()
      }
    )
  })
})

describe('a pick in ImageMediaWidgetInner that ends without a dialog', () => {
  it.each<[string, object, () => Promise<void>]>([
    ['the asset is not read', listed('asset-9'), () => answerReads('fail')],
    ['an audio in no podcast, which it does not take', listed('asset-9', 'audio'), () => answerReads()],
  ])('shows its loading while the asset is read, and closes the dialog when %s', async (_when, asset, answer) => {
    const widget = await mountOf(ImageMediaWidgetInner, 'leadImage')
    await pick(widget, asset)
    expect([isOpen(widget), loads(widget)]).toEqual([true, true])

    await answer()

    expect([isOpen(widget), loads(widget), shown()]).toEqual([false, false, null])
    expect(released.mock.calls).toEqual([['leadImage', { image: 7, media: null }]])
  })
})
