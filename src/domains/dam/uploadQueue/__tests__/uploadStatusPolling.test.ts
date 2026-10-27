import { afterEach, beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest'
import axios, { type AxiosInstance, type AxiosRequestConfig } from 'axios'
import { createPinia, setActivePinia } from 'pinia'
import { effectScope } from 'vue'
import {
  cmsConfiguration,
  type ConsumerProfile,
  consumerProfiles,
  installConsumerProfile,
  ugcConfiguration,
} from '@/domains/dam/__tests__/support/consumerProfiles'
import { type DamSocket, stubDamSocket } from '@/domains/dam/__tests__/support/damSocket'
import { createFakeDam, damAssetWithFile, type FakeDam } from '@/domains/dam/__tests__/support/fakeDam'
import { rowState } from '@/domains/dam/__tests__/support/uploadQueueRow'
import { damUploadFinish } from '@/domains/dam/api/uploadApi'
import { defaultApiErrorLogger, setApiErrorLogger } from '@/domains/api/utils/apiErrors'
import { initCommonAdminCoreDamOptions } from '@/domains/dam/composables/commonAdminCoreDamOptions'
import { destroyDamNotifications, initDamNotifications } from '@/domains/dam/composables/damNotifications'
import {
  type DamNotification,
  DamNotificationName,
  type DamNotificationNameType,
  useDamNotificationsEventBus,
} from '@/domains/dam/composables/damNotificationsEventBus'
import { DamAssetType } from '@/domains/dam/types/Asset'
import { AssetFileFailReason, AssetFileProcessStatus } from '@/domains/dam/types/AssetFile'
import { UploadQueueItemStatus, UploadQueueItemType } from '@/domains/dam/types/UploadQueue'
import { useUploadQueueItemRefresh } from '@/domains/dam/uploadQueue/composables/uploadQueueItemRefresh'
import { useUploadQueueItemFactory } from '@/domains/dam/uploadQueue/factory/UploadQueueItemFactory'
import {
  type ManualScheduler,
  manualScheduler,
} from '@/domains/dam/uploadQueue/settlement/__tests__/support/manualScheduler'
import { uploadSettlementRuntime } from '@/domains/dam/uploadQueue/settlement/uploadSettlementRuntime'
import { useUploadQueuesStore } from '@/domains/dam/uploadQueue/store/uploadQueuesStore'
import { useAlertsQueue } from '@/domains/system/composables/alertsQueue'
import { commonT } from '@/plugins/i18n'

// Covers when the queue asks the DAM what became of the files it waits for (the queue poll), through the real store.
// It is the only way an upload settles where no notification comes, and it runs beside notifications where they do.
// The DAM is a recording client, the socket a stub of global `WebSocket`, and the queue time comes from a test clock.
// The rhythm and the settlement rules are tested in `settlement/__tests__`.

const QUEUE = 'poll-queue'
const { Uploading, Processing, Uploaded, Failed, Stop } = UploadQueueItemStatus
const SECOND = 1000
const MINUTE = 60 * SECOND

let dam: FakeDam
let clock: ManualScheduler
let socket: DamSocket

const realScheduler = uploadSettlementRuntime.scheduler
const realVisibility = uploadSettlementRuntime.visibility

const watchedTab = () => {
  let listeners = 0
  uploadSettlementRuntime.visibility = {
    isVisible: () => true,
    onChange: () => {
      listeners++
      return () => {
        listeners--
      }
    },
  }
  return { listeners: () => listeners }
}

const use = (profile: ConsumerProfile) => {
  setActivePinia(createPinia())
  dam = createFakeDam(profile.endPoints)
  installConsumerProfile(profile, dam.client)
  clock = manualScheduler()
  uploadSettlementRuntime.scheduler = clock
  socket = stubDamSocket()
  useAlertsQueue().value = []
}
afterEach(() => {
  // Runs before the clock of the next case: a timer is taken back on the clock of that moment.
  useUploadQueuesStore().stopUpload(QUEUE)
  destroyDamNotifications()
  uploadSettlementRuntime.scheduler = realScheduler
  uploadSettlementRuntime.visibility = realVisibility
  socket.restore()
  useDamNotificationsEventBus().reset()
})

const photo = (name = 'photo.jpg') => new File([new Uint8Array(3000)], name, { type: 'image/jpeg' })
const fromTheServer = {
  metadata: { customData: { description: 'from the server' }, authorSuggestions: {}, keywordSuggestions: {} },
  mainFileSingleUse: false,
  mainFileInternal: false,
}
const notify = (name: DamNotificationNameType, data: Record<string, unknown>) =>
  useDamNotificationsEventBus().emit({ name, data } as unknown as DamNotification)
/**
 * Real time, for what the upload does after an answer. The queue clock stands still meanwhile.
 */
const moment = () => new Promise<void>((resolve) => setTimeout(resolve, 50))
const readUrls = () => dam.assetReads().map((read) => read.url)
const warnings = () =>
  useAlertsQueue()
    .value.filter((alert) => alert.color === 'warning')
    .map((alert) => alert.text)
const REFRESH_FAILED = 'common.damImage.queueItem.refreshFailed'
const ASSET_GONE = 'common.damImage.queueItem.assetGone'
const ORIGINAL_UNREAD = 'common.damImage.queueItem.duplicateOriginalUnread'

const sentFile = async (profile: ConsumerProfile) => {
  const store = useUploadQueuesStore()
  await store.addByFiles(QUEUE, profile.extSystem, profile.licence, [photo()], 'default')
  const [item] = store.getQueueItems(QUEUE)
  await vi.waitFor(() => expect(item.status).toBe(Processing))
  await clock.settle()
  return item
}
const unreadable = (profile: ConsumerProfile) =>
  dam.reply((request) =>
    request.method === 'GET' && request.url.startsWith(profile.endPoints.asset) ? { status: 502 } : undefined
  )

describe.each(consumerProfiles)('the poll of an upload queue, under the $name', (profile) => {
  const { endPoints, extSystem, licence } = profile

  beforeEach(() => use(profile))

  it('asks about a sent file five seconds after it was sent, and settles it by what the read brings', async () => {
    const item = await sentFile(profile)
    dam.fileBecomes('asset-1', AssetFileProcessStatus.Processed, fromTheServer)

    await clock.advance(5 * SECOND - 1)
    expect(readUrls()).toEqual([])
    await clock.advance(1)

    expect(readUrls()).toEqual([`${endPoints.asset}/asset-1`])
    expect(item).toMatchObject({
      status: Uploaded,
      fileId: 'file-1',
      customData: { description: 'from the server' },
      canEditMetadata: true,
      error: { hasError: false, message: '' },
    })
    expect(clock.waiting()).toBe(0)
  })

  it('asks about every row that waits in one request, by the licence of the rows', async () => {
    const store = useUploadQueuesStore()
    await store.addByFiles(QUEUE, extSystem, licence, [photo('a.jpg'), photo('b.jpg')], 'default')
    const [first, second] = store.getQueueItems(QUEUE)
    await vi.waitFor(() => expect([first.status, second.status]).toEqual([Processing, Processing]))
    await clock.settle()
    dam.fileBecomes('asset-1', AssetFileProcessStatus.Processed, fromTheServer)
    dam.fileBecomes('asset-2', AssetFileProcessStatus.Processed, fromTheServer)

    await clock.advance(5 * SECOND)

    expect(readUrls()).toHaveLength(1)
    const [, readLicence, readIds] = readUrls()[0]!.match(dam.routes.byIds)!
    expect(readUrls()[0]!.startsWith(`${endPoints.asset}/licence/`)).toBe(true)
    expect([readLicence, readIds!.split(',').sort()]).toEqual([String(licence), ['asset-1', 'asset-2']])
    expect([first.status, second.status]).toEqual([Uploaded, Uploaded])
    expect([first.canEditMetadata, second.canEditMetadata]).toEqual([true, true])
    expect(dam.unanswered).toEqual([])
  })

  it('goes on asking while the file is not processed, less and less often', async () => {
    const item = await sentFile(profile)
    dam.fileBecomes('asset-1', AssetFileProcessStatus.Stored, fromTheServer)

    await clock.advance(MINUTE)
    expect(readUrls()).toHaveLength(8)
    await clock.advance(MINUTE)
    expect(readUrls()).toHaveLength(10)

    expect(item).toMatchObject({ status: Processing, canEditMetadata: false, error: { hasError: false } })
  })

  it('a read that fails leaves the row as it was, and is tried again fifteen seconds later', async () => {
    const item = await sentFile(profile)
    const before = rowState(item)
    const readable = unreadable(profile)

    await clock.advance(5 * SECOND)
    expect(readUrls()).toHaveLength(1)
    expect(rowState(item)).toEqual(before)

    readable()
    dam.fileBecomes('asset-1', AssetFileProcessStatus.Processed, fromTheServer)
    await clock.advance(15 * SECOND - 1)
    expect(readUrls()).toHaveLength(1)
    await clock.advance(1)

    expect(readUrls()).toHaveLength(2)
    expect(item.status).toBe(Uploaded)
  })

  it('says the data could not be loaded once three reads in a row have failed, until one answers', async () => {
    const item = await sentFile(profile)
    const readable = unreadable(profile)

    await clock.advance(20 * SECOND)
    expect(readUrls()).toHaveLength(2)
    expect(item.error).toMatchObject({ hasError: false, message: '' })
    await clock.advance(30 * SECOND)

    expect(readUrls()).toHaveLength(3)
    expect(item).toMatchObject({
      status: Processing,
      canEditMetadata: false,
      error: { hasError: true, message: commonT('common.damImage.uploadErrors.readFailed') },
    })

    readable()
    dam.fileBecomes('asset-1', AssetFileProcessStatus.Stored, fromTheServer)
    await clock.advance(MINUTE)

    expect(readUrls()).toHaveLength(4)
    expect(item).toMatchObject({ status: Processing, error: { hasError: false, message: '' } })
  })

  it('says the processing takes too long after twenty minutes, asks on, and settles the row when it is done', async () => {
    const item = await sentFile(profile)
    const store = useUploadQueuesStore()
    dam.fileBecomes('asset-1', AssetFileProcessStatus.Stored, fromTheServer)

    await clock.advance(20 * MINUTE - 1)
    expect(item.error).toMatchObject({ hasError: false, message: '' })
    await clock.advance(1)

    expect(item).toMatchObject({
      status: Processing,
      error: { hasError: true, message: commonT('common.damImage.uploadErrors.processingTooLong') },
    })
    expect(store.getQueueProcessedCount(QUEUE)).toBe(0)
    const reads = readUrls().length
    await clock.advance(10 * MINUTE)
    expect(readUrls().length).toBeGreaterThan(reads)

    dam.fileBecomes('asset-1', AssetFileProcessStatus.Processed, fromTheServer)
    await clock.advance(2 * MINUTE)

    expect(item).toMatchObject({ status: Uploaded, canEditMetadata: true, error: { hasError: false, message: '' } })
    expect(clock.waiting()).toBe(0)
  })

  it('fails the row with the text of an unknown error once its asset was missing from three reads', async () => {
    const item = await sentFile(profile)
    const store = useUploadQueuesStore()
    dam.assets.delete('asset-1')

    await clock.advance(10 * SECOND)
    expect(item.status).toBe(Processing)
    await clock.advance(6 * SECOND)

    expect(readUrls()).toHaveLength(3)
    expect(item).toMatchObject({
      status: Failed,
      canEditMetadata: false,
      error: { hasError: true, message: commonT('common.damImage.uploadErrors.unknownError') },
    })
    expect(store.getQueueProcessedCount(QUEUE)).toBe(store.getQueueTotalCount(QUEUE))
    expect(clock.waiting()).toBe(0)
  })

  // The read that misses the asset for the third time may be the user's refresh. The row fails as it
  // does by the poll, and no "try again" warning follows, because the row has no refresh left to press.
  it('fails the row the same when the third read to miss its asset is its refresh, without a word to try again', async () => {
    const item = await sentFile(profile)
    dam.assets.delete('asset-1')
    await clock.advance(10 * SECOND)
    expect([readUrls().length, item.status]).toEqual([2, Processing])

    await useUploadQueueItemRefresh('default').refreshItem('asset-1', item)

    expect(item).toMatchObject({
      status: Failed,
      error: { hasError: true, message: commonT('common.damImage.uploadErrors.unknownError') },
    })
    expect(warnings()).toEqual([])
    expect(clock.waiting()).toBe(0)
  })

  it('a refresh that misses the asset before that says the asset no longer exists, and the row waits on', async () => {
    const item = await sentFile(profile)
    dam.assets.delete('asset-1')
    await clock.advance(5 * SECOND)

    await useUploadQueueItemRefresh('default').refreshItem('asset-1', item)

    expect(item.status).toBe(Processing)
    expect(warnings()).toEqual([commonT(ASSET_GONE)])
  })

  // "Try again" is said to the user who pressed, about the row pressed. If that row ended
  // while its refresh was in flight, the word would refer to a refresh it no longer has.
  describe('and a refresh that fails while the row pressed ends', () => {
    // The tick's read is the third to miss the asset and gives the row up. The
    // refresh waits behind it and finds a row that is no longer asked about.
    it('says nothing when the tick it waited behind has given the row up', async () => {
      const item = await sentFile(profile)
      dam.assets.delete('asset-1')
      await clock.advance(10 * SECOND)
      const reads = dam.hold('GET', dam.routes.one)
      await clock.advance(6 * SECOND)
      expect([reads.waiting.length, item.status]).toEqual([1, Processing])

      const asked = vi.spyOn(useUploadQueuesStore(), 'refreshAsset')
      const pressed = useUploadQueueItemRefresh('default').refreshItem('asset-1', item)
      reads.release()
      await vi.waitFor(() => expect(reads.waiting).toHaveLength(1))
      expect(item.status).toBe(Failed)
      reads.release()
      await pressed

      expect(readUrls()).toHaveLength(4)
      expect(await asked.mock.results[0]!.value).toBe('missing')
      expect(warnings()).toEqual([])
    })

    // Two queues wait for one asset. The press is the third miss of the pressed row, which fails by it.
    // The other row has missed once and keeps waiting, so the refresh as a whole is not reported as settled.
    it('says nothing when the row pressed is given up by it while another row of the asset waits on', async () => {
      const OTHER = 'another-queue'
      const store = useUploadQueuesStore()
      // Also when the case fails: a queue left waiting would be polled during later cases.
      onTestFinished(() => store.stopUpload(OTHER))
      await store.addByCopyToLicence(QUEUE, extSystem, licence, ['asset-gone'], 'default')
      const [pressedRow] = store.getQueueItems(QUEUE)
      await clock.advance(10 * SECOND)
      await store.addByCopyToLicence(OTHER, extSystem, licence, ['asset-gone'], 'default')
      const [other] = store.getQueueItems(OTHER)
      expect([pressedRow.status, other.status]).toEqual([Processing, Processing])
      const asked = vi.spyOn(store, 'refreshAsset')

      await useUploadQueueItemRefresh('default').refreshItem('asset-gone', pressedRow)

      expect(await asked.mock.results[0]!.value).toBe('missing')
      expect([pressedRow.status, other.status]).toEqual([Failed, Processing])
      expect(warnings()).toEqual([])
    })

    // A waiting row taken out of its queue while its refresh is in flight is stopped. Read from
    // its status alone here, as by a caller that does not say which queue the row was pressed in.
    it('says nothing when the row pressed was stopped meanwhile, by being taken out of its queue', async () => {
      const store = useUploadQueuesStore()
      const item = await sentFile(profile)
      const reads = dam.hold('GET', dam.routes.one)
      const asked = vi.spyOn(store, 'refreshAsset')

      const pressed = useUploadQueueItemRefresh('default').refreshItem('asset-1', item)
      await vi.waitFor(() => expect(reads.waiting).toHaveLength(1))
      store.removeByIndex(QUEUE, 0)
      expect(item.status).toBe(Stop)
      reads.release({ status: 502 })
      await pressed

      expect(await asked.mock.results[0]!.value).toBe('error')
      expect(warnings()).toEqual([])
    })

    // The duplicate notification is not held behind the refresh read. It makes the row
    // the original, and the failing read has nothing to say about an uploaded row.
    it('says nothing when a duplicate notification has made the row pressed the original meanwhile', async () => {
      const store = useUploadQueuesStore()
      const item = await sentFile(profile)
      dam.assets.set(
        'asset-original',
        damAssetWithFile('asset-original', 'file-original', AssetFileProcessStatus.Processed, fromTheServer)
      )
      const reads = dam.hold('GET', dam.routes.one)
      const asked = vi.spyOn(store, 'refreshAsset')

      const pressed = useUploadQueueItemRefresh('default').refreshItem('asset-1', item, QUEUE)
      await vi.waitFor(() => expect(reads.waiting).toHaveLength(1))
      notify(DamNotificationName.AssetFileDuplicate, {
        asset: 'asset-1',
        originAssetFile: 'file-original',
        assetType: DamAssetType.Image,
      })
      await vi.waitFor(() => expect(item.status).toBe(Uploaded))
      reads.release({ status: 502 })
      await pressed

      expect(await asked.mock.results[0]!.value).toBe('error')
      expect(item).toMatchObject({ status: Uploaded, isDuplicate: true, assetId: 'asset-original' })
      expect(warnings()).toEqual([])
    })

    // Still being sent when pressed, waiting for the server when the
    // read fails. The row has not ended, so pressing again may help.
    it('says the state could not be loaded when the row only went on from being sent to waiting', async () => {
      const store = useUploadQueuesStore()
      const chunks = dam.hold('POST', dam.routes.chunk)
      await store.addByFiles(QUEUE, extSystem, licence, [photo()], 'default')
      const [item] = store.getQueueItems(QUEUE)
      await vi.waitFor(() => expect(chunks.waiting).toHaveLength(1))
      expect(item.status).toBe(Uploading)
      const reads = dam.hold('GET', dam.routes.one)

      const pressed = useUploadQueueItemRefresh('default').refreshItem(item.assetId!, item)
      await vi.waitFor(() => expect(reads.waiting).toHaveLength(1))
      chunks.release()
      await vi.waitFor(() => expect(item.status).toBe(Processing))
      reads.release({ status: 502 })
      await pressed

      expect(item.status).toBe(Processing)
      expect(warnings()).toEqual([commonT(REFRESH_FAILED)])
    })
  })

  describe('and a row taken out of the queue', () => {
    it.each([
      ['removed', () => useUploadQueuesStore().removeByIndex(QUEUE, 0)],
      ['stopped with the whole queue', () => useUploadQueuesStore().stopUpload(QUEUE)],
    ])('%s while it waits: no timer is left, and nothing is asked', async (_how, takeOut) => {
      const item = await sentFile(profile)
      expect(clock.waiting()).toBe(1)

      takeOut()

      expect(clock.waiting()).toBe(0)
      await clock.advance(MINUTE)
      expect(readUrls()).toEqual([])
      expect(item.status).toBe(Stop)
    })

    it('a queue emptied row by row and then closed gives up its listener for the tab', async () => {
      const tab = watchedTab()
      await sentFile(profile)
      const store = useUploadQueuesStore()
      store.removeByIndex(QUEUE, 0)
      expect([clock.waiting(), tab.listeners()]).toEqual([0, 1])

      store.stopUpload(QUEUE)

      expect(tab.listeners()).toBe(0)
    })

    it('removed while its read is on the way: the answer is not written, and nothing is asked after', async () => {
      const item = await sentFile(profile)
      const read = dam.hold('GET', dam.routes.one)
      dam.fileBecomes('asset-1', AssetFileProcessStatus.Processed, fromTheServer)
      await clock.advance(5 * SECOND)
      expect(read.waiting).toHaveLength(1)

      useUploadQueuesStore().removeByIndex(QUEUE, 0)
      read.release()
      await clock.settle()
      await clock.advance(MINUTE)

      expect(readUrls()).toHaveLength(1)
      expect(item).toMatchObject({ status: Stop, canEditMetadata: false, customData: {} })
      expect(clock.waiting()).toBe(0)
    })
  })

  describe('and the finish request of the upload', () => {
    const finishing = async () => {
      const store = useUploadQueuesStore()
      const finish = dam.hold('PATCH', dam.routes.finish)
      await store.addByFiles(QUEUE, extSystem, licence, [photo()], 'default')
      await vi.waitFor(() => expect(finish.waiting).toHaveLength(1))
      const [item] = store.getQueueItems(QUEUE)
      expect(item.status).toBe(Uploading)
      return { store, finish, item }
    }

    // The notification can beat the answer to the finish request.
    it('a row its processed notification has settled by then is not asked about', async () => {
      const { finish, item } = await finishing()
      dam.fileBecomes('asset-1', AssetFileProcessStatus.Processed, fromTheServer)

      notify(DamNotificationName.AssetFileProcessed, { asset: 'asset-1', id: 'file-1' })
      await clock.advance(SECOND)
      expect(item.status).toBe(Uploaded)
      finish.release()
      await moment()

      expect(item.status).toBe(Uploaded)
      expect(clock.waiting()).toBe(0)
      const reads = readUrls().length
      await clock.advance(MINUTE)
      expect(readUrls()).toHaveLength(reads)
    })

    it('a row its failed notification has failed by then stays failed, and is not asked about', async () => {
      const { finish, item } = await finishing()

      notify(DamNotificationName.AssetFileFailed, {
        asset: 'asset-1',
        id: 'file-1',
        failReason: AssetFileFailReason.InvalidChecksum,
      })
      finish.release()
      await moment()

      expect(item).toMatchObject({
        status: Failed,
        error: { hasError: true, assetFileFailReason: AssetFileFailReason.InvalidChecksum },
      })
      expect(clock.waiting()).toBe(0)
      await clock.advance(MINUTE)
      expect(readUrls()).toEqual([])
    })

    // The server takes a failed file nowhere from there, so nothing more
    // can be learnt about the row, whatever becomes of the request.
    it('a row its failed notification has failed, whose finish request then fails too, is not asked about', async () => {
      const { store, finish, item } = await finishing()

      notify(DamNotificationName.AssetFileFailed, {
        asset: 'asset-1',
        id: 'file-1',
        failReason: AssetFileFailReason.InvalidChecksum,
      })
      finish.release({ status: 502 })
      await moment()

      expect(item).toMatchObject({
        status: Failed,
        canEditMetadata: false,
        error: { hasError: true, message: '', assetFileFailReason: AssetFileFailReason.InvalidChecksum },
      })
      expect(store.getQueueProcessedCount(QUEUE)).toBe(store.getQueueTotalCount(QUEUE))
      expect(store.refreshMayHelp(item)).toBe(false)
      expect(clock.waiting()).toBe(0)
      await clock.advance(MINUTE)
      expect(readUrls()).toEqual([])
    })

    it('an upload stopped by then stays stopped, and is not asked about', async () => {
      const { store, finish, item } = await finishing()

      await store.stopItemUpload(QUEUE, item, 0)
      finish.release()
      await moment()

      expect(item.status).toBe(Stop)
      expect(store.getQueueItems(QUEUE)).toEqual([])
      expect(clock.waiting()).toBe(0)
      await clock.advance(MINUTE)
      expect(readUrls()).toEqual([])
    })

    // The request reached the server or it did not: the client cannot tell, so it asks.
    it('a row the client gave up on when it failed is asked about, and never told it takes too long', async () => {
      dam.reply((request) =>
        request.method === 'PATCH' && dam.routes.finish.test(request.url) ? { status: 502 } : undefined
      )
      const store = useUploadQueuesStore()
      await store.addByFiles(QUEUE, extSystem, licence, [photo()], 'default')
      const [item] = store.getQueueItems(QUEUE)
      await vi.waitFor(() => expect(item.status).toBe(Failed))
      await clock.settle()
      expect(store.refreshMayHelp(item)).toBe(true)

      await clock.advance(30 * MINUTE)
      expect(readUrls().length).toBeGreaterThan(8)
      expect(item).toMatchObject({ status: Failed, canEditMetadata: false, error: { hasError: true, message: '' } })
      expect(store.refreshMayHelp(item)).toBe(true)

      dam.fileBecomes('asset-1', AssetFileProcessStatus.Processed, fromTheServer)
      await clock.advance(2 * MINUTE)

      expect(item).toMatchObject({
        status: Uploaded,
        customData: { description: 'from the server' },
        canEditMetadata: true,
        error: { hasError: false, message: '' },
      })
      expect(store.refreshMayHelp(item)).toBe(false)
      expect(clock.waiting()).toBe(0)
    })

    const givenUpAtFinish = async () => {
      dam.reply((request) =>
        request.method === 'PATCH' && dam.routes.finish.test(request.url) ? { status: 502 } : undefined
      )
      const store = useUploadQueuesStore()
      await store.addByFiles(QUEUE, extSystem, licence, [photo()], 'default')
      const [item] = store.getQueueItems(QUEUE)
      await vi.waitFor(() => expect(item.status).toBe(Failed))
      await clock.settle()
      expect(store.refreshMayHelp(item)).toBe(true)
      return { store, item }
    }

    const finishEndsWith = async (end: () => { status: number; data?: unknown }) => {
      dam.reply((request) => (request.method === 'PATCH' && dam.routes.finish.test(request.url) ? end() : undefined))
      const store = useUploadQueuesStore()
      await store.addByFiles(QUEUE, extSystem, licence, [photo()], 'default')
      const [item] = store.getQueueItems(QUEUE)
      await vi.waitFor(() => expect(item.status).toBe(Failed))
      await clock.settle()
      return { store, item }
    }

    // The server answered and refused. The request is sent once:
    // a file the server refused to finish will not finish later.
    it.each([400, 404, 422])(
      'a row whose finish request the server refused with %i is final: not asked about, and with no refresh',
      async (status) => {
        const invalid = {
          contextId: 'context',
          error: 'validation_failed',
          fields: { checksum: ['error_field_invalid'] },
        }
        const { store, item } = await finishEndsWith(() => ({ status, data: status === 422 ? invalid : undefined }))

        expect(item).toMatchObject({
          status: Failed,
          assetId: 'asset-1',
          canEditMetadata: false,
          error: { hasError: true, message: '' },
        })
        expect(dam.sentTo('PATCH', dam.routes.finish)).toHaveLength(1)
        expect(store.getQueueProcessedCount(QUEUE)).toBe(store.getQueueTotalCount(QUEUE))
        expect(store.refreshMayHelp(item)).toBe(false)
        expect(clock.waiting()).toBe(0)
        await clock.advance(MINUTE)
        expect(readUrls()).toEqual([])
      }
    )

    // No answer, or a server failure: the request may have done its work anyway.
    it.each([
      ['answered with 500', () => ({ status: 500 })],
      ['answered with 503', () => ({ status: 503 })],
      // Not the 200 the client expects: it gives the row up without an error saying why.
      ['answered with 204', () => ({ status: 204 })],
      [
        'lost to a network error',
        () => {
          throw new axios.AxiosError('Network Error', axios.AxiosError.ERR_NETWORK)
        },
      ],
      [
        'timed out',
        () => {
          throw new axios.AxiosError('timeout of 420000ms exceeded', axios.AxiosError.ECONNABORTED)
        },
      ],
    ])('a row whose finish request was %s is asked about, and offers refresh', async (_how, end) => {
      const { store, item } = await finishEndsWith(end)

      expect(store.refreshMayHelp(item)).toBe(true)
      expect(clock.waiting()).toBe(1)

      dam.fileBecomes('asset-1', AssetFileProcessStatus.Processed, fromTheServer)
      await clock.advance(5 * SECOND)

      expect(readUrls()).toEqual([`${endPoints.asset}/asset-1`])
      expect(item).toMatchObject({ status: Uploaded, canEditMetadata: true, error: { hasError: false } })
    })

    // From then on nothing more can become of the file, so refresh is useless for the row.
    it.each([
      [
        'a read finds its file failed',
        async () => {
          dam.fileBecomes('asset-1', AssetFileProcessStatus.Failed, {}, { failReason: AssetFileFailReason.InvalidSize })
          await clock.advance(5 * SECOND)
        },
        AssetFileFailReason.InvalidSize,
      ],
      [
        'its failed notification comes',
        async () => {
          notify(DamNotificationName.AssetFileFailed, {
            asset: 'asset-1',
            id: 'file-1',
            failReason: AssetFileFailReason.InvalidSize,
          })
          await clock.settle()
        },
        AssetFileFailReason.InvalidSize,
      ],
      [
        'its asset is gone from three reads',
        async () => {
          dam.assets.delete('asset-1')
          await clock.advance(16 * SECOND)
        },
        AssetFileFailReason.None,
      ],
    ])(
      'a row the client gave up on is no longer one the server may finish once %s',
      async (_when, serverSays, reason) => {
        const { store, item } = await givenUpAtFinish()

        await serverSays()

        expect(item).toMatchObject({ status: Failed, error: { hasError: true, assetFileFailReason: reason } })
        expect(store.refreshMayHelp(item)).toBe(false)
        expect(clock.waiting()).toBe(0)
      }
    )

    // The asset exists, but the server never had the whole file, so nothing can
    // have become of it. Only a row whose finish request went out is asked about.
    it('a row that failed on a chunk, before its finish request went out, is not asked about', async () => {
      dam.reply((request) =>
        request.method === 'POST' && dam.routes.chunk.test(request.url)
          ? {
              status: 422,
              data: { contextId: 'context', error: 'validation_failed', fields: { size: ['error_field_invalid'] } },
            }
          : undefined
      )
      const store = useUploadQueuesStore()
      await store.addByFiles(QUEUE, extSystem, licence, [photo()], 'default')
      const [item] = store.getQueueItems(QUEUE)
      await vi.waitFor(() => expect(item.status).toBe(Failed))
      await clock.settle()

      expect(item.assetId).toBe('asset-1')
      expect(dam.sentTo('PATCH', dam.routes.finish)).toEqual([])
      expect(store.refreshMayHelp(item)).toBe(false)
      expect(clock.waiting()).toBe(0)
      await clock.advance(MINUTE)
      expect(readUrls()).toEqual([])
    })

    it('a row whose start request was refused has no asset, and is not asked about', async () => {
      dam.reply((request) =>
        request.method === 'POST' && dam.routes.start.test(request.url) ? { status: 503 } : undefined
      )
      const store = useUploadQueuesStore()
      await store.addByFiles(QUEUE, extSystem, licence, [photo()], 'default')
      const [item] = store.getQueueItems(QUEUE)
      await vi.waitFor(() => expect(item.status).toBe(Failed))
      await clock.settle()

      expect(item.assetId).toBeNull()
      expect(store.refreshMayHelp(item)).toBe(false)
      expect(clock.waiting()).toBe(0)
      await clock.advance(MINUTE)
      expect(readUrls()).toEqual([])
    })
  })
})

// A failed request is handed to the application logger (Sentry in admin-cms).
// The poll keeps asking while a row waits, so during an outage it would report the same failure at every read.
describe.each(consumerProfiles)('what is reported of the reads that fail, under the $name', (profile) => {
  const { endPoints, extSystem, licence } = profile
  const logged = vi.fn()
  const reported = () => logged.mock.calls.map(([, context]) => `${context.status} ${context.url}`)

  beforeEach(() => {
    use(profile)
    logged.mockClear()
    setApiErrorLogger(logged)
  })
  afterEach(() => setApiErrorLogger(defaultApiErrorLogger))

  it('one row: the first read that fails, none of those after it, and the first again once a read has answered', async () => {
    await sentFile(profile)
    const readable = unreadable(profile)

    await clock.advance(2 * MINUTE)
    expect(readUrls()).toHaveLength(4)
    expect(reported()).toEqual([`502 ${endPoints.asset}/asset-1`])
    expect(logged.mock.calls[0]![1]).toMatchObject({ system: 'coreDam', entity: 'asset' })

    readable()
    dam.fileBecomes('asset-1', AssetFileProcessStatus.Stored, fromTheServer)
    await clock.advance(5 * MINUTE)
    expect(readUrls().length).toBeGreaterThan(6)
    expect(reported()).toHaveLength(1)

    unreadable(profile)
    await clock.advance(5 * MINUTE)
    expect(reported()).toEqual([`502 ${endPoints.asset}/asset-1`, `502 ${endPoints.asset}/asset-1`])
  })

  it('two rows: the request for both reports its first failure, and no other', async () => {
    const store = useUploadQueuesStore()
    await store.addByFiles(QUEUE, extSystem, licence, [photo('a.jpg'), photo('b.jpg')], 'default')
    const [first, second] = store.getQueueItems(QUEUE)
    await vi.waitFor(() => expect([first.status, second.status]).toEqual([Processing, Processing]))
    await clock.settle()
    unreadable(profile)

    await clock.advance(2 * MINUTE)

    expect(readUrls()).toHaveLength(4)
    expect(reported()).toHaveLength(1)
    expect(reported()[0]).toMatch(new RegExp(`^502 ${endPoints.asset}/licence/${licence}/ids/asset-[12],asset-[12]$`))
    expect(logged.mock.calls[0]![1]).toMatchObject({ system: 'coreDam', entity: 'asset' })
  })

  it('two rows: the report names the request with the address of the client it went to', async () => {
    const sentTo = { baseURL: 'https://core-dam.test/api' }
    installConsumerProfile(profile, () => {
      const real = dam.client()
      return {
        ...real,
        get: (url: string, config?: AxiosRequestConfig) =>
          dam.routes.byIds.test(url)
            ? Promise.reject(
                new axios.AxiosError(
                  'Request failed with status code 502',
                  axios.AxiosError.ERR_BAD_RESPONSE,
                  { ...sentTo, url } as never,
                  undefined,
                  { status: 502, statusText: '', data: undefined, headers: {}, config: { ...sentTo, url } } as never
                )
              )
            : real.get(url, config),
      } as AxiosInstance
    })
    const store = useUploadQueuesStore()
    await store.addByFiles(QUEUE, extSystem, licence, [photo('a.jpg'), photo('b.jpg')], 'default')
    const [first, second] = store.getQueueItems(QUEUE)
    await vi.waitFor(() => expect([first.status, second.status]).toEqual([Processing, Processing]))
    await clock.settle()

    await clock.advance(5 * SECOND)

    expect(reported()).toHaveLength(1)
    expect(reported()[0]).toMatch(
      new RegExp(`^502 https://core-dam\\.test/api${endPoints.asset}/licence/${licence}/ids/asset-[12],asset-[12]$`)
    )
  })

  it('the refresh of a row reports each of its failures, whatever the poll has reported', async () => {
    const store = useUploadQueuesStore()
    await sentFile(profile)
    unreadable(profile)

    await clock.advance(5 * SECOND)
    expect(await store.refreshAsset('asset-1', 'default')).toBe('error')
    expect(await store.refreshAsset('asset-1', 'default')).toBe('error')
    await clock.advance(15 * SECOND)

    expect(readUrls()).toHaveLength(4)
    expect(reported()).toHaveLength(3)
  })

  it('an asset that is gone is reported once, not at each of the three reads that miss it', async () => {
    const item = await sentFile(profile)
    dam.assets.delete('asset-1')

    await clock.advance(16 * SECOND)

    expect(readUrls()).toHaveLength(3)
    expect(item.status).toBe(Failed)
    expect(reported()).toEqual([`404 ${endPoints.asset}/asset-1`])
  })

  it('nothing is reported of an upload whose reads all answer', async () => {
    const item = await sentFile(profile)
    dam.fileBecomes('asset-1', AssetFileProcessStatus.Stored, fromTheServer)
    await clock.advance(MINUTE)
    dam.fileBecomes('asset-1', AssetFileProcessStatus.Processed, fromTheServer)
    await clock.advance(MINUTE)

    expect(item.status).toBe(Uploaded)
    expect(logged).not.toHaveBeenCalled()
  })
})

// The poll is a backup for notifications where they exist, so it waits longer before it asks.
describe('the rhythm of the poll, by the notification socket of admin-cms', () => {
  beforeEach(() => use(cmsConfiguration))

  it('an open socket: the first read comes ten seconds after the file was sent', async () => {
    initDamNotifications().openConnection()
    socket.accept()
    await sentFile(cmsConfiguration)

    await clock.advance(10 * SECOND - 1)
    expect(readUrls()).toEqual([])
    await clock.advance(1)
    expect(readUrls()).toHaveLength(1)
  })

  it('a socket that only connects brings nothing yet: the first read comes at five seconds', async () => {
    initDamNotifications().openConnection()
    await sentFile(cmsConfiguration)

    await clock.advance(5 * SECOND)
    expect(readUrls()).toHaveLength(1)
  })

  it('a socket that closes while a row waits: the read comes as if there had been none', async () => {
    initDamNotifications().openConnection()
    socket.accept()
    await sentFile(cmsConfiguration)
    await clock.advance(SECOND)

    socket.sockets.at(-1)!.onclose?.(new CloseEvent('close'))
    await clock.advance(4 * SECOND - 1)
    expect(readUrls()).toEqual([])
    await clock.advance(1)
    expect(readUrls()).toHaveLength(1)
  })

  // The queue learns of the socket from the moment its first row waits.
  // That row is added from a component.
  it('a socket that closes once the component that added the row is gone: the queue still hears of it', async () => {
    initDamNotifications().openConnection()
    socket.accept()
    const store = useUploadQueuesStore()
    const component = effectScope()
    await component.run(() =>
      store.addByCopyToLicence(QUEUE, cmsConfiguration.extSystem, cmsConfiguration.licence, ['asset-copy'], 'default')
    )
    component.stop()
    await clock.advance(SECOND)

    socket.sockets.at(-1)!.onclose?.(new CloseEvent('close'))
    await clock.advance(4 * SECOND - 1)
    expect(readUrls()).toEqual([])
    await clock.advance(1)
    expect(readUrls()).toHaveLength(1)
  })

  it('a notification settles the row before the poll asks, and the poll then has nothing to ask', async () => {
    initDamNotifications().openConnection()
    socket.accept()
    const item = await sentFile(cmsConfiguration)
    dam.fileBecomes('asset-1', AssetFileProcessStatus.Processed, fromTheServer)

    socket.deliver(DamNotificationName.AssetFileProcessed, { asset: 'asset-1', id: 'file-1' })
    await clock.advance(SECOND)

    expect(item.status).toBe(Uploaded)
    expect(readUrls()).toEqual(['/adm/v1/asset/asset-1'])
    expect(clock.waiting()).toBe(0)
  })
})

// Disposed through pinia (`$dispose()`). The store's notification
// listener goes with its scope, and the rest must go too.
describe('an upload queue store that is disposed of', () => {
  beforeEach(() => use(cmsConfiguration))

  it('leaves nothing behind: no timer, no listener for the tab, and nothing is asked any more', async () => {
    const tab = watchedTab()
    initDamNotifications().openConnection()
    socket.accept()
    const item = await sentFile(cmsConfiguration)
    dam.fileBecomes('asset-1', AssetFileProcessStatus.Processed, fromTheServer)
    expect([clock.waiting(), tab.listeners()]).toEqual([1, 1])

    useUploadQueuesStore().$dispose()

    expect([clock.waiting(), tab.listeners()]).toEqual([0, 0])
    socket.sockets.at(-1)!.onclose?.(new CloseEvent('close'))
    notify(DamNotificationName.AssetFileProcessed, { asset: 'asset-1', id: 'file-1' })
    await clock.advance(MINUTE)

    expect(clock.waiting()).toBe(0)
    expect(readUrls()).toEqual([])
    expect(item.status).toBe(Processing)
  })
})

describe('an application that configures no notification service at all', () => {
  beforeEach(() => {
    use(ugcConfiguration)
    const { configs, apiTimeout, adminDomain } = ugcConfiguration.options(dam.client).coreDam!
    initCommonAdminCoreDamOptions({ configs, apiTimeout, adminDomain })
  })

  it('uploads all the same: no socket is opened, and the poll settles the file', async () => {
    initDamNotifications().openConnection()
    const item = await sentFile(ugcConfiguration)
    dam.fileBecomes('asset-1', AssetFileProcessStatus.Processed, fromTheServer)

    await clock.advance(5 * SECOND)

    expect(socket.sockets).toEqual([])
    expect(item).toMatchObject({ status: Uploaded, canEditMetadata: true })
    expect(dam.unanswered).toEqual([])
  })
})

describe('an asset copied to the licence', () => {
  const { extSystem, licence } = cmsConfiguration

  beforeEach(() => use(cmsConfiguration))

  const copied = async (asset = 'asset-copy') => {
    const store = useUploadQueuesStore()
    await store.addByCopyToLicence(QUEUE, extSystem, licence, [asset], 'default')
    return { store, item: store.getQueueItems(QUEUE).at(-1)! }
  }
  const copyProcessed = () =>
    dam.assets.set(
      'asset-copy',
      damAssetWithFile('asset-copy', 'file-copy', AssetFileProcessStatus.Processed, fromTheServer)
    )

  it('is asked about from the moment it is added, and ends up uploaded with its file', async () => {
    const { store, item } = await copied()
    copyProcessed()

    await clock.advance(5 * SECOND)

    // The image is built from the file id. Without it the copied item is dropped on confirm.
    expect(item).toMatchObject({ status: Uploaded, fileId: 'file-copy', canEditMetadata: true })
    expect(store.getQueueProcessedCount(QUEUE)).toBe(1)
    expect(clock.waiting()).toBe(0)
  })

  // The widget learns this from the answer to the copy request.
  // It tells the queue right after it adds the row.
  it('that the licence has already: the row becomes that asset at once, and nothing is asked about it later', async () => {
    dam.assets.set(
      'asset-there',
      damAssetWithFile('asset-there', 'file-there', AssetFileProcessStatus.Processed, fromTheServer)
    )
    const { store, item } = await copied('asset-there')

    await store.queueItemDuplicate('asset-there', 'file-there', DamAssetType.Image, 'default')

    expect(dam.originReads().map((read) => read.url)).toEqual(['/adm/v1/asset/asset-file/file-there'])
    expect(item).toMatchObject({
      status: Uploaded,
      isDuplicate: true,
      assetId: 'asset-there',
      fileId: 'file-there',
      canEditMetadata: true,
    })
    expect(clock.waiting()).toBe(0)
    await clock.advance(MINUTE)
    expect(readUrls()).toEqual([])
  })

  // An item's metadata is not its file. An item whose file notification is lost must not stay processing.
  it.each([
    [
      'its metadata notification',
      () => notify(DamNotificationName.AssetMetadataProcessed, { asset: 'asset-copy' }),
      true,
    ],
    [
      'a save in the asset detail',
      () => void useUploadQueuesStore().updateFromDetail({ id: 'asset-copy' } as never, 'default'),
      false,
    ],
  ])('is still asked about after %s', async (_name, loadMetadata, formOpen) => {
    const { item } = await copied()
    dam.assets.set(
      'asset-copy',
      damAssetWithFile('asset-copy', 'file-copy', AssetFileProcessStatus.Stored, fromTheServer)
    )

    loadMetadata()
    await clock.advance(3 * SECOND)
    expect(item).toMatchObject({
      status: Processing,
      customData: { description: 'from the server' },
      canEditMetadata: formOpen,
    })

    copyProcessed()
    await clock.advance(2 * SECOND)
    expect(item).toMatchObject({ status: Uploaded, fileId: 'file-copy', canEditMetadata: true })
  })

  it('shows no error left from before once it is settled, as a copy or as a duplicate', async () => {
    const { item: copy } = await copied()
    const { item: duplicate } = await copied('asset-duplicate')
    copy.error.hasError = true
    duplicate.error.hasError = true
    copyProcessed()
    dam.assets.set(
      'asset-original',
      damAssetWithFile('asset-original', 'file-original', AssetFileProcessStatus.Processed, fromTheServer)
    )

    notify(DamNotificationName.AssetFileCopied, { asset: 'asset-copy' })
    notify(DamNotificationName.AssetFileDuplicate, {
      asset: 'asset-duplicate',
      originAssetFile: 'file-original',
      assetType: DamAssetType.Image,
    })
    await clock.advance(SECOND)

    expect([copy.status, duplicate.status]).toEqual([Uploaded, Uploaded])
    expect([copy.error.hasError, duplicate.error.hasError]).toEqual([false, false])
  })
})

describe('a duplicate whose origin asset cannot be loaded', () => {
  const { extSystem, licence } = cmsConfiguration
  const rejections: unknown[] = []
  const onRejection = (event: PromiseRejectionEvent) => {
    rejections.push(event.reason)
    event.preventDefault()
  }

  let originReadable: () => void

  beforeEach(() => {
    use(cmsConfiguration)
    rejections.length = 0
    window.addEventListener('unhandledrejection', onRejection)
    originReadable = dam.reply((request) => (dam.routes.byFile.test(request.url) ? { status: 403 } : undefined))
  })
  afterEach(() => window.removeEventListener('unhandledrejection', onRejection))

  it('fails the item instead of throwing past the widget, and it is asked about no more', async () => {
    const store = useUploadQueuesStore()
    await store.addByCopyToLicence(QUEUE, extSystem, licence, ['asset-1'], 'default')

    await expect(store.queueItemDuplicate('asset-1', 'file-1', DamAssetType.Image, 'default')).resolves.toBeUndefined()

    const item = store.getQueueItems(QUEUE)[0]!
    expect(item).toMatchObject({ status: Failed, canEditMetadata: false, error: { hasError: true } })
    expect(store.getQueueProcessedCount(QUEUE)).toBe(store.getQueueTotalCount(QUEUE))
    expect(clock.waiting()).toBe(0)
  })

  // The row failed because a read failed, not because of its file.
  // Nothing asks again by itself, so the row offers a refresh.
  it('leaves a copy the licence has already with its refresh, which settles the row from its asset', async () => {
    const store = useUploadQueuesStore()
    dam.assets.set('asset-1', damAssetWithFile('asset-1', 'file-1', AssetFileProcessStatus.Processed, fromTheServer))
    await store.addByCopyToLicence(QUEUE, extSystem, licence, ['asset-1'], 'default')
    const [item] = store.getQueueItems(QUEUE)

    await store.queueItemDuplicate('asset-1', 'file-1', DamAssetType.Image, 'default')
    expect([item.status, store.refreshMayHelp(item)]).toEqual([Failed, true])

    expect(await store.refreshAsset('asset-1', 'default')).toBe('settled')

    expect(item).toMatchObject({
      status: Uploaded,
      assetId: 'asset-1',
      fileId: 'file-1',
      customData: { description: 'from the server' },
      canEditMetadata: true,
      error: { hasError: false, message: '' },
    })
    expect(store.refreshMayHelp(item)).toBe(false)
  })

  // The finish request failed in the browser, but the server has the file and finds it a duplicate.
  it('leaves an upload the client gave up on with its refresh, which makes the row the original once that can be read', async () => {
    dam.reply((request) =>
      request.method === 'PATCH' && dam.routes.finish.test(request.url) ? { status: 502 } : undefined
    )
    const store = useUploadQueuesStore()
    await store.addByFiles(QUEUE, extSystem, licence, [photo()], 'default')
    const [item] = store.getQueueItems(QUEUE)
    await vi.waitFor(() => expect(item.status).toBe(Failed))
    await clock.settle()
    dam.fileBecomes('asset-1', AssetFileProcessStatus.Duplicate, {}, { originAssetFile: 'file-original' })
    dam.assets.set(
      'asset-original',
      damAssetWithFile('asset-original', 'file-original', AssetFileProcessStatus.Processed, fromTheServer)
    )

    await clock.advance(5 * SECOND)
    expect(dam.originReads()).toHaveLength(1)
    expect([item.status, item.isDuplicate, store.refreshMayHelp(item)]).toEqual([Failed, false, true])
    expect(clock.waiting()).toBe(0)

    expect(await store.refreshAsset('asset-1', 'default')).toBe('originalUnread')
    expect([item.status, store.refreshMayHelp(item)]).toEqual([Failed, true])

    originReadable()
    expect(await store.refreshAsset('asset-1', 'default')).toBe('settled')

    expect(item).toMatchObject({
      status: Uploaded,
      isDuplicate: true,
      assetId: 'asset-original',
      fileId: 'file-original',
      canEditMetadata: true,
      error: { hasError: false, message: '' },
    })
    expect(store.refreshMayHelp(item)).toBe(false)
  })

  // The file is a settled duplicate and the row is not.
  // The user who pressed refresh is told why.
  it('tells the one who pressed refresh that the original could not be read while it cannot, and nothing once it can', async () => {
    const store = useUploadQueuesStore()
    const item = await sentFile(cmsConfiguration)
    dam.fileBecomes('asset-1', AssetFileProcessStatus.Duplicate, {}, { originAssetFile: 'file-original' })
    dam.assets.set(
      'asset-original',
      damAssetWithFile('asset-original', 'file-original', AssetFileProcessStatus.Processed, fromTheServer)
    )
    await clock.advance(5 * SECOND)
    expect([item.status, store.refreshMayHelp(item), warnings()]).toEqual([Failed, true, []])
    const { refreshItem } = useUploadQueueItemRefresh('default')

    await refreshItem('asset-1', item)

    expect(warnings()).toEqual([commonT(ORIGINAL_UNREAD)])
    expect([item.status, store.refreshMayHelp(item)]).toEqual([Failed, true])

    originReadable()
    await refreshItem('asset-1', item)

    expect(item).toMatchObject({ status: Uploaded, isDuplicate: true, assetId: 'asset-original' })
    expect(store.refreshMayHelp(item)).toBe(false)
    expect(warnings()).toHaveLength(1)
  })

  // The press itself fails the row: no tick has asked yet, and refresh is the read that finds the duplicate.
  // The row keeps its refresh, which asks for the original again.
  // The message follows that, not the change of the row's state.
  it('tells the one whose press of refresh is what fails the row for want of the original why, as the row keeps its refresh', async () => {
    const store = useUploadQueuesStore()
    const item = await sentFile(cmsConfiguration)
    dam.fileBecomes('asset-1', AssetFileProcessStatus.Duplicate, {}, { originAssetFile: 'file-original' })

    const asked = vi.spyOn(store, 'refreshAsset')

    await useUploadQueueItemRefresh('default').refreshItem('asset-1', item)

    expect(await asked.mock.results[0]!.value).toBe('originalUnread')
    expect([item.status, store.refreshMayHelp(item)]).toEqual([Failed, true])
    expect(dam.originReads()).toHaveLength(1)
    expect(warnings()).toEqual([commonT(ORIGINAL_UNREAD)])
  })

  it('says why to a caller that names no row, also when the row failed by it', async () => {
    const item = await sentFile(cmsConfiguration)
    dam.fileBecomes('asset-1', AssetFileProcessStatus.Duplicate, {}, { originAssetFile: 'file-original' })

    await useUploadQueueItemRefresh('default').refreshItem('asset-1')

    expect(item.status).toBe(Failed)
    expect(warnings()).toEqual([commonT(ORIGINAL_UNREAD)])
  })

  // A failed row keeps its status when it is taken out of the queue.
  // Only its queue shows it is gone, and "try again" would be said about a row nobody sees.
  it.each([
    ['taken out of its queue meanwhile: nothing is said', true, []],
    ['still in its queue: the state could not be loaded', false, [REFRESH_FAILED]],
  ])('a refresh of a failed row whose read fails, the row %s', async (_what, removed, said) => {
    const store = useUploadQueuesStore()
    const item = await sentFile(cmsConfiguration)
    dam.fileBecomes('asset-1', AssetFileProcessStatus.Duplicate, {}, { originAssetFile: 'file-original' })
    await clock.advance(5 * SECOND)
    expect([item.status, store.refreshMayHelp(item)]).toEqual([Failed, true])
    const reads = dam.hold('GET', dam.routes.one)

    const pressed = useUploadQueueItemRefresh('default').refreshItem('asset-1', item, QUEUE)
    await vi.waitFor(() => expect(reads.waiting).toHaveLength(1))
    if (removed) store.removeByIndex(QUEUE, 0)
    reads.release({ status: 502 })
    await pressed

    expect(item.status).toBe(Failed)
    expect(store.getQueueItems(QUEUE)).toHaveLength(removed ? 0 : 1)
    expect(warnings()).toEqual(said.map((key) => commonT(key)))
  })

  it('leaves an upload that waited for the server with its refresh too, until the server fails the file', async () => {
    const store = useUploadQueuesStore()
    const item = await sentFile(cmsConfiguration)
    dam.fileBecomes('asset-1', AssetFileProcessStatus.Duplicate, {}, { originAssetFile: 'file-original' })

    await clock.advance(5 * SECOND)
    expect([item.status, store.refreshMayHelp(item)]).toEqual([Failed, true])

    dam.fileBecomes('asset-1', AssetFileProcessStatus.Failed, {}, { failReason: AssetFileFailReason.InvalidSize })
    expect(await store.refreshAsset('asset-1', 'default')).toBe('settled')

    expect(item).toMatchObject({ status: Failed, error: { assetFileFailReason: AssetFileFailReason.InvalidSize } })
    expect(store.refreshMayHelp(item)).toBe(false)
  })

  it('fails the item when the duplicate notification leads there, with no unhandled rejection', async () => {
    const store = useUploadQueuesStore()
    await store.addByCopyToLicence(QUEUE, extSystem, licence, ['asset-1'], 'default')

    notify(DamNotificationName.AssetFileDuplicate, {
      asset: 'asset-1',
      originAssetFile: 'file-1',
      assetType: DamAssetType.Image,
    })
    await vi.waitFor(() => expect(store.getQueueItems(QUEUE)[0]!.status).toBe(Failed))
    await moment()

    expect(rejections).toEqual([])
  })
})

describe('the answer to the finish request', () => {
  const { endPoints } = ugcConfiguration

  beforeEach(() => use(ugcConfiguration))

  const sending = () => {
    const item = useUploadQueueItemFactory().createDefault(
      'k',
      UploadQueueItemType.File,
      Uploading,
      DamAssetType.Image,
      1024,
      1
    )
    item.assetId = 'asset-1'
    item.fileId = 'file-1'
    return item
  }

  it('turns a row that is being sent into one that waits for the server', async () => {
    const item = sending()

    await damUploadFinish(dam.client, endPoints.image, item, 'sha')

    expect(item.status).toBe(Processing)
    expect(dam.requests.map((request) => `${request.method} ${request.url}`)).toEqual([
      'PATCH /ugc/v1/image/file-1/uploaded',
    ])
  })

  // A stop while the request ran leaves nothing to cancel. A notification can beat the answer.
  it.each([Stop, Uploaded, Failed])('leaves a row that is %s by then as it is', async (settled) => {
    const finish = dam.hold('PATCH', dam.routes.finish)
    const item = sending()

    const finished = damUploadFinish(dam.client, endPoints.image, item, 'sha')
    await vi.waitFor(() => expect(finish.waiting).toHaveLength(1))
    item.status = settled
    finish.release()
    await finished

    expect(item.status).toBe(settled)
  })
})
