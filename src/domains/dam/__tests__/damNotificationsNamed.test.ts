import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createPinia, type Pinia, setActivePinia } from 'pinia'
import { cmsConfiguration, installConsumerProfile } from '@/domains/dam/__tests__/support/consumerProfiles'
import { type DamSocket, stubDamSocket } from '@/domains/dam/__tests__/support/damSocket'
import { createFakeDam, damAssetWithFile, type FakeDam } from '@/domains/dam/__tests__/support/fakeDam'
import { holdLongWaits, type LongWaits } from '@/domains/dam/__tests__/support/longWaits'
import { alertText, forgetAlerts, shownAlerts } from '@/domains/dam/__tests__/support/uploadUi'
import { seedDamConfigOf } from '@/domains/dam/__tests__/support/namedDamConfig'
import { initCommonAdminCoreDamOptions } from '@/domains/dam/composables/commonAdminCoreDamOptions'
import {
  destroyDamNotifications,
  initDamNotifications,
  useDamNotifications,
} from '@/domains/dam/composables/damNotifications'
import { useDamNotificationsConnection } from '@/domains/dam/composables/damNotificationsConnection'
import { DamNotificationName, useDamNotificationsEventBus } from '@/domains/dam/composables/damNotificationsEventBus'
import { AssetFileProcessStatus, type AssetFileProcessStatusType } from '@/domains/dam/types/AssetFile'
import { UploadQueueItemStatus } from '@/domains/dam/types/UploadQueue'
import {
  type ManualScheduler,
  manualScheduler,
} from '@/domains/dam/uploadQueue/settlement/__tests__/support/manualScheduler'
import { uploadSettlementRuntime } from '@/domains/dam/uploadQueue/settlement/uploadSettlementRuntime'
import { useUploadQueuesStore } from '@/domains/dam/uploadQueue/store/uploadQueuesStore'

// The DAM notifications of a page with two configurations of two DAMs: `default`, with the socket of the root
// `notification`, and `own`, which has a socket only when it names one. Both DAMs have given an asset `a-1`, a copy of
// which waits in a queue of each configuration. What comes through a socket is of the configurations of that socket:
// the store settles by it only the rows of their queues, and a listener hears `default`'s socket unless it asks for
// another. A queue polls as a backup only while the socket of its configuration is open. The time of the settlement is
// the manual scheduler's; the sockets are a stub of the global `WebSocket`.

const { endPoints, extSystem, licence } = cmsConfiguration
const OWN = { asset: '/own/v2/asset', image: '/own/v2/image' }
const ADDRESS = 'ws://dam.test/notifications'
const OWN_ADDRESS = 'ws://own.test/notifications'
const OF_DEFAULT = 'notified-of-default'
const OF_OWN = 'notified-of-own'
const ASSET = 'a-1'
const S = 1000
/** From here on a wait is held: below the 1.5 s the caches wait before they ask. */
const HELD_FROM_MS = 1_200
const { Processing, Uploaded } = UploadQueueItemStatus
const { Processed, Uploading } = AssetFileProcessStatus

const realScheduler = uploadSettlementRuntime.scheduler
let pinia: Pinia
let dam: FakeDam
let own: FakeDam
let socket: DamSocket
let clock: ManualScheduler
let waits: LongWaits

beforeEach(() => {
  pinia = createPinia()
  setActivePinia(pinia)
  dam = createFakeDam(endPoints)
  own = createFakeDam(OWN)
  socket = stubDamSocket()
  clock = manualScheduler()
  uploadSettlementRuntime.scheduler = clock
  waits = holdLongWaits(HELD_FROM_MS)
})

afterEach(async () => {
  const store = useUploadQueuesStore()
  store.stopUpload(OF_DEFAULT)
  store.stopUpload(OF_OWN)
  destroyDamNotifications()
  socket.restore()
  uploadSettlementRuntime.scheduler = realScheduler
  await waits.elapseAll()
  waits.restore()
  useDamNotificationsEventBus().reset()
  forgetAlerts()
})

/** `default` with the root socket at `ADDRESS`, and `own` with the `notification` given, or none. */
const configure = (ofOwn?: { enabled?: boolean | string; webSocketUrl?: string }) => {
  const { coreDam } = installConsumerProfile(cmsConfiguration, dam.client)
  initCommonAdminCoreDamOptions({
    ...coreDam!,
    notification: { enabled: true, webSocketUrl: ADDRESS },
    configs: {
      ...coreDam!.configs,
      own: {
        damClient: own.client,
        endPointAsset: OWN.asset,
        endPointImage: OWN.image,
        ...(ofOwn ? { notification: ofOwn } : {}),
      },
    },
  })
  seedDamConfigOf('own', pinia)
}
/** The application starts its notifications, as it does once at start-up. */
const started = () => {
  const notifications = initDamNotifications()
  notifications.openConnection()
  return notifications
}
/** `a-1` in each DAM, its file in the state given, a file of its own: `file-default`, `file-own`. */
const a1In = (status: AssetFileProcessStatusType) => {
  dam.assets.set(ASSET, damAssetWithFile(ASSET, 'file-default', status, { licence }))
  own.assets.set(ASSET, damAssetWithFile(ASSET, 'file-own', status, { licence }))
}
/** A copy of `a-1` into the licence in the queue of each configuration: each waits for its DAM. */
const rowsOfA1 = async () => {
  const store = useUploadQueuesStore()
  await store.addByCopyToLicence(OF_DEFAULT, extSystem, licence, [ASSET], 'default')
  await store.addByCopyToLicence(OF_OWN, extSystem, licence, [ASSET], 'own')
  return { default: store.getQueueItems(OF_DEFAULT)[0]!, own: store.getQueueItems(OF_OWN)[0]! }
}
/** The reads of `a-1` a DAM was asked. */
const readsOfA1 = (of: FakeDam) => of.assetReads().filter((request) => request.url.endsWith(`/${ASSET}`))
const processed = (asset: string) => ({ asset, id: `file-of-${asset}` })

describe('the notification sockets of the DAM configurations of a page', () => {
  it('are one for each address, opened and closed through the one handle of the page', () => {
    configure({ enabled: true, webSocketUrl: OWN_ADDRESS })

    const notifications = initDamNotifications()
    expect(initDamNotifications()).toBe(notifications)
    notifications.openConnection()
    expect(socket.sockets.map((one) => one.url)).toEqual([ADDRESS, OWN_ADDRESS])
    socket.accept(ADDRESS)
    expect(notifications.status.value).toBe('OPEN')

    destroyDamNotifications()
    socket.sockets.forEach((one) => expect((one as unknown as { close: () => void }).close).toHaveBeenCalled())
  })

  it('are one socket for two configurations that name one address, heard as the socket of both', () => {
    configure({ enabled: 'true', webSocketUrl: ADDRESS })
    started()
    const origins: string[][] = []
    const off = useDamNotifications().addDamNotificationListener((_event, origin) => origins.push(origin), {
      configName: 'own',
    })

    socket.accept(ADDRESS)
    socket.deliver(DamNotificationName.AssetFileProcessed, processed('shared'), ADDRESS)
    off()

    expect(socket.sockets.map((one) => one.url)).toEqual([ADDRESS])
    expect(useDamNotificationsConnection('own').isPushAlive()).toBe(true)
    expect(origins).toEqual([['default', 'own']])
  })

  it('tell whether the socket of each configuration is open; none is for a configuration without one', () => {
    configure({ enabled: true, webSocketUrl: OWN_ADDRESS })
    const ofDefault = useDamNotificationsConnection()
    const ofOwn = useDamNotificationsConnection('own')
    const changes: string[] = []
    const off = ofOwn.onChange(() => changes.push(`${ofDefault.isPushAlive()} ${ofOwn.isPushAlive()}`))

    started()
    socket.accept(OWN_ADDRESS)
    expect([ofDefault.isPushAlive(), ofOwn.isPushAlive()]).toEqual([false, true])
    socket.accept(ADDRESS)
    socket.drop(OWN_ADDRESS)
    expect([ofDefault.isPushAlive(), ofOwn.isPushAlive()]).toEqual([true, false])
    expect(useDamNotificationsConnection('other').isPushAlive()).toBe(false)
    off()

    expect(changes).toEqual(['false true', 'true true', 'true false'])
  })

  it('are heard by a listener: of `default` without options, of the configuration it names, or all', () => {
    configure({ enabled: true, webSocketUrl: OWN_ADDRESS })
    started()
    const heard: string[] = []
    const { addDamNotificationListener } = useDamNotifications()
    const listener = (who: string) => (event: { data: unknown }, origin: string[]) =>
      heard.push(`${who}: ${(event.data as { asset: string }).asset} of ${origin.join(',')}`)
    const offs = [
      addDamNotificationListener(listener('unnamed')),
      addDamNotificationListener(listener('own'), { configName: 'own' }),
      addDamNotificationListener(listener('all'), { all: true }),
    ]

    socket.deliver(DamNotificationName.AssetFileProcessed, processed('on-default'), ADDRESS)
    socket.deliver(DamNotificationName.AssetFileProcessed, processed('on-own'), OWN_ADDRESS)
    offs.forEach((off) => off())

    expect(heard).toEqual([
      'unnamed: on-default of default',
      'all: on-default of default',
      'own: on-own of own',
      'all: on-own of own',
    ])
  })
})

describe('the notification sockets of the DAM configurations, as a listener and the page meet them', () => {
  it('are heard once by a callback added twice for the same sockets, until it is taken off', () => {
    configure({ enabled: true, webSocketUrl: OWN_ADDRESS })
    started()
    const heard: string[] = []
    const callback = (event: { data: unknown }) => heard.push((event.data as { asset: string }).asset)
    const { addDamNotificationListener } = useDamNotifications()
    const off = addDamNotificationListener(callback, { configName: 'own' })
    addDamNotificationListener(callback, { configName: 'own' })

    socket.deliver(DamNotificationName.AssetFileProcessed, processed('once'), OWN_ADDRESS)
    off()
    socket.deliver(DamNotificationName.AssetFileProcessed, processed('after-off'), OWN_ADDRESS)

    expect(heard).toEqual(['once'])
  })

  it('give each listener the names of the socket as its own copy', () => {
    configure({ enabled: true, webSocketUrl: ADDRESS })
    started()
    const heard: string[][] = []
    const { addDamNotificationListener } = useDamNotifications()
    const offs = [
      addDamNotificationListener((_event, origin) => origin.splice(0, origin.length, 'changed')),
      addDamNotificationListener((_event, origin) => heard.push(origin), { all: true }),
    ]

    socket.deliver(DamNotificationName.AssetFileProcessed, processed('first'), ADDRESS)
    socket.deliver(DamNotificationName.AssetFileProcessed, processed('second'), ADDRESS)
    socket.accept(ADDRESS)
    offs.forEach((off) => off())

    expect(heard).toEqual([
      ['default', 'own'],
      ['default', 'own'],
    ])
    expect(useDamNotificationsConnection('own').isPushAlive()).toBe(true)
  })

  it('open for the page also when the address of a named one is refused: that one only warns', async () => {
    configure({ enabled: true, webSocketUrl: 'not an address' })
    const notifications = initDamNotifications()

    expect(() => notifications.openConnection()).not.toThrow()
    expect(socket.sockets.map((one) => one.url)).toEqual([ADDRESS])
    await waits.elapse()

    expect(shownAlerts()).toEqual([['warning', alertText('common.damImage.notificationsNotConnected')]])
  })

  it('warn of a refused named address no more once the page has closed them, also when opened twice', async () => {
    configure({ enabled: true, webSocketUrl: 'not an address' })
    const notifications = initDamNotifications()

    notifications.openConnection()
    notifications.openConnection()
    notifications.closeConnection()
    await waits.elapse()

    expect(shownAlerts()).toEqual([])
  })

  it('tell no configuration named as a property every object has that its socket is open', () => {
    configure()
    started()
    socket.accept(ADDRESS)

    expect(useDamNotificationsConnection('constructor').isPushAlive()).toBe(false)
    expect(useDamNotificationsConnection('toString').isPushAlive()).toBe(false)
  })
})

describe('the upload queues of two DAM configurations, as the notifications of their sockets go', () => {
  it('poll the queue of a configuration with its socket open as a backup, beside that of default without', async () => {
    configure({ enabled: true, webSocketUrl: OWN_ADDRESS })
    started()
    socket.accept(OWN_ADDRESS)
    a1In(Uploading)
    await rowsOfA1()

    await clock.advance(5 * S)
    expect([readsOfA1(dam).length, readsOfA1(own).length]).toEqual([1, 0])
    await clock.advance(5 * S)
    expect([readsOfA1(dam).length, readsOfA1(own).length]).toEqual([2, 1])
  })

  it('read what the socket of default tells while the read of what that of own told is on its way', async () => {
    configure({ enabled: true, webSocketUrl: OWN_ADDRESS })
    started()
    socket.accept(ADDRESS)
    socket.accept(OWN_ADDRESS)
    a1In(Processed)
    const rows = await rowsOfA1()
    const held = own.hold('GET', own.routes.one)

    socket.deliver(DamNotificationName.AssetFileProcessed, processed(ASSET), OWN_ADDRESS)
    await clock.advance(1 * S)
    socket.deliver(DamNotificationName.AssetFileProcessed, processed(ASSET), ADDRESS)
    await clock.advance(1 * S)

    expect(held.waiting).toHaveLength(1)
    expect(rows.default).toMatchObject({ status: Uploaded, fileId: 'file-default' })
    expect(rows.own.status).toBe(Processing)
    held.release()
    await clock.advance(1 * S)
    expect(rows.own).toMatchObject({ status: Uploaded, fileId: 'file-own' })
  })

  it('poll the queue of a configuration without a socket densely, beside that of default with its socket open', async () => {
    configure()
    started()
    socket.accept(ADDRESS)
    a1In(Uploading)
    await rowsOfA1()

    await clock.advance(5 * S)
    expect([readsOfA1(dam).length, readsOfA1(own).length]).toEqual([0, 1])
    await clock.advance(5 * S)
    expect([readsOfA1(dam).length, readsOfA1(own).length]).toEqual([1, 2])
  })

  it.each([
    ['default', ADDRESS],
    ['own', OWN_ADDRESS],
  ] as const)('settle by an event on the socket of %s only the row of its queue', async (name, address) => {
    configure({ enabled: true, webSocketUrl: OWN_ADDRESS })
    started()
    socket.accept(address)
    a1In(Processed)
    const rows = await rowsOfA1()
    const other = name === 'own' ? 'default' : 'own'

    socket.deliver(DamNotificationName.AssetFileProcessed, processed(ASSET), address)
    await clock.advance(1 * S)

    expect(rows[name]).toMatchObject({ status: Uploaded, fileId: `file-${name}` })
    expect(rows[other]).toMatchObject({ status: Processing, fileId: null })
    expect(readsOfA1(name === 'own' ? own : dam)).toHaveLength(1)
    expect(readsOfA1(name === 'own' ? dam : own)).toHaveLength(0)
  })

  it('settle by an event on the socket two configurations share the rows of both, each read by its DAM', async () => {
    configure({ enabled: true, webSocketUrl: ADDRESS })
    started()
    socket.accept(ADDRESS)
    a1In(Processed)
    const rows = await rowsOfA1()

    socket.deliver(DamNotificationName.AssetFileProcessed, processed(ASSET), ADDRESS)
    await clock.advance(1 * S)

    expect(rows.default).toMatchObject({ status: Uploaded, fileId: 'file-default' })
    expect(rows.own).toMatchObject({ status: Uploaded, fileId: 'file-own' })
  })
})
