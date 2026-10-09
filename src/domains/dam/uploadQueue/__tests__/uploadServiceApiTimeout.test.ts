import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { installConsumerProfile, ugcConfiguration } from '@/domains/dam/__tests__/support/consumerProfiles'
import { createFakeDam, type FakeDam } from '@/domains/dam/__tests__/support/fakeDam'
import { holdLongWaits, type LongWaits } from '@/domains/dam/__tests__/support/longWaits'
import { initCommonAdminCoreDamOptions } from '@/domains/dam/composables/commonAdminCoreDamOptions'
import { useDamConfigStore } from '@/domains/dam/config/store/damConfigStore'
import { DamAssetType } from '@/domains/dam/types/Asset'
import { UploadQueueItemStatus, UploadQueueItemType } from '@/domains/dam/types/UploadQueue'
import { useDamUploadChunkSize } from '@/domains/dam/uploadQueue/composables/damUploadChunkSize'
import { useUpload } from '@/domains/dam/uploadQueue/composables/uploadService'
import { useUploadQueueItemFactory } from '@/domains/dam/uploadQueue/factory/UploadQueueItemFactory'

// The upload sizes its chunks so that one takes between a fifth and a half of a request's timeout, at the speed
// measured. The timeout is the one the application configures for its DAM requests (`coreDam.apiTimeout`). The
// real upload service against a client that records the chunks; the speed is given, not measured.

const { endPoints } = ugcConfiguration
const MIN = 1_000
const MAX = 100_000

let dam: FakeDam
let waits: LongWaits

beforeEach(() => {
  setActivePinia(createPinia())
  dam = createFakeDam(endPoints)
  waits = holdLongWaits()
})
afterEach(() => {
  waits.restore()
})

/** A file of 3000 bytes sent by an application with the given timeout, at the given speed in bytes a second. */
const chunksSentWith = async (apiTimeout: number | null | undefined, speed = 100) => {
  const options = installConsumerProfile(ugcConfiguration, dam.client)
  initCommonAdminCoreDamOptions({ ...options.coreDam!, apiTimeout: apiTimeout as number })
  useDamConfigStore().damPrvConfig.settings.imageChunkConfig = { minSize: MIN, maxSize: MAX }
  // Whatever the uploads before left behind: a speed at which any chunk takes too long, so the size falls to the
  // lower bound.
  useDamUploadChunkSize().updateChunkSize(0.001)
  const item = useUploadQueueItemFactory().createDefault(
    'file_photo.jpg',
    UploadQueueItemType.File,
    UploadQueueItemStatus.Waiting,
    DamAssetType.Image,
    MIN,
    ugcConfiguration.licence
  )
  item.file = new File([new Uint8Array(3000)], 'photo.jpg', { type: 'image/jpeg' })
  // The first chunk would be of 1000 bytes: 10 s at the speed the cases below leave as it is.
  item.progress.speed = speed
  const { uploadInit, upload } = useUpload(item)

  await uploadInit()
  await upload()

  return dam.sentTo('POST', dam.routes.chunk).map((request) => ((request.data as FormData).get('file') as File).size)
}

describe('the chunks of an upload', () => {
  // Between 6 s and 15 s a chunk: 10 s is fine.
  it('stay as they are while one takes between a fifth and a half of the configured 30 s', async () => {
    expect(await chunksSentWith(30)).toEqual([1000, 1000, 1000])
  })

  // Between 12 s and 30 s a chunk: 10 s is too short, a quarter of the timeout is aimed at.
  it('grow to a quarter of a configured 60 s', async () => {
    expect(await chunksSentWith(60)).toEqual([1500, 1500])
  })

  it('grow to a quarter of a configured 120 s', async () => {
    expect(await chunksSentWith(120)).toEqual([3000])
  })

  // At 200 bytes a second a chunk of 1000 takes 5 s. That is too short for 30 s, which aims at 7.5 s: 1500 bytes;
  // and for 60 s, which aims at 15 s: all 3000 at once. A timeout taken for 0 would find any chunk too long and
  // stay at the smallest, 1000.
  it.each([undefined, null])('are sized against 30 s when the application configures no timeout (%s)', async (none) => {
    expect(await chunksSentWith(none, 200)).toEqual([1500, 1500])
  })

  it.each([
    [30, [1500, 1500]],
    [60, [3000]],
  ])('are sized at that speed against the %s s the application configures', async (apiTimeout, sizes) => {
    expect(await chunksSentWith(apiTimeout, 200)).toEqual(sizes)
  })
})
