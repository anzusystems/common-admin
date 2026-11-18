import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, type Pinia, setActivePinia } from 'pinia'
import { defineComponent, h, shallowRef } from 'vue'
import { type ConsumerImageApi, installConsumerImageApi } from '@/domains/dam/__tests__/support/consumerImageApi'
import { cmsConfiguration, installConsumerProfile } from '@/domains/dam/__tests__/support/consumerProfiles'
import { answerDamNames, damNamesAsked } from '@/domains/dam/__tests__/support/damNames'
import { createFakeDam, damAssetWithFile, type FakeDam } from '@/domains/dam/__tests__/support/fakeDam'
import { holdLongWaits, type LongWaits } from '@/domains/dam/__tests__/support/longWaits'
import {
  alertText,
  forgetAlerts,
  shownAlerts,
  signInToDam,
  signOutOfDam,
} from '@/domains/dam/__tests__/support/uploadUi'
import AssetDetailSidebarActionsTeleportTarget from '@/domains/dam/assetDetail/components/AssetDetailSidebarActionsTeleportTarget.vue'
import AssetDetailSidebarMetadata from '@/domains/dam/assetDetail/components/AssetDetailSidebarMetadata.vue'
import { useAssetDetailStore } from '@/domains/dam/assetDetail/store/assetDetailStore'
import { useAssetSelectStore } from '@/domains/dam/assetSelect/store/assetSelectStore'
import AuthorRemoteAutocompleteWithCached from '@/domains/dam/author/components/AuthorRemoteAutocompleteWithCached.vue'
import { useCommonAdminCoreDamOptions } from '@/domains/dam/composables/commonAdminCoreDamOptions'
import { useDamNotificationsEventBus } from '@/domains/dam/composables/damNotificationsEventBus'
import { useDamConfigStore } from '@/domains/dam/config/store/damConfigStore'
import ImageWidgetMultipleInner from '@/domains/dam/imageWidget/components/ImageWidgetMultipleInner.vue'
import ImageWidgetMultipleItem from '@/domains/dam/imageWidget/components/ImageWidgetMultipleItem.vue'
import { useImageStore } from '@/domains/dam/imageWidget/store/imageStore'
import { createDamImage } from '@/domains/dam/imageWidget/utils/damImage'
import { ImageWidgetUploadConfigKey } from '@/domains/dam/imageWidget/utils/imageWidgetInkectionKeys'
import { DamAssetType, type DamImageCopyToLicenceResponseItem } from '@/domains/dam/types/Asset'
import { AssetFileProcessStatus } from '@/domains/dam/types/AssetFile'
import type { ImageAware } from '@/domains/dam/types/ImageAware'
import { useUploadQueueDialog } from '@/domains/dam/uploadQueue/composables/useUploadQueueDialog'
import { useUploadQueuesStore } from '@/domains/dam/uploadQueue/store/uploadQueuesStore'
import type { DocId } from '@/shared/types/common'

// Gallery under admin-cms. Regressions guarded here:
// rows of one asset shared one author list; a pick that copies
// assets opened the queue dialog before the other assets were read;
// positions had gaps after a removal; authors written into an asset
// made the next save report "given meanwhile" and save nothing;
// a detail close waited for another asset's save; a gallery drawn during another's save wrote old texts back;
// rows added while the entity images loaded were lost; a widget gone during the author write still saved its images.
// The sortable list, asset picker, queue dialog and pictures are stand-ins.

const QUEUE = 'gallery'
const Picker = defineComponent({ name: 'AAssetSelect', emits: ['confirm'], setup: () => () => h('div') })
const QueueStandIn = defineComponent({ name: 'UploadQueueDialog', emits: ['apply'], setup: () => () => h('div') })
// Stand-in for the sortable list: draws only the rows and ignores commits.
const Editor = defineComponent({
  name: 'ASortableListEditor',
  setup: (_, { slots, expose }) => {
    expose({ commit: () => undefined, cancelReorderMode: () => undefined })
    return () => h('div', slots['view-body']?.())
  },
})

const profile = cmsConfiguration
const { endPoints, extSystem, licence } = profile
const OTHER_LICENCE = 300003
const SEARCH = new RegExp(
  `^${endPoints.asset.replace(/\//g, '\\/')}\\/licence\\/(\\d+)\\/search\\?assetAndMainFileIds=([^&]*)`
)
const COPY = /\/copy-to-licence$/

let pinia: Pinia
let dam: FakeDam
let imageApi: ConsumerImageApi
let waits: LongWaits
let widget: VueWrapper | undefined
let detailForm: VueWrapper | undefined

beforeEach(() => {
  pinia = createPinia()
  setActivePinia(pinia)
  dam = createFakeDam(endPoints)
  imageApi = installConsumerImageApi(profile, installConsumerProfile(profile, dam.client))
  answerDamNames(dam)
  dam.reply((request) => {
    const match = request.method === 'GET' ? request.url.match(SEARCH) : null
    if (!match) return undefined
    const files = match[2]!.split(',')
    const found = [...dam.assets.values()].filter((asset) => asset.mainFile && files.includes(asset.mainFile.id))
    return { status: 200, data: { data: found, totalCount: found.length } }
  })
  waits = holdLongWaits()
  forgetAlerts()
  signInToDam(extSystem)
})
afterEach(async () => {
  detailForm?.unmount()
  detailForm = undefined
  widget?.unmount()
  widget = undefined
  useUploadQueueDialog().uploadQueueDialog.value = null
  await damNamesAsked()
  waits.restore()
  useDamNotificationsEventBus().reset()
  signOutOfDam()
})

const uploadConfig = () => ({
  licence,
  extSystem,
  licenceName: '',
  extSystemConfig: useDamConfigStore(pinia).damConfigExtSystem.get(extSystem)!,
})
const images = () => useImageStore(pinia).images
const mountWidget = async (modelValue: number[], callDeleteApiOnRemove = false) => {
  const mounted: VueWrapper = mount(ImageWidgetMultipleInner, {
    attachTo: document.body,
    props: {
      modelValue,
      queueKey: QUEUE,
      uploadLicence: licence,
      selectLicences: [licence, OTHER_LICENCE],
      callDeleteApiOnRemove,
      'onUpdate:modelValue': (value: number[]) => mounted.setProps({ modelValue: value }),
    } as never,
    global: {
      plugins: [pinia],
      provide: { [ImageWidgetUploadConfigKey as symbol]: shallowRef(uploadConfig()) },
      stubs: {
        ASortableListEditor: Editor,
        AAssetSelect: Picker,
        AssetDetailDialogFrame: true,
        AImageWidgetSimple: true,
        AssetImage: true,
        AssetQueueSelectedSidebar: true,
        AFileDropzone: true,
        AFormRemoteAutocompleteWithCached: true,
        UploadQueueDialog: QueueStandIn,
      },
    },
  })
  widget = mounted
  await flushPromises()
  useAssetSelectStore(pinia).setSelectConfig([uploadConfig()])
  return mounted
}
const stored = (id: number, position: number, file = `file-${id}`): ImageAware => ({
  id,
  texts: { description: `image ${id}`, source: `source ${id}` },
  dam: { damId: file, licenceId: licence, regionPosition: 0, internal: false },
  flags: { showSource: true, internal: false, overrideInternal: false },
  position,
})
const inTheDam = (asset: DocId, file: DocId, of = licence) =>
  dam.assets.set(asset, damAssetWithFile(asset, file, AssetFileProcessStatus.Processed, { licence: of }))
const withImages = async (ids: number[], sources: Record<number, string> = {}, callDeleteApiOnRemove = false) => {
  ids.forEach((id, index) => {
    const image = stored(id, index + 1)
    imageApi.has({ ...image, texts: { ...image.texts, source: sources[id] ?? image.texts.source } })
    inTheDam(`asset-${id}`, `file-${id}`)
  })
  const mounted = await mountWidget(ids, callDeleteApiOnRemove)
  await vi.waitFor(() => expect(images()).toHaveLength(ids.length))
  await damNamesAsked()
  await flushPromises()
  return mounted
}
const rows = () => widget!.findAllComponents(ImageWidgetMultipleItem)
const pickInRow = async (row: number, authors: DocId[]) => {
  rows()[row]!.findComponent(AuthorRemoteAutocompleteWithCached).vm.$emit('update:modelValue', authors)
  await flushPromises()
  await damNamesAsked()
}
const save = () => (widget!.vm as unknown as { saveImages: () => Promise<boolean> }).saveImages()
const imagesSent = () =>
  imageApi.calls
    .filter(([call]) => call === 'bulkUpdateImages')
    .map(([, sent]) =>
      (sent as ImageAware[]).map((image) => [image.id ?? null, image.position, image.texts.description])
    )
const metadataWrites = () =>
  dam.sentTo('PATCH', dam.routes.bulkMetadata).map((request) => dam.body(request) as Array<{ id: DocId }>)
const rereadsOf = (asset: DocId) =>
  dam.sentTo('GET', dam.routes.one).filter((request) => request.url === `${endPoints.asset}/${asset}`)
const damKeepsAuthors = () =>
  dam.reply((request) => {
    if (request.method !== 'PATCH' || !dam.routes.bulkMetadata.test(request.url)) return undefined
    for (const sent of dam.body(request) as Array<{ id: DocId; authors?: DocId[] }>) {
      const asset = dam.assets.get(sent.id)
      if (asset && sent.authors) asset.authors = [...sent.authors]
    }
    return undefined
  })
const listed = (asset: DocId, file: DocId, of = licence) => ({
  id: asset,
  licence: of,
  mainFile: { id: file },
  mainFileInternal: false,
  attributes: { assetType: DamAssetType.Image },
  podcasts: [],
})
const confirmPick = (picked: ReturnType<typeof listed>[], copyTo?: number) =>
  widget!.findComponent(Picker).vm.$emit('confirm', {
    type: 'asset',
    value: picked,
    ...(copyTo ? { copyToLicence: copyTo } : {}),
  })
const copiesAnswer = () =>
  dam.reply((request) => {
    if (request.method !== 'PATCH' || !COPY.test(request.url)) return undefined
    const asked = dam.body(request) as Array<{ asset: DocId }>
    const answer: DamImageCopyToLicenceResponseItem[] = asked.map(({ asset }) => ({
      asset,
      targetAsset: `copy-of-${asset}`,
      targetMainFile: `file-of-copy-of-${asset}`,
      targetAssetLicence: licence,
      result: 'copy',
      assetConflicts: [],
    }))
    return { status: 200, data: answer }
  })
const queueDialog = () => useUploadQueueDialog().uploadQueueDialog.value
const uploadedRow = () => ({
  key: 'uploaded',
  ...createDamImage({ fileId: 'file-uploaded', licenceId: licence }, { description: 'uploaded', source: 'Upload' }),
  damAuthors: [],
  showDamAuthors: false,
  assetId: undefined,
})
const rowFiles = () => images().map((image) => image.dam.damId)

describe('the rows of the widget of several images', () => {
  it('give each row of an asset the entity has twice a list of authors of its own', async () => {
    imageApi.has(stored(12, 1))
    imageApi.has(stored(13, 2, 'file-12'))
    inTheDam('asset-12', 'file-12')
    await mountWidget([12, 13])
    await vi.waitFor(() => expect(images()).toHaveLength(2))
    await flushPromises()
    const [first, second] = images()

    expect([first!.assetId, second!.assetId]).toEqual(['asset-12', 'asset-12'])
    first!.damAuthors.push('author-5')
    expect(second!.damAuthors).toEqual([])
  })

  it.each<[string, boolean]>([
    ['removed', false],
    ['removed and deleted in the backend', true],
  ])('numbered anew once one is %s: the save sends the positions without a gap', async (_how, deleted) => {
    await withImages([11, 12, 13], {}, deleted)

    rows()[1]!.vm.$emit('removeItem', 1)
    await flushPromises()

    expect(images().map((image) => [image.id, image.position])).toEqual([
      [11, 1],
      [13, 2],
    ])
    expect(imageApi.calls.filter(([call]) => call === 'deleteImage')).toHaveLength(deleted ? 1 : 0)
    expect(await save()).toBe(true)
    expect(imagesSent()).toEqual([
      [
        [11, 1, 'image 11'],
        [13, 2, 'image 13'],
      ],
    ])
  })

  it('numbered anew once a row picked in the library and not saved yet is removed', async () => {
    await withImages([11])
    inTheDam('asset-20', 'file-20')
    inTheDam('asset-21', 'file-21')
    confirmPick([listed('asset-20', 'file-20'), listed('asset-21', 'file-21')])
    await vi.waitFor(() => expect(images()).toHaveLength(3))

    rows()[1]!.vm.$emit('removeItem', 1)
    await flushPromises()

    expect(images().map((image) => [image.id ?? null, image.position, image.dam.damId])).toEqual([
      [11, 1, 'file-11'],
      [null, 2, 'file-21'],
    ])
  })
})

describe('a pick in the library of the widget of several images', () => {
  it.each<[string, 'readonly' | 'gone']>([
    ['has turned read-only', 'readonly'],
    ['is gone, and the next one is drawn', 'gone'],
  ])('adds nothing when the widget %s while the picked assets are read', async (_what, what) => {
    const mounted = await withImages([11])
    inTheDam('asset-20', 'file-20')
    const reads = dam.hold('GET', dam.routes.byIds)
    confirmPick([listed('asset-20', 'file-20')])
    await vi.waitFor(() => expect(reads.waiting).toHaveLength(1))

    if (what === 'readonly') {
      await mounted.setProps({ readonly: true })
    } else {
      mounted.unmount()
      widget = undefined
      await mountWidget([])
    }
    reads.release()
    await waits.settle()

    expect(rowFiles()).toEqual(what === 'readonly' ? ['file-11'] : [])
  })

  it('that also copies assets adds nothing and opens no queue when the widget turns read-only meanwhile', async () => {
    const mounted = await withImages([11])
    inTheDam('asset-20', 'file-20')
    copiesAnswer()
    const copies = dam.hold('PATCH', COPY)
    confirmPick([listed('asset-20', 'file-20'), listed('asset-30', 'file-30', OTHER_LICENCE)], licence)
    await vi.waitFor(() => expect(copies.waiting).toHaveLength(1))

    await mounted.setProps({ readonly: true })
    copies.release()
    await waits.settle()

    expect(rowFiles()).toEqual(['file-11'])
    expect(queueDialog()).toBeNull()
  })

  // The queue dialog is where copies enter the widget. Opened at once, it could add
  // them before the assets taken as they are were read, so they came after the copies.
  it('that also copies assets opens the queue once the assets taken as they are have been added', async () => {
    await withImages([11])
    inTheDam('asset-20', 'file-20')
    copiesAnswer()
    const reads = dam.hold('GET', dam.routes.byIds)
    confirmPick([listed('asset-30', 'file-30', OTHER_LICENCE), listed('asset-20', 'file-20')], licence)
    await vi.waitFor(() => expect(reads.waiting).toHaveLength(1))
    await vi.waitFor(() => expect(dam.sentTo('PATCH', COPY)).toHaveLength(1))
    await waits.settle()

    expect(queueDialog()).toBeNull()
    expect(rowFiles()).toEqual(['file-11'])

    reads.release()
    await vi.waitFor(() => expect(queueDialog()).toBe(QUEUE))
    expect(rowFiles()).toEqual(['file-11', 'file-20'])
    expect(images().map((image) => image.position)).toEqual([1, 2])
  })

  it.each<[string, 'picked' | 'uploaded', string]>([
    ['picked in the library', 'picked', 'file-20'],
    ['uploaded', 'uploaded', 'file-uploaded'],
  ])('keeps the rows %s while the images of the entity load, after those images', async (_how, how, file) => {
    imageApi.has(stored(11, 1))
    inTheDam('asset-11', 'file-11')
    const searches = dam.hold('GET', SEARCH)
    await mountWidget([11])
    await vi.waitFor(() => expect(searches.waiting).toHaveLength(1))
    if (how === 'picked') {
      inTheDam('asset-20', 'file-20')
      confirmPick([listed('asset-20', 'file-20')])
      await vi.waitFor(() => expect(dam.sentTo('GET', dam.routes.byIds)).toHaveLength(1))
    } else {
      useUploadQueueDialog().uploadQueueDialog.value = QUEUE
      await flushPromises()
      widget!.findComponent(QueueStandIn).vm.$emit('apply', [uploadedRow()])
    }
    await waits.settle()

    searches.release({ status: 200, data: { data: [dam.assets.get('asset-11')], totalCount: 1 } })
    await vi.waitFor(() => expect(rowFiles()).toEqual(['file-11', file]))

    expect(images().map((image) => image.position)).toEqual([1, 2])
  })

  // An upload is the user's work, so its queue dialog stays open,
  // as it does for a widget that is read-only from the start.
  it('leaves the queue dialog of an upload applied while the images load as it is, once the widget has turned read-only by their end', async () => {
    imageApi.has(stored(11, 1))
    inTheDam('asset-11', 'file-11')
    const searches = dam.hold('GET', SEARCH)
    const mounted = await mountWidget([11])
    await vi.waitFor(() => expect(searches.waiting).toHaveLength(1))
    const stops = vi.spyOn(useUploadQueuesStore(pinia), 'stopUpload')
    useUploadQueueDialog().uploadQueueDialog.value = QUEUE
    await flushPromises()

    widget!.findComponent(QueueStandIn).vm.$emit('apply', [uploadedRow()])
    await waits.settle()
    expect(queueDialog()).toBe(QUEUE)
    await mounted.setProps({ readonly: true })
    searches.release({ status: 200, data: { data: [dam.assets.get('asset-11')], totalCount: 1 } })
    await vi.waitFor(() => expect(rowFiles()).toEqual(['file-11']))
    await waits.settle()

    expect(queueDialog()).toBe(QUEUE)
    expect(stops).not.toHaveBeenCalled()
    expect(rowFiles()).toEqual(['file-11'])
  })
})

describe('the save of the widget of several images', () => {
  it('saves the images with the next save, once the authors picked in a row were written and the images were not saved', async () => {
    await withImages([12], { 12: '' })
    damKeepsAuthors()
    await pickInRow(0, ['author-5'])
    const saves = imageApi.holdBulkSaves()

    const first = save()
    await vi.waitFor(() => expect(saves.waiting).toHaveLength(1))
    saves.release('failed')
    expect(await first).toBe(false)
    await flushPromises()

    expect(metadataWrites()).toEqual([[{ id: 'asset-12', authors: ['author-5'] }]])
    expect(images().map((image) => [image.damAuthors, image.showDamAuthors, image.texts.source])).toEqual([
      [['author-5'], false, 'Name of author-5'],
    ])
    forgetAlerts()

    const second = save()
    await vi.waitFor(() => expect(saves.waiting).toHaveLength(1))
    saves.release()

    expect(await second).toBe(true)
    expect(shownAlerts()).toEqual([])
    expect(metadataWrites()).toHaveLength(1)
    expect(rereadsOf('asset-12')).toHaveLength(1)
    expect(imagesSent()).toHaveLength(2)
  })

  // A widget drawn meanwhile for the same images read them before that save, and the save was noted only once sent.
  // Its own save then wrote the texts it had read back over the new ones.
  it('saves no image once the widget is gone while the authors picked in a row are written', async () => {
    const mounted = await withImages([12], { 12: '' })
    await pickInRow(0, ['author-5'])
    const writes = dam.hold('PATCH', dam.routes.bulkMetadata)
    const saved = save()
    await vi.waitFor(() => expect(writes.waiting).toHaveLength(1))

    mounted.unmount()
    widget = undefined
    writes.release()

    expect(await saved).toBe(false)
    expect(metadataWrites()).toHaveLength(1)
    expect(imagesSent()).toEqual([])
  })

  // The detail form is not locked while saving, so the detail can close before the DAM answers.
  // The read after the close waits for that save. The read of another row's asset does not.
  it('reads the asset of a row once its detail closes, while the save of the detail of another asset is on its way', async () => {
    await withImages([11, 12], { 11: '', 12: '' })
    const detail = () => useAssetDetailStore(pinia)
    const { editAssetLabel } = useCommonAdminCoreDamOptions('default')
    const editAssetOf = async (row: number) => {
      await rows()
        [row]!.findAll('button')
        .find((button) => button.text() === editAssetLabel)!
        .trigger('click')
      await vi.waitFor(() => expect(detail().asset?.id).toBe(`asset-1${row + 1}`))
      await flushPromises()
    }
    const closeDetail = async () => {
      widget!.findComponent({ name: 'AssetDetailDialogFrame' }).vm.$emit('close')
      await flushPromises()
    }
    await editAssetOf(0)
    const Form = defineComponent({
      setup: () => () =>
        h('div', [
          h(AssetDetailSidebarMetadata, { queueKey: QUEUE, isActive: true, assetType: DamAssetType.Image, extSystem }),
          h(AssetDetailSidebarActionsTeleportTarget, { queueKey: QUEUE }),
        ]),
    })
    detailForm = mount(Form, {
      attachTo: document.body,
      global: { plugins: [pinia], stubs: { AFormRemoteAutocompleteWithCached: true, ACachedUserChip: true } },
    })
    await flushPromises()
    await flushPromises()
    const detailSaves = dam.hold('PATCH', dam.routes.bulkMetadata)
    detail().asset!.authors = ['author-9']
    document.body.querySelector<HTMLButtonElement>('[data-cy="button-save"]')!.click()
    await vi.waitFor(() => expect(detailSaves.waiting).toHaveLength(1))
    detailForm.unmount()
    detailForm = undefined
    await closeDetail()

    await editAssetOf(1)
    await closeDetail()
    await vi.waitFor(() => expect(rereadsOf('asset-12')).toHaveLength(1))

    expect(rereadsOf('asset-11')).toEqual([])
    expect(detailSaves.waiting).toHaveLength(1)
    detailSaves.release()
    await vi.waitFor(() => expect(rereadsOf('asset-11')).toHaveLength(1))
  })
})

describe('the widget of several images drawn while the save of another one of the same images is on its way', () => {
  const typedAndSaving = async () => {
    const original = await withImages([11, 12])
    images()[0]!.texts.description = 'typed in the original'
    const saves = imageApi.holdBulkSaves()
    const saved = save()
    await vi.waitFor(() => expect(saves.waiting).toHaveLength(1))
    original.unmount()
    widget = undefined
    await mountWidget([11, 12])
    await vi.waitFor(() => expect(imageApi.calls.filter(([call]) => call === 'fetchImageListByIds')).toHaveLength(2))
    // The copy waits for the save after its read answers, for at most the 30 s `apiTimeout`.
    // A fixed real-time pause was too short on a slow runner,
    // and the wait was not yet there when a case let it run out.
    await vi.waitFor(() => expect(waits.lengths()).toContain(30_000))
    return { saves, saved }
  }
  const descriptions = () => images().map((image) => image.texts.description)

  it('shows its rows once that save has answered, with what it saved', async () => {
    const { saves, saved } = await typedAndSaving()
    expect(images()).toEqual([])

    saves.release()
    expect(await saved).toBe(true)
    await vi.waitFor(() => expect(images()).toHaveLength(2))

    expect(descriptions()).toEqual(['typed in the original', 'image 12'])
    expect(shownAlerts()).toEqual([])
    const again = save()
    await vi.waitFor(() => expect(saves.waiting).toHaveLength(1))
    saves.release()
    expect(await again).toBe(true)
    expect(imagesSent().at(-1)).toEqual([
      [11, 1, 'typed in the original'],
      [12, 2, 'image 12'],
    ])
  })

  it('shows the rows it read once that save fails', async () => {
    const { saves, saved } = await typedAndSaving()

    saves.release('failed')
    expect(await saved).toBe(false)
    await vi.waitFor(() => expect(images()).toHaveLength(2))

    expect(descriptions()).toEqual(['image 11', 'image 12'])
  })

  // The image store is page-wide. The save answer of a gone widget
  // used to overwrite the rows of the next widget, of another entity.
  it('of other images: shows its own rows at once, and the answer of that save writes nothing into them', async () => {
    const original = await withImages([11, 12])
    const saves = imageApi.holdBulkSaves()
    const saved = save()
    await vi.waitFor(() => expect(saves.waiting).toHaveLength(1))
    original.unmount()
    widget = undefined
    imageApi.has(stored(21, 1))
    inTheDam('asset-21', 'file-21')
    await mountWidget([21])
    await vi.waitFor(() => expect(images()).toHaveLength(1))

    saves.release()
    expect(await saved).toBe(true)
    await waits.settle()

    expect(images().map((image) => image.id)).toEqual([21])
  })

  it('shows the rows it read once the wait runs out, and says the request timed out', async () => {
    const { saves } = await typedAndSaving()

    expect(await waits.elapse()).toBe(true)
    await vi.waitFor(() => expect(images()).toHaveLength(2))

    expect(descriptions()).toEqual(['image 11', 'image 12'])
    expect(shownAlerts()).toEqual([['error', alertText('error.apiTimedOut.message')]])
    saves.release()
  })
})
