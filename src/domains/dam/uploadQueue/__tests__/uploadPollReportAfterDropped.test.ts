import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import axios, { type AxiosInstance, type AxiosRequestConfig } from 'axios'
import { createPinia, setActivePinia } from 'pinia'
import { defaultApiErrorLogger, setApiErrorLogger } from '@/domains/api/utils/apiErrors'
import {
  type ConsumerProfile,
  consumerProfiles,
  installConsumerProfile,
} from '@/domains/dam/__tests__/support/consumerProfiles'
import { type DamSocket, stubDamSocket } from '@/domains/dam/__tests__/support/damSocket'
import { createFakeDam, type FakeDam } from '@/domains/dam/__tests__/support/fakeDam'
import { destroyDamNotifications } from '@/domains/dam/composables/damNotifications'
import {
  type DamNotification,
  DamNotificationName,
  type DamNotificationNameType,
  useDamNotificationsEventBus,
} from '@/domains/dam/composables/damNotificationsEventBus'
import { AssetFileProcessStatus } from '@/domains/dam/types/AssetFile'
import { UploadQueueItemStatus } from '@/domains/dam/types/UploadQueue'
import {
  type ManualScheduler,
  manualScheduler,
} from '@/domains/dam/uploadQueue/settlement/__tests__/support/manualScheduler'
import { uploadSettlementRuntime } from '@/domains/dam/uploadQueue/settlement/uploadSettlementRuntime'
import { useUploadQueuesStore } from '@/domains/dam/uploadQueue/store/uploadQueuesStore'
import { useAlertsQueue } from '@/domains/system/composables/alertsQueue'

// What is reported of the reads the queue makes while it waits for the server: the first failure of a series,
// and only one the error logger writes down. A failure it drops -- a timeout, a 401, a 403 -- has told nobody: a
// later one it would write is reported all the same, and the series begins there. Through the real store, as in
// `uploadStatusPolling.test.ts`; the DAM is a client that records its requests and times out where it is told.

const QUEUE = 'report-queue'
const { Processing, Uploaded } = UploadQueueItemStatus
const SECOND = 1000
const MINUTE = 60 * SECOND

let dam: FakeDam
let clock: ManualScheduler
let socket: DamSocket
// While set, a read of an asset runs out of time on its way, as axios rejects such a request.
let timingOut = false
let timedOut = 0
const logged = vi.fn()
const reported = () => logged.mock.calls.map(([, context]) => `${context.status} ${context.url}`)

const realScheduler = uploadSettlementRuntime.scheduler

const use = (profile: ConsumerProfile) => {
  setActivePinia(createPinia())
  dam = createFakeDam(profile.endPoints)
  timingOut = false
  timedOut = 0
  const timesOut = (config: AxiosRequestConfig) =>
    timingOut && (config.method ?? 'GET').toUpperCase() === 'GET' && !!config.url?.startsWith(profile.endPoints.asset)
  const timeout = (config: AxiosRequestConfig) => {
    timedOut++
    return Promise.reject(
      new axios.AxiosError('timeout of 30000ms exceeded', axios.AxiosError.ECONNABORTED, config as never)
    )
  }
  installConsumerProfile(profile, () => {
    const real = dam.client()
    return {
      ...real,
      request: (config: AxiosRequestConfig) => (timesOut(config) ? timeout(config) : real.request(config)),
      get: (url: string, config: AxiosRequestConfig = {}) =>
        timesOut({ ...config, url }) ? timeout({ ...config, url }) : real.get(url, config),
    } as AxiosInstance
  })
  clock = manualScheduler()
  uploadSettlementRuntime.scheduler = clock
  socket = stubDamSocket()
  useAlertsQueue().value = []
  logged.mockClear()
  setApiErrorLogger(logged)
}
afterEach(() => {
  // Before the clock of the next case: a timer is taken back on the clock of that moment.
  useUploadQueuesStore().stopUpload(QUEUE)
  destroyDamNotifications()
  uploadSettlementRuntime.scheduler = realScheduler
  socket.restore()
  useDamNotificationsEventBus().reset()
  setApiErrorLogger(defaultApiErrorLogger)
})

const photo = (name = 'photo.jpg') => new File([new Uint8Array(3000)], name, { type: 'image/jpeg' })
const fromTheServer = {
  metadata: { customData: { description: 'from the server' }, authorSuggestions: {}, keywordSuggestions: {} },
  mainFileSingleUse: false,
  mainFileInternal: false,
}
const notify = (name: DamNotificationNameType, data: Record<string, unknown>) =>
  useDamNotificationsEventBus().emit({ name, data } as unknown as DamNotification)

/** Every read of an asset is answered so, from now on, until the returned function takes it back. */
const readsAnswer = (profile: ConsumerProfile, status: number) =>
  dam.reply((request) =>
    request.method === 'GET' && request.url.startsWith(profile.endPoints.asset) ? { status } : undefined
  )

describe.each(consumerProfiles)('a series of failed reads that begins quietly, under the $name', (profile) => {
  const { endPoints, extSystem, licence } = profile

  beforeEach(() => use(profile))

  /** The files, sent whole: their rows wait for the server, `asset-1` and on. */
  const sentFiles = async (...names: string[]) => {
    const store = useUploadQueuesStore()
    await store.addByFiles(QUEUE, extSystem, licence, names.map(photo), 'default')
    const items = store.getQueueItems(QUEUE)
    await vi.waitFor(() => expect(items.map((item) => item.status)).toEqual(names.map(() => Processing)))
    await clock.settle()
    return items
  }

  it('one row: a read that timed out tells nobody, and the 502 after it is reported, once', async () => {
    await sentFiles('photo.jpg')
    timingOut = true

    // At 5 s.
    await clock.advance(5 * SECOND)
    expect([timedOut, reported()]).toEqual([1, []])

    timingOut = false
    readsAnswer(profile, 502)
    // At 15, 30 and 60 s after a failure.
    await clock.advance(2 * MINUTE)

    expect(dam.assetReads().length).toBeGreaterThan(1)
    expect(reported()).toEqual([`502 ${endPoints.asset}/asset-1`])
  })

  it('one row: a read the server forbade tells nobody, and the 502 after it is reported, once', async () => {
    await sentFiles('photo.jpg')
    const forbidden = readsAnswer(profile, 403)

    await clock.advance(5 * SECOND)
    expect([dam.assetReads().length, reported()]).toEqual([1, []])

    forbidden()
    readsAnswer(profile, 502)
    await clock.advance(2 * MINUTE)

    expect(dam.assetReads().length).toBeGreaterThan(2)
    expect(reported()).toEqual([`502 ${endPoints.asset}/asset-1`])
  })

  it('two rows: a read of the list nobody was logged in for tells nobody, and its 502 after it is reported, once', async () => {
    await sentFiles('a.jpg', 'b.jpg')
    const unauthorized = readsAnswer(profile, 401)

    await clock.advance(5 * SECOND)
    expect([dam.sentTo('GET', dam.routes.byIds).length, reported()]).toEqual([1, []])

    unauthorized()
    readsAnswer(profile, 502)
    await clock.advance(2 * MINUTE)

    expect(dam.sentTo('GET', dam.routes.byIds).length).toBeGreaterThan(2)
    expect(reported()).toHaveLength(1)
    expect(reported()[0]).toMatch(new RegExp(`^502 ${endPoints.asset}/licence/${licence}/ids/asset-[12],asset-[12]$`))
  })

  // An uploaded row still without its metadata is asked about by its notification alone: its read tries again by
  // itself.
  it('the read a notification asks for: a try that timed out tells nobody, and the 502 of its next try is reported', async () => {
    const [item] = await sentFiles('photo.jpg')
    dam.fileBecomes('asset-1', AssetFileProcessStatus.Processed, fromTheServer)
    notify(DamNotificationName.AssetFileProcessed, { asset: 'asset-1', id: 'file-1' })
    await clock.advance(SECOND)
    expect([item!.status, item!.canEditMetadata]).toEqual([Uploaded, false])
    timingOut = true

    notify(DamNotificationName.AssetMetadataProcessed, { asset: 'asset-1' })
    await clock.advance(2 * SECOND)
    expect([timedOut, reported()]).toEqual([1, []])

    timingOut = false
    readsAnswer(profile, 502)
    // Its tries at 15 and 30 s after a failure.
    await clock.advance(MINUTE)

    expect(dam.assetReads()).toHaveLength(3)
    expect(reported()).toEqual([`502 ${endPoints.asset}/asset-1`])
  })
})
