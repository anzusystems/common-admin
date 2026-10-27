import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { cmsConfiguration, installConsumerProfile } from '@/domains/dam/__tests__/support/consumerProfiles'
import { seedDamConfigOf } from '@/domains/dam/__tests__/support/namedDamConfig'
import { createFakeDam, damAssetWithFile, type FakeDam } from '@/domains/dam/__tests__/support/fakeDam'
import { holdLongWaits, type LongWaits } from '@/domains/dam/__tests__/support/longWaits'
import { defaultApiErrorLogger, setApiErrorLogger } from '@/domains/api/utils/apiErrors'
import { initCommonAdminCoreDamOptions } from '@/domains/dam/composables/commonAdminCoreDamOptions'
import {
  type DamNotification,
  DamNotificationName,
  type DamNotificationNameType,
  useDamNotificationsEventBus,
} from '@/domains/dam/composables/damNotificationsEventBus'
import { DamAssetStatus, DamAssetType } from '@/domains/dam/types/Asset'
import { AssetFileProcessStatus } from '@/domains/dam/types/AssetFile'
import { UploadQueueItemStatus } from '@/domains/dam/types/UploadQueue'
import { useUploadQueuesStore } from '@/domains/dam/uploadQueue/store/uploadQueuesStore'

// A page with two DAM configurations: `default` (as in admin-cms) and `own`, with its own client and addresses.
// A queue stays under the configuration it was made with. Files are sent there, and rows are asked
// about there: by the poll, after a notification, by the refresh and for the original of a duplicate.
// Each configuration has a recording DAM client. Ids started under `own` differ from those of `default`.

const { endPoints, extSystem, licence } = cmsConfiguration
const OWN = { asset: '/own/v2/asset', image: '/own/v2/image' }
const QUEUE = 'named-queue'
const DEFAULT_QUEUE = 'named-queue-of-default'
const { Processing, Uploaded } = UploadQueueItemStatus

let dam: FakeDam
let own: FakeDam
let waits: LongWaits

beforeEach(() => {
  setActivePinia(createPinia())
  dam = createFakeDam(endPoints)
  own = createFakeDam(OWN)
  const { coreDam } = installConsumerProfile(cmsConfiguration, dam.client)
  initCommonAdminCoreDamOptions({
    ...coreDam,
    configs: {
      ...coreDam.configs,
      own: { damClient: own.client, endPointAsset: OWN.asset, endPointImage: OWN.image },
    },
  })
  // The DAM of `own` has the default configuration, filled before anything is
  // added, except its chunks: half a photo, where `default`'s take a photo whole.
  // A queue under `own` that read the store of `default` would send each photo in one chunk.
  seedDamConfigOf('own').damPrvConfig.settings.imageChunkConfig = { minSize: 1500, maxSize: 1500 }
  let started = 0
  own.reply((request) => {
    if (request.method !== 'POST' || !own.routes.start.test(request.url)) return undefined
    started++
    const created = { id: `own-file-${started}`, asset: `own-asset-${started}` }
    own.assets.set(
      created.asset,
      damAssetWithFile(created.asset, created.id, AssetFileProcessStatus.Uploading, {
        licence,
        attributes: { assetType: DamAssetType.Image, assetStatus: DamAssetStatus.Draft },
      })
    )
    return { status: 201, data: created }
  })
  waits = holdLongWaits()
})

afterEach(() => {
  const store = useUploadQueuesStore()
  store.stopUpload(QUEUE)
  store.stopUpload(DEFAULT_QUEUE)
  setApiErrorLogger(defaultApiErrorLogger)
  waits.restore()
  useDamNotificationsEventBus().reset()
})

/** Notifications of `default`'s socket concern only the queues of `default`. */
const notify = (name: DamNotificationNameType, data: Record<string, unknown>) =>
  useDamNotificationsEventBus().emit({ name, data } as unknown as DamNotification, ['own'])
const photo = (name: string) => new File([new Uint8Array(3000)], name, { type: 'image/jpeg' })
const asked = (of: FakeDam) => of.requests.map((request) => `${request.method} ${request.url}`)
const sendingUnderOwn = [
  `POST ${OWN.image}/licence/${licence}`,
  `POST ${OWN.image}/own-file-1/chunk`,
  `POST ${OWN.image}/own-file-1/chunk`,
  `PATCH ${OWN.image}/own-file-1/uploaded`,
]

const uploadedUnderOwn = async () => {
  const store = useUploadQueuesStore()
  await store.addByFiles(QUEUE, extSystem, licence, [photo('photo.jpg')], 'own')
  const [item] = store.getQueueItems(QUEUE)
  await vi.waitFor(() => expect(item.status).toBe(Processing))
  return { store, item }
}

describe('a queue made under a named DAM configuration', () => {
  it('sends its file by the client and to the addresses of that configuration', async () => {
    const { item } = await uploadedUnderOwn()

    expect(asked(own)).toEqual(sendingUnderOwn)
    expect(asked(dam)).toEqual([])
    expect(item).toMatchObject({ assetId: 'own-asset-1', fileId: 'own-file-1' })
  })

  it('is asked about there by the poll', async () => {
    const { item } = await uploadedUnderOwn()
    own.fileBecomes('own-asset-1', AssetFileProcessStatus.Processed)

    await waits.elapse()
    await vi.waitFor(() => expect(item.status).toBe(Uploaded))

    expect(asked(own).slice(sendingUnderOwn.length)).toEqual([`GET ${OWN.asset}/own-asset-1`])
    expect(asked(dam)).toEqual([])
  })

  describe('with two rows', () => {
    const twoUploadedUnderOwn = async () => {
      const store = useUploadQueuesStore()
      await store.addByFiles(QUEUE, extSystem, licence, [photo('first.jpg'), photo('second.jpg')], 'own')
      const items = store.getQueueItems(QUEUE)
      await vi.waitFor(() => expect(items.map((item) => item.status)).toEqual([Processing, Processing]))
      return items
    }
    const bothAtOnce = new RegExp(`^${OWN.asset}/licence/${licence}/ids/own-asset-[12],own-asset-[12]$`)

    it('is asked about both at once there by the poll', async () => {
      const items = await twoUploadedUnderOwn()
      own.fileBecomes('own-asset-1', AssetFileProcessStatus.Processed)
      own.fileBecomes('own-asset-2', AssetFileProcessStatus.Processed)

      await waits.elapse()
      await vi.waitFor(() => expect(items.map((item) => item.status)).toEqual([Uploaded, Uploaded]))

      const reads = own.assetReads().map((read) => read.url)
      expect(reads).toHaveLength(1)
      expect(reads[0]).toMatch(bothAtOnce)
      expect(asked(dam)).toEqual([])
    })

    it('reports that read, when it fails, with the address of its configuration', async () => {
      const logged = vi.fn()
      setApiErrorLogger(logged)
      await twoUploadedUnderOwn()
      own.reply((request) => (own.routes.byIds.test(request.url) ? { status: 502 } : undefined))

      await waits.elapse()
      await vi.waitFor(() => expect(logged).toHaveBeenCalledTimes(1))

      const [, context] = logged.mock.calls[0]!
      expect(context.status).toBe(502)
      expect(context.url).toMatch(bothAtOnce)
      expect(asked(dam)).toEqual([])
    })
  })

  it('is read there when a notification of its socket names its asset', async () => {
    const { item } = await uploadedUnderOwn()
    own.fileBecomes('own-asset-1', AssetFileProcessStatus.Processed)

    notify(DamNotificationName.AssetFileProcessed, { asset: 'own-asset-1', id: 'own-file-1' })
    await vi.waitFor(() => expect(item.status).toBe(Uploaded))

    expect(asked(own).slice(sendingUnderOwn.length)).toEqual([`GET ${OWN.asset}/own-asset-1`])
    expect(asked(dam)).toEqual([])
  })

  it('is read there by the refresh of its row', async () => {
    const { store, item } = await uploadedUnderOwn()
    own.fileBecomes('own-asset-1', AssetFileProcessStatus.Processed)

    expect(await store.refreshAsset('own-asset-1', { queueKey: QUEUE })).toBe('settled')

    expect(item.status).toBe(Uploaded)
    expect(asked(own).slice(sendingUnderOwn.length)).toEqual([`GET ${OWN.asset}/own-asset-1`])
    expect(asked(dam)).toEqual([])
  })

  it('has the original of a duplicate the poll finds read there', async () => {
    const { item } = await uploadedUnderOwn()
    own.assets.set(
      'own-asset-original',
      damAssetWithFile('own-asset-original', 'own-file-original', AssetFileProcessStatus.Processed)
    )
    own.fileBecomes('own-asset-1', AssetFileProcessStatus.Duplicate, {}, { originAssetFile: 'own-file-original' })

    await waits.elapse()
    await vi.waitFor(() => expect(item.status).toBe(Uploaded))

    expect(asked(own).slice(sendingUnderOwn.length)).toEqual([
      `GET ${OWN.asset}/own-asset-1`,
      `GET ${OWN.asset}/asset-file/own-file-original`,
    ])
    expect(asked(dam)).toEqual([])
    expect(item).toMatchObject({ isDuplicate: true, assetId: 'own-asset-original', fileId: 'own-file-original' })
  })

  it('has the original of a duplicate a notification of its socket names read there', async () => {
    const { item } = await uploadedUnderOwn()
    own.assets.set(
      'own-asset-original',
      damAssetWithFile('own-asset-original', 'own-file-original', AssetFileProcessStatus.Processed)
    )

    notify(DamNotificationName.AssetFileDuplicate, {
      asset: 'own-asset-1',
      id: 'own-file-1',
      originAssetFile: 'own-file-original',
      assetType: DamAssetType.Image,
    })
    await vi.waitFor(() => expect(item.status).toBe(Uploaded))

    expect(asked(own).slice(sendingUnderOwn.length)).toEqual([`GET ${OWN.asset}/asset-file/own-file-original`])
    expect(asked(dam)).toEqual([])
    expect(item).toMatchObject({ isDuplicate: true, assetId: 'own-asset-original', fileId: 'own-file-original' })
  })

  it('asks there about an asset copied to the licence', async () => {
    const store = useUploadQueuesStore()
    own.assets.set(
      'own-asset-copy',
      damAssetWithFile('own-asset-copy', 'own-file-copy', AssetFileProcessStatus.Processed, { licence })
    )

    await store.addByCopyToLicence(QUEUE, extSystem, licence, ['own-asset-copy'], 'own')
    const [item] = store.getQueueItems(QUEUE)
    await waits.elapse()
    await vi.waitFor(() => expect(item.status).toBe(Uploaded))

    expect(asked(own)).toEqual([`GET ${OWN.asset}/own-asset-copy`])
    expect(asked(dam)).toEqual([])
  })

  it('leaves a queue of the default configuration beside it where it was', async () => {
    const store = useUploadQueuesStore()
    await store.addByFiles(QUEUE, extSystem, licence, [photo('own.jpg')], 'own')
    await store.addByFiles(DEFAULT_QUEUE, extSystem, licence, [photo('default.jpg')], 'default')
    const [ofOwn] = store.getQueueItems(QUEUE)
    const [ofDefault] = store.getQueueItems(DEFAULT_QUEUE)
    await vi.waitFor(() => expect([ofOwn.status, ofDefault.status]).toEqual([Processing, Processing]))
    own.fileBecomes('own-asset-1', AssetFileProcessStatus.Processed)
    dam.fileBecomes('asset-1', AssetFileProcessStatus.Processed)

    await waits.elapse()
    await vi.waitFor(() => expect([ofOwn.status, ofDefault.status]).toEqual([Uploaded, Uploaded]))

    expect(asked(own)).toEqual([...sendingUnderOwn, `GET ${OWN.asset}/own-asset-1`])
    expect(asked(dam)).toEqual([
      `POST ${endPoints.image}/licence/${licence}`,
      `POST ${endPoints.image}/file-1/chunk`,
      `PATCH ${endPoints.image}/file-1/uploaded`,
      `GET ${endPoints.asset}/asset-1`,
    ])
  })

  it('is sent and asked about under the default configuration when that is named', async () => {
    const store = useUploadQueuesStore()
    await store.addByFiles(QUEUE, extSystem, licence, [photo('photo.jpg')], 'default')
    const [item] = store.getQueueItems(QUEUE)
    await vi.waitFor(() => expect(item.status).toBe(Processing))
    dam.fileBecomes('asset-1', AssetFileProcessStatus.Processed)

    expect(await store.refreshAsset('asset-1', 'default')).toBe('settled')

    expect(asked(dam)).toHaveLength(4)
    expect(asked(own)).toEqual([])
  })
})

describe('the configuration of a queue that is added to again', () => {
  const refused = (known: string, other: string) =>
    `useUploadQueuesStore: the queue "${QUEUE}" has rows under the DAM configuration "${known}", none is added under "${other}".`

  it('is the only one its rows are added under: files under another name are refused, and none is added', async () => {
    const { store } = await uploadedUnderOwn()

    await expect(store.addByFiles(QUEUE, extSystem, licence, [photo('second.jpg')], 'default')).rejects.toThrow(
      refused('own', 'default')
    )

    expect(store.getQueueItems(QUEUE)).toHaveLength(1)
    expect(asked(own)).toEqual(sendingUnderOwn)
    expect(asked(dam)).toEqual([])
  })

  it('is the only one its rows are added under: a copy to the licence under another name is refused too', async () => {
    const { store } = await uploadedUnderOwn()

    await expect(store.addByCopyToLicence(QUEUE, extSystem, licence, ['asset-copy'], 'default')).rejects.toThrow(
      refused('own', 'default')
    )

    expect(store.getQueueItems(QUEUE)).toHaveLength(1)
    expect(asked(own)).toEqual(sendingUnderOwn)
    expect(asked(dam)).toEqual([])
  })

  it('takes more rows under the same name', async () => {
    const { store } = await uploadedUnderOwn()

    await store.addByFiles(QUEUE, extSystem, licence, [photo('second.jpg')], 'own')
    await vi.waitFor(() => expect(store.getQueueItems(QUEUE)[1]!.status).toBe(Processing))

    expect(own.sentTo('POST', own.routes.start)).toHaveLength(2)
    expect(asked(dam)).toEqual([])
  })

  it('is the one named anew once the queue has no rows', async () => {
    const { store } = await uploadedUnderOwn()
    store.stopUpload(QUEUE)
    expect(store.getQueueItems(QUEUE)).toEqual([])

    await store.addByFiles(QUEUE, extSystem, licence, [photo('again.jpg')], 'default')
    const [item] = store.getQueueItems(QUEUE)
    await vi.waitFor(() => expect(item.status).toBe(Processing))

    expect(asked(own)).toEqual(sendingUnderOwn)
    expect(asked(dam)).toEqual([
      `POST ${endPoints.image}/licence/${licence}`,
      `POST ${endPoints.image}/file-1/chunk`,
      `PATCH ${endPoints.image}/file-1/uploaded`,
    ])
  })

  // The files of an add are put into the queue one after another, and another add may come before the first is there.
  // The queue is named with the row, so the add whose row is there first names it.
  // Before, the files of the first add were sent under the name of the second.
  it.each([
    ['own', 'default'],
    ['default', 'own'],
  ] as const)(
    'is that of the add whose row is in the queue first, of two that overlap: under %s, the add under %s is refused',
    async (first, second) => {
      const store = useUploadQueuesStore()

      const taken = store.addByFiles(QUEUE, extSystem, licence, [photo('first.jpg'), photo('second.jpg')], first)
      const other = store.addByFiles(QUEUE, extSystem, licence, [photo('other.jpg')], second)

      await expect(other).rejects.toThrow(refused(first, second))
      await taken
      const items = store.getQueueItems(QUEUE)
      expect(items.map((item) => item.displayTitle)).toEqual(['first.jpg', 'second.jpg'])
      await vi.waitFor(() => expect(items.map((item) => item.status)).toEqual([Processing, Processing]))
      const [sentTo, leftAlone] = first === 'own' ? [own, dam] : [dam, own]
      expect(sentTo.sentTo('POST', sentTo.routes.start)).toHaveLength(2)
      expect(asked(leftAlone)).toEqual([])
    }
  )

  // `constructor`: what every object has is not a configuration the application has named.
  it.each(['unknown', 'constructor'])(
    'is refused when the application has no configuration of that name, and no row is added: %s',
    async (name) => {
      const store = useUploadQueuesStore()
      const notConfigured = "Composable can't be used without properly configured common admin."

      await expect(store.addByFiles(QUEUE, extSystem, licence, [photo('photo.jpg')], name)).rejects.toThrow(
        notConfigured
      )
      await expect(store.addByCopyToLicence(QUEUE, extSystem, licence, ['asset-1'], name)).rejects.toThrow(
        notConfigured
      )

      expect(store.getQueueItems(QUEUE)).toEqual([])
      expect([...asked(dam), ...asked(own)]).toEqual([])
    }
  )
})

describe('what a saved detail writes back into the rows of its asset', () => {
  const saved = () =>
    own.fileBecomes('own-asset-1', AssetFileProcessStatus.Processed, {
      metadata: { customData: { title: 'saved in the detail' }, authorSuggestions: {}, keywordSuggestions: {} },
    })

  it('is read under the configuration the detail names', async () => {
    const { store, item } = await uploadedUnderOwn()

    await store.updateFromDetail(saved(), 'own')

    expect(item.customData).toEqual({ title: 'saved in the detail' })
    expect(asked(own).slice(sendingUnderOwn.length)).toEqual([`GET ${OWN.asset}/own-asset-1`])
    expect(asked(dam)).toEqual([])
  })

  it('is of the default configuration when the detail names it, and leaves the rows of another alone', async () => {
    const { store, item } = await uploadedUnderOwn()

    await store.updateFromDetail(saved(), 'default')

    expect(item.customData).toEqual({})
    expect(asked(own).slice(sendingUnderOwn.length)).toEqual([])
    expect(asked(dam)).toEqual([])
  })

  it('is left alone, in silence, when the application has no configuration of the name', async () => {
    const { store, item } = await uploadedUnderOwn()

    await expect(store.updateFromDetail(saved(), 'unknown')).resolves.toBeUndefined()

    expect(item.customData).toEqual({})
    expect([...asked(own).slice(sendingUnderOwn.length), ...asked(dam)]).toEqual([])
  })
})
