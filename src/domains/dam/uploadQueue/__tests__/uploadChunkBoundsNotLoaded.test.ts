import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { installConsumerProfile, ugcConfiguration } from '@/domains/dam/__tests__/support/consumerProfiles'
import { createFakeDam, type FakeDam, type FakeDamRequest } from '@/domains/dam/__tests__/support/fakeDam'
import { holdLongWaits, type LongWaits } from '@/domains/dam/__tests__/support/longWaits'
import { seedDamConfigOf } from '@/domains/dam/__tests__/support/namedDamConfig'
import { initCommonAdminCoreDamOptions } from '@/domains/dam/composables/commonAdminCoreDamOptions'
import { useDamConfigStore } from '@/domains/dam/config/store/damConfigStore'
import { DamAssetType } from '@/domains/dam/types/Asset'
import { UploadQueueItemStatus, UploadQueueItemType } from '@/domains/dam/types/UploadQueue'
import { useDamUploadChunkSize } from '@/domains/dam/uploadQueue/composables/damUploadChunkSize'
import { useUpload } from '@/domains/dam/uploadQueue/composables/uploadService'
import { useUploadQueueItemFactory } from '@/domains/dam/uploadQueue/factory/UploadQueueItemFactory'
import { libraryUploadPreset } from '@/domains/dam/uploadQueue/presets/uploadPresets'
import { useUploadQueuesStore } from '@/domains/dam/uploadQueue/store/uploadQueuesStore'

// Chunk bounds come with the prv configuration and are 0 and 0 in a store that never had it loaded.
// Sized by them, a chunk had no bytes. The upload had the DAM create its asset, then tried the chunk four
// times, each refused by the library's request before it went out, and failed. The asset was left in the DAM.
// Real upload service and queue against recording clients. Pauses between chunk retries are skipped.

const { endPoints, extSystem, licence } = ugcConfiguration
const OWN = { asset: '/own/v2/asset', image: '/own/v2/image' }
const QUEUE = 'chunk-bounds'
const NOT_LOADED = { minSize: 0, maxSize: 0 }

let dam: FakeDam
let own: FakeDam
let waits: LongWaits

const sizeOf = (request: FakeDamRequest) => ((request.data as FormData).get('file') as File).size
const chunksSent = (of: FakeDam) => of.sentTo('POST', of.routes.chunk).map(sizeOf)
const asked = (of: FakeDam) => of.requests.map((request) => `${request.method} ${request.url}`)

beforeEach(() => {
  setActivePinia(createPinia())
  dam = createFakeDam(endPoints)
  own = createFakeDam(OWN)
  const { coreDam } = installConsumerProfile(ugcConfiguration, dam.client)
  initCommonAdminCoreDamOptions({
    ...coreDam,
    configs: {
      ...coreDam.configs,
      own: { damClient: own.client, endPointAsset: OWN.asset, endPointImage: OWN.image },
    },
  })
  seedDamConfigOf('own').damPrvConfig.settings.imageChunkConfig = { ...NOT_LOADED }
  waits = holdLongWaits(10_000, { passFrom: 1_000 })
})
afterEach(() => {
  useUploadQueuesStore().stopUpload(QUEUE)
  waits.restore()
})

const rowOf = (speed: number | null = null) => {
  const item = useUploadQueueItemFactory().createDefault(
    'file_photo.jpg',
    UploadQueueItemType.File,
    UploadQueueItemStatus.Waiting,
    DamAssetType.Image,
    1000,
    licence
  )
  item.file = new File([new Uint8Array(3000)], 'photo.jpg', { type: 'image/jpeg' })
  item.progress.speed = speed
  return item
}
const defaultNotLoaded = () => {
  const store = useDamConfigStore()
  store.damPrvConfig.settings.imageChunkConfig = { ...NOT_LOADED }
  store.initialized.damPrvConfig = false
}

describe('an upload while the chunk bounds of its configuration are not loaded', () => {
  it('is refused before anything is asked of the DAM', async () => {
    defaultNotLoaded()
    const { uploadInit } = useUpload(rowOf())

    await expect(uploadInit()).rejects.toThrow('the chunk bounds of the DAM configuration "default" are not loaded')
    expect(asked(dam)).toEqual([])
  })

  it('under a named configuration is refused by its own bounds, whatever those of default are', async () => {
    const { uploadInit } = useUpload(rowOf(), undefined, libraryUploadPreset('own'))

    await expect(uploadInit()).rejects.toThrow('the chunk bounds of the DAM configuration "own" are not loaded')
    expect([asked(own), asked(dam)]).toEqual([[], []])
  })

  it('fails each row of the queue, and the DAM is asked nothing: no asset is created', async () => {
    defaultNotLoaded()
    const files = ['a', 'b'].map((name) => new File([new Uint8Array(3000)], `${name}.jpg`, { type: 'image/jpeg' }))

    await useUploadQueuesStore().addByFiles(QUEUE, extSystem, licence, files, 'default')
    await vi.waitFor(() =>
      expect(
        useUploadQueuesStore()
          .getQueueItems(QUEUE)
          .map((item) => item.status)
      ).toEqual([UploadQueueItemStatus.Failed, UploadQueueItemStatus.Failed])
    )
    await waits.settle()

    expect(asked(dam)).toEqual([])
  })
})

describe('the chunks of an upload', () => {
  it('are sent as before while the bounds are loaded', async () => {
    useDamConfigStore().damPrvConfig.settings.imageChunkConfig = { minSize: 1000, maxSize: 1000 }
    const { uploadInit, upload } = useUpload(rowOf(100))

    await uploadInit()
    await upload()

    expect(chunksSent(dam)).toEqual([1000, 1000, 1000])
    expect(dam.sentTo('PATCH', dam.routes.finish)).toHaveLength(1)
  })

  // The bounds were there when the upload started and are gone before its chunks (the store emptied by `reset`).
  // The chunk size is then written back into the bounds as 0.
  it('are never of no bytes: the upload fails at once instead, and is not finished', async () => {
    useDamConfigStore().damPrvConfig.settings.imageChunkConfig = { minSize: 1000, maxSize: 100_000 }
    useDamUploadChunkSize().updateChunkSize(0.001)
    const { uploadInit, upload } = useUpload(rowOf(1000))
    await uploadInit()
    useDamConfigStore().reset()

    await expect(upload()).rejects.toThrow('a chunk of no bytes')
    expect(chunksSent(dam)).toEqual([])
    expect(dam.sentTo('PATCH', dam.routes.finish)).toEqual([])
  })
})
