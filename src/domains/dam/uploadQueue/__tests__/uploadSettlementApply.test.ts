import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import {
  cmsConfiguration,
  type ConsumerProfile,
  installConsumerProfile,
  ugcConfiguration,
} from '@/domains/dam/__tests__/support/consumerProfiles'
import { answerDamNames, damNameLookups, damNamesAsked } from '@/domains/dam/__tests__/support/damNames'
import { createFakeDam, damAssetWithFile, damImageLinks, type FakeDam } from '@/domains/dam/__tests__/support/fakeDam'
import { holdLongWaits, type LongWaits } from '@/domains/dam/__tests__/support/longWaits'
import {
  type DamNotification,
  DamNotificationName,
  type DamNotificationNameType,
  useDamNotificationsEventBus,
} from '@/domains/dam/composables/damNotificationsEventBus'
import { type AssetDetailItemDto, DamAssetStatus, DamAssetType } from '@/domains/dam/types/Asset'
import { AssetFileProcessStatus } from '@/domains/dam/types/AssetFile'
import { type UploadQueueItem, UploadQueueItemStatus } from '@/domains/dam/types/UploadQueue'
import { useUploadQueueItemRefresh } from '@/domains/dam/uploadQueue/composables/uploadQueueItemRefresh'
import { useUploadQueuesStore } from '@/domains/dam/uploadQueue/store/uploadQueuesStore'

// What a row of the queue is given from the asset the DAM answers with, field by field, whichever way that asset
// came to be read: by the poll, on a notification, on the row's refresh. Nothing of the library is replaced: the
// DAM is a client that records its requests, the notifications are events on the real bus, and only the long
// waits between two reads are taken out of real time.

const QUEUE = 'apply-queue'

let dam: FakeDam
let waits: LongWaits

const use = (profile: ConsumerProfile) => {
  setActivePinia(createPinia())
  dam = createFakeDam(profile.endPoints)
  installConsumerProfile(profile, dam.client)
  waits = holdLongWaits()
  answerDamNames(dam)
}
const nameLookups = () => damNameLookups(dam)
// A name is asked for once in the whole file, whatever the case: one that waits for the lookup needs ids nobody
// has asked for, on a second attempt of the case too.
let attempts = 0
const neverAsked = (...ids: string[]) => {
  attempts++
  return ids.map((id) => `${id}-try-${attempts}`)
}

afterEach(async () => {
  useUploadQueuesStore().stopUpload(QUEUE)
  await damNamesAsked()
  waits.restore()
  useDamNotificationsEventBus().reset()
})

const notify = (name: DamNotificationNameType, data: Record<string, unknown>) =>
  useDamNotificationsEventBus().emit({ name, data } as unknown as DamNotification)
// The metadata notification may come to be read with a delay of its own.
const SOON = { timeout: 5000 }

// One asset with everything a row takes. Of the names the DAM suggests for authors and keywords: one it knows
// nobody by (an empty object, by which the queue recognises it), one it knows one by, one it knows two by.
const nobody = {} as unknown as string[]
const everything: Partial<AssetDetailItemDto> = {
  keywords: ['keyword-1'],
  authors: ['author-1'],
  metadata: {
    customData: { title: 'from the server', description: 'described' },
    authorSuggestions: {
      'New Author': nobody,
      'Known Author': ['author-1'],
      'Ambiguous Author': ['author-2', 'author-3'],
    },
    keywordSuggestions: { 'new keyword': nobody, 'known keyword': ['keyword-1'] },
  },
  mainFileSingleUse: true,
  mainFileInternal: true,
}
const theMetadata = {
  keywords: ['keyword-1'],
  authors: ['author-1'],
  customData: { title: 'from the server', description: 'described' },
  mainFileSingleUse: true,
  mainFileInternal: true,
  authorConflicts: ['author-2', 'author-3'],
  canEditMetadata: true,
}
const noMetadata = {
  keywords: [],
  authors: [],
  customData: {},
  authorConflicts: [],
  canEditMetadata: false,
}
const suggestions = () => {
  const queue = useUploadQueuesStore().getQueue(QUEUE)!
  return {
    newAuthorNames: [...queue.suggestions.newAuthorNames],
    newKeywordNames: [...queue.suggestions.newKeywordNames],
  }
}
const theSuggestions = { newAuthorNames: ['New Author'], newKeywordNames: ['new keyword'] }

/** A file, sent whole: its row has the asset and the file the start request answered, `asset-1` and `file-1`. */
const uploadedFile = async (profile: ConsumerProfile) => {
  const store = useUploadQueuesStore()
  await store.addByFiles(QUEUE, profile.extSystem, profile.licence, [
    new File([new Uint8Array(3000)], 'photo.jpg', { type: 'image/jpeg' }),
  ])
  const [item] = store.getQueueItems(QUEUE)
  await vi.waitFor(() => expect(item.status).toBe(UploadQueueItemStatus.Processing))
  return item
}
/** An asset copied to the licence: its row has the asset `asset-1`, and no file. */
const copiedAsset = async (profile: ConsumerProfile) => {
  const store = useUploadQueuesStore()
  await store.addByCopyToLicence(QUEUE, profile.extSystem, profile.licence, ['asset-1'])
  return store.getQueueItems(QUEUE)[0]!
}
const processed = () =>
  dam.fileBecomes('asset-1', AssetFileProcessStatus.Processed, everything, { links: damImageLinks('file-1') })

describe('what a processed asset gives a row, under the CMS configuration', () => {
  beforeEach(() => use(cmsConfiguration))

  const ways: Array<[string, typeof uploadedFile, (item: UploadQueueItem) => unknown]> = [
    ['an uploaded file the poll asks about', uploadedFile, () => waits.elapse()],
    ['a copy to the licence the poll asks about', copiedAsset, () => waits.elapse()],
    [
      'a copy to the licence on its copied notification',
      copiedAsset,
      () => notify(DamNotificationName.AssetFileCopied, { asset: 'asset-1' }),
    ],
    [
      'an uploaded file on its metadata and its file notification',
      uploadedFile,
      () => {
        notify(DamNotificationName.AssetMetadataProcessed, { asset: 'asset-1' })
        notify(DamNotificationName.AssetFileProcessed, { asset: 'asset-1', id: 'file-1' })
      },
    ],
    [
      'an uploaded file on its file and its metadata notification',
      uploadedFile,
      () => {
        notify(DamNotificationName.AssetFileProcessed, { asset: 'asset-1', id: 'file-1' })
        notify(DamNotificationName.AssetMetadataProcessed, { asset: 'asset-1' })
      },
    ],
    ['an uploaded file on its refresh', uploadedFile, () => useUploadQueueItemRefresh().refreshItem('asset-1')],
    ['a copy to the licence on its refresh', copiedAsset, () => useUploadQueueItemRefresh().refreshItem('asset-1')],
  ]
  it.each(ways)('%s: the state of the file, its preview, the metadata and the form', async (_name, row, read) => {
    const item = await row(cmsConfiguration)
    const asset = processed()

    await read(item)
    await vi.waitFor(
      () => expect([item.status, item.canEditMetadata]).toEqual([UploadQueueItemStatus.Uploaded, true]),
      SOON
    )

    expect(item).toMatchObject({
      assetId: 'asset-1',
      // A copy learns its file here; an upload has had it since its start request.
      fileId: asset.mainFile!.id,
      isDuplicate: false,
      duplicateAssetId: null,
      assetStatus: DamAssetStatus.WithFile,
      imagePreview: damImageLinks('file-1').image_detail,
      ...theMetadata,
      error: { hasError: false, message: '' },
    })
    expect(suggestions()).toEqual(theSuggestions)
    expect(dam.assetReads().every((read) => read.url.startsWith('/adm/v1/asset/'))).toBe(true)
  })

  it('the file notification alone: the state of the file, its preview and the two switches, nothing else', async () => {
    const item = await uploadedFile(cmsConfiguration)
    processed()

    notify(DamNotificationName.AssetFileProcessed, { asset: 'asset-1', id: 'file-1' })
    await vi.waitFor(() => expect(item.status).toBe(UploadQueueItemStatus.Uploaded))
    await waits.settle()

    expect(item).toMatchObject({
      fileId: 'file-1',
      assetStatus: DamAssetStatus.WithFile,
      imagePreview: damImageLinks('file-1').image_detail,
      mainFileSingleUse: true,
      mainFileInternal: true,
      ...noMetadata,
    })
    expect(suggestions()).toEqual({ newAuthorNames: [], newKeywordNames: [] })
  })

  it('the metadata notification alone: the metadata and the form, nothing about the file', async () => {
    const item = await uploadedFile(cmsConfiguration)
    // The server reads the metadata off the file before it has processed it.
    dam.fileBecomes('asset-1', AssetFileProcessStatus.Stored, everything, { links: damImageLinks('file-1') })

    notify(DamNotificationName.AssetMetadataProcessed, { asset: 'asset-1' })
    await vi.waitFor(() => expect(item.canEditMetadata).toBe(true), SOON)
    await waits.settle()

    expect(item).toMatchObject({
      status: UploadQueueItemStatus.Processing,
      fileId: 'file-1',
      assetStatus: DamAssetStatus.Draft,
      ...theMetadata,
    })
    expect(item.imagePreview).toBeUndefined()
    expect(suggestions()).toEqual(theSuggestions)
  })

  // The read the notification asks for says what became of the file as well: a file notification that is lost
  // does not leave the row waiting.
  it('the metadata notification for a file processed by then: the row is uploaded too', async () => {
    const item = await uploadedFile(cmsConfiguration)
    processed()

    notify(DamNotificationName.AssetMetadataProcessed, { asset: 'asset-1' })
    await vi.waitFor(() => expect(item.canEditMetadata).toBe(true), SOON)

    expect(item).toMatchObject({
      status: UploadQueueItemStatus.Uploaded,
      assetStatus: DamAssetStatus.WithFile,
      imagePreview: damImageLinks('file-1').image_detail,
      ...theMetadata,
    })
    const reads = dam.assetReads().length
    await waits.elapseAll()
    expect(dam.assetReads()).toHaveLength(reads)
  })

  // The row stops being the asset that was uploaded: it is the original from here on, and what is saved from it
  // is saved to the original.
  it.each([
    ['an uploaded file', uploadedFile],
    ['a copy to the licence', copiedAsset],
  ])('a duplicate, %s: everything of the original, and its asset and file in place of the own', async (_name, row) => {
    const item = await row(cmsConfiguration)
    dam.assets.set(
      'asset-original',
      damAssetWithFile('asset-original', 'file-original', AssetFileProcessStatus.Processed, everything, {
        links: damImageLinks('file-original'),
      })
    )

    notify(DamNotificationName.AssetFileDuplicate, {
      asset: 'asset-1',
      id: 'file-1',
      originAssetFile: 'file-original',
      assetType: DamAssetType.Image,
    })
    await vi.waitFor(() => expect(item.status).toBe(UploadQueueItemStatus.Uploaded))

    expect(item).toMatchObject({
      isDuplicate: true,
      assetId: 'asset-original',
      duplicateAssetId: 'asset-original',
      fileId: 'file-original',
      assetStatus: DamAssetStatus.WithFile,
      imagePreview: damImageLinks('file-original').image_detail,
      ...theMetadata,
      error: { hasError: false, message: '' },
    })
    expect(suggestions()).toEqual(theSuggestions)
    expect(useUploadQueuesStore().getQueueProcessedCount(QUEUE)).toBe(1)
  })

  it('the names of its authors and keywords are asked for from the DAM, by the ext system of the widget', async () => {
    const item = await uploadedFile(cmsConfiguration)
    const [author, oneOfTwo, otherOfTwo, keyword] = neverAsked('author-7', 'author-8', 'author-9', 'keyword-7')
    dam.fileBecomes('asset-1', AssetFileProcessStatus.Processed, {
      authors: [author],
      keywords: [keyword],
      metadata: {
        customData: {},
        authorSuggestions: { 'Ambiguous Author': [oneOfTwo, otherOfTwo] },
        keywordSuggestions: {},
      },
    })

    await waits.elapse()
    await vi.waitFor(() => expect(item.status).toBe(UploadQueueItemStatus.Uploaded))
    await vi.waitFor(() => expect(nameLookups()).toHaveLength(2), SOON)

    const asked = (kind: string) => {
      const lookup = nameLookups().find((request) => request.url.includes(`/${kind}/`))!
      const [path, query] = lookup.url.split('?')
      return { path, ids: new URLSearchParams(query).get('id')!.split(',').sort() }
    }
    expect(asked('author')).toEqual({
      path: '/adm/v1/author/ext-system/1/search',
      // The author of the asset, and the two the DAM cannot tell apart.
      ids: [author, oneOfTwo, otherOfTwo],
    })
    expect(asked('keyword')).toEqual({ path: '/adm/v1/keyword/ext-system/1/search', ids: [keyword] })
    expect(dam.unanswered).toEqual([])
  })
})

// admin-ugc's ext system has neither authors nor keywords. Were an asset of its to carry one, the names would be
// asked for under `/adm/v1`: those two paths are fixed, whatever endpoints the application has configured.
describe('what a processed asset gives a row, under the UGC configuration', () => {
  beforeEach(() => use(ugcConfiguration))

  it('an asset with an author and a keyword: their names are asked for under /adm/v1', async () => {
    const item = await uploadedFile(ugcConfiguration)
    const [author, keyword] = neverAsked('author-4', 'keyword-4')
    dam.fileBecomes('asset-1', AssetFileProcessStatus.Processed, { authors: [author], keywords: [keyword] })

    await waits.elapse()
    await vi.waitFor(() => expect(item.status).toBe(UploadQueueItemStatus.Uploaded))
    await vi.waitFor(() => expect(nameLookups()).toHaveLength(2), SOON)

    expect(item).toMatchObject({ authors: [author], keywords: [keyword] })
    expect(
      dam.requests
        .filter((request) => !request.url.startsWith('/ugc/v1/'))
        .map((request) => request.url.split('?')[0])
        .sort()
    ).toEqual(['/adm/v1/author/ext-system/4/search', '/adm/v1/keyword/ext-system/4/search'])
  })
})
