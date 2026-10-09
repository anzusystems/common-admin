import { describe, expect, it } from 'vitest'
import { DamAssetStatus, DamAssetType, type DamAssetTypeType } from '@/domains/dam/types/Asset'
import type { DocIdNullable } from '@/shared/types/common'
import { AssetFileFailReason, AssetFileProcessStatus } from '@/domains/dam/types/AssetFile'
import { type UploadQueueItem, UploadQueueItemStatus, UploadQueueItemType } from '@/domains/dam/types/UploadQueue'
import {
  damAsset,
  damFile,
  damProfile,
  fakeDamServer,
  libProfile,
  loadedMetadata,
  noMetadata,
  previewOf,
  queueRow,
  settledState,
  TEXT,
} from '@/domains/dam/uploadQueue/settlement/__tests__/support/settlementFixtures'
import { createUploadSettle, type UploadReadIntent } from '@/domains/dam/uploadQueue/settlement/uploadSettle'

// What a read asset or a known state writes into a row. No timers, no settlement around: the writes are called
// as the settlement calls them, over the profile of the library's store and of the DAM application's.

const QUEUE = 'queue'
const TARGET = { assetId: 'asset-1', fileId: null }
const FILE_TARGET = { assetId: 'asset-1', fileId: 'file-1' }

/** A tick, the manual refresh, a `copied` event. */
const WITH_METADATA: UploadReadIntent = { hint: null, metadata: true, early: false, seen: true }
/** A `processed` event. */
const EVENT_ONLY: UploadReadIntent = { hint: 'processed', metadata: false, early: false, seen: true }
/** A metadata notification. */
const METADATA_EVENT: UploadReadIntent = { hint: null, metadata: true, early: true, seen: false }

const processedAsset = () => damAsset('asset-1', damFile('file-1', AssetFileProcessStatus.Processed))
const storedAsset = () => damAsset('asset-1', damFile('file-1', AssetFileProcessStatus.Stored))

const lib = () => {
  const server = fakeDamServer()
  const { profile, calls, add, queues } = libProfile(server)
  const settle = createUploadSettle(profile)
  return { server, profile, calls, add, queues, settle, read: () => settle.startRead() }
}
const dam = () => {
  const server = fakeDamServer()
  const { profile, calls, add, queues, gateOpen } = damProfile(server)
  const settle = createUploadSettle(profile)
  return { server, profile, calls, add, queues, gateOpen, settle, read: () => settle.startRead() }
}
const noError = { hasError: false, message: '', assetFileFailReason: AssetFileFailReason.None }

describe('a processed file', () => {
  it('N-S1 with its metadata: the state, the file, the preview, the switches, the metadata and the form', async () => {
    const { settle, add, queues, calls, read } = lib()
    // A copy to the licence knows its asset alone.
    const row = add(QUEUE, queueRow({ type: UploadQueueItemType.Asset, fileId: null }))

    await settle.applyAssetRead(processedAsset(), TARGET, WITH_METADATA, read())

    expect(row).toMatchObject({
      status: UploadQueueItemStatus.Uploaded,
      fileId: 'file-1',
      assetStatus: DamAssetStatus.WithFile,
      imagePreview: previewOf('file-1'),
      error: noError,
      ...loadedMetadata,
    })
    const queue = queues.get(QUEUE)!
    expect([...queue.suggestions.newAuthorNames]).toEqual(['New Author'])
    expect([...queue.suggestions.newKeywordNames]).toEqual(['new keyword'])
    expect(calls.keywordsAdded).toEqual(['keyword-1'])
    expect(calls.authorsAdded).toEqual(['author-1', 'author-2', 'author-3'])
    expect(calls.final).toEqual([row.key])
    expect(calls.metadataLoaded).toEqual([row.key])
    expect(calls.assetsRead).toEqual(['asset-1'])
  })

  it('N-S2 on its event alone: the state, the preview and the switches, and no form', async () => {
    const { settle, add, calls, read } = lib()
    const row = add(QUEUE, queueRow())

    // The event carries the state: the asset it is read with need not say it.
    await settle.applyAssetRead(damAsset('asset-1', damFile('file-1')), TARGET, EVENT_ONLY, read())

    expect(row).toMatchObject({
      status: UploadQueueItemStatus.Uploaded,
      fileId: 'file-1',
      assetStatus: DamAssetStatus.WithFile,
      imagePreview: previewOf('file-1'),
      mainFileSingleUse: true,
      mainFileInternal: true,
      ...noMetadata,
    })
    expect(calls.final).toEqual([row.key])
    expect(calls.metadataLoaded).toEqual([])
    expect(calls.keywordsAdded).toEqual([])
  })

  it('N-S2 a read that shows no final state and carries no hint writes nothing', async () => {
    const { settle, add, calls, read } = lib()
    const row = add(QUEUE, queueRow())
    const before = settledState(row)

    await settle.applyAssetRead(storedAsset(), TARGET, WITH_METADATA, read())
    await settle.applyAssetRead(damAsset('asset-1', null), TARGET, EVENT_ONLY, read())

    expect(settledState(row)).toEqual(before)
    expect(calls.final).toEqual([])
  })

  it('N-S3 a row that has its metadata keeps what the user has typed since, the switches too', async () => {
    const { settle, add, read } = lib()
    const row = add(QUEUE, queueRow())
    await settle.applyAssetRead(processedAsset(), TARGET, WITH_METADATA, read())

    row.keywords = ['typed-keyword']
    row.authors = []
    row.customData.title = 'typed'
    row.mainFileSingleUse = false
    row.mainFileInternal = false
    const typed = settledState(row)

    await settle.applyAssetRead(processedAsset(), TARGET, WITH_METADATA, read())
    await settle.applyAssetRead(processedAsset(), TARGET, EVENT_ONLY, read())
    await settle.applyAssetRead(processedAsset(), TARGET, METADATA_EVENT, read())

    expect(settledState(row)).toEqual(typed)
  })

  it('N-S4 a row the client gave up on gets its form at once on the event alone, with the metadata it never had', async () => {
    const { settle, add, calls, read } = lib()
    const row = add(
      QUEUE,
      queueRow({
        status: UploadQueueItemStatus.Failed,
        error: { hasError: true, message: 'the finish request failed', assetFileFailReason: AssetFileFailReason.None },
      })
    )

    await settle.applyAssetRead(processedAsset(), TARGET, EVENT_ONLY, read())

    expect(row).toMatchObject({ status: UploadQueueItemStatus.Uploaded, error: noError, ...loadedMetadata })
    expect(calls.metadataLoaded).toEqual([row.key])
  })

  it('N-S4 a row the client gave up on, which had its metadata by then, gets the form back as the user left it', async () => {
    const { settle, add, read } = lib()
    const row = add(QUEUE, queueRow({ status: UploadQueueItemStatus.Uploading }))
    // Its metadata notification came while the file was still sent.
    await settle.applyAssetRead(damAsset('asset-1', null), TARGET, METADATA_EVENT, read())
    expect(row).toMatchObject({ canEditMetadata: true, mainFileSingleUse: true, mainFileInternal: true })
    row.keywords = ['typed-keyword']
    row.customData.title = 'typed'
    // The switches are fields of its form: the user turns off what the server has on.
    row.mainFileSingleUse = false
    row.mainFileInternal = false
    row.status = UploadQueueItemStatus.Failed
    row.error.hasError = true
    row.canEditMetadata = false

    await settle.applyAssetRead(processedAsset(), TARGET, EVENT_ONLY, read())

    expect(row).toMatchObject({
      status: UploadQueueItemStatus.Uploaded,
      canEditMetadata: true,
      keywords: ['typed-keyword'],
      customData: { title: 'typed', description: 'described' },
      mainFileSingleUse: false,
      mainFileInternal: false,
      error: noError,
    })

    // Nor by a tick or the refresh of the row, should it fail and be found processed once more.
    row.status = UploadQueueItemStatus.Failed
    row.canEditMetadata = false
    await settle.applyAssetRead(processedAsset(), TARGET, WITH_METADATA, read())

    expect(row).toMatchObject({ canEditMetadata: true, mainFileSingleUse: false, mainFileInternal: false })
  })

  it('N-S3 a row whose form is on is given nothing by a processed file, also when its metadata was never loaded here', async () => {
    const { settle, add, calls, read } = lib()
    // As a store or a test hands it over: the form on, the fields the user's.
    const row = add(
      QUEUE,
      queueRow({ canEditMetadata: true, customData: { title: '' }, mainFileSingleUse: false, mainFileInternal: false })
    )

    await settle.applyAssetRead(processedAsset(), TARGET, WITH_METADATA, read())

    expect(row).toMatchObject({
      status: UploadQueueItemStatus.Uploaded,
      canEditMetadata: true,
      keywords: [],
      authors: [],
      customData: { title: '' },
      authorConflicts: [],
      mainFileSingleUse: false,
      mainFileInternal: false,
    })
    expect(calls.keywordsAdded).toEqual([])
  })

  it('N-S4 a row that settles on the event: uploaded at once, and the read after it brings the metadata and the form', async () => {
    const { settle, add, calls, read } = dam()
    const failed = () =>
      queueRow({
        status: UploadQueueItemStatus.Failed,
        error: { hasError: true, message: 'the finish request failed', assetFileFailReason: AssetFileFailReason.None },
      })
    const neverLoaded = add(QUEUE, failed())
    const loaded = add(QUEUE, failed())
    loaded.status = UploadQueueItemStatus.Uploading
    await settle.applyAssetRead(damAsset('asset-1', null), FILE_TARGET, METADATA_EVENT, read())
    expect([neverLoaded.canEditMetadata, loaded.canEditMetadata]).toEqual([false, true])
    loaded.customData.title = 'typed'
    loaded.status = UploadQueueItemStatus.Failed
    loaded.canEditMetadata = false

    settle.settleProcessedByEvent(FILE_TARGET)

    // The one that had its metadata has its form back before anything is read.
    expect(neverLoaded).toMatchObject({
      status: UploadQueueItemStatus.Uploaded,
      canEditMetadata: false,
      error: noError,
    })
    expect(loaded).toMatchObject({ status: UploadQueueItemStatus.Uploaded, canEditMetadata: true, error: noError })
    expect(calls.final).toEqual([neverLoaded.key, loaded.key])

    await settle.applyAssetRead(processedAsset(), FILE_TARGET, EVENT_ONLY, read())

    expect(neverLoaded).toMatchObject({ status: UploadQueueItemStatus.Uploaded, ...loadedMetadata })
    expect(loaded.customData).toEqual({ title: 'typed', description: 'described' })
  })

  it('N-S4 a row that never failed gets no metadata from the read after its event', async () => {
    const { settle, add, read } = dam()
    const row = add(QUEUE, queueRow())

    settle.settleProcessedByEvent(FILE_TARGET)
    await settle.applyAssetRead(processedAsset(), FILE_TARGET, EVENT_ONLY, read())

    expect(row).toMatchObject({ status: UploadQueueItemStatus.Uploaded, mainFileSingleUse: true, ...noMetadata })
  })
})

describe('the first load of the metadata of a row', () => {
  it('N-S5 keeps what a mass operation has put into the row, and fills what is still empty', async () => {
    const { settle, add, read } = lib()
    const filled = add(
      QUEUE,
      queueRow({
        keywords: ['mass-keyword'],
        authors: ['mass-author'],
        customData: { title: 'mass title', description: '', rights: 'mass rights', tags: [], note: null },
        mainFileSingleUse: false,
        mainFileInternal: false,
      })
    )
    const partly = add(QUEUE, queueRow({ keywords: ['mass-keyword'], authors: [] }))

    await settle.applyAssetRead(processedAsset(), TARGET, WITH_METADATA, read())

    expect(filled).toMatchObject({
      keywords: ['mass-keyword'],
      authors: ['mass-author'],
      // The switches are no field of a mass operation: the server's.
      mainFileSingleUse: true,
      mainFileInternal: true,
      canEditMetadata: true,
    })
    // Key by key: what the row has stays, what it has empty is the server's or nothing.
    expect(filled.customData).toEqual({ title: 'mass title', description: 'described', rights: 'mass rights' })
    expect(partly).toMatchObject({ keywords: ['mass-keyword'], authors: ['author-1'] })
  })

  it('N-S5 two rows of one asset do not share what was loaded into them', async () => {
    const { settle, add, read } = lib()
    const first = add(QUEUE, queueRow())
    const second = add(QUEUE, queueRow())

    await settle.applyAssetRead(processedAsset(), TARGET, WITH_METADATA, read())
    first.customData.title = 'typed into the first'
    first.keywords.push('typed-keyword')

    expect(second).toMatchObject(loadedMetadata)
  })
})

describe('a failed file', () => {
  it('N-S6 the row fails with the reason of the file, loses its form, and the text it had is gone', async () => {
    const { settle, add, calls, read } = lib()
    const row = add(
      QUEUE,
      queueRow({
        canEditMetadata: true,
        error: { hasError: true, message: TEXT.tooLong, assetFileFailReason: AssetFileFailReason.None },
      })
    )
    const asset = damAsset(
      'asset-1',
      damFile('file-1', AssetFileProcessStatus.Failed, { failReason: AssetFileFailReason.InvalidMimeType })
    )

    await settle.applyAssetRead(asset, TARGET, WITH_METADATA, read())

    expect(row).toMatchObject({
      status: UploadQueueItemStatus.Failed,
      canEditMetadata: false,
      error: { hasError: true, message: '', assetFileFailReason: AssetFileFailReason.InvalidMimeType },
    })
    expect(calls.final).toEqual([row.key])
  })

  it('N-S6 a failure the caller knows of is written without a read, also over an uploaded row', () => {
    const { settle, add, server } = lib()
    const row = add(QUEUE, queueRow({ status: UploadQueueItemStatus.Uploaded, canEditMetadata: true }))
    const other = add(QUEUE, queueRow({ assetId: 'asset-2' }))

    settle.settleKnownFailed(TARGET, AssetFileFailReason.InvalidSize)

    expect(row).toMatchObject({
      status: UploadQueueItemStatus.Failed,
      canEditMetadata: false,
      error: { hasError: true, message: '', assetFileFailReason: AssetFileFailReason.InvalidSize },
    })
    expect(other.status).toBe(UploadQueueItemStatus.Processing)
    expect(server.requests).toEqual([])
  })
})

describe('a duplicate file, in the library', () => {
  const original = () =>
    damAsset(
      'asset-original',
      damFile('file-original', AssetFileProcessStatus.Processed, { asset: 'asset-original' }),
      {
        keywords: ['original-keyword'],
        authors: ['original-author'],
        mainFileSingleUse: false,
        mainFileInternal: true,
      }
    )
  const duplicate = () =>
    damAsset('asset-1', damFile('file-1', AssetFileProcessStatus.Duplicate, { originAssetFile: 'file-original' }))

  it('N-S7 the row becomes the original: its asset, its file, its preview, its metadata and the form', async () => {
    const { settle, add, server, calls, read } = lib()
    server.originAssets.set('file-original', original())
    const row = add(
      QUEUE,
      queueRow({
        keywords: ['own-keyword'],
        customData: { title: 'own title', own: 'kept nowhere' },
        error: { hasError: true, message: TEXT.tooLong, assetFileFailReason: AssetFileFailReason.None },
      })
    )

    await settle.applyAssetRead(duplicate(), TARGET, WITH_METADATA, read())

    expect(settledState(row)).toEqual({
      status: UploadQueueItemStatus.Uploaded,
      isDuplicate: true,
      assetId: 'asset-original',
      fileId: 'file-original',
      duplicateAssetId: 'asset-original',
      assetStatus: DamAssetStatus.WithFile,
      imagePreview: previewOf('file-original'),
      canEditMetadata: true,
      keywords: ['original-keyword'],
      authors: ['original-author'],
      customData: { title: 'from the server', description: 'described' },
      authorConflicts: ['author-2', 'author-3'],
      mainFileSingleUse: false,
      mainFileInternal: true,
      error: noError,
    })
    expect(server.requests).toEqual([{ kind: 'originAsset', ids: ['file-original'] }])
    expect(calls.final).toEqual([row.key])
    expect(calls.authorsFetched).toBe(1)
    expect(calls.keywordsFetched).toBe(1)
  })

  it('N-S7 the original is read once for all the rows of the asset, and a known duplicate goes the same way', async () => {
    const { settle, add, server } = lib()
    server.originAssets.set('file-original', original())
    const rows = [add(QUEUE, queueRow()), add('another', queueRow())]

    await settle.settleKnownDuplicate(TARGET, 'file-original', DamAssetType.Image)

    expect(rows.map((row) => [row.status, row.assetId, row.fileId])).toEqual([
      [UploadQueueItemStatus.Uploaded, 'asset-original', 'file-original'],
      [UploadQueueItemStatus.Uploaded, 'asset-original', 'file-original'],
    ])
    expect(server.asked('originAsset')).toHaveLength(1)
  })

  it('N-S7 an original that cannot be read fails only the row that still waits', async () => {
    const { settle, add, calls, read } = lib()
    const waiting = add(QUEUE, queueRow())
    const uploaded = add(QUEUE, queueRow({ status: UploadQueueItemStatus.Uploaded, canEditMetadata: true }))

    // The server knows no asset of that file: its reader throws.
    await settle.applyAssetRead(duplicate(), TARGET, WITH_METADATA, read())

    expect(waiting).toMatchObject({
      status: UploadQueueItemStatus.Failed,
      isDuplicate: false,
      assetId: 'asset-1',
      canEditMetadata: false,
      error: { hasError: true },
    })
    expect(uploaded).toMatchObject({
      status: UploadQueueItemStatus.Uploaded,
      isDuplicate: false,
      canEditMetadata: true,
    })
    expect(calls.final).toEqual([waiting.key])
  })

  const nothingToRead: Array<[string, DocIdNullable, DamAssetTypeType | null]> = [
    ['names no original', null, DamAssetType.Image],
    ['is no image', 'file-original', DamAssetType.Audio],
    ['has no type', 'file-original', null],
  ]
  it.each(nothingToRead)(
    'N-S7 a duplicate that %s changes nothing and asks for nothing',
    async (_what, originFileId, assetType) => {
      const { settle, add, server } = lib()
      server.originAssets.set('file-original', original())
      const row = add(QUEUE, queueRow())
      const before = settledState(row)

      await settle.settleKnownDuplicate(TARGET, originFileId, assetType)

      expect(settledState(row)).toEqual(before)
      expect(server.requests).toEqual([])
    }
  )
})

describe('a duplicate file, in the DAM application', () => {
  const originFile = () =>
    damFile('file-original', AssetFileProcessStatus.Processed, { asset: 'asset-original', singleUse: true })

  it('N-S8 the row is uploaded and marked at once, and completed once the original file is read', async () => {
    const { settle, add, server, calls } = dam()
    server.originFiles.set('file-original', originFile())
    const row = add(
      QUEUE,
      queueRow({
        canEditMetadata: true,
        error: { hasError: true, message: TEXT.tooLong, assetFileFailReason: AssetFileFailReason.None },
      })
    )
    server.hold()

    const settled = settle.settleKnownDuplicate(FILE_TARGET, 'file-original', DamAssetType.Image)

    // Before the original file answers.
    expect(row).toMatchObject({
      status: UploadQueueItemStatus.Uploaded,
      isDuplicate: true,
      canEditMetadata: false,
      assetId: 'asset-1',
      fileId: 'file-1',
      duplicateAssetId: null,
      error: noError,
    })
    expect(calls.final).toEqual([row.key])

    server.release()
    await settled

    expect(row).toMatchObject({
      status: UploadQueueItemStatus.Uploaded,
      isDuplicate: true,
      canEditMetadata: false,
      assetId: 'asset-1',
      fileId: 'file-original',
      duplicateAssetId: 'asset-original',
      mainFileSingleUse: true,
      imagePreview: previewOf('file-original'),
    })
    expect(server.requests).toEqual([{ kind: 'originFile', ids: ['file-original'] }])
  })

  it('N-S8 an original file that cannot be read leaves the row as it was marked', async () => {
    const { settle, add, server } = dam()
    server.fail('originFile')
    const row = add(QUEUE, queueRow())

    await settle.settleKnownDuplicate(FILE_TARGET, 'file-original', DamAssetType.Image)

    expect(row).toMatchObject({
      status: UploadQueueItemStatus.Uploaded,
      isDuplicate: true,
      fileId: 'file-1',
      duplicateAssetId: null,
    })
  })

  it('N-S8 a row written into or taken out while the original file was read is not completed', async () => {
    const { settle, add, server, queues } = dam()
    server.originFiles.set('file-original', originFile())
    const failedMeanwhile = add(QUEUE, queueRow())
    const removedMeanwhile = add('another', queueRow())
    server.hold()

    const settled = settle.settleKnownDuplicate(FILE_TARGET, 'file-original', DamAssetType.Image)
    queues['another'].items.splice(0, 1)
    settle.settleKnownFailed(FILE_TARGET, AssetFileFailReason.Unknown)
    server.release()
    await settled

    expect(failedMeanwhile).toMatchObject({
      status: UploadQueueItemStatus.Failed,
      fileId: 'file-1',
      duplicateAssetId: null,
    })
    expect(removedMeanwhile).toMatchObject({
      status: UploadQueueItemStatus.Uploaded,
      isDuplicate: true,
      fileId: 'file-1',
      duplicateAssetId: null,
    })
  })

  it('N-S8 a read that shows the file a duplicate settles the row the same way', async () => {
    const { settle, add, server, read } = dam()
    server.originFiles.set('file-original', originFile())
    const row = add(QUEUE, queueRow())
    const asset = damAsset(
      'asset-1',
      damFile('file-1', AssetFileProcessStatus.Duplicate, { originAssetFile: 'file-original' })
    )

    await settle.applyAssetRead(asset, FILE_TARGET, WITH_METADATA, read())

    expect(row).toMatchObject({
      status: UploadQueueItemStatus.Uploaded,
      isDuplicate: true,
      fileId: 'file-original',
      duplicateAssetId: 'asset-original',
      ...noMetadata,
    })
  })
})

describe('the order of the states', () => {
  it.each([
    ['uploaded', UploadQueueItemStatus.Uploaded],
    ['failed', UploadQueueItemStatus.Failed],
  ])('N-S9 a read that shows the file not final yet leaves a row that is %s as it is', async (_what, status) => {
    const { settle, add, calls, read } = lib()
    const row = add(QUEUE, queueRow({ status }))
    const before = settledState(row)

    for (const fileStatus of [
      AssetFileProcessStatus.Uploading,
      AssetFileProcessStatus.Uploaded,
      AssetFileProcessStatus.Stored,
    ]) {
      await settle.applyAssetRead(damAsset('asset-1', damFile('file-1', fileStatus)), TARGET, WITH_METADATA, read())
    }

    expect(settledState(row)).toEqual(before)
    expect(calls.final).toEqual([])
  })

  it('N-S9 a final state a read shows is written over another final state of the row', async () => {
    const { settle, add, read } = lib()
    const row = add(QUEUE, queueRow({ status: UploadQueueItemStatus.Uploaded }))
    const failedAsset = damAsset(
      'asset-1',
      damFile('file-1', AssetFileProcessStatus.Failed, { failReason: AssetFileFailReason.DownloadFailed })
    )

    // The backend lets a processed file fail.
    await settle.applyAssetRead(failedAsset, TARGET, WITH_METADATA, read())

    expect(row).toMatchObject({
      status: UploadQueueItemStatus.Failed,
      error: { hasError: true, assetFileFailReason: AssetFileFailReason.DownloadFailed },
    })
  })

  it('N-S9 a stopped row is written by nothing', async () => {
    const { settle, add, server, calls, read } = lib()
    server.originAssets.set('file-original', damAsset('asset-original', damFile('file-original')))
    const row = add(QUEUE, queueRow({ status: UploadQueueItemStatus.Stop }))
    const before = settledState(row)

    await settle.applyAssetRead(processedAsset(), TARGET, WITH_METADATA, read())
    await settle.applyAssetRead(processedAsset(), TARGET, METADATA_EVENT, read())
    settle.settleProcessedByEvent(TARGET)
    settle.settleKnownFailed(TARGET, AssetFileFailReason.Unknown)
    await settle.settleKnownDuplicate(TARGET, 'file-original', DamAssetType.Image)

    expect(settledState(row)).toEqual(before)
    expect(calls.final).toEqual([])
    expect(server.requests).toEqual([])
  })

  it('N-S9 a read that started before an event wrote into the row does not write over it', async () => {
    const { settle, add, read } = lib()
    const row = add(QUEUE, queueRow())

    const startedBefore = read()
    settle.settleKnownFailed(TARGET, AssetFileFailReason.InvalidChecksum)
    await settle.applyAssetRead(processedAsset(), TARGET, WITH_METADATA, startedBefore)
    expect(row).toMatchObject({ status: UploadQueueItemStatus.Failed, canEditMetadata: false })

    // One that starts after it does: the client side of a failure may be overtaken by the server.
    await settle.applyAssetRead(processedAsset(), TARGET, WITH_METADATA, read())
    expect(row).toMatchObject({ status: UploadQueueItemStatus.Uploaded, canEditMetadata: true })
  })
})

describe('the metadata notification', () => {
  it('N-S10 opens the form of a row whose file is still sent, and leaves the state of the row alone', async () => {
    const { settle, add, calls, read } = lib()
    const row = add(QUEUE, queueRow({ status: UploadQueueItemStatus.Uploading }))

    // The asset has no main file yet.
    await settle.applyAssetRead(damAsset('asset-1', null), TARGET, METADATA_EVENT, read())

    expect(row).toMatchObject({ status: UploadQueueItemStatus.Uploading, fileId: 'file-1', ...loadedMetadata })
    expect(calls.metadataLoaded).toEqual([row.key])
    expect(calls.final).toEqual([])
  })

  it('N-S10 gives nothing to a failed row, nor to a duplicate', async () => {
    const { settle, add, read } = dam()
    const failed = add(QUEUE, queueRow({ status: UploadQueueItemStatus.Failed }))
    const duplicate = add(QUEUE, queueRow({ status: UploadQueueItemStatus.Uploaded, isDuplicate: true }))
    const slot = add(QUEUE, queueRow({ type: UploadQueueItemType.SlotFile, slotName: 'extra' }))

    await settle.applyAssetRead(storedAsset(), TARGET, METADATA_EVENT, read())

    for (const row of [failed, duplicate, slot]) expect(row, row.key).toMatchObject(noMetadata)
  })

  it('N-S10 gives a failed row its metadata when the gate of the profile says so, never a duplicate', async () => {
    const { settle, add, gateOpen, calls, read } = dam()
    const failed = add(QUEUE, queueRow({ type: UploadQueueItemType.Asset, status: UploadQueueItemStatus.Failed }))
    const duplicate = add(QUEUE, queueRow({ status: UploadQueueItemStatus.Uploaded, isDuplicate: true }))
    gateOpen.add(failed.key)
    gateOpen.add(duplicate.key)

    await settle.applyAssetRead(storedAsset(), TARGET, METADATA_EVENT, read())

    expect(failed).toMatchObject({ status: UploadQueueItemStatus.Failed, ...loadedMetadata })
    expect(duplicate).toMatchObject(noMetadata)
    expect(calls.metadataLoaded).toEqual([failed.key])
  })

  it('N-S10 a read after it that shows the file processed settles the row as well', async () => {
    const { settle, add, read } = lib()
    const row = add(QUEUE, queueRow())

    await settle.applyAssetRead(processedAsset(), TARGET, METADATA_EVENT, read())

    expect(row).toMatchObject({ status: UploadQueueItemStatus.Uploaded, ...loadedMetadata })
  })
})

describe('a row whose state a processed file never changes (mass edit)', () => {
  const massEditRow = (overrides: Partial<UploadQueueItem> = {}) =>
    queueRow({
      type: UploadQueueItemType.Asset,
      status: UploadQueueItemStatus.Uploaded,
      canEditMetadata: true,
      keywords: ['edited'],
      mainFileSingleUse: false,
      ...overrides,
    })

  it('N-S11 is only completed by a processed file, and told about it: its state stays whatever it is', async () => {
    const { settle, add, calls, read } = dam()
    // One its batch load left failed, one uploaded: neither state is the file's to change.
    const withFile = add('edit', massEditRow({ status: UploadQueueItemStatus.Failed, canEditMetadata: false }))
    const withoutFile = add('edit', massEditRow({ fileId: null }))
    const untouched = [withFile, withoutFile].map(settledState)

    // A file not processed yet, and no event that says otherwise: nothing to complete the rows with.
    await settle.applyAssetRead(storedAsset(), FILE_TARGET, WITH_METADATA, read())

    expect([withFile, withoutFile].map(settledState)).toEqual(untouched)
    expect(calls.processedSeen).toEqual([])

    await settle.applyAssetRead(processedAsset(), FILE_TARGET, WITH_METADATA, read())

    for (const row of [withFile, withoutFile]) {
      expect(row, row.key).toMatchObject({
        assetStatus: DamAssetStatus.WithFile,
        imagePreview: previewOf('file-1'),
        // The form of a mass edit is the user's: neither its fields nor its switch are the server's to set.
        keywords: ['edited'],
        mainFileSingleUse: false,
      })
    }
    expect(withFile).toMatchObject({ status: UploadQueueItemStatus.Failed, canEditMetadata: false })
    expect(withoutFile).toMatchObject({ status: UploadQueueItemStatus.Uploaded, canEditMetadata: true, fileId: null })
    expect(calls.processedSeen).toEqual([withFile.key, withoutFile.key])
    expect(calls.final).toEqual([])
    expect(calls.metadataLoaded).toEqual([])
  })

  it('N-S11 is told at its processed event, and completed by the read after it whatever that read says of the file', async () => {
    const { settle, add, calls, read } = dam()
    const withFile = add('edit', massEditRow({ status: UploadQueueItemStatus.Failed, canEditMetadata: false }))
    const withoutFile = add('edit', massEditRow({ fileId: null }))

    settle.announceProcessed(FILE_TARGET)
    expect(calls.processedSeen).toEqual([withFile.key, withoutFile.key])
    expect([withFile.assetStatus, withoutFile.assetStatus]).toEqual([DamAssetStatus.Draft, DamAssetStatus.Draft])

    // The event carries the state: the asset it is read with need not say it.
    await settle.applyAssetRead(damAsset('asset-1', damFile('file-1')), FILE_TARGET, EVENT_ONLY, read())

    for (const row of [withFile, withoutFile]) {
      expect(row, row.key).toMatchObject({
        assetStatus: DamAssetStatus.WithFile,
        imagePreview: previewOf('file-1'),
        keywords: ['edited'],
        mainFileSingleUse: false,
      })
    }
    expect([withFile.status, withoutFile.status]).toEqual([
      UploadQueueItemStatus.Failed,
      UploadQueueItemStatus.Uploaded,
    ])
    expect(calls.processedSeen).toEqual([withFile.key, withoutFile.key, withFile.key, withoutFile.key])
    expect(calls.final).toEqual([])
  })

  it('N-S11 is not told by a read the metadata notification asked for', async () => {
    const { settle, add, calls, read } = dam()
    add('edit', massEditRow())

    await settle.applyAssetRead(processedAsset(), TARGET, METADATA_EVENT, read())

    expect(calls.processedSeen).toEqual([])
  })

  it('N-S11 a failed file fails the row that has that file, not the one without a file', async () => {
    const { settle, add } = dam()
    const withFile = add('edit', massEditRow())
    const withoutFile = add('edit', massEditRow({ fileId: null }))

    settle.settleKnownFailed(FILE_TARGET, AssetFileFailReason.InvalidMimeType)

    expect(withFile).toMatchObject({
      status: UploadQueueItemStatus.Failed,
      canEditMetadata: false,
      error: { hasError: true, assetFileFailReason: AssetFileFailReason.InvalidMimeType },
    })
    expect(withoutFile).toMatchObject({ status: UploadQueueItemStatus.Uploaded, canEditMetadata: true, error: noError })
  })

  it('N-S11 a duplicate file marks the row that has that file, not the one without a file', async () => {
    const { settle, add } = dam()
    const withFile = add('edit', massEditRow())
    const withoutFile = add('edit', massEditRow({ fileId: null }))

    await settle.settleKnownDuplicate(FILE_TARGET, null, null)

    expect(withFile).toMatchObject({
      status: UploadQueueItemStatus.Uploaded,
      isDuplicate: true,
      canEditMetadata: false,
    })
    expect(withoutFile).toMatchObject({ isDuplicate: false, canEditMetadata: true })
  })
})

describe('a read asked for about a file that is not the main file of its asset', () => {
  const OTHER_FILE = { assetId: 'asset-1', fileId: 'file-b' }
  const slotRow = (overrides: Partial<UploadQueueItem> = {}) =>
    queueRow({ type: UploadQueueItemType.SlotFile, slotName: 'extra', fileId: 'file-b', ...overrides })
  const mainFiles: Array<[string, ReturnType<typeof damFile>]> = [
    ['failed', damFile('file-a', AssetFileProcessStatus.Failed, { failReason: AssetFileFailReason.InvalidMimeType })],
    ['a duplicate', damFile('file-a', AssetFileProcessStatus.Duplicate, { originAssetFile: 'file-original' })],
  ]

  it.each(mainFiles)(
    'the main file is %s: the row of the other file, which its event has settled, stays uploaded with its own file',
    async (_what, mainFile) => {
      const { settle, add, server, read } = dam()
      server.originFiles.set('file-original', damFile('file-original', AssetFileProcessStatus.Processed))
      const row = add(QUEUE, slotRow())
      settle.settleProcessedByEvent(OTHER_FILE)

      // The asset says how its main file fared. Of the file the read was asked for it says nothing.
      await settle.applyAssetRead(damAsset('asset-1', mainFile), OTHER_FILE, EVENT_ONLY, read())

      expect(row).toMatchObject({
        status: UploadQueueItemStatus.Uploaded,
        isDuplicate: false,
        fileId: 'file-b',
        duplicateAssetId: null,
        assetStatus: DamAssetStatus.WithFile,
        error: noError,
      })
      expect(row.imagePreview).toBeUndefined()
      expect(server.requests).toEqual([])
    }
  )

  it.each(mainFiles)(
    'the main file is %s: with no state from an event, the read leaves the row of the other file as it is',
    async (_what, mainFile) => {
      const { settle, add, server, calls, read } = dam()
      const row = add(QUEUE, slotRow())
      const before = settledState(row)

      // The refresh of a row whose file is not the main one.
      await settle.applyAssetRead(damAsset('asset-1', mainFile), OTHER_FILE, WITH_METADATA, read())

      expect(settledState(row)).toEqual(before)
      expect(calls.final).toEqual([])
      expect(server.requests).toEqual([])
    }
  )

  it('the state of the main file is still written into the row of the main file', async () => {
    const { settle, add, read } = dam()
    const main = add(QUEUE, slotRow({ slotName: 'default', fileId: 'file-a' }))
    const other = add(QUEUE, slotRow())

    await settle.applyAssetRead(
      damAsset('asset-1', mainFiles[0][1]),
      { assetId: 'asset-1', fileId: 'file-a' },
      WITH_METADATA,
      read()
    )

    expect(main).toMatchObject({
      status: UploadQueueItemStatus.Failed,
      error: { hasError: true, assetFileFailReason: AssetFileFailReason.InvalidMimeType },
    })
    expect(other.status).toBe(UploadQueueItemStatus.Processing)
  })
})

describe('a duplicate in the library, while its original is being read', () => {
  const original = () =>
    damAsset(
      'asset-original',
      damFile('file-original', AssetFileProcessStatus.Processed, { asset: 'asset-original' }),
      {
        mainFileSingleUse: false,
      }
    )
  const duplicate = () =>
    damAsset('asset-1', damFile('file-1', AssetFileProcessStatus.Duplicate, { originAssetFile: 'file-original' }))
  const ORIGINAL = { assetId: 'asset-original', fileId: null }

  it('a failed notification that comes meanwhile stands: the answer does not turn the row into the original', async () => {
    const { settle, add, server, queues, calls } = lib()
    server.originAssets.set('file-original', original())
    const failedMeanwhile = add(QUEUE, queueRow())
    const stoppedMeanwhile = add(QUEUE, queueRow())
    const removedMeanwhile = add('another', queueRow())
    server.hold()

    const settled = settle.settleKnownDuplicate(TARGET, 'file-original', DamAssetType.Image)
    stoppedMeanwhile.status = UploadQueueItemStatus.Stop
    queues.get('another')!.items.splice(0, 1)
    settle.settleKnownFailed(TARGET, AssetFileFailReason.InvalidChecksum)
    server.release()
    await settled

    expect(failedMeanwhile).toMatchObject({
      status: UploadQueueItemStatus.Failed,
      isDuplicate: false,
      assetId: 'asset-1',
      fileId: 'file-1',
      canEditMetadata: false,
      error: { hasError: true, assetFileFailReason: AssetFileFailReason.InvalidChecksum },
    })
    expect(stoppedMeanwhile).toMatchObject({
      status: UploadQueueItemStatus.Stop,
      isDuplicate: false,
      assetId: 'asset-1',
    })
    expect(removedMeanwhile).toMatchObject({
      status: UploadQueueItemStatus.Processing,
      isDuplicate: false,
      assetId: 'asset-1',
    })
    // The failure alone made a row final.
    expect(calls.final).toEqual([failedMeanwhile.key])
  })

  it('an original that cannot be read does not fail a row an event has written into meanwhile', async () => {
    const { settle, add, server, calls } = lib()
    const waiting = add(QUEUE, queueRow())
    const writtenMeanwhile = add(QUEUE, queueRow())
    server.fail('originAsset')
    server.hold()

    const settled = settle.settleKnownDuplicate(TARGET, 'file-original', DamAssetType.Image)
    // What every write of an event leaves on the row it wrote into.
    settle.bump(writtenMeanwhile)
    server.release()
    await settled

    expect(waiting.status).toBe(UploadQueueItemStatus.Failed)
    expect(writtenMeanwhile).toMatchObject({ status: UploadQueueItemStatus.Processing, error: noError })
    expect(calls.final).toEqual([waiting.key])
  })

  it('T1 a read that shows the file a duplicate asks for the original once for all its rows, whether it answers or not', async () => {
    const answered = lib()
    answered.server.originAssets.set('file-original', original())
    const rows = [answered.add(QUEUE, queueRow()), answered.add(QUEUE, queueRow()), answered.add('another', queueRow())]

    await answered.settle.applyAssetRead(duplicate(), TARGET, WITH_METADATA, answered.read())

    expect(rows.map((row) => row.assetId)).toEqual(['asset-original', 'asset-original', 'asset-original'])
    expect(answered.server.asked('originAsset')).toHaveLength(1)

    // Not answered: the rows stay rows of the duplicate, and each would ask for itself.
    const unanswered = lib()
    unanswered.add(QUEUE, queueRow())
    unanswered.add(QUEUE, queueRow({ status: UploadQueueItemStatus.Uploaded }))
    unanswered.add('another', queueRow({ status: UploadQueueItemStatus.Failed }))

    await unanswered.settle.applyAssetRead(duplicate(), TARGET, WITH_METADATA, unanswered.read())

    expect(unanswered.server.asked('originAsset')).toHaveLength(1)
  })

  it('a row that became its original, then failed, gets its form back with what the user typed once its file is processed after all', async () => {
    const { settle, add, server, read } = lib()
    server.originAssets.set('file-original', original())
    const row = add(QUEUE, queueRow())
    await settle.settleKnownDuplicate(TARGET, 'file-original', DamAssetType.Image)
    expect(row).toMatchObject({ isDuplicate: true, assetId: 'asset-original', canEditMetadata: true })
    row.keywords = ['typed-keyword']
    row.customData.title = 'typed'
    row.mainFileSingleUse = true

    settle.settleKnownFailed(ORIGINAL, AssetFileFailReason.Unknown)
    expect(row).toMatchObject({ status: UploadQueueItemStatus.Failed, isDuplicate: true, canEditMetadata: false })
    await settle.applyAssetRead(original(), ORIGINAL, EVENT_ONLY, read())

    // It is an editable row like any other: only a row marked as a duplicate has no form to get back.
    expect(row).toMatchObject({
      status: UploadQueueItemStatus.Uploaded,
      isDuplicate: true,
      canEditMetadata: true,
      keywords: ['typed-keyword'],
      customData: { title: 'typed', description: 'described' },
      mainFileSingleUse: true,
      error: noError,
    })
  })
})

describe('a stopped row, in the DAM application', () => {
  it('T2 is passed by the event of a processed file, and is not told of it as a mass edit', () => {
    const { settle, add, calls } = dam()
    const upload = add(QUEUE, queueRow({ status: UploadQueueItemStatus.Stop }))
    const edit = add('edit', queueRow({ type: UploadQueueItemType.Asset, status: UploadQueueItemStatus.Stop }))

    settle.settleProcessedByEvent(FILE_TARGET)
    settle.announceProcessed(FILE_TARGET)

    expect([upload.status, edit.status]).toEqual([UploadQueueItemStatus.Stop, UploadQueueItemStatus.Stop])
    expect(calls.final).toEqual([])
    expect(calls.processedSeen).toEqual([])
  })
})
