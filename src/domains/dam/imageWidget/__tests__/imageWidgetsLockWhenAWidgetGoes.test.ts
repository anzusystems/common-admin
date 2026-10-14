import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { type Component, defineComponent, h, ref, shallowRef } from 'vue'
import ImageMediaWidgetInner from '@/domains/dam/imageWidget/components/ImageMediaWidgetInner.vue'
import ImageWidgetInner from '@/domains/dam/imageWidget/components/ImageWidgetInner.vue'
import { useImageMediaWidgetStore } from '@/domains/dam/imageWidget/store/imageMediaWidgetStore'
import { ImageWidgetUploadConfigKey } from '@/domains/dam/imageWidget/utils/imageWidgetInkectionKeys'
import { useUploadQueueDialog } from '@/domains/dam/uploadQueue/composables/useUploadQueueDialog'
import { useUploadQueuesStore } from '@/domains/dam/uploadQueue/store/uploadQueuesStore'

// The lock of the field of a widget of one image in an article open by two editors, when the widget goes away (the
// pin of a sidebar widget in admin-cms draws a copy of it elsewhere) while its menu, a dialog, the picker, a drop
// waiting for the lock or a pick still read or copied holds the field, and nothing was confirmed. Nothing gave the lock
// back: the server keeps it till it is released or the editor leaves the article, and the field stayed locked for the
// other editor. The widget gives it back as it goes, once, with the value its field has; not while a save or a delete
// of it is on its way, whose end gives it back, nor once the copy drawn in its place has taken the lock. A pick of a
// widget that is gone opens nothing in the copy. The dialog of the image and the collaboration are stand-ins; the
// save, the delete, the read of a picked asset and its copy into the licence answer when the case lets them.

const released = vi.fn()
const acquired = vi.fn()
const held = vi.hoisted(() => ({
  saves: [] as Array<() => void>,
  reads: [] as Array<() => void>,
  deletes: [] as Array<() => void>,
}))

vi.mock('@/domains/collab/composables/commonAdminCollabOptions', () => ({
  useCommonAdminCollabOptions: () => ({ collabOptions: ref({ enabled: true }) }),
}))
vi.mock('@/domains/collab/composables/collabField', () => ({
  useCollabField: (_room: string, field: string) => ({
    releaseCollabFieldLock: (value: unknown) => released(field, value),
    acquireCollabFieldLock: () => acquired(field),
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
    imageApi: {
      fetchImage: vi.fn(async (_client: unknown, id: number) => ({ ...image, id })),
      updateImage: vi.fn(
        (_client: unknown, id: number, data: object) =>
          new Promise((resolve) => held.saves.push(() => resolve({ ...data, id })))
      ),
      deleteImage: vi.fn(() => new Promise<void>((resolve) => held.deletes.push(resolve))),
    },
  }),
}))
// The asset of a pick is read once the case lets it: as the DAM has it, and as the CMS sees a media.
vi.mock('@/domains/dam/api/damAssetApi', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  fetchAsset: () =>
    new Promise((resolve) =>
      held.reads.push(() =>
        resolve({ id: 'asset-9', authors: [], metadata: { customData: { description: 'picked' } } })
      )
    ),
  fetchAssetAsCmsMedia: () => new Promise((resolve) => held.reads.push(() => resolve({}))),
}))
vi.mock('@/domains/dam/api/damImageApi', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  copyToLicence: () =>
    new Promise((resolve) =>
      held.reads.push(() => resolve([{ result: 'copy', targetAsset: 'asset-copied', targetMainFile: 'file-copied' }]))
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
/** An image asset as the list of the picker has it. */
const listed = {
  id: 'asset-9',
  licence: 1,
  mainFile: { id: 'file-9' },
  mainFileInternal: false,
  attributes: { assetType: 'image' },
  podcasts: [],
}

const mounted: VueWrapper[] = []
afterEach(async () => {
  mounted.splice(0).forEach((wrapper) => wrapper.unmount())
  useUploadQueueDialog().uploadQueueDialog.value = null
  held.saves.splice(0).forEach((answer) => answer())
  held.reads.splice(0).forEach((answer) => answer())
  held.deletes.splice(0).forEach((answer) => answer())
  await flushPromises()
})

describe.each<[string, Component]>([
  ['ImageWidgetInner', ImageWidgetInner],
  ['ImageMediaWidgetInner', ImageMediaWidgetInner],
])('the lock of the field of %s when the widget goes', (_name, component) => {
  const isImageWidget = component === ImageWidgetInner
  /** What the field is given back with, as each widget sends it: the image id, or the image and the media. */
  const valueOf = (id: number | null) => (isImageWidget ? id : { image: id, media: null })
  const FIELD = 'listingImage'

  /** The widget of the field of the article, with its image. */
  const mountWidget = async (more: object = {}) => {
    const model = ref<number | null>(7)
    const Parent = defineComponent({
      setup: () => () =>
        h(component as never, {
          queueKey: FIELD,
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
          collab: { room: 'article:1', field: FIELD, cachedUsers: new Map() },
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
    return Object.assign(wrapper, { model })
  }
  // Found anew each time: once another widget is mounted with stand-ins of its own, this one draws them anew.
  const dialogOf = (wrapper: VueWrapper) => wrapper.findComponent({ name: 'ImageDetailDialogMetadata' })
  const pickerOf = (wrapper: VueWrapper) =>
    wrapper.findComponent({ name: isImageWidget ? 'AAssetSelect' : 'AAssetSelectMedia' })
  /** The widget is taken away, as by the pin that draws its copy in the sidebar. */
  const goes = async (wrapper: VueWrapper) => {
    mounted.splice(mounted.indexOf(wrapper), 1)
    wrapper.unmount()
    await flushPromises()
  }
  const answerAll = async (which: Array<() => void>) => {
    while (which.length > 0) {
      which.shift()!()
      await flushPromises()
    }
  }
  const givenBack = () => released.mock.calls
  const menuOf = (wrapper: VueWrapper) => wrapper.findComponent({ name: 'VMenu' })

  it.each<[string, (wrapper: VueWrapper) => Promise<void>]>([
    [
      'the image dialog',
      async (wrapper) => {
        useImageMediaWidgetStore().setDetail(structuredClone(image))
        dialogOf(wrapper).vm.$emit('update:modelValue', true)
        await flushPromises()
      },
    ],
    [
      'the menu',
      async (wrapper) => {
        wrapper.findComponent({ name: 'VMenu' }).vm.$emit('update:modelValue', true)
        await flushPromises()
      },
    ],
    [
      'the picker',
      async (wrapper) => {
        pickerOf(wrapper).vm.$emit('update:modelValue', true)
        await flushPromises()
      },
    ],
    [
      'a drop that waits for the lock',
      async (wrapper) => {
        wrapper.findComponent({ name: 'AFileDropzone' }).vm.$emit('drop', [new File(['x'], 'x.jpg')])
        await flushPromises()
      },
    ],
  ])('is given back once, with the image of the field, by a widget that goes with %s open', async (_what, open) => {
    const wrapper = await mountWidget()
    await open(wrapper)
    expect(acquired.mock.calls).toEqual([[FIELD]])
    expect(givenBack()).toEqual([])

    await goes(wrapper)

    expect(givenBack()).toEqual([[FIELD, valueOf(7)]])
  })

  it('is given back once by a widget that goes while the asset of its pick is read, and not again by the answer', async () => {
    const wrapper = await mountWidget()
    pickerOf(wrapper).vm.$emit('update:modelValue', true)
    await flushPromises()
    pickerOf(wrapper).vm.$emit('confirm', { type: 'asset', value: [listed] })
    pickerOf(wrapper).vm.$emit('update:modelValue', false)
    await flushPromises()
    expect(held.reads).toHaveLength(1)
    expect(givenBack()).toEqual([])

    await goes(wrapper)
    expect(givenBack()).toEqual([[FIELD, valueOf(7)]])

    await answerAll(held.reads)
    expect(givenBack()).toEqual([[FIELD, valueOf(7)]])
  })

  // The end of the save gives it back (the step before this one): one release, with what the field has.
  it('is not given back as it goes by a widget whose save is on its way, but once, at the end of that save', async () => {
    const wrapper = await mountWidget()
    useImageMediaWidgetStore().setDetail(structuredClone(image))
    dialogOf(wrapper).vm.$emit('update:modelValue', true)
    await flushPromises()
    dialogOf(wrapper).vm.$emit('confirm')
    await flushPromises()
    expect(held.saves).toHaveLength(1)

    await goes(wrapper)
    expect(givenBack()).toEqual([])

    await answerAll(held.saves)
    expect(givenBack()).toEqual([[FIELD, valueOf(7)]])
  })

  it('is not given back by a widget that goes holding nothing, nor a second time once given back', async () => {
    const idle = await mountWidget()
    await goes(idle)
    expect(givenBack()).toEqual([])

    const wrapper = await mountWidget()
    useImageMediaWidgetStore().setDetail(structuredClone(image))
    dialogOf(wrapper).vm.$emit('update:modelValue', true)
    await flushPromises()
    dialogOf(wrapper).vm.$emit('close')
    await flushPromises()
    expect(givenBack()).toEqual([[FIELD, valueOf(7)]])

    await goes(wrapper)
    expect(givenBack()).toEqual([[FIELD, valueOf(7)]])
  })

  // The pick goes on in no widget: the copy of the widget drawn in its place showed its upload dialog, and asked for
  // the lock only then.
  it('is given back once by a widget that goes while the asset of its pick is copied, whose answer opens nothing', async () => {
    const queued = vi.spyOn(useUploadQueuesStore(), 'addByCopyToLicence').mockResolvedValue(undefined as never)
    const wrapper = await mountWidget()
    pickerOf(wrapper).vm.$emit('update:modelValue', true)
    await flushPromises()
    pickerOf(wrapper).vm.$emit('confirm', { type: 'asset', value: [{ ...listed, licence: 2 }], copyToLicence: 1 })
    pickerOf(wrapper).vm.$emit('update:modelValue', false)
    await flushPromises()
    await answerAll(isImageWidget ? [] : held.reads.splice(0, 1))
    expect(held.reads).toHaveLength(1)

    await goes(wrapper)
    expect(givenBack()).toEqual([[FIELD, valueOf(7)]])

    await answerAll(held.reads)
    expect([useUploadQueueDialog().uploadQueueDialog.value, queued.mock.calls]).toEqual([null, []])
    expect([acquired.mock.calls, givenBack()]).toEqual([[[FIELD]], [[FIELD, valueOf(7)]]])
    queued.mockRestore()
  })

  /** "Remove" in the menu of a widget that deletes its image: the delete is on its way, and the menu closed. */
  const removed = async (wrapper: VueWrapper) => {
    menuOf(wrapper).vm.$emit('update:modelValue', true)
    await flushPromises()
    const remove = wrapper.findAllComponents({ name: 'VListItem' }).find((one) => one.text().includes('Remove image'))!
    await remove.trigger('click')
    menuOf(wrapper).vm.$emit('update:modelValue', false)
    await flushPromises()
    expect(held.deletes).toHaveLength(1)
  }

  // The end of the delete gave the lock back by the release of its reset, whatever had taken it since: the copy
  // drawn in place of the widget, with its menu open, lost it.
  it('is left by a widget that goes while its delete runs to the copy that has taken the lock since', async () => {
    const wrapper = await mountWidget({ callDeleteApiOnRemove: true })
    await removed(wrapper)
    await goes(wrapper)
    const copy = await mountWidget({ callDeleteApiOnRemove: true })
    menuOf(copy).vm.$emit('update:modelValue', true)
    await flushPromises()
    expect(acquired.mock.calls).toEqual([[FIELD], [FIELD]])

    await answerAll(held.deletes)
    expect(givenBack()).toEqual([])

    menuOf(copy).vm.$emit('update:modelValue', false)
    await flushPromises()
    expect(givenBack()).toEqual([[FIELD, valueOf(7)]])
  })

  it('is given back once at the end of the delete by a widget that went while it ran, with the image of the field, which it leaves', async () => {
    const wrapper = await mountWidget({ callDeleteApiOnRemove: true })
    await removed(wrapper)
    await goes(wrapper)
    expect(givenBack()).toEqual([])

    await answerAll(held.deletes)

    expect(givenBack()).toEqual([[FIELD, valueOf(7)]])
    expect(wrapper.model.value).toBe(7)
  })
})
