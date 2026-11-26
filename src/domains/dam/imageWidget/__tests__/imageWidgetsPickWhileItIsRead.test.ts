import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { type Component, defineComponent, h, ref, shallowRef } from 'vue'
import ImageMediaWidgetInner from '@/domains/dam/imageWidget/components/ImageMediaWidgetInner.vue'
import ImageWidgetInner from '@/domains/dam/imageWidget/components/ImageWidgetInner.vue'
import { useImageMediaWidgetStore } from '@/domains/dam/imageWidget/store/imageMediaWidgetStore'
import { ImageWidgetUploadConfigKey } from '@/domains/dam/imageWidget/utils/imageWidgetInkectionKeys'
import { useUploadQueueDialog } from '@/domains/dam/uploadQueue/composables/useUploadQueueDialog'
import { useUploadQueuesStore } from '@/domains/dam/uploadQueue/store/uploadQueuesStore'
import { initCommonAdminCoreDamOptions, initCommonAdminImageOptions } from '@/plugins/pluginOptions'

// A widget reads the picked asset before its dialog shows the
// image. The editor could open another widget's dialog meanwhile.
// The answer then covered that dialog and replaced its form through
// the page-wide dialog store, losing what the editor typed.
// The dialog now shows loading at once, and the answer is applied only while it still loads for that pick.

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
const typed = { ...image, texts: { description: 'typed by the editor', source: 'Agency' } }
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
  // Found anew each time: once another widget is mounted with its own stand-ins, this one draws them anew.
  return {
    dialog: () => wrapper.findComponent({ name: 'ImageDetailDialogMetadata' }),
    picker: () => wrapper.findComponent({ name: isImageWidget ? 'AAssetSelect' : 'AAssetSelectMedia' }),
  }
}
type Widget = Awaited<ReturnType<typeof mountOf>>

const pick = async (widget: Widget, asset: object, forceTakeOver = false) => {
  widget.picker().vm.$emit('update:modelValue', true)
  await flushPromises()
  widget.picker().vm.$emit('confirm', { type: 'asset', value: [asset], forceTakeOver })
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

  // The dialog store is page-wide, so what it holds after the answer is another dialog's form.
  // The dialog that loaded for the pick closes. Otherwise its confirm would save that form as this widget's image.
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
        await answerReads()
      }

      expect([isOpen(widget), loads(widget)]).toEqual([true, false])
      expect(shown()).toMatchObject({ dam: { damId: 'file-of-asset-10' } })
    }
  )

  // An image of another licence is not copied at the pick (1.52.0): it is read as any other, and the image save takes it
  // over into the licence of the upload. No upload dialog takes the place of the dialog, also when the switch is on.
  it('of another licence, the take over on: loads while it is read, then shows it to be taken over, and copies nothing', async () => {
    const queued = vi.spyOn(useUploadQueuesStore(), 'addByCopyToLicence')
    const widget = await mountOf(component, 'listingImage')
    await pick(widget, listed('asset-9', 'image', { licence: 2 }), true)
    expect([isOpen(widget), loads(widget)]).toEqual([true, true])

    await answerReads()

    expect([isOpen(widget), loads(widget), useUploadQueueDialog().uploadQueueDialog.value]).toEqual([true, false, null])
    expect(shown()).toMatchObject({ dam: { damId: 'file-of-asset-9', licenceId: 2, forceTakeOver: true } })
    expect(held.copies).toEqual([])
    expect(queued).not.toHaveBeenCalled()
    queued.mockRestore()
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

// Single use photos are checked only where the CMS checks them (`singleUseUsageEnabled`, admin-cms). The check of a
// pick belongs to that pick: one given up late (Esc and pick again, or a slow read) must not wipe the next one's.
describe.each<[string, Component]>([
  ['ImageWidgetInner', ImageWidgetInner],
  ['ImageMediaWidgetInner', ImageMediaWidgetInner],
])('the single use check of a pick in %s', (_name, component) => {
  const isImageWidget = component === ImageWidgetInner
  const usageAsked = vi.fn()
  const blocked = (groupId: string) => ({
    groupId,
    holder: null,
    status: 'conflict',
    blocked: true,
    usageCount: 1,
    usages: [],
  })
  // The image backend of the admin: core-cms answers the usage of every group, blocked; daily tools has no route.
  const imageClient = (answers: boolean) => () =>
    ({
      defaults: {},
      getUri: (config: { url?: string }) => config.url ?? '',
      request: (config: { url: string; params: { groupIds: string } }) => {
        usageAsked(config.url)
        return answers
          ? Promise.resolve({
              status: 200,
              config,
              data: { data: config.params.groupIds.split(',').map(blocked), totalCount: 0 },
            })
          : Promise.reject(Object.assign(new Error('Not Found'), { isAxiosError: true, response: { status: 404 } }))
      },
    }) as never
  const install = (checked: boolean) => {
    initCommonAdminCoreDamOptions({
      configs: { default: { damClient: () => ({}) as never, ...(checked ? { singleUseUsageEnabled: true } : {}) } },
      apiTimeout: 30,
      adminDomain: '',
    })
    initCommonAdminImageOptions({
      configs: {
        default: {
          imageClient: imageClient(checked),
          previewDomain: '',
          previewDomainOriginal: '',
          width: 1,
          height: 1,
        },
      },
    })
  }
  afterEach(() => {
    initCommonAdminCoreDamOptions(undefined)
    initCommonAdminImageOptions(undefined)
    usageAsked.mockReset()
  })
  const singleUse = (id: string) =>
    listed(id, 'image', {
      mainFile: { id: `file-of-${id}`, flags: { singleUse: true }, fileAttributes: { takenOverFromId: '' } },
    })
  const checkShown = (widget: Widget) => widget.dialog().props('singleUseCheck')
  /** The pick's reads up to the asset read, which is held: the image and media widget reads the medium first. */
  const pickHeldAtItsAssetRead = async (widget: Widget, asset: object) => {
    await pick(widget, asset)
    if (!isImageWidget) {
      held.reads.shift()!.answer()
      await flushPromises()
    }
    return held.reads.splice(0)
  }

  // admin-inhouse uses the CMS image API on daily tools, which has no usage route: rc.26 listed no single use photo
  // and checked none. Asking it failed, kept a persistent error up and the confirm off for good.
  it('asks nobody about a picked single use photo where the CMS does not check them, and lets the image be confirmed', async () => {
    install(false)
    const widget = await mountOf(component, 'listingImage')
    await pick(widget, singleUse('asset-9'))
    await answerReads()

    expect(usageAsked).not.toHaveBeenCalled()
    expect(shown()).toMatchObject({ dam: { damId: 'file-of-asset-9' } })
    expect(checkShown(widget)).toBeNull()
  })

  it('asks the CMS that checks them, and the dialog holds the answer of the pick', async () => {
    install(true)
    const widget = await mountOf(component, 'listingImage')
    await pick(widget, singleUse('asset-9'))
    await answerReads()

    expect(usageAsked).toHaveBeenCalledWith('/adm/v1/image/single-use-usage')
    expect(checkShown(widget)).toMatchObject({
      failed: false,
      asset: { id: 'asset-9', singleUseUsage: { blocked: true } },
    })
  })

  it.each<[string, 'before' | 'after', boolean]>([
    ['closed and picked again, answering before the new pick is read', 'before', true],
    ['closed and picked again, answering after the new pick is read', 'after', true],
    ['picked again over its loading dialog, answering after the new pick is read', 'after', false],
  ])('keeps the check of the next pick when a pick given up answers late: %s', async (_how, when, closed) => {
    install(true)
    const widget = await mountOf(component, 'listingImage')
    const first = await pickHeldAtItsAssetRead(widget, singleUse('asset-9'))
    if (closed) {
      widget.dialog().vm.$emit('close')
      await flushPromises()
    }
    await pick(widget, singleUse('asset-10'))
    const firstAnswers = async () => {
      first.forEach((one) => one.answer())
      await flushPromises()
      await flushPromises()
    }

    if (when === 'before') await firstAnswers()
    await answerReads()
    if (when === 'after') await firstAnswers()

    expect(shown()).toMatchObject({ dam: { damId: 'file-of-asset-10' } })
    expect(checkShown(widget)).toMatchObject({
      failed: false,
      asset: { id: 'asset-10', singleUseUsage: { blocked: true } },
    })
  })
})
