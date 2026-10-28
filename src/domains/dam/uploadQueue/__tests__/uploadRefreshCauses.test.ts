import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { reactive } from 'vue'
import {
  type ConsumerProfile,
  consumerProfiles,
  installConsumerProfile,
} from '@/domains/dam/__tests__/support/consumerProfiles'
import { type DamSocket, stubDamSocket } from '@/domains/dam/__tests__/support/damSocket'
import { createFakeDam, type FakeDam, type FakeDamAnswer } from '@/domains/dam/__tests__/support/fakeDam'
import { destroyDamNotifications } from '@/domains/dam/composables/damNotifications'
import {
  type DamNotification,
  DamNotificationName,
  type DamNotificationNameType,
  useDamNotificationsEventBus,
} from '@/domains/dam/composables/damNotificationsEventBus'
import { DamAssetType } from '@/domains/dam/types/Asset'
import { AssetFileFailReason, AssetFileProcessStatus } from '@/domains/dam/types/AssetFile'
import { type UploadQueueItem, UploadQueueItemStatus, UploadQueueItemType } from '@/domains/dam/types/UploadQueue'
import type { UploadQueueListBinding } from '@/domains/dam/uploadQueue/components/uploadQueueBindings'
import type { UploadRefreshOutcome } from '@/domains/dam/uploadQueue/settlement/uploadSettlementTypes'
import {
  createUploadQueueItemRefresh,
  useUploadQueueItemRefresh,
} from '@/domains/dam/uploadQueue/composables/uploadQueueItemRefresh'
import { useUploadQueueItemFactory } from '@/domains/dam/uploadQueue/factory/UploadQueueItemFactory'
import {
  type ManualScheduler,
  manualScheduler,
} from '@/domains/dam/uploadQueue/settlement/__tests__/support/manualScheduler'
import { uploadSettlementRuntime } from '@/domains/dam/uploadQueue/settlement/uploadSettlementRuntime'
import { useUploadQueuesStore } from '@/domains/dam/uploadQueue/store/uploadQueuesStore'
import { useAlertsQueue } from '@/domains/system/composables/alertsQueue'
import { commonT } from '@/plugins/i18n'

// Covers what "Refresh" says when it cannot settle a row, by cause:
// read failed, asset gone, or original of a duplicate unreadable.
// It says it while pressing again may still help the row, not by whether its state changed.
// An uploaded row without metadata whose asset is gone counts misses like any row and fails at the limit.
// Uses the real store, as in `uploadStatusPolling.test.ts`.

const QUEUE = 'refresh-queue'
const { Processing, Uploaded, Failed } = UploadQueueItemStatus
const SECOND = 1000

const REFRESH_FAILED = 'common.damImage.queueItem.refreshFailed'
const ASSET_GONE = 'common.damImage.queueItem.assetGone'
const ORIGINAL_UNREAD = 'common.damImage.queueItem.duplicateOriginalUnread'

let dam: FakeDam
let clock: ManualScheduler
let socket: DamSocket

const realScheduler = uploadSettlementRuntime.scheduler

const use = (profile: ConsumerProfile) => {
  setActivePinia(createPinia())
  dam = createFakeDam(profile.endPoints)
  installConsumerProfile(profile, dam.client)
  clock = manualScheduler()
  uploadSettlementRuntime.scheduler = clock
  socket = stubDamSocket()
  useAlertsQueue().value = []
}

const photo = () => new File([new Uint8Array(3000)], 'photo.jpg', { type: 'image/jpeg' })
const fromTheServer = {
  metadata: { customData: { description: 'from the server' }, authorSuggestions: {}, keywordSuggestions: {} },
  mainFileSingleUse: false,
  mainFileInternal: false,
}
const notify = (name: DamNotificationNameType, data: Record<string, unknown>) =>
  useDamNotificationsEventBus().emit({ name, data } as unknown as DamNotification)
const warnings = () =>
  useAlertsQueue()
    .value.filter((alert) => alert.color === 'warning')
    .map((alert) => alert.text)
const said = (...keys: string[]) => keys.map((key) => commonT(key))

describe.each(consumerProfiles)('what the refresh of a row says, under the $name', (profile) => {
  const { endPoints, extSystem, licence } = profile

  beforeEach(() => use(profile))
  afterEach(() => {
    // Runs before the clock of the next case: a timer is taken back on the clock of that moment.
    useUploadQueuesStore().stopUpload(QUEUE)
    destroyDamNotifications()
    uploadSettlementRuntime.scheduler = realScheduler
    socket.restore()
    useDamNotificationsEventBus().reset()
  })

  const sentFile = async () => {
    const store = useUploadQueuesStore()
    await store.addByFiles(QUEUE, extSystem, licence, [photo()], 'default')
    const [item] = store.getQueueItems(QUEUE)
    await vi.waitFor(() => expect(item!.status).toBe(Processing))
    await clock.settle()
    return item!
  }
  const uploadedWithoutMetadata = async () => {
    const item = await sentFile()
    dam.fileBecomes('asset-1', AssetFileProcessStatus.Processed, fromTheServer)
    notify(DamNotificationName.AssetFileProcessed, { asset: 'asset-1', id: 'file-1' })
    await clock.advance(SECOND)
    expect([item.status, item.canEditMetadata]).toEqual([Uploaded, false])
    return item
  }
  const failReason = AssetFileFailReason.InvalidMimeType
  const unreadable = () =>
    dam.reply((request) =>
      request.method === 'GET' && request.url.startsWith(endPoints.asset) ? { status: 502 } : undefined
    )

  describe('why it could not settle the row', () => {
    it('the asset was not found: says the asset no longer exists, and the row waits on', async () => {
      const store = useUploadQueuesStore()
      const item = await sentFile()
      dam.assets.delete('asset-1')
      const asked = vi.spyOn(store, 'refreshAsset')

      await useUploadQueueItemRefresh('default').refreshItem('asset-1', item, QUEUE)

      expect(await asked.mock.results[0]!.value).toBe('missing')
      expect(item.status).toBe(Processing)
      expect(warnings()).toEqual(said(ASSET_GONE))
    })

    it('the original of its duplicate could not be read: says so to the row it failed, which keeps its refresh', async () => {
      const store = useUploadQueuesStore()
      const item = await sentFile()
      dam.reply((request) => (dam.routes.byFile.test(request.url) ? { status: 502 } : undefined))
      dam.fileBecomes('asset-1', AssetFileProcessStatus.Duplicate, {}, { originAssetFile: 'file-original' })
      const asked = vi.spyOn(store, 'refreshAsset')

      await useUploadQueueItemRefresh('default').refreshItem('asset-1', item, QUEUE)

      expect(await asked.mock.results[0]!.value).toBe('originalUnread')
      expect([item.status, store.refreshMayHelp(item)]).toEqual([Failed, true])
      expect(warnings()).toEqual(said(ORIGINAL_UNREAD))
    })
  })

  describe('an uploaded row still without its metadata, whose asset is gone', () => {
    it('is told so at its refresh, and fails with that text at the third read that misses it, with no refresh left', async () => {
      const store = useUploadQueuesStore()
      const item = await uploadedWithoutMetadata()
      dam.assets.delete('asset-1')
      const { refreshItem } = useUploadQueueItemRefresh('default')

      await refreshItem('asset-1', item, QUEUE)
      await refreshItem('asset-1', item, QUEUE)
      expect([item.status, warnings()]).toEqual([Uploaded, said(ASSET_GONE, ASSET_GONE)])

      await refreshItem('asset-1', item, QUEUE)

      expect(item).toMatchObject({
        status: Failed,
        canEditMetadata: false,
        error: { hasError: true, message: commonT(ASSET_GONE) },
      })
      expect(store.refreshMayHelp(item)).toBe(false)
      expect(warnings()).toHaveLength(2)
      expect(store.getQueueProcessedCount(QUEUE)).toBe(store.getQueueTotalCount(QUEUE))
    })

    it('counts the reads its metadata notification asks for as well: the third that misses fails it, and nobody is told', async () => {
      const item = await uploadedWithoutMetadata()
      dam.assets.delete('asset-1')

      notify(DamNotificationName.AssetMetadataProcessed, { asset: 'asset-1' })
      await clock.advance(50 * SECOND)

      expect(dam.assetReads()).toHaveLength(4)
      expect(item).toMatchObject({ status: Failed, error: { hasError: true, message: commonT(ASSET_GONE) } })
      expect(warnings()).toEqual([])
      expect(clock.waiting()).toBe(0)
    })
  })

  describe('a failed row', () => {
    // The server failed its file: no refresh may change it, and the row shows its failure itself.
    it('that its refresh cannot help is told nothing when the read fails', async () => {
      const store = useUploadQueuesStore()
      const item = await sentFile()
      notify(DamNotificationName.AssetFileFailed, { asset: 'asset-1', failReason })
      await vi.waitFor(() => expect(item.status).toBe(Failed))
      expect(store.refreshMayHelp(item)).toBe(false)
      unreadable()

      await useUploadQueueItemRefresh('default').refreshItem('asset-1', item, QUEUE)

      expect(item.status).toBe(Failed)
      expect(warnings()).toEqual([])
    })

    // A duplicate notification fails the row while its refresh read is in flight, because the original is unreadable.
    // The read answers about the file as it was before. The failed row shows what became of it.
    it.each<[string, FakeDamAnswer | undefined]>([
      ['the file is not processed yet', undefined],
      ['the read failed', { status: 502 }],
    ])(
      'that a duplicate notification failed while its refresh read was on its way is not told %s',
      async (_what, answer) => {
        const store = useUploadQueuesStore()
        const item = await sentFile()
        dam.fileBecomes('asset-1', AssetFileProcessStatus.Stored)
        dam.reply((request) => (dam.routes.byFile.test(request.url) ? { status: 502 } : undefined))
        const reads = dam.hold('GET', dam.routes.one)

        const pressed = useUploadQueueItemRefresh('default').refreshItem('asset-1', item, QUEUE)
        await vi.waitFor(() => expect(reads.waiting).toHaveLength(1))
        notify(DamNotificationName.AssetFileDuplicate, {
          asset: 'asset-1',
          originAssetFile: 'file-original',
          assetType: DamAssetType.Image,
        })
        await vi.waitFor(() => expect([item.status, store.refreshMayHelp(item)]).toEqual([Failed, true]))
        reads.release(answer)
        await pressed

        expect(warnings()).toEqual([])
      }
    )

    it('that loses its refresh while the read is on its way is not told to try again', async () => {
      dam.reply((request) =>
        request.method === 'PATCH' && dam.routes.finish.test(request.url) ? { status: 502 } : undefined
      )
      const store = useUploadQueuesStore()
      await store.addByFiles(QUEUE, extSystem, licence, [photo()], 'default')
      const [item] = store.getQueueItems(QUEUE)
      await vi.waitFor(() => expect(item!.status).toBe(Failed))
      await clock.settle()
      expect(store.refreshMayHelp(item!)).toBe(true)
      const reads = dam.hold('GET', dam.routes.one)

      const pressed = useUploadQueueItemRefresh('default').refreshItem('asset-1', item, QUEUE)
      await vi.waitFor(() => expect(reads.waiting).toHaveLength(1))
      notify(DamNotificationName.AssetFileFailed, { asset: 'asset-1', failReason })
      await vi.waitFor(() => expect(store.refreshMayHelp(item!)).toBe(false))
      reads.release({ status: 502 })
      await pressed

      expect(item!.status).toBe(Failed)
      expect(warnings()).toEqual([])
    })
  })
})

// A host whose rows settle on the event (admin-dam): the processed notification
// makes the row uploaded, without its form, while the refresh read is in flight.
// The read answers about the file as it was before.
describe('the refresh of a row of a bound list that turns uploaded while it reads', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it.each<UploadRefreshOutcome>(['pending', 'error', 'missing'])(
    'says nothing of a read that answers %s',
    async (outcome) => {
      const row = reactive(
        useUploadQueueItemFactory().createDefault('a', UploadQueueItemType.File, Processing, DamAssetType.Image, 1, 1)
      ) as UploadQueueItem
      row.assetId = 'asset-of-a'
      const asked: string[] = []
      const binding: Pick<UploadQueueListBinding, 'items' | 'refresh' | 'refreshMayHelp' | 'warn'> = {
        items: () => [row],
        refresh: async () => {
          row.status = Uploaded
          return outcome
        },
        refreshMayHelp: () => false,
        warn: (key) => asked.push(key),
      }

      await createUploadQueueItemRefresh(binding).refreshItem(row)

      expect([row.status, row.canEditMetadata]).toEqual([Uploaded, false])
      expect(asked).toEqual([])
    }
  )
})

describe('the refresh of a failed row of a bound list', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it.each([
    ['may still help it is told the state could not be loaded', true, [REFRESH_FAILED]],
    ['cannot help it any more is told nothing', false, []],
  ])('a row whose refresh %s', async (_what, mayHelp, warned) => {
    const failed = reactive(
      useUploadQueueItemFactory().createDefault('a', UploadQueueItemType.File, Failed, DamAssetType.Image, 1, 1)
    ) as UploadQueueItem
    failed.assetId = 'asset-of-a'
    const asked: string[] = []
    const binding: Pick<UploadQueueListBinding, 'items' | 'refresh' | 'refreshMayHelp' | 'warn'> = {
      items: () => [failed],
      refresh: async () => 'error',
      refreshMayHelp: () => mayHelp,
      warn: (key) => asked.push(key),
    }

    await createUploadQueueItemRefresh(binding).refreshItem(failed)

    expect(asked).toEqual(warned)
  })
})
