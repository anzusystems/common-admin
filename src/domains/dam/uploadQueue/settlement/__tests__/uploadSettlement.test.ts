import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { DamAssetStatus } from '@/domains/dam/types/Asset'
import { AssetFileFailReason, AssetFileProcessStatus } from '@/domains/dam/types/AssetFile'
import { type UploadQueueItem, UploadQueueItemStatus, UploadQueueItemType } from '@/domains/dam/types/UploadQueue'
import { immediateScheduler } from '@/domains/dam/uploadQueue/settlement/__tests__/support/immediateScheduler'
import {
  type ManualScheduler,
  manualScheduler,
} from '@/domains/dam/uploadQueue/settlement/__tests__/support/manualScheduler'
import {
  damAsset,
  damFile,
  damProfile,
  emptyQueue,
  fakeDamServer,
  type FakeDamServer,
  fakeVisibility,
  libProfile,
  loadedMetadata,
  noMetadata,
  previewOf,
  queueRow,
  settledState,
  TEXT,
} from '@/domains/dam/uploadQueue/settlement/__tests__/support/settlementFixtures'
import { createUploadSettlement } from '@/domains/dam/uploadQueue/settlement/uploadSettlement'
import { uploadSettlementRuntime } from '@/domains/dam/uploadQueue/settlement/uploadSettlementRuntime'
import type { UploadSettlement } from '@/domains/dam/uploadQueue/settlement/uploadSettlementTypes'

const S = 1000
const MIN = 60 * S
const QUEUE = 'queue'
const noError = { hasError: false, message: '', assetFileFailReason: AssetFileFailReason.None }

const realRuntime = { ...uploadSettlementRuntime }
let clock: ManualScheduler
let visibility: ReturnType<typeof fakeVisibility>
let server: FakeDamServer
let settlement: UploadSettlement

beforeEach(() => {
  clock = manualScheduler()
  visibility = fakeVisibility()
  uploadSettlementRuntime.scheduler = clock
  uploadSettlementRuntime.visibility = visibility
  server = fakeDamServer()
})

afterEach(() => {
  settlement?.dispose()
  uploadSettlementRuntime.scheduler = realRuntime.scheduler
  uploadSettlementRuntime.visibility = realRuntime.visibility
})

const lib = () => {
  const made = libProfile(server)
  settlement = createUploadSettlement(made.profile)
  return made
}
const dam = () => {
  const made = damProfile(server)
  settlement = createUploadSettlement(made.profile)
  return made
}
const processedEvent = { kind: 'processed', assetId: 'asset-1', fileId: 'file-1' } as const
const metadataEvent = { kind: 'metadata', assetId: 'asset-1', fileId: null } as const
const uploaded = { status: UploadQueueItemStatus.Uploaded, fileId: 'file-1', assetStatus: DamAssetStatus.WithFile }

describe('a row that waits for the server, in the library', () => {
  it('N-Z1 is settled by a tick with no notification at all, with its metadata', async () => {
    const { add, calls } = lib()
    server.fileBecomes('asset-1', AssetFileProcessStatus.Stored)
    const row = add(QUEUE, queueRow())
    settlement.track(QUEUE, row)
    expect(settlement.hasTracked()).toBe(true)

    await clock.advance(5 * S)
    expect(server.requests).toEqual([{ kind: 'asset', ids: ['asset-1'] }])
    expect(row).toMatchObject({ status: UploadQueueItemStatus.Processing, ...noMetadata })

    server.fileBecomes('asset-1', AssetFileProcessStatus.Processed)
    await clock.advance(5 * S)

    expect(row).toMatchObject({ ...uploaded, imagePreview: previewOf('file-1'), error: noError, ...loadedMetadata })
    expect(calls.final).toEqual([row.key])
    expect(calls.authorsFetched).toBeGreaterThan(0)
    expect(calls.keywordsFetched).toBeGreaterThan(0)
    expect(settlement.hasTracked()).toBe(false)
    expect(clock.waiting()).toBe(0)
    await clock.advance(10 * MIN)
    expect(server.requests).toHaveLength(2)
  })

  it('N-Z2 is settled by its notification, and no tick asks about it after', async () => {
    const { add } = lib()
    server.fileBecomes('asset-1', AssetFileProcessStatus.Processed)
    const row = add(QUEUE, queueRow())
    settlement.track(QUEUE, row)

    const settled = settlement.notify(processedEvent)
    expect(row.status).toBe(UploadQueueItemStatus.Processing)
    await clock.advance(250)
    await settled

    expect(row).toMatchObject(uploaded)
    expect(server.requests).toEqual([{ kind: 'asset', ids: ['asset-1'] }])
    expect(settlement.hasTracked()).toBe(false)
    expect(clock.waiting()).toBe(0)
    await clock.advance(10 * MIN)
    expect(server.requests).toHaveLength(1)
  })

  it('N-Z3 ends the same whether the tick or the notifications come first', async () => {
    const tickFirst = async () => {
      const { add } = lib()
      const row = add(QUEUE, queueRow())
      settlement.track(QUEUE, row)
      await clock.advance(5 * S)
      void settlement.notify(metadataEvent)
      void settlement.notify(processedEvent)
      await clock.advance(2 * S)
      return row
    }
    const notificationsFirst = async (first: 'metadata' | 'processed') => {
      const { add } = lib()
      const row = add(QUEUE, queueRow())
      settlement.track(QUEUE, row)
      await clock.advance(1 * S)
      void settlement.notify(first === 'metadata' ? metadataEvent : processedEvent)
      void settlement.notify(first === 'metadata' ? processedEvent : metadataEvent)
      await clock.advance(10 * S)
      return row
    }
    server.fileBecomes('asset-1', AssetFileProcessStatus.Processed)

    const byTick = settledState(await tickFirst())
    settlement.dispose()
    const byMetadataFirst = settledState(await notificationsFirst('metadata'))
    settlement.dispose()
    const byProcessedFirst = settledState(await notificationsFirst('processed'))

    expect(byTick).toMatchObject({ ...uploaded, ...loadedMetadata, error: noError })
    expect(byMetadataFirst).toEqual(byTick)
    expect(byProcessedFirst).toEqual(byTick)
  })

  it('N-Z4 a tick sent before the failed notification and answered after it does not bring the row back', async () => {
    const { add } = lib()
    server.fileBecomes('asset-1', AssetFileProcessStatus.Processed)
    const row = add(QUEUE, queueRow())
    settlement.track(QUEUE, row)
    server.hold()
    await clock.advance(5 * S)
    expect(server.requests).toHaveLength(1)

    void settlement.notify({
      kind: 'failed',
      assetId: 'asset-1',
      fileId: 'file-1',
      failReason: AssetFileFailReason.InvalidChecksum,
    })
    expect(row.status).toBe(UploadQueueItemStatus.Failed)
    server.release()
    await clock.advance(10 * MIN)

    expect(row).toMatchObject({
      status: UploadQueueItemStatus.Failed,
      canEditMetadata: false,
      error: { hasError: true, message: '', assetFileFailReason: AssetFileFailReason.InvalidChecksum },
    })
    expect(server.requests).toHaveLength(1)
  })

  it('N-Z5 a row taken out of the queue while its read is on the way is not written', async () => {
    const { add, queues, calls } = lib()
    server.fileBecomes('asset-1', AssetFileProcessStatus.Processed)
    const row = add(QUEUE, queueRow())
    const stays = add(QUEUE, queueRow({ assetId: 'asset-2', fileId: 'file-2' }))
    server.fileBecomes('asset-2', AssetFileProcessStatus.Processed)
    settlement.track(QUEUE, row)
    settlement.track(QUEUE, stays)
    const before = settledState(row)
    server.hold()
    await clock.advance(5 * S)

    settlement.untrack(row)
    queues.get(QUEUE)!.items.splice(0, 1)
    server.release()
    await clock.advance(10 * MIN)

    expect(settledState(row)).toEqual(before)
    expect(stays.status).toBe(UploadQueueItemStatus.Uploaded)
    expect(calls.final).toEqual([stays.key])
    expect(server.requests).toHaveLength(1)
  })

  it('N-Z5 nor is a row of a queue that was cleared while its read was on the way', async () => {
    const { add, queues, calls } = lib()
    server.fileBecomes('asset-1', AssetFileProcessStatus.Processed)
    const row = add(QUEUE, queueRow())
    settlement.track(QUEUE, row)
    const before = settledState(row)
    server.hold()
    await clock.advance(5 * S)

    settlement.dropQueue(QUEUE)
    queues.set(QUEUE, emptyQueue())
    server.release()
    await clock.advance(10 * MIN)

    expect(settledState(row)).toEqual(before)
    expect(calls.final).toEqual([])
    expect(server.requests).toHaveLength(1)
    expect(clock.waiting()).toBe(0)
    expect(settlement.hasTracked()).toBe(false)
  })

  it('N-Z6 a row whose finish request failed is asked about for as long as it stays, and settles when the server is done', async () => {
    const { add } = lib()
    server.fileBecomes('asset-1', AssetFileProcessStatus.Stored)
    const clientError = {
      hasError: true,
      message: 'the finish request failed',
      assetFileFailReason: AssetFileFailReason.None,
    }
    const row = add(QUEUE, queueRow({ status: UploadQueueItemStatus.Failed, error: { ...clientError } }))
    settlement.track(QUEUE, row, { clientFailed: true })

    await clock.advance(61 * MIN)
    const afterAnHour = server.requests.length
    await clock.advance(10 * MIN)

    expect(server.requests.length).toBeGreaterThan(afterAnHour)
    expect(row).toMatchObject({ status: UploadQueueItemStatus.Failed, error: clientError, canEditMetadata: false })

    server.fileBecomes('asset-1', AssetFileProcessStatus.Processed)
    await clock.advance(10 * MIN)

    expect(row).toMatchObject({ ...uploaded, error: noError, ...loadedMetadata })
    expect(settlement.hasTracked()).toBe(false)
  })

  it('N-Z7 fails with the text of an unknown error once its asset was missing from three reads', async () => {
    const { add, calls } = lib()
    const row = add(QUEUE, queueRow({ canEditMetadata: true }))
    settlement.track(QUEUE, row)

    await clock.advance(10 * S)
    expect(row.status).toBe(UploadQueueItemStatus.Processing)
    await clock.advance(6 * S)

    expect(server.requests).toHaveLength(3)
    expect(row).toMatchObject({
      status: UploadQueueItemStatus.Failed,
      canEditMetadata: false,
      error: { hasError: true, message: TEXT.missing },
    })
    expect(calls.final).toEqual([row.key])
    expect(settlement.hasTracked()).toBe(false)
    await clock.advance(10 * MIN)
    expect(server.requests).toHaveLength(3)
  })

  // The read that is one too many may be the one the user asked for.
  // The row is given up anyway, and the refresh does not answer with the outcome that says to ask again.
  it('N-Z7 a refresh that is the third read to miss the asset gives the row up, and answers that it is settled', async () => {
    const { add, calls } = lib()
    const row = add(QUEUE, queueRow())
    settlement.track(QUEUE, row)

    await clock.advance(10 * S)
    expect([server.requests.length, row.status]).toEqual([2, UploadQueueItemStatus.Processing])

    expect(await settlement.refreshAsset({ assetId: 'asset-1', fileId: null })).toBe('settled')

    expect(row).toMatchObject({
      status: UploadQueueItemStatus.Failed,
      error: { hasError: true, message: TEXT.missing },
    })
    expect(calls.final).toEqual([row.key])
    expect(settlement.hasTracked()).toBe(false)
  })

  it('N-Z7 a refresh that misses the asset before that leaves the row waiting, and answers that it is missing', async () => {
    const { add } = lib()
    const row = add(QUEUE, queueRow())
    settlement.track(QUEUE, row)

    await clock.advance(5 * S)

    expect(await settlement.refreshAsset({ assetId: 'asset-1', fileId: null })).toBe('missing')
    expect(row.status).toBe(UploadQueueItemStatus.Processing)
    expect(settlement.hasTracked()).toBe(true)
  })

  // Two queues may wait for one asset, each from its own moment.
  // While one of the rows is still asked about, the refresh says to ask again.
  it('N-Z7 a refresh that gives one row up while another of the asset still waits answers that it is missing', async () => {
    const { add } = lib()
    const first = add(QUEUE, queueRow())
    settlement.track(QUEUE, first)
    await clock.advance(10 * S)
    const second = add('another', queueRow())
    settlement.track('another', second)

    expect(await settlement.refreshAsset({ assetId: 'asset-1', fileId: null })).toBe('missing')

    expect([first.status, second.status]).toEqual([UploadQueueItemStatus.Failed, UploadQueueItemStatus.Processing])
  })

  it('N-Z7 counts from nothing again once the asset was there', async () => {
    const { add } = lib()
    const row = add(QUEUE, queueRow())
    settlement.track(QUEUE, row)

    await clock.advance(10 * S)
    server.fileBecomes('asset-1', AssetFileProcessStatus.Stored)
    await clock.advance(6 * S)
    server.assets.delete('asset-1')
    await clock.advance(15 * S)
    expect(server.requests).toHaveLength(5)
    expect(row.status).toBe(UploadQueueItemStatus.Processing)

    await clock.advance(9 * S)
    expect(server.requests).toHaveLength(6)
    expect(row.status).toBe(UploadQueueItemStatus.Failed)
  })

  it('N-Z7 a bulk answer that is no list is a failed read, not missing assets', async () => {
    const { add } = lib()
    const garbled = [1, 2].map((at) => add(QUEUE, queueRow({ licenceId: 1, assetId: `asset-1-${at}` })))
    const answered = [1, 2].map((at) => add(QUEUE, queueRow({ licenceId: 2, assetId: `asset-2-${at}` })))
    ;[...garbled, ...answered].forEach((row) => settlement.track(QUEUE, row))
    answered.forEach((row) => {
      server.assets.set(
        row.assetId!,
        damAsset(row.assetId!, damFile('file-1', AssetFileProcessStatus.Stored), { licence: 2 })
      )
    })
    server.garbleList(1)

    await clock.advance(16 * S)

    expect(garbled.map((row) => [row.status, row.error.message])).toEqual([
      [UploadQueueItemStatus.Processing, TEXT.readFailed],
      [UploadQueueItemStatus.Processing, TEXT.readFailed],
    ])
    expect(answered.map((row) => [row.status, row.error.message])).toEqual([
      [UploadQueueItemStatus.Processing, ''],
      [UploadQueueItemStatus.Processing, ''],
    ])
    await clock.advance(10 * MIN)
    expect(garbled.map((row) => row.status)).toEqual([
      UploadQueueItemStatus.Processing,
      UploadQueueItemStatus.Processing,
    ])
  })

  it('N-Z7 when every read of a tick fails, the queue waits as after a failed read', async () => {
    const { add } = lib()
    const rows = [add(QUEUE, queueRow()), add(QUEUE, queueRow({ assetId: 'asset-2', fileId: 'file-2' }))]
    rows.forEach((row) => settlement.track(QUEUE, row))
    server.garbleList(1)

    await clock.advance(50 * S)

    expect(server.asked('assets')).toHaveLength(3)
    expect(rows.map((row) => row.status)).toEqual([UploadQueueItemStatus.Processing, UploadQueueItemStatus.Processing])
  })

  it('N-Z8 the read after a metadata notification comes 2 s later', async () => {
    const { add } = lib()
    server.fileBecomes('asset-1', AssetFileProcessStatus.Stored)
    const row = add(QUEUE, queueRow({ status: UploadQueueItemStatus.Uploading }))

    const settled = settlement.notify(metadataEvent)
    await clock.advance(2 * S - 1)
    expect(server.requests).toEqual([])
    await clock.advance(1)
    await settled

    expect(server.requests).toEqual([{ kind: 'asset', ids: ['asset-1'] }])
    expect(row).toMatchObject({ status: UploadQueueItemStatus.Uploading, ...loadedMetadata })
  })

  it('N-Z8 a processed notification meanwhile brings that read to 250 ms, and the metadata is loaded with it', async () => {
    const { add } = lib()
    server.fileBecomes('asset-1', AssetFileProcessStatus.Processed)
    const row = add(QUEUE, queueRow())

    void settlement.notify(metadataEvent)
    await clock.advance(500)
    void settlement.notify(processedEvent)
    await clock.advance(249)
    expect(server.requests).toEqual([])
    await clock.advance(1)

    expect(server.requests).toEqual([{ kind: 'asset', ids: ['asset-1'] }])
    expect(row).toMatchObject({ ...uploaded, ...loadedMetadata })
    await clock.advance(10 * S)
    expect(server.requests).toHaveLength(1)
  })

  it('N-Z9 a processed notification with no metadata notification leaves the row uploaded without its form', async () => {
    const { add, calls } = lib()
    server.fileBecomes('asset-1', AssetFileProcessStatus.Processed)
    const row = add(QUEUE, queueRow())
    settlement.track(QUEUE, row)

    void settlement.notify(processedEvent)
    await clock.advance(10 * MIN)

    expect(row).toMatchObject({ ...uploaded, mainFileSingleUse: true, mainFileInternal: true, ...noMetadata })
    expect(calls.metadataLoaded).toEqual([])
    expect(server.requests).toHaveLength(1)
  })

  it('N-Z10 warns after three failed reads on a row without its form, not on one that has it', async () => {
    const { add } = lib()
    const withoutForm = add(QUEUE, queueRow())
    const withForm = add(QUEUE, queueRow({ assetId: 'asset-2', fileId: 'file-2', canEditMetadata: true }))
    settlement.track(QUEUE, withoutForm)
    settlement.track(QUEUE, withForm)
    server.fail('assets')

    await clock.advance(49 * S)
    expect(server.requests).toHaveLength(2)
    expect(withoutForm.error).toEqual(noError)
    await clock.advance(1 * S)

    expect(server.requests).toHaveLength(3)
    expect(withoutForm).toMatchObject({
      status: UploadQueueItemStatus.Processing,
      error: { hasError: true, message: TEXT.readFailed },
    })
    expect(withForm.error).toEqual(noError)
  })

  it('N-Z10 a read that succeeds takes the warning away, and brings back the text of a long processing', async () => {
    const { add } = lib()
    server.fileBecomes('asset-1', AssetFileProcessStatus.Stored)
    const row = add(QUEUE, queueRow())
    settlement.track(QUEUE, row)

    await clock.advance(21 * MIN)
    expect(row.error).toMatchObject({ hasError: true, message: TEXT.tooLong })

    server.fail('asset')
    await clock.advance(3 * MIN)
    expect(row.error).toMatchObject({ hasError: true, message: TEXT.readFailed })

    server.recover()
    await clock.advance(5 * MIN)
    expect(row).toMatchObject({
      status: UploadQueueItemStatus.Processing,
      error: { hasError: true, message: TEXT.tooLong },
    })
  })

  it('N-Z10 a read that succeeds leaves no text on a row that had only the warning', async () => {
    const { add } = lib()
    server.fileBecomes('asset-1', AssetFileProcessStatus.Stored)
    const row = add(QUEUE, queueRow())
    settlement.track(QUEUE, row)
    server.fail('asset')

    await clock.advance(50 * S)
    expect(row.error.message).toBe(TEXT.readFailed)

    server.recover()
    await clock.advance(60 * S)

    expect(row).toMatchObject({ status: UploadQueueItemStatus.Processing, error: noError })
  })

  it('N-Z11 says its processing takes too long after 20 min, is read on, and loses the text when it settles', async () => {
    const { add } = lib()
    server.fileBecomes('asset-1', AssetFileProcessStatus.Stored)
    const row = add(QUEUE, queueRow())
    settlement.track(QUEUE, row)

    await clock.advance(20 * MIN - 1)
    expect(row.error).toEqual(noError)
    await clock.advance(1)
    expect(row).toMatchObject({
      status: UploadQueueItemStatus.Processing,
      error: { hasError: true, message: TEXT.tooLong },
    })

    const when20Min = server.requests.length
    await clock.advance(30 * MIN)
    expect(server.requests.length).toBeGreaterThan(when20Min)
    expect(row).toMatchObject({
      status: UploadQueueItemStatus.Processing,
      error: { hasError: true, message: TEXT.tooLong },
    })

    server.fileBecomes('asset-1', AssetFileProcessStatus.Processed)
    await clock.advance(2 * MIN)
    expect(row).toMatchObject({ ...uploaded, error: noError, canEditMetadata: true })
  })

  it.each(['processed', 'copied', 'metadata', 'failed', 'duplicate'] as const)(
    'N-Z12 a %s notification about an asset no queue has asks for nothing and changes nothing',
    async (kind) => {
      const { add } = lib()
      server.fileBecomes('asset-9', AssetFileProcessStatus.Processed)
      const row = add(QUEUE, queueRow())
      const before = settledState(row)

      await settlement.notify({
        kind,
        assetId: 'asset-9',
        fileId: 'file-9',
        failReason: AssetFileFailReason.Unknown,
        originAssetFile: 'file-original',
        assetType: 'image',
      })
      expect(clock.waiting()).toBe(0)
      await clock.advance(10 * MIN)

      expect(server.requests).toEqual([])
      expect(settledState(row)).toEqual(before)
    }
  )

  it('N-Z12 a notification whose rows have left their queue before its read is due asks for nothing', async () => {
    const { add, queues } = lib()
    server.fileBecomes('asset-1', AssetFileProcessStatus.Processed)
    add(QUEUE, queueRow())

    const settled = settlement.notify(metadataEvent)
    queues.get(QUEUE)!.items.splice(0, 1)
    await clock.advance(2 * S)
    await settled

    expect(server.requests).toEqual([])
    expect(clock.waiting()).toBe(0)
  })

  it('N-Z13 a tick asks by licence and by fifty, and for a single asset by itself', async () => {
    const { add } = lib()
    const ids = (licence: number, count: number) => Array.from({ length: count }, (_, at) => `asset-${licence}-${at}`)
    const track = (licenceId: number, assetId: string) =>
      settlement.track(QUEUE, add(QUEUE, queueRow({ licenceId, assetId, fileId: assetId.replace('asset', 'file') })))
    ids(1, 51).forEach((assetId) => track(1, assetId))
    ids(2, 2).forEach((assetId) => track(2, assetId))
    track(3, 'asset-3-0')
    track(2, 'asset-2-0')

    await clock.advance(5 * S)

    expect(server.requests).toEqual([
      { kind: 'assets', licenceId: 1, ids: ids(1, 51).slice(0, 50) },
      { kind: 'assets', licenceId: 1, ids: ['asset-1-50'] },
      { kind: 'assets', licenceId: 2, ids: ids(2, 2) },
      { kind: 'asset', ids: ['asset-3-0'] },
    ])
  })

  it('N-Z13 a notification asks for the asset it names and no other', async () => {
    const { add } = lib()
    server.fileBecomes('asset-1', AssetFileProcessStatus.Processed)
    const rows = [add(QUEUE, queueRow()), add(QUEUE, queueRow({ assetId: 'asset-2', fileId: 'file-2' }))]
    rows.forEach((row) => settlement.track(QUEUE, row))

    void settlement.notify(processedEvent)
    await clock.advance(250)

    expect(server.requests).toEqual([{ kind: 'asset', ids: ['asset-1'] }])
    expect(rows.map((row) => row.status)).toEqual([UploadQueueItemStatus.Uploaded, UploadQueueItemStatus.Processing])
  })

  it('N-Z14 one group of a tick that fails does not stop the other', async () => {
    const { add } = lib()
    const failing = [1, 2].map((at) => add(QUEUE, queueRow({ licenceId: 1, assetId: `asset-1-${at}` })))
    const answered = [1, 2].map((at) => add(QUEUE, queueRow({ licenceId: 2, assetId: `asset-2-${at}` })))
    ;[...failing, ...answered].forEach((row) => settlement.track(QUEUE, row))
    answered.forEach((row) => {
      server.assets.set(
        row.assetId!,
        damAsset(row.assetId!, damFile('file-1', AssetFileProcessStatus.Processed), { licence: 2 })
      )
    })
    server.failLicence(1)

    await clock.advance(5 * S)

    expect(answered.map((row) => row.status)).toEqual([UploadQueueItemStatus.Uploaded, UploadQueueItemStatus.Uploaded])
    expect(failing.map((row) => row.status)).toEqual([
      UploadQueueItemStatus.Processing,
      UploadQueueItemStatus.Processing,
    ])

    await clock.advance(5 * S)
    expect(server.asked('assets').filter((request) => request.licenceId === 1)).toHaveLength(2)
  })

  it('N-Z15 a read a notification asks for during a tick waits for it; never two at once', async () => {
    const { add } = lib()
    server.fileBecomes('asset-1', AssetFileProcessStatus.Processed)
    const row = add(QUEUE, queueRow())
    settlement.track(QUEUE, row)
    server.hold()
    await clock.advance(5 * S)
    expect(server.requests).toHaveLength(1)

    void settlement.notify(metadataEvent)
    await clock.advance(10 * S)
    expect(server.requests).toHaveLength(1)

    server.release()
    await clock.settle()

    expect(server.requests).toHaveLength(2)
    expect(server.mostRunning()).toBe(1)
    expect(row).toMatchObject({ ...uploaded, ...loadedMetadata })
  })

  it('N-Z16 the refresh of a row during a read is sent right after it, with no wait of its own', async () => {
    const { add } = lib()
    server.fileBecomes('asset-1', AssetFileProcessStatus.Stored)
    const row = add(QUEUE, queueRow())
    settlement.track(QUEUE, row)
    server.hold()
    await clock.advance(5 * S)

    const outcome = settlement.refreshAsset({ assetId: 'asset-1', fileId: null })
    await clock.settle()
    expect(server.requests).toHaveLength(1)

    server.release()
    await clock.settle()

    expect(clock.now()).toBe(5 * S)
    expect(server.requests).toHaveLength(2)
    expect(server.mostRunning()).toBe(1)
    expect(await outcome).toBe('pending')
  })

  it('N-Z17 the refresh says whether the file is settled, still pending, missing, or could not be read', async () => {
    const { add } = lib()
    const row = add(QUEUE, queueRow())
    const refresh = () => settlement.refreshAsset({ assetId: 'asset-1', fileId: null })

    expect(await refresh()).toBe('missing')

    server.fileBecomes('asset-1', AssetFileProcessStatus.Stored)
    expect(await refresh()).toBe('pending')
    expect(row.status).toBe(UploadQueueItemStatus.Processing)

    server.fail('asset')
    expect(await refresh()).toBe('error')
    expect(row.status).toBe(UploadQueueItemStatus.Processing)
    server.recover()

    server.fileBecomes('asset-1', AssetFileProcessStatus.Processed)
    expect(await refresh()).toBe('settled')
    expect(row).toMatchObject({ ...uploaded, ...loadedMetadata })

    server.fileBecomes('asset-1', AssetFileProcessStatus.Failed, { failReason: AssetFileFailReason.InvalidSize })
    expect(await refresh()).toBe('settled')
    expect(row).toMatchObject({
      status: UploadQueueItemStatus.Failed,
      error: { hasError: true, assetFileFailReason: AssetFileFailReason.InvalidSize },
    })
    expect(clock.waiting()).toBe(0)
  })

  it('N-Z18 a read after the copied notification that fails leaves the row waiting, and a later read settles it', async () => {
    const { add } = lib()
    server.fileBecomes('asset-1', AssetFileProcessStatus.Processed)
    const row = add(QUEUE, queueRow({ type: UploadQueueItemType.Asset, fileId: null }))
    settlement.track(QUEUE, row)
    server.fail('asset')

    const settled = settlement.notify({ kind: 'copied', assetId: 'asset-1', fileId: 'file-1' })
    await clock.advance(250)
    await settled

    expect(server.requests).toHaveLength(1)
    expect(row).toMatchObject({ status: UploadQueueItemStatus.Processing, fileId: null, error: noError })
    expect(settlement.hasTracked()).toBe(true)

    server.recover()
    await clock.advance(5 * S)

    expect(row).toMatchObject({ ...uploaded, ...loadedMetadata })
  })

  it('N-Z18 with nothing else to ask, the read of the notification is tried again by itself', async () => {
    const { add } = lib()
    server.fileBecomes('asset-1', AssetFileProcessStatus.Processed)
    const row = add(QUEUE, queueRow({ type: UploadQueueItemType.Asset, fileId: null }))
    server.fail('asset')

    void settlement.notify({ kind: 'copied', assetId: 'asset-1', fileId: 'file-1' })
    await clock.advance(250)
    server.recover()
    await clock.advance(15 * S - 1)
    expect(server.requests).toHaveLength(1)
    await clock.advance(1)

    expect(server.requests).toHaveLength(2)
    expect(row).toMatchObject({ ...uploaded, ...loadedMetadata })
  })
})

describe('the read a notification asks for, when it fails', () => {
  it('is tried three times, 15 and 30 s apart, and then the row without its form warns', async () => {
    const { add } = lib()
    server.fileBecomes('asset-1', AssetFileProcessStatus.Stored)
    const row = add(QUEUE, queueRow({ status: UploadQueueItemStatus.Uploading }))
    server.fail('asset')

    void settlement.notify(metadataEvent)
    await clock.advance(2 * S + 15 * S)
    expect(server.requests).toHaveLength(2)
    expect(row.error).toEqual(noError)
    await clock.advance(30 * S)

    expect(server.requests).toHaveLength(3)
    expect(row).toMatchObject({
      status: UploadQueueItemStatus.Uploading,
      canEditMetadata: false,
      error: { hasError: true, message: TEXT.readFailed },
    })
    await clock.advance(10 * MIN)
    expect(server.requests).toHaveLength(3)

    server.recover()
    server.fileBecomes('asset-1', AssetFileProcessStatus.Processed)
    expect(await settlement.refreshAsset({ assetId: 'asset-1', fileId: null })).toBe('settled')
    expect(row).toMatchObject({ ...uploaded, error: noError, ...loadedMetadata })
  })

  it('joins the read of a notification that came meanwhile, and loses nothing of what it was to bring', async () => {
    const { add } = lib()
    server.fileBecomes('asset-1', AssetFileProcessStatus.Processed)
    const row = add(QUEUE, queueRow())
    server.fail('asset')
    server.hold()

    void settlement.notify(metadataEvent)
    await clock.advance(2 * S)
    expect(server.requests).toHaveLength(1)

    server.recover()
    void settlement.notify(processedEvent)
    server.release()
    await clock.advance(250)

    expect(server.requests).toHaveLength(2)
    expect(row).toMatchObject({ ...uploaded, ...loadedMetadata })
    await clock.advance(10 * MIN)
    expect(server.requests).toHaveLength(2)
  })
})

describe('a duplicate whose original cannot be read, in the library', () => {
  const clientError = {
    hasError: true,
    message: 'the finish request failed',
    assetFileFailReason: AssetFileFailReason.None,
  }

  it('fails the row that waits and leaves alone the one the client gave up on; neither is asked about again', async () => {
    const { add, calls } = lib()
    server.fileBecomes('asset-1', AssetFileProcessStatus.Duplicate, { originAssetFile: 'file-unknown' })
    server.fileBecomes('asset-2', AssetFileProcessStatus.Duplicate, { originAssetFile: 'file-unknown' })
    const waiting = add(QUEUE, queueRow())
    const givenUp = add(
      'another',
      queueRow({
        assetId: 'asset-2',
        fileId: 'file-2',
        status: UploadQueueItemStatus.Failed,
        error: { ...clientError },
      })
    )
    settlement.track(QUEUE, waiting)
    settlement.track('another', givenUp, { clientFailed: true })

    await clock.advance(5 * S)

    expect(waiting).toMatchObject({
      status: UploadQueueItemStatus.Failed,
      isDuplicate: false,
      error: { hasError: true },
    })
    expect(givenUp).toMatchObject({ status: UploadQueueItemStatus.Failed, isDuplicate: false, error: clientError })
    expect(calls.final).toEqual([waiting.key])
    expect(calls.refreshMayHelp).toEqual(['+' + givenUp.key, '+' + waiting.key])
    expect(settlement.hasTracked()).toBe(false)
    const asked = server.requests.length
    await clock.advance(10 * MIN)
    expect(server.requests).toHaveLength(asked)
  })
})

describe('the text of a row that fails for a duplicate whose original cannot be read', () => {
  it("goes when it is the settlement's own, and stays when the row has it from elsewhere", async () => {
    const { add } = lib()
    for (const assetId of ['asset-1', 'asset-3']) server.fileBecomes(assetId, AssetFileProcessStatus.Stored)
    server.fileBecomes('asset-2', AssetFileProcessStatus.Duplicate, { originAssetFile: 'file-unknown' })
    const storeText = { hasError: true, message: 'a text of the store', assetFileFailReason: AssetFileFailReason.None }
    const waitsLong = add(QUEUE, queueRow())
    const hasItsOwn = add(QUEUE, queueRow({ assetId: 'asset-2', fileId: 'file-2', error: { ...storeText } }))
    const writtenOver = add(QUEUE, queueRow({ assetId: 'asset-3', fileId: 'file-3' }))
    ;[waitsLong, hasItsOwn, writtenOver].forEach((row) => settlement.track(QUEUE, row))

    await clock.advance(21 * MIN)
    expect(hasItsOwn).toMatchObject({ status: UploadQueueItemStatus.Failed, error: storeText })
    expect(waitsLong.error).toMatchObject({ hasError: true, message: TEXT.tooLong })
    expect(writtenOver.error).toMatchObject({ hasError: true, message: TEXT.tooLong })

    writtenOver.error = { ...storeText }
    for (const assetId of ['asset-1', 'asset-3']) {
      server.fileBecomes(assetId, AssetFileProcessStatus.Duplicate, { originAssetFile: 'file-unknown' })
    }
    await clock.advance(2 * MIN)

    expect(waitsLong).toMatchObject({ status: UploadQueueItemStatus.Failed, error: { hasError: true, message: '' } })
    expect(writtenOver).toMatchObject({ status: UploadQueueItemStatus.Failed, error: storeText })
  })
})

describe('the rows of the DAM application', () => {
  const massEditRow = (overrides: Partial<UploadQueueItem> = {}) =>
    queueRow({
      type: UploadQueueItemType.Asset,
      status: UploadQueueItemStatus.Uploaded,
      canEditMetadata: true,
      keywords: ['edited'],
      ...overrides,
    })
  const slotRow = (slotName: string, fileId: string) =>
    queueRow({ type: UploadQueueItemType.SlotFile, slotName, fileId })

  it('N-Z19 one asset in the upload and in the mass edit: its processed file settles the first and completes the second', async () => {
    const { add, calls } = dam()
    server.fileBecomes('asset-1', AssetFileProcessStatus.Processed)
    const upload = add('global', queueRow())
    const edit = add('edit', massEditRow({ fileId: null }))
    settlement.track('global', upload)
    settlement.track('edit', edit)

    void settlement.notify(processedEvent)

    expect(upload.status).toBe(UploadQueueItemStatus.Uploaded)
    expect(calls.final).toEqual([upload.key])
    expect(calls.processedSeen).toEqual([edit.key])
    expect(server.requests).toEqual([])

    await clock.advance(250)

    expect(upload).toMatchObject({
      ...uploaded,
      imagePreview: previewOf('file-1'),
      mainFileSingleUse: true,
      ...noMetadata,
    })
    expect(edit).toMatchObject({
      status: UploadQueueItemStatus.Uploaded,
      fileId: null,
      assetStatus: DamAssetStatus.WithFile,
      imagePreview: previewOf('file-1'),
      keywords: ['edited'],
      canEditMetadata: true,
    })
    expect(calls.assetsRead).toEqual(['asset-1'])
    expect(settlement.hasTracked()).toBe(false)
    await clock.advance(10 * MIN)
    expect(server.requests).toEqual([{ kind: 'asset', ids: ['asset-1'] }])
  })

  it('N-Z17 the refresh of a mass-edit row answers by the state of the file, and only completes the row', async () => {
    const { add, calls } = dam()
    const edit = add('edit', massEditRow())
    const refresh = () => settlement.refreshAsset({ assetId: 'asset-1', fileId: edit.fileId })

    server.fileBecomes('asset-1', AssetFileProcessStatus.Stored)
    expect(await refresh()).toBe('pending')
    expect(calls.processedSeen).toEqual([])

    server.fileBecomes('asset-1', AssetFileProcessStatus.Processed)
    expect(await refresh()).toBe('settled')

    expect(edit).toMatchObject({
      status: UploadQueueItemStatus.Uploaded,
      assetStatus: DamAssetStatus.WithFile,
      imagePreview: previewOf('file-1'),
      keywords: ['edited'],
      canEditMetadata: true,
    })
    expect(calls.processedSeen).toEqual([edit.key])
    expect(calls.final).toEqual([])
  })

  it('N-Z20 a slot row is settled from the list of the slots of its asset, then completed from the asset', async () => {
    const { add, calls } = dam()
    const first = add('slots', slotRow('default', 'file-a'))
    const second = add('slots', slotRow('extra', 'file-b'))
    server.assets.set('asset-1', damAsset('asset-1', damFile('file-a', AssetFileProcessStatus.Processed)))
    server.slots.set('asset-1', [
      damFile('file-a', AssetFileProcessStatus.Processed),
      damFile('file-b', AssetFileProcessStatus.Stored),
      null,
    ])
    settlement.track('slots', first)
    settlement.track('slots', second)

    await clock.advance(5 * S)

    expect(server.requests).toEqual([
      { kind: 'slots', ids: ['asset-1'] },
      { kind: 'asset', ids: ['asset-1'] },
    ])
    expect(first).toMatchObject({
      status: UploadQueueItemStatus.Uploaded,
      fileId: 'file-a',
      assetStatus: DamAssetStatus.WithFile,
      imagePreview: previewOf('file-a'),
      canEditMetadata: false,
    })
    expect(second).toMatchObject({ status: UploadQueueItemStatus.Processing, assetStatus: DamAssetStatus.Draft })
    expect(second.imagePreview).toBeUndefined()
    expect(calls.final).toEqual([first.key, first.key])
    expect(calls.assetsRead).toEqual(['asset-1'])

    server.slots.set('asset-1', [
      damFile('file-a', AssetFileProcessStatus.Processed),
      damFile('file-b', AssetFileProcessStatus.Failed, { failReason: AssetFileFailReason.InvalidMimeType }),
    ])
    await clock.advance(5 * S)

    expect(first.status).toBe(UploadQueueItemStatus.Uploaded)
    expect(second).toMatchObject({
      status: UploadQueueItemStatus.Failed,
      error: { hasError: true, assetFileFailReason: AssetFileFailReason.InvalidMimeType },
    })
    expect(settlement.hasTracked()).toBe(false)
  })

  it('N-Z20 a slot row that is not the main file takes the state of the asset, not the preview of another file', async () => {
    const { add } = dam()
    const row = add('slots', slotRow('extra', 'file-b'))
    server.assets.set('asset-1', damAsset('asset-1', damFile('file-a', AssetFileProcessStatus.Processed)))
    server.slots.set('asset-1', [damFile('file-b', AssetFileProcessStatus.Processed)])
    settlement.track('slots', row)

    await clock.advance(5 * S)

    expect(row).toMatchObject({ status: UploadQueueItemStatus.Uploaded, assetStatus: DamAssetStatus.WithFile })
    expect(row.imagePreview).toBeUndefined()
    expect(row.mainFileSingleUse).toBeNull()
  })

  it('N-Z20 a slot row whose file is missing from three lists fails; one whose list cannot be read never warns', async () => {
    const { add } = dam()
    const missing = add('slots', slotRow('default', 'file-a'))
    const unread = add(
      'other',
      queueRow({ type: UploadQueueItemType.SlotFile, slotName: 'x', assetId: 'asset-2', fileId: 'file-x' })
    )
    settlement.track('slots', missing)
    await clock.advance(16 * S)
    expect(missing).toMatchObject({
      status: UploadQueueItemStatus.Failed,
      error: { hasError: true, message: TEXT.missing },
    })

    server.fail('slots')
    settlement.track('other', unread)
    await clock.advance(30 * MIN)

    expect(server.asked('slots').length).toBeGreaterThan(6)
    expect(unread).toMatchObject({
      status: UploadQueueItemStatus.Processing,
      error: { hasError: true, message: TEXT.tooLongSlot },
    })
  })

  // Without its form the row waits for its metadata, which a missing asset never brings.
  // Its misses count as those of a waiting row, and at the third
  // it fails with the profile's text (here `assetMissing`).
  it('N-Z21 a row uploaded by its event fails when its asset is missing three times while it has no form, and one with its form stays uploaded', async () => {
    const { add } = dam()
    const withoutForm = add('global', queueRow())
    const withForm = add('global', queueRow({ canEditMetadata: true }))
    settlement.track('global', withoutForm)

    void settlement.notify(processedEvent)
    await clock.advance(250 + 15 * S)
    expect(server.requests).toHaveLength(2)
    expect(withoutForm).toMatchObject({ status: UploadQueueItemStatus.Uploaded, error: noError })
    await clock.advance(30 * S)

    expect(server.requests).toHaveLength(3)
    expect(withoutForm).toMatchObject({
      status: UploadQueueItemStatus.Failed,
      canEditMetadata: false,
      error: { hasError: true, message: TEXT.missing },
    })
    expect(withForm).toMatchObject({ status: UploadQueueItemStatus.Uploaded, error: noError })
    await clock.advance(10 * MIN)
    expect(server.requests).toHaveLength(3)
  })

  it('a duplicate notification marks the row at once and reads only the original file', async () => {
    const { add } = dam()
    server.originFiles.set(
      'file-original',
      damFile('file-original', AssetFileProcessStatus.Processed, { asset: 'asset-original' })
    )
    const row = add('global', queueRow())
    settlement.track('global', row)

    const settled = settlement.notify({
      kind: 'duplicate',
      assetId: 'asset-1',
      fileId: 'file-1',
      originAssetFile: 'file-original',
      assetType: 'image',
    })
    expect(row).toMatchObject({ status: UploadQueueItemStatus.Uploaded, isDuplicate: true })
    await settled

    expect(row).toMatchObject({ fileId: 'file-original', duplicateAssetId: 'asset-original' })
    expect(server.requests).toEqual([{ kind: 'originFile', ids: ['file-original'] }])
    expect(settlement.hasTracked()).toBe(false)
    expect(clock.waiting()).toBe(0)
  })
})

describe('which rows a settlement tracks', () => {
  it('not a row of another queue, a row without an asset, a stopped row, nor a row no tick can read', async () => {
    const { add } = dam()
    const elsewhere = add('other', queueRow())
    const noAsset = add(QUEUE, queueRow({ assetId: null }))
    const stopped = add(QUEUE, queueRow({ status: UploadQueueItemStatus.Stop }))
    const massEdit = add(QUEUE, queueRow({ type: UploadQueueItemType.Asset }))

    settlement.track(QUEUE, elsewhere)
    settlement.track(QUEUE, queueRow())
    settlement.track(QUEUE, noAsset)
    settlement.track(QUEUE, stopped)
    settlement.track(QUEUE, massEdit)

    expect(settlement.hasTracked()).toBe(false)
    expect(clock.waiting()).toBe(0)
  })

  it('a row untracked or a queue dropped leaves no timer, and a disposed settlement none at all', async () => {
    const { add, connection } = lib()
    const row = add(QUEUE, queueRow())
    settlement.track(QUEUE, row)
    expect(clock.waiting()).toBe(1)
    settlement.untrack(row)
    expect(clock.waiting()).toBe(0)

    settlement.track(QUEUE, row)
    settlement.dropQueue(QUEUE)
    expect(clock.waiting()).toBe(0)
    expect(settlement.hasTracked()).toBe(false)
    expect([visibility.listeners(), connection.listeners()]).toEqual([0, 0])

    settlement.track(QUEUE, row)
    void settlement.notify(metadataEvent)
    expect(clock.waiting()).toBe(2)
    expect([visibility.listeners(), connection.listeners()]).toEqual([1, 1])
    settlement.dispose()

    expect(clock.waiting()).toBe(0)
    expect([visibility.listeners(), connection.listeners()]).toEqual([0, 0])
    await clock.advance(10 * MIN)
    expect(server.requests).toEqual([])
  })
})

describe('the tab and the notifications', () => {
  it('a hidden tab stops the ticks, not the read a notification asks for; the return reads at once', async () => {
    const { add } = lib()
    server.fileBecomes('asset-1', AssetFileProcessStatus.Stored)
    const row = add(QUEUE, queueRow())
    settlement.track(QUEUE, row)

    visibility.set(false)
    await clock.advance(1 * MIN)
    expect(server.requests).toEqual([])

    void settlement.notify(metadataEvent)
    await clock.advance(2 * S)
    expect(server.requests).toHaveLength(1)
    expect(row.canEditMetadata).toBe(true)

    await clock.advance(1 * MIN)
    expect(server.requests).toHaveLength(1)
    visibility.set(true)
    await clock.settle()
    expect(server.requests).toHaveLength(2)
  })

  it('reads by the sparse rhythm while the notifications are alive, and by the dense one once they die', async () => {
    const { add, connection } = lib()
    server.fileBecomes('asset-1', AssetFileProcessStatus.Stored)
    connection.set(true)
    settlement.track(QUEUE, add(QUEUE, queueRow()))

    await clock.advance(10 * S - 1)
    expect(server.requests).toHaveLength(0)
    await clock.advance(1)
    expect(server.requests).toHaveLength(1)

    connection.set(false)
    await clock.advance(6 * S)
    expect(server.requests).toHaveLength(2)
  })
})

describe('under the immediate scheduler of the tests of a store', () => {
  it('a notification is settled by awaiting it alone, and no tick ever comes', async () => {
    uploadSettlementRuntime.scheduler = immediateScheduler()
    const { add } = lib()
    server.fileBecomes('asset-1', AssetFileProcessStatus.Processed)
    const row = add(QUEUE, queueRow())
    const other = add(QUEUE, queueRow({ assetId: 'asset-2', fileId: 'file-2' }))
    settlement.track(QUEUE, row)
    settlement.track(QUEUE, other)

    await settlement.notify(metadataEvent)
    expect(row).toMatchObject({ ...uploaded, ...loadedMetadata })

    await settlement.notify({ kind: 'processed', assetId: 'asset-2', fileId: 'file-2' })
    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(server.requests).toEqual([
      { kind: 'asset', ids: ['asset-1'] },
      { kind: 'asset', ids: ['asset-2'] },
    ])
    expect(other.status).toBe(UploadQueueItemStatus.Processing)
  })
})

describe('two slot uploads of one asset at once', () => {
  const slotRow = (slotName: string, fileId: string) =>
    queueRow({ type: UploadQueueItemType.SlotFile, slotName, fileId })
  const mainFiles: Array<[string, ReturnType<typeof damFile>]> = [
    ['failed', damFile('file-a', AssetFileProcessStatus.Failed, { failReason: AssetFileFailReason.InvalidMimeType })],
    ['a duplicate', damFile('file-a', AssetFileProcessStatus.Duplicate, { originAssetFile: 'file-original' })],
  ]
  const seed = (mainFile: ReturnType<typeof damFile>) => {
    const { add } = dam()
    server.originFiles.set('file-original', damFile('file-original', AssetFileProcessStatus.Processed))
    server.assets.set('asset-1', damAsset('asset-1', mainFile))
    server.slots.set('asset-1', [mainFile, damFile('file-b', AssetFileProcessStatus.Processed)])
    return { main: add('slots', slotRow('default', 'file-a')), other: add('slots', slotRow('extra', 'file-b')) }
  }
  const stillItsOwn = {
    status: UploadQueueItemStatus.Uploaded,
    isDuplicate: false,
    fileId: 'file-b',
    duplicateAssetId: null,
    assetStatus: DamAssetStatus.WithFile,
    error: noError,
  }

  it.each(mainFiles)(
    'the main file is %s and the other processed: a tick leaves the other uploaded, with its own file',
    async (_what, mainFile) => {
      const { main, other } = seed(mainFile)
      settlement.track('slots', main)
      settlement.track('slots', other)

      await clock.advance(5 * S)

      expect(server.asked('asset')).toHaveLength(1)
      expect(other).toMatchObject(stillItsOwn)
      expect(main.fileId).toBe(
        mainFile.fileAttributes.status === AssetFileProcessStatus.Failed ? 'file-a' : 'file-original'
      )
      await clock.advance(10 * MIN)
      expect(other).toMatchObject(stillItsOwn)
    }
  )

  it.each(mainFiles)(
    'the main file is %s and the other processed: the notification of the other leaves it uploaded as well',
    async (_what, mainFile) => {
      const { other } = seed(mainFile)

      void settlement.notify({ kind: 'processed', assetId: 'asset-1', fileId: 'file-b' })
      await clock.advance(250)

      expect(server.asked('asset')).toHaveLength(1)
      expect(other).toMatchObject(stillItsOwn)
    }
  )

  it.each([
    ['processed', damFile('file-a', AssetFileProcessStatus.Processed)],
    ['failed', damFile('file-a', AssetFileProcessStatus.Failed, { failReason: AssetFileFailReason.InvalidMimeType })],
  ])(
    'T2 a slot row stopped while the list of its slots is read, its file %s, is not written and its asset not asked for',
    async (_what, file) => {
      const { add, calls } = dam()
      const row = add('slots', slotRow('default', 'file-a'))
      server.assets.set('asset-1', damAsset('asset-1', file))
      server.slots.set('asset-1', [file])
      settlement.track('slots', row)
      const before = { ...settledState(row), status: UploadQueueItemStatus.Stop }
      server.hold()
      await clock.advance(5 * S)

      row.status = UploadQueueItemStatus.Stop
      server.release()
      await clock.advance(10 * MIN)

      expect(settledState(row)).toEqual(before)
      expect(calls.final).toEqual([])
      expect(server.requests).toEqual([{ kind: 'slots', ids: ['asset-1'] }])
    }
  )
})

describe('a queue whose rows are gone while the tab is hidden', () => {
  it('keeps no tick for the return: a row tracked later is first asked about 5 s after it', async () => {
    const { add } = lib()
    server.fileBecomes('asset-1', AssetFileProcessStatus.Processed)
    server.fileBecomes('asset-2', AssetFileProcessStatus.Stored)
    const first = add(QUEUE, queueRow())
    settlement.track(QUEUE, first)
    await clock.advance(2 * S)
    visibility.set(false)
    void settlement.notify(processedEvent)
    await clock.advance(1 * S)
    expect(first.status).toBe(UploadQueueItemStatus.Uploaded)

    await clock.advance(57 * S)
    visibility.set(true)
    await clock.advance(40 * S)
    expect(server.requests).toHaveLength(1)

    settlement.track(QUEUE, add(QUEUE, queueRow({ assetId: 'asset-2', fileId: 'file-2' })))
    await clock.advance(5 * S - 1)
    expect(server.requests).toHaveLength(1)
    await clock.advance(1)

    expect(server.requests).toEqual([
      { kind: 'asset', ids: ['asset-1'] },
      { kind: 'asset', ids: ['asset-2'] },
    ])
  })
})

describe('a tick that waits for its turn behind another read', () => {
  it('is not run for a queue dropped meanwhile, whose key another queue has by then', async () => {
    const { add, queues } = lib()
    for (const assetId of ['asset-1', 'asset-2', 'asset-3']) server.fileBecomes(assetId, AssetFileProcessStatus.Stored)
    settlement.track('a', add('a', queueRow()))
    settlement.track('b', add('b', queueRow({ assetId: 'asset-2', fileId: 'file-2' })))
    server.hold()
    await clock.advance(5 * S)
    expect(server.requests).toEqual([{ kind: 'asset', ids: ['asset-1'] }])

    settlement.dropQueue('b')
    queues.set('b', emptyQueue())
    settlement.track('b', add('b', queueRow({ assetId: 'asset-3', fileId: 'file-3' })))
    server.release()
    await clock.settle()

    expect(server.requests).toEqual([{ kind: 'asset', ids: ['asset-1'] }])

    await clock.advance(5 * S - 1)
    expect(server.asked('asset').filter(({ ids }) => ids[0] === 'asset-3')).toHaveLength(0)
    await clock.advance(1)
    expect(server.asked('asset').filter(({ ids }) => ids[0] === 'asset-3')).toHaveLength(1)
    expect(server.asked('asset').filter(({ ids }) => ids[0] === 'asset-2')).toHaveLength(0)
  })
})

describe('a settlement disposed of', () => {
  it('does nothing when it is told to take a row out or to drop a queue: the store is told nothing of it', () => {
    const { add, calls } = lib()
    const row = add(QUEUE, queueRow({ status: UploadQueueItemStatus.Failed }))
    settlement.track(QUEUE, row, { clientFailed: true })
    settlement.dispose()

    settlement.untrack(row)
    settlement.dropQueue(QUEUE)

    expect(calls.refreshMayHelp).toEqual(['+' + row.key])
  })

  it('writes nothing of a tick that was on its way, calls no hook and plans nothing', async () => {
    const { add, calls } = lib()
    server.fileBecomes('asset-1', AssetFileProcessStatus.Processed)
    const row = add(QUEUE, queueRow())
    settlement.track(QUEUE, row)
    const before = settledState(row)
    server.hold()
    await clock.advance(5 * S)

    settlement.dispose()
    server.release()
    await clock.advance(10 * MIN)

    expect(settledState(row)).toEqual(before)
    expect(calls).toMatchObject({
      final: [],
      assetsRead: [],
      metadataLoaded: [],
      authorsFetched: 0,
      keywordsFetched: 0,
    })
    expect(clock.waiting()).toBe(0)
    expect(server.requests).toHaveLength(1)
    expect(settlement.hasTracked()).toBe(false)
  })

  it('does not send a read that waited for its turn, and answers its caller that nothing was read', async () => {
    const { add } = lib()
    server.fileBecomes('asset-1', AssetFileProcessStatus.Processed)
    const row = add(QUEUE, queueRow())
    settlement.track(QUEUE, row)
    server.hold()
    await clock.advance(5 * S)
    const outcome = settlement.refreshAsset({ assetId: 'asset-1', fileId: null })

    settlement.dispose()
    server.release()

    expect(await outcome).toBe('error')
    expect(server.requests).toHaveLength(1)
    expect(row.status).toBe(UploadQueueItemStatus.Processing)
  })

  it('does not try again a read of a notification that fails after it', async () => {
    const { add } = lib()
    const row = add(QUEUE, queueRow({ status: UploadQueueItemStatus.Uploading }))
    server.fail('asset')
    server.hold()
    void settlement.notify(metadataEvent)
    await clock.advance(2 * S)
    expect(server.requests).toHaveLength(1)

    settlement.dispose()
    server.release()
    await clock.settle()

    expect(clock.waiting()).toBe(0)
    expect(row.error).toEqual(noError)
  })

  it('does not settle a slot row from a list that answers after it, nor ask for its asset', async () => {
    const { add, calls } = dam()
    const row = add('slots', queueRow({ type: UploadQueueItemType.SlotFile, slotName: 'default', fileId: 'file-a' }))
    server.assets.set('asset-1', damAsset('asset-1', damFile('file-a', AssetFileProcessStatus.Processed)))
    server.slots.set('asset-1', [damFile('file-a', AssetFileProcessStatus.Processed)])
    settlement.track('slots', row)
    server.hold()
    await clock.advance(5 * S)

    settlement.dispose()
    server.release()
    await clock.settle()

    expect(row.status).toBe(UploadQueueItemStatus.Processing)
    expect(calls.final).toEqual([])
    expect(clock.waiting()).toBe(0)
    expect(server.requests).toEqual([{ kind: 'slots', ids: ['asset-1'] }])
  })

  it('does not write the original of a duplicate that answers after it', async () => {
    const made = lib()
    server.originAssets.set('file-original', damAsset('asset-original', damFile('file-original')))
    const becomes = made.add(QUEUE, queueRow())
    const before = settledState(becomes)
    server.hold()
    const known = settlement.settleKnownDuplicate({ assetId: 'asset-1', fileId: null }, 'file-original', 'image')
    settlement.dispose()
    server.release()
    await known

    expect(settledState(becomes)).toEqual(before)
    expect(made.calls.final).toEqual([])

    server = fakeDamServer()
    const { add } = dam()
    server.originFiles.set('file-original', damFile('file-original', AssetFileProcessStatus.Processed))
    const marked = add(QUEUE, queueRow())
    server.hold()
    const event = settlement.notify({
      kind: 'duplicate',
      assetId: 'asset-1',
      fileId: 'file-1',
      originAssetFile: 'file-original',
      assetType: 'image',
    })
    settlement.dispose()
    server.release()
    await event

    expect(marked).toMatchObject({ status: UploadQueueItemStatus.Uploaded, isDuplicate: true, fileId: 'file-1' })
  })

  it('does nothing it is asked for afterwards', async () => {
    const { add } = lib()
    server.fileBecomes('asset-1', AssetFileProcessStatus.Processed)
    server.originAssets.set('file-original', damAsset('asset-original', damFile('file-original')))
    const row = add(QUEUE, queueRow())
    const before = settledState(row)
    settlement.dispose()

    settlement.track(QUEUE, row)
    await settlement.notify(processedEvent)
    settlement.settleKnownFailed({ assetId: 'asset-1', fileId: null }, AssetFileFailReason.Unknown)
    await settlement.settleKnownDuplicate({ assetId: 'asset-1', fileId: null }, 'file-original', 'image')
    await settlement.settleKnownProcessed({ assetId: 'asset-1', fileId: null }, { withMetadata: true })
    expect(await settlement.refreshAsset({ assetId: 'asset-1', fileId: null })).toBe('error')

    expect(settledState(row)).toEqual(before)
    expect(server.requests).toEqual([])
    expect(clock.waiting()).toBe(0)
    expect(settlement.hasTracked()).toBe(false)
  })
})

describe('the warning of a row whose reads keep failing', () => {
  it('comes with its third failed read in a row, whichever asked: two ticks and the read of a notification', async () => {
    const { add } = lib()
    server.fileBecomes('asset-1', AssetFileProcessStatus.Stored)
    const row = add(QUEUE, queueRow())
    settlement.track(QUEUE, row)
    server.fail('asset')

    await clock.advance(20 * S)
    expect(row.error).toEqual(noError)
    void settlement.notify(metadataEvent)
    await clock.advance(2 * S)

    expect(server.requests).toHaveLength(3)
    expect(row).toMatchObject({
      status: UploadQueueItemStatus.Processing,
      error: { hasError: true, message: TEXT.readFailed },
    })
  })

  it('does not come for a tracked row whose ticks are answered, though the read of its notification failed three times', async () => {
    const { add } = lib()
    server.fileBecomes('asset-1', AssetFileProcessStatus.Stored)
    server.fileBecomes('asset-2', AssetFileProcessStatus.Stored)
    const row = add(QUEUE, queueRow())
    settlement.track(QUEUE, row)
    settlement.track(QUEUE, add(QUEUE, queueRow({ assetId: 'asset-2', fileId: 'file-2' })))
    server.fail('asset')

    void settlement.notify(metadataEvent)
    await clock.advance(47 * S)

    expect(server.asked('asset')).toHaveLength(3)
    expect(server.asked('assets').length).toBeGreaterThan(3)
    expect(row.error).toEqual(noError)
    await clock.advance(10 * MIN)
    expect(server.asked('asset')).toHaveLength(3)
  })
})

describe('a read a notification asked for, when its rows are taken out', () => {
  // A read on the wire cannot be cancelled.
  // If it fails after the rows left, nobody is left to retry it for.
  it('is not tried again when it fails after they left, and begins no streak of failures', async () => {
    const { add, queues } = lib()
    server.fileBecomes('asset-1', AssetFileProcessStatus.Stored)
    server.fileBecomes('asset-2', AssetFileProcessStatus.Stored)
    add(QUEUE, queueRow({ status: UploadQueueItemStatus.Uploading }))
    server.fail('asset')
    server.hold()
    void settlement.notify(metadataEvent)
    await clock.advance(2 * S)
    expect(server.requests).toHaveLength(1)

    settlement.dropQueue(QUEUE)
    queues.delete(QUEUE)
    server.release()
    await clock.settle()
    expect(clock.waiting()).toBe(0)

    settlement.track('next', add('next', queueRow({ assetId: 'asset-2', fileId: 'file-2' })))
    await clock.advance(5 * S)
    expect(server.letReport()).toEqual([true, true])
  })

  const released = (settled: Promise<void>) => {
    const state = { done: false }
    void settled.then(() => (state.done = true))
    return state
  }

  it('is given up at once when the store takes out the only row it was for', async () => {
    const { add, queues } = lib()
    server.fileBecomes('asset-1', AssetFileProcessStatus.Processed)
    const row = add(QUEUE, queueRow())
    const settled = released(settlement.notify(metadataEvent))
    expect(clock.waiting()).toBe(1)

    settlement.untrack(row)
    await clock.settle()

    expect(clock.waiting()).toBe(0)
    expect(settled.done).toBe(true)
    queues.get(QUEUE)!.items.splice(0, 1)
    await clock.advance(10 * MIN)
    expect(server.requests).toEqual([])
  })

  it('waits on while another row of the asset is still there', async () => {
    const { add } = lib()
    server.fileBecomes('asset-1', AssetFileProcessStatus.Stored)
    const leaving = add(QUEUE, queueRow({ status: UploadQueueItemStatus.Uploading }))
    const staying = add('another', queueRow({ status: UploadQueueItemStatus.Uploading }))
    const settled = released(settlement.notify(metadataEvent))

    settlement.untrack(leaving)
    await clock.settle()
    expect(clock.waiting()).toBe(1)
    expect(settled.done).toBe(false)

    await clock.advance(2 * S)
    expect(server.requests).toHaveLength(1)
    expect(staying.canEditMetadata).toBe(true)
    expect(settled.done).toBe(true)
  })

  it('is given up with its queue, unless a row of another queue needs it', async () => {
    const { add } = lib()
    for (const assetId of ['asset-1', 'asset-2', 'asset-3']) server.fileBecomes(assetId, AssetFileProcessStatus.Stored)
    const uploading = (assetId: string) => queueRow({ assetId, status: UploadQueueItemStatus.Uploading })
    add('a', uploading('asset-1'))
    add('b', uploading('asset-2'))
    add('a', uploading('asset-3'))
    const shared = add('b', uploading('asset-3'))
    const ofDropped = released(settlement.notify({ kind: 'metadata', assetId: 'asset-1', fileId: null }))
    const ofOther = released(settlement.notify({ kind: 'metadata', assetId: 'asset-2', fileId: null }))
    const ofBoth = released(settlement.notify({ kind: 'metadata', assetId: 'asset-3', fileId: null }))
    expect(clock.waiting()).toBe(3)

    settlement.dropQueue('a')
    await clock.settle()

    expect(clock.waiting()).toBe(2)
    expect([ofDropped.done, ofOther.done, ofBoth.done]).toEqual([true, false, false])
    await clock.advance(2 * S)
    expect(server.asked('asset').map(({ ids }) => ids[0])).toEqual(['asset-2', 'asset-3'])
    expect(shared.canEditMetadata).toBe(true)
  })
})

describe('an asset of a tick that cannot be written', () => {
  it('does not stop the other assets of the tick, nor the counting of the rows, nor the rhythm of the queue', async () => {
    const { add, profile } = lib()
    profile.hooks.onAssetRead = (asset) => {
      if (asset.id === 'asset-1') throw new Error('the hook of the store throws')
    }
    server.fileBecomes('asset-1', AssetFileProcessStatus.Processed)
    server.fileBecomes('asset-2', AssetFileProcessStatus.Processed)
    const rows = ['asset-1', 'asset-2', 'asset-3'].map((assetId) => add(QUEUE, queueRow({ assetId })))
    rows.forEach((row) => settlement.track(QUEUE, row))

    await clock.advance(5 * S)

    expect(rows.map((row) => row.status)).toEqual([
      UploadQueueItemStatus.Uploaded,
      UploadQueueItemStatus.Uploaded,
      UploadQueueItemStatus.Processing,
    ])

    await clock.advance(11 * S)
    expect(rows[2]).toMatchObject({ status: UploadQueueItemStatus.Failed, error: { message: TEXT.missing } })
  })
})

describe('a row that warned while its file was sent, and whose upload then failed', () => {
  const warnedWhileSent = async () => {
    const made = lib()
    server.fileBecomes('asset-1', AssetFileProcessStatus.Stored)
    const row = made.add(QUEUE, queueRow({ status: UploadQueueItemStatus.Uploading }))
    server.fail('asset')
    void settlement.notify(metadataEvent)
    await clock.advance(47 * S)
    expect(row.error).toEqual({
      hasError: true,
      message: TEXT.readFailed,
      assetFileFailReason: AssetFileFailReason.None,
    })
    return row
  }
  const failsItsUpload = (row: UploadQueueItem, error?: UploadQueueItem['error']) => {
    if (error) row.error = { ...error }
    else row.error.hasError = true
    row.status = UploadQueueItemStatus.Failed
    row.canEditMetadata = false
    settlement.track(QUEUE, row, { clientFailed: true })
  }
  const uploadError = { hasError: true, message: 'the upload failed', assetFileFailReason: AssetFileFailReason.Unknown }

  it.each([
    ['still fail', false],
    ['are answered again', true],
  ])('keeps the error the store wrote over the warning, when the reads %s', async (_what, recovers) => {
    const row = await warnedWhileSent()

    failsItsUpload(row, uploadError)
    if (recovers) server.recover()
    await clock.advance(10 * MIN)

    expect(server.requests.length).toBeGreaterThan(5)
    expect(row).toMatchObject({ status: UploadQueueItemStatus.Failed, canEditMetadata: false })
    expect(row.error).toEqual(uploadError)
  })

  it('loses the warning and keeps the flag of its failure, when the store wrote no text of its own', async () => {
    const row = await warnedWhileSent()

    // The library's store marks the failure by the flag alone, so the text on the row is still the settlement's.
    failsItsUpload(row)
    server.recover()
    await clock.advance(10 * MIN)

    expect(row.status).toBe(UploadQueueItemStatus.Failed)
    expect(row.error).toEqual({ hasError: true, message: '', assetFileFailReason: AssetFileFailReason.None })
  })

  it('and is uploaded with no error at all when the server finished its file all the same', async () => {
    const row = await warnedWhileSent()

    failsItsUpload(row, uploadError)
    server.recover()
    server.fileBecomes('asset-1', AssetFileProcessStatus.Processed)
    await clock.advance(10 * MIN)

    expect(row).toMatchObject({ ...uploaded, error: noError, ...loadedMetadata })
  })
})

describe('a text of the settlement that nobody wrote over', () => {
  it('is taken away, flag and all, once it no longer holds: the warning of a row still being sent, when its metadata comes', async () => {
    const { add } = lib()
    server.fileBecomes('asset-1', AssetFileProcessStatus.Stored)
    const row = add(QUEUE, queueRow({ status: UploadQueueItemStatus.Uploading }))
    server.fail('asset')
    void settlement.notify(metadataEvent)
    await clock.advance(47 * S)
    expect(row.error).toMatchObject({ hasError: true, message: TEXT.readFailed })

    server.recover()
    void settlement.notify(metadataEvent)
    await clock.advance(2 * S)

    expect(row).toMatchObject({ status: UploadQueueItemStatus.Uploading, error: noError, ...loadedMetadata })
  })
})

describe('a notification that arrives while the read of the metadata notification is on the wire', () => {
  const metadataReadOnTheWire = async (made: ReturnType<typeof dam> | ReturnType<typeof lib>) => {
    server.fileBecomes('asset-1', AssetFileProcessStatus.Processed)
    const row = made.add(QUEUE, queueRow())
    settlement.track(QUEUE, row)
    void settlement.notify(metadataEvent)
    server.hold()
    await clock.advance(2 * S)
    expect(server.requests).toEqual([{ kind: 'asset', ids: ['asset-1'] }])
    return row
  }

  it('processed, in the DAM application: the row is uploaded at once, and the answer still gives it its metadata and its form', async () => {
    const made = dam()
    const row = await metadataReadOnTheWire(made)

    void settlement.notify(processedEvent)
    expect(row).toMatchObject({ status: UploadQueueItemStatus.Uploaded, ...noMetadata })
    server.release()
    await clock.settle()

    expect(row).toMatchObject({ status: UploadQueueItemStatus.Uploaded, error: noError, ...loadedMetadata })
    expect(made.calls.metadataLoaded).toEqual([row.key])

    await clock.advance(10 * MIN)
    expect(server.requests).toHaveLength(2)
    expect(row).toMatchObject({ ...uploaded, imagePreview: previewOf('file-1'), ...loadedMetadata })
    expect(settlement.hasTracked()).toBe(false)
  })

  it('failed, in the DAM application: the row stays failed, with no form and nothing loaded', async () => {
    const made = dam()
    const row = await metadataReadOnTheWire(made)

    void settlement.notify({
      kind: 'failed',
      assetId: 'asset-1',
      fileId: 'file-1',
      failReason: AssetFileFailReason.InvalidMimeType,
    })
    server.release()
    await clock.advance(10 * MIN)

    expect(row).toMatchObject({
      status: UploadQueueItemStatus.Failed,
      error: { hasError: true, message: '', assetFileFailReason: AssetFileFailReason.InvalidMimeType },
      ...noMetadata,
    })
    expect(made.calls.metadataLoaded).toEqual([])
    expect(server.requests).toHaveLength(1)
  })

  it('duplicate, in the DAM application: the row stays a marked duplicate, with no form and nothing loaded', async () => {
    const made = dam()
    const row = await metadataReadOnTheWire(made)

    void settlement.notify({ kind: 'duplicate', assetId: 'asset-1', fileId: 'file-1' })
    server.release()
    await clock.advance(10 * MIN)

    expect(row).toMatchObject({
      status: UploadQueueItemStatus.Uploaded,
      isDuplicate: true,
      error: noError,
      ...noMetadata,
    })
    expect(made.calls.metadataLoaded).toEqual([])
    expect(server.requests).toHaveLength(1)
  })

  it('processed, in the library: as before, the answer settles the row with its metadata and its form', async () => {
    const made = lib()
    const row = await metadataReadOnTheWire(made)

    void settlement.notify(processedEvent)
    expect(row.status).toBe(UploadQueueItemStatus.Processing)
    server.release()
    await clock.settle()

    expect(row).toMatchObject({ ...uploaded, error: noError, ...loadedMetadata })
    await clock.advance(10 * MIN)
    expect(server.requests).toHaveLength(2)
    expect(row).toMatchObject({ ...uploaded, error: noError, ...loadedMetadata })
  })
})

describe('whether a refresh may still change a failed row', () => {
  const gaveUp = { status: UploadQueueItemStatus.Failed }
  const yes = (row: UploadQueueItem) => '+' + row.key
  const no = (row: UploadQueueItem) => '-' + row.key

  it('it may for a row the client gave up on, from the moment it is asked about; never said of a row that waits', () => {
    const { add, calls } = lib()
    const givenUp = add(QUEUE, queueRow({ ...gaveUp }))
    const waiting = add(QUEUE, queueRow({ assetId: 'asset-2', fileId: 'file-2' }))

    settlement.track(QUEUE, givenUp, { clientFailed: true })
    settlement.track(QUEUE, waiting)

    expect(calls.refreshMayHelp).toEqual([yes(givenUp)])
  })

  it('no longer once the server has said what became of the file, by a read or by its notification', async () => {
    const { add, calls } = lib()
    const processed = add(QUEUE, queueRow({ ...gaveUp, assetId: 'asset-1' }))
    const failedByRead = add(QUEUE, queueRow({ ...gaveUp, assetId: 'asset-2', fileId: 'file-2' }))
    const failedByEvent = add(QUEUE, queueRow({ ...gaveUp, assetId: 'asset-3', fileId: 'file-3' }))
    const stillWaited = add(QUEUE, queueRow({ ...gaveUp, assetId: 'asset-4', fileId: 'file-4' }))
    server.fileBecomes('asset-1', AssetFileProcessStatus.Processed)
    server.fileBecomes('asset-2', AssetFileProcessStatus.Failed)
    server.fileBecomes('asset-3', AssetFileProcessStatus.Stored)
    server.fileBecomes('asset-4', AssetFileProcessStatus.Stored)
    const rows = [processed, failedByRead, failedByEvent, stillWaited]
    rows.forEach((row) => settlement.track(QUEUE, row, { clientFailed: true }))
    expect(calls.refreshMayHelp).toEqual(rows.map(yes))

    void settlement.notify({ kind: 'failed', assetId: 'asset-3', fileId: null, failReason: 'unknown' })
    await clock.advance(5 * S)

    expect(calls.refreshMayHelp.slice(4)).toEqual([no(failedByEvent), no(processed), no(failedByRead)])
  })

  it('no longer once its asset is gone from three reads, though the row is left as it is', async () => {
    const { add, calls } = lib()
    const missing = add(QUEUE, queueRow({ ...gaveUp }))
    settlement.track(QUEUE, missing, { clientFailed: true })

    await clock.advance(16 * S)

    expect(calls.refreshMayHelp).toEqual([yes(missing), no(missing)])
    expect(missing.status).toBe(UploadQueueItemStatus.Failed)
    expect(calls.final).toEqual([])
  })

  it('no longer once it is a refresh that finds its asset gone for the third time, which does not say to ask again', async () => {
    const { add, calls } = lib()
    const missing = add(QUEUE, queueRow({ ...gaveUp }))
    settlement.track(QUEUE, missing, { clientFailed: true })
    await clock.advance(10 * S)
    expect(calls.refreshMayHelp).toEqual([yes(missing)])

    expect(await settlement.refreshAsset({ assetId: 'asset-1', fileId: null })).toBe('settled')

    expect(calls.refreshMayHelp).toEqual([yes(missing), no(missing)])
    expect(missing.status).toBe(UploadQueueItemStatus.Failed)
    expect(settlement.hasTracked()).toBe(false)
  })

  it('it may for a row left without the original of its duplicate: the one that waited, and the one given up on', async () => {
    const { add, calls } = lib()
    server.fileBecomes('asset-1', AssetFileProcessStatus.Duplicate, { originAssetFile: 'file-original' })
    server.fileBecomes('asset-2', AssetFileProcessStatus.Duplicate, { originAssetFile: 'file-original' })
    const waited = add(QUEUE, queueRow({ assetId: 'asset-1' }))
    const givenUp = add(QUEUE, queueRow({ ...gaveUp, assetId: 'asset-2', fileId: 'file-2' }))
    settlement.track(QUEUE, waited)
    settlement.track(QUEUE, givenUp, { clientFailed: true })

    await clock.advance(5 * S)

    expect([waited.status, givenUp.status]).toEqual([UploadQueueItemStatus.Failed, UploadQueueItemStatus.Failed])
    expect(calls.refreshMayHelp).toEqual([yes(givenUp), yes(waited)])
    expect(settlement.hasTracked()).toBe(false)

    expect(await settlement.refreshAsset({ assetId: 'asset-1', fileId: null })).toBe('originalUnread')
    expect(await settlement.refreshAsset({ assetId: 'asset-2', fileId: null })).toBe('originalUnread')
    expect([waited.status, givenUp.status]).toEqual([UploadQueueItemStatus.Failed, UploadQueueItemStatus.Failed])
    expect(calls.refreshMayHelp).toEqual([yes(givenUp), yes(waited)])

    server.originAssets.set(
      'file-original',
      damAsset('asset-original', damFile('file-original', AssetFileProcessStatus.Processed))
    )
    expect(await settlement.refreshAsset({ assetId: 'asset-1', fileId: null })).toBe('settled')
    expect(await settlement.refreshAsset({ assetId: 'asset-2', fileId: null })).toBe('settled')

    expect(waited).toMatchObject({
      status: UploadQueueItemStatus.Uploaded,
      isDuplicate: true,
      assetId: 'asset-original',
    })
    expect(givenUp).toMatchObject({
      status: UploadQueueItemStatus.Uploaded,
      isDuplicate: true,
      assetId: 'asset-original',
    })
    expect(calls.refreshMayHelp.slice(2)).toEqual([no(waited), no(givenUp)])
  })

  it('it may for a row its own refresh fails for want of the original, and that refresh answers why', async () => {
    const { add, calls } = lib()
    server.fileBecomes('asset-1', AssetFileProcessStatus.Duplicate, { originAssetFile: 'file-original' })
    const row = add(QUEUE, queueRow())
    settlement.track(QUEUE, row)
    expect(row.status).toBe(UploadQueueItemStatus.Processing)

    expect(await settlement.refreshAsset({ assetId: 'asset-1', fileId: null })).toBe('originalUnread')

    expect(row.status).toBe(UploadQueueItemStatus.Failed)
    expect(calls.refreshMayHelp).toEqual([yes(row)])
    expect(settlement.hasTracked()).toBe(false)
  })

  it('the same for a duplicate the caller knows of: a copy the licence has already, whose original cannot be read', async () => {
    const { add, calls } = lib()
    const copy = add(QUEUE, queueRow({ type: UploadQueueItemType.Asset, fileId: null }))
    settlement.track(QUEUE, copy)

    await settlement.settleKnownDuplicate({ assetId: 'asset-1', fileId: null }, 'file-original', 'image')

    expect(copy.status).toBe(UploadQueueItemStatus.Failed)
    expect(calls.refreshMayHelp).toEqual([yes(copy)])
  })

  it('no longer for a row left without its original, when a refresh then finds its file failed', async () => {
    const { add, calls } = lib()
    server.fileBecomes('asset-1', AssetFileProcessStatus.Duplicate, { originAssetFile: 'file-original' })
    const row = add(QUEUE, queueRow())
    settlement.track(QUEUE, row)
    await clock.advance(5 * S)
    expect(calls.refreshMayHelp).toEqual([yes(row)])

    expect(await settlement.refreshAsset({ assetId: 'asset-1', fileId: null })).toBe('originalUnread')
    expect(calls.refreshMayHelp).toEqual([yes(row)])

    server.fileBecomes('asset-1', AssetFileProcessStatus.Failed, { failReason: 'invalid_mime_type' })
    expect(await settlement.refreshAsset({ assetId: 'asset-1', fileId: null })).toBe('settled')

    expect(row).toMatchObject({
      status: UploadQueueItemStatus.Failed,
      error: { assetFileFailReason: 'invalid_mime_type' },
    })
    expect(calls.refreshMayHelp).toEqual([yes(row), no(row)])
  })

  it('no longer for a row left without its original once three reads in a row find no asset', async () => {
    const { add, calls } = lib()
    server.fileBecomes('asset-1', AssetFileProcessStatus.Duplicate, { originAssetFile: 'file-original' })
    const row = add(QUEUE, queueRow())
    settlement.track(QUEUE, row)
    await clock.advance(5 * S)
    expect(calls.refreshMayHelp).toEqual([yes(row)])
    const asset = server.assets.get('asset-1')!
    const refresh = () => settlement.refreshAsset({ assetId: 'asset-1', fileId: null })

    server.assets.delete('asset-1')
    expect([await refresh(), await refresh()]).toEqual(['missing', 'missing'])
    server.assets.set('asset-1', asset)
    expect(await refresh()).toBe('originalUnread')
    server.assets.delete('asset-1')
    expect([await refresh(), await refresh()]).toEqual(['missing', 'missing'])
    expect(calls.refreshMayHelp).toEqual([yes(row)])

    expect(await refresh()).toBe('settled')

    expect(calls.refreshMayHelp).toEqual([yes(row), no(row)])
    expect(row.status).toBe(UploadQueueItemStatus.Failed)
  })

  it('the same when it is a notification that asks about it, and its three tries find no asset', async () => {
    const { add, calls } = lib()
    server.fileBecomes('asset-1', AssetFileProcessStatus.Duplicate, { originAssetFile: 'file-original' })
    const row = add(QUEUE, queueRow())
    settlement.track(QUEUE, row)
    await clock.advance(5 * S)
    server.assets.delete('asset-1')

    void settlement.notify({ kind: 'processed', assetId: 'asset-1', fileId: null })
    await clock.advance(250 + 15 * S)
    expect(calls.refreshMayHelp).toEqual([yes(row)])
    await clock.advance(30 * S)

    expect(calls.refreshMayHelp).toEqual([yes(row), no(row)])
  })

  // The server's word stands.
  // A duplicate announced late, whose original cannot be read,
  // must not bring a refresh back to a row the server has failed.
  it('not for a row the server had failed before the original of its duplicate could not be read', async () => {
    const { add, calls } = lib()
    const row = add(QUEUE, queueRow())
    settlement.track(QUEUE, row)
    void settlement.notify({ kind: 'failed', assetId: 'asset-1', fileId: null, failReason: 'invalid_size' })
    expect(row.status).toBe(UploadQueueItemStatus.Failed)

    await settlement.notify({
      kind: 'duplicate',
      assetId: 'asset-1',
      fileId: null,
      originAssetFile: 'file-original',
      assetType: 'image',
    })

    expect(server.asked('originAsset')).toHaveLength(1)
    expect(row).toMatchObject({ status: UploadQueueItemStatus.Failed, error: { assetFileFailReason: 'invalid_size' } })
    expect(calls.refreshMayHelp).toEqual([])
  })

  it('no longer when the store takes the row out or drops its queue; nothing is said of a row it was never said of', () => {
    const { add, calls } = lib()
    const taken = add(QUEUE, queueRow({ ...gaveUp }))
    const dropped = add('other', queueRow({ ...gaveUp, assetId: 'asset-2', fileId: 'file-2' }))
    const waiting = add('other', queueRow({ assetId: 'asset-3', fileId: 'file-3' }))
    settlement.track(QUEUE, taken, { clientFailed: true })
    settlement.track('other', dropped, { clientFailed: true })
    settlement.track('other', waiting)

    settlement.untrack(taken)
    settlement.untrack(taken)
    settlement.untrack(waiting)
    expect(calls.refreshMayHelp.slice(2)).toEqual([no(taken)])

    settlement.dropQueue('other')
    expect(calls.refreshMayHelp.slice(2)).toEqual([no(taken), no(dropped)])
  })
})

describe('which failed reads a reader is let report', () => {
  const stored = (assetId: string) => server.fileBecomes(assetId, AssetFileProcessStatus.Stored)

  it('the first of a streak, none of those after it, and the first again once a read has answered', async () => {
    const { add } = lib()
    stored('asset-1')
    settlement.track(QUEUE, add(QUEUE, queueRow()))
    server.fail('asset')

    await clock.advance(50 * S)
    expect(server.letReport()).toEqual([true, false, false])

    server.recover()
    await clock.advance(MIN)
    expect(server.requests).toHaveLength(4)
    server.fail('asset')
    await clock.advance(MIN)

    expect(server.letReport().slice(4)).toEqual([true, false])
  })

  it('once for the request that asks about several rows, and not again for a row that joins the streak', async () => {
    const { add } = lib()
    stored('asset-1')
    stored('asset-2')
    stored('asset-3')
    settlement.track(QUEUE, add(QUEUE, queueRow({ assetId: 'asset-1' })))
    settlement.track(QUEUE, add(QUEUE, queueRow({ assetId: 'asset-2', fileId: 'file-2' })))
    server.fail('assets')

    await clock.advance(5 * S)
    settlement.track(QUEUE, add(QUEUE, queueRow({ assetId: 'asset-3', fileId: 'file-3' })))
    await clock.advance(MIN)

    expect(server.asked('assets').length).toBeGreaterThan(2)
    expect(server.letReport()).toEqual([
      true,
      ...server
        .asked('assets')
        .slice(1)
        .map(() => false),
    ])
  })

  it('every request of the tick that begins a streak, since they go out together', async () => {
    const { add } = lib()
    const inLicence = (licenceId: number, assetId: string) => {
      server.assets.set(assetId, damAsset(assetId, damFile('file-of-' + assetId, 'stored'), { licence: licenceId }))
      settlement.track(QUEUE, add(QUEUE, queueRow({ assetId, fileId: 'file-of-' + assetId, licenceId })))
    }
    inLicence(1, 'asset-1')
    inLicence(2, 'asset-2')
    server.fail('asset')

    await clock.advance(5 * S)
    expect(server.letReport()).toEqual([true, true])
    await clock.advance(15 * S)
    expect(server.letReport()).toEqual([true, true, false, false])
  })

  it('a row whose own reads keep failing is not reported again when the reads of another row answer between', async () => {
    const { add } = lib()
    stored('asset-1')
    stored('asset-2')
    settlement.track(QUEUE, add(QUEUE, queueRow({ assetId: 'asset-1' })))
    settlement.track('other', add('other', queueRow({ assetId: 'asset-2', fileId: 'file-2' })))
    server.failAsset('asset-1')

    await clock.advance(3 * MIN)

    const ofFailing = server.letReport({ asset: 'asset-1' })
    expect(ofFailing.length).toBeGreaterThan(3)
    expect(ofFailing).toEqual([true, ...ofFailing.slice(1).map(() => false)])
    expect(server.letReport({ asset: 'asset-2' }).length).toBeGreaterThan(8)
  })

  it('a read a notification asks for: its first try, and none of the tries after it', async () => {
    const { add } = lib()
    stored('asset-1')
    add(QUEUE, queueRow({ status: UploadQueueItemStatus.Uploading }))
    server.fail('asset')

    void settlement.notify(metadataEvent)
    await clock.advance(MIN)

    expect(server.letReport()).toEqual([true, false, false])
  })

  it('not the read of the poll that fails inside a streak a notification has begun', async () => {
    const { add } = lib()
    stored('asset-1')
    stored('asset-2')
    add('other', queueRow({ assetId: 'asset-2', fileId: 'file-2', status: UploadQueueItemStatus.Uploading }))
    server.fail('asset')

    void settlement.notify({ kind: 'metadata', assetId: 'asset-2', fileId: null })
    await clock.advance(2 * S)
    settlement.track(QUEUE, add(QUEUE, queueRow({ assetId: 'asset-1' })))
    await clock.advance(5 * S)

    expect(server.requests).toEqual([
      { kind: 'asset', ids: ['asset-2'] },
      { kind: 'asset', ids: ['asset-1'] },
    ])
    expect(server.letReport()).toEqual([true, false])
  })

  it('not the read of a notification that fails inside a streak the poll has begun', async () => {
    const { add } = lib()
    stored('asset-1')
    stored('asset-2')
    settlement.track(QUEUE, add(QUEUE, queueRow({ assetId: 'asset-1' })))
    add('other', queueRow({ assetId: 'asset-2', fileId: 'file-2', status: UploadQueueItemStatus.Uploading }))
    server.fail('asset')

    await clock.advance(5 * S)
    void settlement.notify({ kind: 'metadata', assetId: 'asset-2', fileId: null })
    void settlement.notify({ kind: 'processed', assetId: 'asset-1', fileId: null })
    await clock.advance(3 * S)

    expect(server.requests).toHaveLength(3)
    expect(server.letReport()).toEqual([true, false, false])
  })

  it('the refresh always, whatever streak runs; one that answers ends the streak', async () => {
    const { add } = lib()
    stored('asset-1')
    settlement.track(QUEUE, add(QUEUE, queueRow()))
    server.fail('asset')

    await clock.advance(5 * S)
    expect(await settlement.refreshAsset({ assetId: 'asset-1', fileId: null })).toBe('error')
    expect(await settlement.refreshAsset({ assetId: 'asset-1', fileId: null })).toBe('error')
    await settlement.settleKnownProcessed({ assetId: 'asset-1', fileId: null }, { withMetadata: true })
    await clock.advance(15 * S)
    expect(server.letReport()).toEqual([true, true, true, true, false])

    server.recover()
    expect(await settlement.refreshAsset({ assetId: 'asset-1', fileId: null })).toBe('pending')
    server.fail('asset')
    await clock.advance(2 * MIN)

    expect(server.letReport().slice(6, 8)).toEqual([true, false])
  })

  it('an asset that does not exist: once for its row, not at each read that misses it', async () => {
    const { add } = lib()
    const row = add(QUEUE, queueRow())
    settlement.track(QUEUE, row)

    await clock.advance(16 * S)

    expect(server.letReport()).toEqual([true, false, false])
    expect(row).toMatchObject({ status: UploadQueueItemStatus.Failed, error: { message: TEXT.missing } })
  })

  it('an asset the refresh found missing is not said missing again by the poll', async () => {
    const { add } = lib()
    settlement.track(QUEUE, add(QUEUE, queueRow()))

    expect(await settlement.refreshAsset({ assetId: 'asset-1', fileId: null })).toBe('missing')
    await clock.advance(5 * S)

    expect(server.letReport()).toEqual([true, false])
  })

  it('the first failure again once the last queue was dropped, although no read has answered', async () => {
    const { add, queues } = lib()
    stored('asset-1')
    stored('asset-2')
    settlement.track(QUEUE, add(QUEUE, queueRow()))
    server.fail('asset')
    await clock.advance(20 * S)
    expect(server.letReport()).toEqual([true, false])

    settlement.dropQueue(QUEUE)
    queues.delete(QUEUE)
    settlement.track('next', add('next', queueRow({ assetId: 'asset-2', fileId: 'file-2' })))
    await clock.advance(20 * S)

    expect(server.letReport().slice(2)).toEqual([true, false])
  })

  it('the list of the slots of an asset, as any other read of the poll', async () => {
    const { add } = dam()
    settlement.track(
      'slots',
      add('slots', queueRow({ type: UploadQueueItemType.SlotFile, slotName: 'default', fileId: 'file-1' }))
    )
    server.fail('slots')

    await clock.advance(20 * S)
    expect(server.letReport('slots')).toEqual([true, false])

    server.recover()
    server.slots.set('asset-1', [damFile('file-1', AssetFileProcessStatus.Stored)])
    await clock.advance(30 * S)
    server.fail('slots')
    await clock.advance(MIN)

    expect(server.letReport('slots').slice(3, 5)).toEqual([true, false])
  })
})

describe('the queue a reader is told a read is for', () => {
  const stored = (assetId: string) => server.fileBecomes(assetId, AssetFileProcessStatus.Stored)

  it('the poll: the queue of the tick, for an asset asked for by itself and for several asked for at once', async () => {
    const { add } = lib()
    stored('asset-1')
    stored('asset-2')
    stored('asset-3')
    settlement.track('first', add('first', queueRow()))
    settlement.track('second', add('second', queueRow({ assetId: 'asset-2', fileId: 'file-2' })))
    settlement.track('second', add('second', queueRow({ assetId: 'asset-3', fileId: 'file-3' })))

    await clock.advance(5 * S)

    expect(server.queuesOf('asset')).toEqual(['first'])
    expect(server.queuesOf('assets')).toEqual(['second'])
  })

  it('the poll of the DAM application: the queue of the tick, for the slots too', async () => {
    const { add } = dam()
    stored('asset-1')
    server.slots.set('asset-2', [damFile('file-2', AssetFileProcessStatus.Stored)])
    settlement.track('first', add('first', queueRow()))
    settlement.track(
      'second',
      add('second', queueRow({ assetId: 'asset-2', fileId: 'file-2', type: UploadQueueItemType.SlotFile }))
    )

    await clock.advance(5 * S)

    expect(server.queuesOf('asset')).toEqual(['first'])
    expect(server.queuesOf('slots')).toEqual(['second'])
  })

  it('a notification: the queue of the first row it concerns, tracked or not', async () => {
    const { add } = lib()
    server.fileBecomes('asset-1', AssetFileProcessStatus.Processed)
    add('first', queueRow())
    settlement.track('second', add('second', queueRow()))

    const settled = settlement.notify(processedEvent)
    await clock.advance(250)
    await settled

    expect(server.queuesOf('asset')).toEqual(['first'])
  })

  it('the refresh: the queue of the first row of the asset, and none for an asset no row has', async () => {
    const { add } = lib()
    stored('asset-1')
    add('first', queueRow())
    add('second', queueRow())

    await settlement.refreshAsset({ assetId: 'asset-1', fileId: null })
    await settlement.refreshAsset({ assetId: 'asset-of-no-row', fileId: null })

    expect(server.queuesOf('asset')).toEqual(['first', undefined])
  })

  // The queue is noted before the read is asked for, because the row may be gone by the time it answers.
  it('the refresh: the queue of a row that leaves while the read is on the wire', async () => {
    const { add, queues } = lib()
    stored('asset-1')
    add(QUEUE, queueRow())
    server.hold()

    const outcome = settlement.refreshAsset({ assetId: 'asset-1', fileId: null })
    await clock.settle()
    expect(server.requests).toHaveLength(1)
    queues.get(QUEUE)!.items.splice(0)
    server.release()
    await outcome

    expect(server.queuesOf('asset')).toEqual([QUEUE])
  })

  it('the original of a duplicate: the queue of the first row that is to become it', async () => {
    const { add } = lib()
    server.originAssets.set('file-original', damAsset('asset-original', damFile('file-original')))
    const first = add('first', queueRow())
    const second = add('second', queueRow())

    await settlement.settleKnownDuplicate({ assetId: 'asset-1', fileId: null }, 'file-original', 'image')

    expect(server.queuesOf('originAsset')).toEqual(['first'])
    expect([first.assetId, second.assetId]).toEqual(['asset-original', 'asset-original'])
  })

  // The tick is of the second queue, and its asset is also that of a row of the first queue.
  // The original is asked for under the queue of that row, the first to become the duplicate.
  it('the original of a duplicate a tick has found: the queue of the first row to become it, not that of the tick', async () => {
    const { add } = lib()
    server.originAssets.set('file-original', damAsset('asset-original', damFile('file-original')))
    server.fileBecomes('asset-1', AssetFileProcessStatus.Duplicate, { originAssetFile: 'file-original' })
    const ofFirst = add('first', queueRow())
    const ofSecond = add('second', queueRow())
    settlement.track('second', ofSecond)

    await clock.advance(5 * S)

    expect(server.queuesOf('asset')).toEqual(['second'])
    expect(server.queuesOf('originAsset')).toEqual(['first'])
    expect([ofFirst.assetId, ofSecond.assetId]).toEqual(['asset-original', 'asset-original'])
  })
})
