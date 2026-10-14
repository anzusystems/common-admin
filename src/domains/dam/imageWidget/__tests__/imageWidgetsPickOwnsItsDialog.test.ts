import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { type Component, defineComponent, h, ref, shallowRef } from 'vue'
import ImageMediaWidgetInner from '@/domains/dam/imageWidget/components/ImageMediaWidgetInner.vue'
import ImageWidgetInner from '@/domains/dam/imageWidget/components/ImageWidgetInner.vue'
import { useImageMediaWidgetStore } from '@/domains/dam/imageWidget/store/imageMediaWidgetStore'
import { ImageWidgetUploadConfigKey } from '@/domains/dam/imageWidget/utils/imageWidgetInkectionKeys'
import { useUploadQueueDialog } from '@/domains/dam/uploadQueue/composables/useUploadQueueDialog'

// What a pick in the library of a widget of one image may still do once its dialog has gone to something else, and
// what may empty the store of the image dialog, which the page shares. The read of a pick the dialog no longer loads
// for offered the authors of its asset in the dialog of the pick shown since; the answer of the widget's own save
// closed the dialog of a pick still read and left it loading; the end of a pick whose dialog was closed gave the lock
// of the field up under a later pick; a widget drawn late, or the delete of the image and media widget, emptied the
// form of another widget's open dialog. The dialog of the image and the collaboration are stand-ins; the reads, the
// save and the delete answer when the case lets them.

const released = vi.fn()
const changed = vi.fn()
const held = vi.hoisted(() => ({
  reads: [] as Array<() => void>,
  saves: [] as Array<() => void>,
  deletes: [] as Array<() => void>,
}))

vi.mock('@/domains/collab/composables/commonAdminCollabOptions', () => ({
  useCommonAdminCollabOptions: () => ({ collabOptions: ref({ enabled: true }) }),
}))
vi.mock('@/domains/collab/composables/collabField', () => ({
  useCollabField: (_room: string, field: string) => ({
    releaseCollabFieldLock: (value: unknown) => released(field, value),
    acquireCollabFieldLock: () => undefined,
    changeCollabFieldData: (value: unknown) => changed(field, value),
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
      fetchImage: async (_client: unknown, id: number) => ({ ...image, id }),
      updateImage: (_client: unknown, id: number, data: object) =>
        new Promise((resolve) => held.saves.push(() => resolve({ ...data, id }))),
      deleteImage: () => new Promise<void>((resolve) => held.deletes.push(resolve)),
    },
  }),
}))
// An asset of the DAM is described and has no authors: the dialog offers the authors of the DAM for its image.
vi.mock('@/domains/dam/api/damAssetApi', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  fetchAsset: (_client: unknown, _endPoint: string, id: string) =>
    new Promise((resolve) =>
      held.reads.push(() =>
        resolve({ id, authors: [], flags: { described: true }, metadata: { customData: { description: `of ${id}` } } })
      )
    ),
  fetchAssetAsCmsMedia: () => new Promise((resolve) => held.reads.push(() => resolve({ title: 'the media' }))),
}))
vi.mock('@/domains/dam/composables/commonAdminCoreDamOptions', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useCommonAdminCoreDamOptions: () => ({ damClient: () => ({}), endPointAsset: '/asset' }),
}))
vi.mock('@/domains/dam/config/composables/damConfigState', () => ({
  useDamConfigState: () => ({
    getDamConfigExtSystem: () => ({ image: { authors: { enabled: true } } }),
    getExtSystemByLicence: async () => 1,
  }),
}))

const image = {
  id: 7,
  texts: { description: 'listing', source: 'Agency' },
  flags: { showSource: true, internal: false, overrideInternal: false },
  dam: { damId: 'file-7', licenceId: 1, regionPosition: 0, internal: false },
  position: 1,
}
/** What the editor has typed in the form of the dialog of another widget. */
const typed = { ...image, texts: { description: 'typed by the editor', source: 'Agency' } }
const listed = (id: string) => ({
  id,
  licence: 1,
  mainFile: { id: `file-of-${id}` },
  mainFileInternal: false,
  attributes: { assetType: 'image' },
  podcasts: [],
})

const mounted: VueWrapper[] = []
afterEach(async () => {
  mounted.splice(0).forEach((wrapper) => wrapper.unmount())
  useUploadQueueDialog().uploadQueueDialog.value = null
  held.reads.splice(0).forEach((answer) => answer())
  held.saves.splice(0).forEach((answer) => answer())
  held.deletes.splice(0).forEach((answer) => answer())
  await flushPromises()
  useImageMediaWidgetStore().setDetail(null)
})

const mountOf = async (component: Component, field: string, more: object = {}) => {
  const isImageWidget = component === ImageWidgetInner
  const model = ref<number | null>(7)
  const Parent = defineComponent({
    setup: () => () =>
      h(component as never, {
        queueKey: field,
        uploadLicence: 1,
        selectLicences: [1],
        ...(isImageWidget
          ? { image, modelValue: model.value, 'onUpdate:modelValue': (value: number | null) => (model.value = value) }
          : {
              initialImage: image,
              image: model.value,
              'onUpdate:image': (value: number | null) => (model.value = value),
              media: null,
            }),
        collab: { room: 'article:1', field, cachedUsers: new Map() },
        collabStatus: 'active',
        ...more,
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
    wrapper,
    dialog: () => wrapper.findComponent({ name: 'ImageDetailDialogMetadata' }),
    picker: () => wrapper.findComponent({ name: isImageWidget ? 'AAssetSelect' : 'AAssetSelectMedia' }),
  }
}
type Widget = Awaited<ReturnType<typeof mountOf>>

const pick = async (widget: Widget, asset: object) => {
  widget.picker().vm.$emit('update:modelValue', true)
  await flushPromises()
  widget.picker().vm.$emit('confirm', { type: 'asset', value: [asset] })
  widget.picker().vm.$emit('update:modelValue', false)
  await flushPromises()
}
const answer = async (which: Array<() => void>) => {
  while (which.length > 0) {
    which.shift()!()
    await flushPromises()
  }
}
const close = async (widget: Widget) => {
  widget.dialog().vm.$emit('close')
  await flushPromises()
}
const shown = () => useImageMediaWidgetStore().detail
const isOpen = (widget: Widget) => widget.dialog().props('modelValue') as boolean
const loads = (widget: Widget) => widget.dialog().props('loading') as boolean
const openAndType = async (widget: Widget) => {
  useImageMediaWidgetStore().setDetail(structuredClone(typed))
  widget.dialog().vm.$emit('update:modelValue', true)
  await flushPromises()
}

describe.each<[string, Component]>([
  ['ImageWidgetInner', ImageWidgetInner],
  ['ImageMediaWidgetInner', ImageMediaWidgetInner],
])('a pick of %s', (_name, component) => {
  const isImageWidget = component === ImageWidgetInner
  const valueOf = (id: number | null) => (isImageWidget ? id : { image: id, media: null })

  it('closed and picked again: the read of the first pick leaves the authors offered for the second, and those picked there', async () => {
    const widget = await mountOf(component, 'listingImage')
    await pick(widget, listed('asset-9'))
    // The image and media widget learns what the asset is first: the read of the asset itself is still on its way.
    if (!isImageWidget) await answer(held.reads.splice(0, 1))
    const first = held.reads.splice(0)
    await close(widget)
    await pick(widget, listed('asset-10'))
    await answer(held.reads)
    expect(shown()).toMatchObject({ dam: { damId: 'file-of-asset-10' } })
    expect(widget.dialog().props('showDamAuthors')).toBe(true)
    widget.dialog().vm.$emit('update:damAuthors', ['author-1'])
    await flushPromises()

    await answer(first)

    expect([widget.dialog().props('showDamAuthors'), widget.dialog().props('damAuthors')]).toEqual([true, ['author-1']])
  })

  // The widget's own save answers while the dialog, closed after its confirm, loads for a pick: the dialog is the
  // pick's. Closed by that answer, it left the widget loading for the pick, whose answer opened the dialog again (the
  // image and media widget), or closed an "edit metadata" opened meanwhile, which showed only the spinner.
  it('stays loading for the pick when its own save answers, then shows the pick; nothing is left loading', async () => {
    const widget = await mountOf(component, 'listingImage')
    useImageMediaWidgetStore().setDetail(structuredClone(image))
    widget.dialog().vm.$emit('update:modelValue', true)
    await flushPromises()
    widget.dialog().vm.$emit('confirm')
    await flushPromises()
    expect(held.saves).toHaveLength(1)
    await close(widget)
    await pick(widget, listed('asset-9'))

    await answer(held.saves)
    expect([isOpen(widget), loads(widget), shown()]).toEqual([true, true, null])
    expect([released.mock.calls, changed.mock.calls]).toEqual([[], []])

    await answer(held.reads)
    expect([isOpen(widget), loads(widget)]).toEqual([true, false])
    expect(shown()).toMatchObject({ id: 7, dam: { damId: 'file-of-asset-9' } })
    await close(widget)
    expect(released.mock.calls).toEqual([['listingImage', valueOf(7)]])
  })

  it('closed, and another one closed after it: the lock of the field is kept till the later one is over', async () => {
    const widget = await mountOf(component, 'listingImage')
    await pick(widget, listed('asset-9'))
    const first = held.reads.splice(0)
    await close(widget)
    await pick(widget, listed('asset-10'))
    await close(widget)

    await answer(first)
    expect(released.mock.calls).toEqual([])

    await answer(held.reads)
    expect(released.mock.calls).toEqual([['listingImage', valueOf(7)]])
  })

  it('drawn while the dialog of another widget is open: the form of that dialog stays as the editor typed it', async () => {
    const another = await mountOf(ImageWidgetInner, 'socialImage')
    await openAndType(another)

    await mountOf(component, 'listingImage')

    expect(shown()).toEqual(typed)
  })
})

describe('the store of the image dialog', () => {
  it('is emptied by a widget drawn while no dialog shows it: what a widget that went left there', async () => {
    useImageMediaWidgetStore().setDetail(structuredClone(typed))

    await mountOf(ImageWidgetInner, 'listingImage')

    expect(shown()).toBeNull()
  })

  it('keeps the form of the open dialog of another widget when the image and media widget deletes its image', async () => {
    const another = await mountOf(ImageWidgetInner, 'socialImage')
    const widget = await mountOf(ImageMediaWidgetInner, 'leadImage', { callDeleteApiOnRemove: true })
    await openAndType(another)
    widget.wrapper.findComponent({ name: 'VMenu' }).vm.$emit('update:modelValue', true)
    await flushPromises()
    const remove = widget.wrapper
      .findAllComponents({ name: 'VListItem' })
      .find((one) => one.text().includes('Remove image'))!
    await remove.trigger('click')
    await flushPromises()

    await answer(held.deletes)

    expect(isOpen(another)).toBe(true)
    expect(shown()).toEqual(typed)
  })
})
