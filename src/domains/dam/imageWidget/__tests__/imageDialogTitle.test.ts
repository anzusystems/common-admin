import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { type Component, defineComponent, h, ref, shallowRef } from 'vue'
import ImageDetailDialogMetadata from '@/domains/dam/imageWidget/components/ImageDetailDialogMetadata.vue'
import ImageMediaWidgetInner from '@/domains/dam/imageWidget/components/ImageMediaWidgetInner.vue'
import ImageWidgetInner from '@/domains/dam/imageWidget/components/ImageWidgetInner.vue'
import { useImageMediaWidgetStore } from '@/domains/dam/imageWidget/store/imageMediaWidgetStore'
import { ImageWidgetUploadConfigKey } from '@/domains/dam/imageWidget/utils/imageWidgetInkectionKeys'
import { DamAssetType } from '@/domains/dam/types/Asset'
import { useUploadQueueDialog } from '@/domains/dam/uploadQueue/composables/useUploadQueueDialog'

// The image dialog title says what the dialog edits and must not change while it loads, waits or saves.
// It used to come from the dialog store, which is empty while loading a pick or waiting for a save.
// The dialog was titled "edit medium" and switched to "edit image" when the image arrived.

const held = vi.hoisted(() => ({ reads: [] as Array<() => void> }))

vi.mock('@/domains/dam/composables/uploadValidations', async (importOriginal) => {
  const { ref: aRef } = await import('vue')
  return {
    ...(await importOriginal<object>()),
    useImageValidation: () => ({ v$: aRef({ $touch: () => undefined, $invalid: false, image: undefined }) }),
  }
})
vi.mock('@/domains/dam/imageWidget/composables/commonAdminImageOptions', () => ({
  useCommonAdminImageOptions: () => ({
    imageClient: () => ({}),
    previewDomain: 'https://img',
    imageWidth: 300,
    imageHeight: 200,
    imageApi: { fetchImage: async (_client: unknown, id: number) => ({ ...image, id }) },
  }),
}))
vi.mock('@/domains/dam/api/damAssetApi', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  fetchAsset: (_client: unknown, _endPoint: string, id: string) =>
    new Promise((resolve) =>
      held.reads.push(() => resolve({ id, authors: [], metadata: { customData: { description: `of ${id}` } } }))
    ),
  fetchAssetAsCmsMedia: () => new Promise((resolve) => held.reads.push(() => resolve({ title: 'the media' }))),
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
const video = {
  extService: 'damVideo',
  damMedia: { imageFileId: null, assetId: 'video-1', licenceId: 1, assetType: DamAssetType.Video, authorNames: [] },
}
const listed = (id: string, assetType: string) => ({
  id,
  licence: 1,
  mainFile: { id: `file-of-${id}`, _resourceName: `${assetType}File`, imagePreview: null },
  mainFileInternal: false,
  attributes: { assetType },
  podcasts: [],
})

const mounted: VueWrapper[] = []
afterEach(async () => {
  mounted.splice(0).forEach((wrapper) => wrapper.unmount())
  useUploadQueueDialog().uploadQueueDialog.value = null
  held.reads.splice(0).forEach((answer) => answer())
  await flushPromises()
  useImageMediaWidgetStore().setDetail(null)
})

describe('the title of the image dialog', () => {
  const titleOf = async (props: object, shown: object | null) => {
    const wrapper = mount(ImageDetailDialogMetadata, {
      attachTo: document.body,
      props: { modelValue: true, saving: false, loading: false, ...props } as never,
      global: { stubs: { AImageWidgetSimple: true, DamAdminAssetLink: true } },
    })
    mounted.push(wrapper)
    useImageMediaWidgetStore().setDetail(structuredClone(shown) as never)
    await flushPromises()
    return wrapper.findComponent({ name: 'ADialogToolbar' }).text()
  }

  it.each<[string, object, object | null, string]>([
    ['of an image while it loads', { type: DamAssetType.Image, loading: true }, null, 'Edit image'],
    [
      'of an image while it saves, its form emptied by then',
      { type: DamAssetType.Image, saving: true },
      null,
      'Edit image',
    ],
    ['of a video while it loads', { type: DamAssetType.Video, loading: true }, null, 'Edit medium'],
    ['of an image, shown', { type: DamAssetType.Image }, image, 'Edit image'],
    ['without the type it is opened for: what it shows', {}, image, 'Edit image'],
  ])('%s', async (_what, props, shown, title) => {
    expect(await titleOf(props, shown)).toBe(title)
  })
})

const mountOf = async (component: Component, holds: 'image' | 'video' = 'image') => {
  const isImageWidget = component === ImageWidgetInner
  const Parent = defineComponent({
    setup: () => {
      const model = ref<number | null>(holds === 'image' ? 7 : null)
      return () =>
        h(component as never, {
          queueKey: 'listingImage',
          uploadLicence: 1,
          selectLicences: [1],
          ...(isImageWidget
            ? { image, modelValue: model.value, 'onUpdate:modelValue': (value: number | null) => (model.value = value) }
            : {
                initialImage: holds === 'image' ? image : undefined,
                image: model.value,
                'onUpdate:image': (value: number | null) => (model.value = value),
                media: holds === 'video' ? video : null,
              }),
        })
    },
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
      },
    },
  })
  mounted.push(wrapper)
  await flushPromises()
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
const typesWhileRead = async (widget: Widget) => {
  const seen = [[widget.dialog().props('type'), widget.dialog().props('loading')]]
  while (held.reads.length > 0) {
    held.reads.shift()!()
    await flushPromises()
    seen.push([widget.dialog().props('type'), widget.dialog().props('loading')])
  }
  return seen
}

describe('what the dialog of a widget is opened for', () => {
  it('in the image widget: an image, while the picked asset is read and once it is', async () => {
    const widget = await mountOf(ImageWidgetInner)
    await pick(widget, listed('asset-9', DamAssetType.Image))

    expect(await typesWhileRead(widget)).toEqual([
      [DamAssetType.Image, true],
      [DamAssetType.Image, false],
    ])
  })

  it.each<[string, string]>([
    ['an image', DamAssetType.Image],
    ['a video', DamAssetType.Video],
  ])('in the image and media widget: %s picked, while it is read and once it is', async (_what, assetType) => {
    const widget = await mountOf(ImageMediaWidgetInner)
    await pick(widget, listed('asset-9', assetType))

    const seen = await typesWhileRead(widget)

    expect(seen[0]).toEqual([assetType, true])
    expect(seen.at(-1)).toEqual([assetType, false])
    expect(new Set(seen.map(([type]) => type))).toEqual(new Set([assetType]))
  })

  it('in the image and media widget: the video it holds for "edit metadata", and an uploaded image after it', async () => {
    const widget = await mountOf(ImageMediaWidgetInner, 'video')
    widget.wrapper.findComponent({ name: 'VMenu' }).vm.$emit('update:modelValue', true)
    await flushPromises()
    await widget.wrapper
      .findAllComponents({ name: 'VListItem' })
      .find((one) => one.text().includes('Edit medium'))!
      .trigger('click')
    await flushPromises()
    expect([widget.dialog().props('modelValue'), widget.dialog().props('type')]).toEqual([true, DamAssetType.Video])
    widget.dialog().vm.$emit('close')
    await flushPromises()

    useUploadQueueDialog().uploadQueueDialog.value = 'listingImage'
    await flushPromises()
    widget.wrapper
      .findComponent({ name: 'UploadQueueDialogSingle' })
      .vm.$emit('apply', [{ ...image, id: undefined, texts: { description: 'uploaded', source: 'Upload' } }])
    useUploadQueueDialog().uploadQueueDialog.value = null
    await flushPromises()
    expect([widget.dialog().props('modelValue'), widget.dialog().props('type')]).toEqual([true, DamAssetType.Image])
  })
})
