import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { cmsConfiguration, installConsumerProfile } from '@/domains/dam/__tests__/support/consumerProfiles'
import { answerDamNames, damNamesAsked } from '@/domains/dam/__tests__/support/damNames'
import {
  createFakeDam,
  damAssetWithFile,
  type FakeDam,
  type FakeDamAnswer,
} from '@/domains/dam/__tests__/support/fakeDam'
import { holdLongWaits, type LongWaits } from '@/domains/dam/__tests__/support/longWaits'
import {
  type DamNotification,
  DamNotificationName,
  type DamNotificationNameType,
  useDamNotificationsEventBus,
} from '@/domains/dam/composables/damNotificationsEventBus'
import { AssetFileProcessStatus } from '@/domains/dam/types/AssetFile'
import { UploadQueueItemStatus } from '@/domains/dam/types/UploadQueue'
import { useUploadQueuesStore } from '@/domains/dam/uploadQueue/store/uploadQueuesStore'

// A save in the asset detail of a queue row reads the asset once more. The rows of
// the asset take what the read finds, or what the detail saved when the read fails.
// Regressions guarded: values typed into the row during the read were replaced. A row that became a row of
// the asset only during the read (the original of a duplicate) got nothing when no row had the asset before.

const { endPoints, extSystem, licence } = cmsConfiguration
const QUEUE = 'detail-save-typed'

let dam: FakeDam
let waits: LongWaits

beforeEach(() => {
  setActivePinia(createPinia())
  dam = createFakeDam(endPoints)
  installConsumerProfile(cmsConfiguration, dam.client)
  answerDamNames(dam)
  waits = holdLongWaits()
})
afterEach(async () => {
  useUploadQueuesStore().stopUpload(QUEUE)
  await damNamesAsked()
  waits.restore()
  useDamNotificationsEventBus().reset()
})

const notify = (name: DamNotificationNameType, data: Record<string, unknown>) =>
  useDamNotificationsEventBus().emit({ name, data } as unknown as DamNotification)

const saved = {
  keywords: ['keyword-saved'],
  authors: ['author-saved'],
  metadata: {
    customData: { title: 'saved in the detail', description: 'saved description' },
    authorSuggestions: {},
    keywordSuggestions: {},
  },
}

const rowOfTheAsset = async () => {
  const store = useUploadQueuesStore()
  dam.assets.set(
    'asset-1',
    damAssetWithFile('asset-1', 'file-1', AssetFileProcessStatus.Processed, {
      keywords: ['keyword-before'],
      authors: ['author-before'],
      metadata: {
        customData: { title: 'title before', description: 'description before' },
        authorSuggestions: {},
        keywordSuggestions: {},
      },
    })
  )
  await store.addByCopyToLicence(QUEUE, extSystem, licence, ['asset-1'], 'default')
  notify(DamNotificationName.AssetFileCopied, { asset: 'asset-1' })
  const [row] = store.getQueueItems(QUEUE)
  await vi.waitFor(() => expect(row!.canEditMetadata).toBe(true))
  return row!
}
const holdReadsOf = (asset: string) => dam.hold('GET', new RegExp(`^${endPoints.asset}/${asset}$`))

describe('a save in the asset detail of a row of the queue', () => {
  it.each<[string, FakeDamAnswer | undefined]>([
    ['the read finds', undefined],
    ['the read fails and the detail saved', { status: 500 }],
  ])(
    'keeps what was typed into the row while the asset is read; the fields left as they were take what %s',
    async (_what, answer) => {
      const row = await rowOfTheAsset()
      const detail = dam.fileBecomes('asset-1', AssetFileProcessStatus.Processed, saved)
      const reads = holdReadsOf('asset-1')
      const written = useUploadQueuesStore().updateFromDetail(detail, 'default')
      await vi.waitFor(() => expect(reads.waiting).toHaveLength(1))

      row.keywords = ['keyword-typed']
      row.customData.title = 'title typed'
      reads.release(answer)
      await written

      expect(row).toMatchObject({
        keywords: ['keyword-typed'],
        authors: ['author-saved'],
        customData: { title: 'title typed', description: 'saved description' },
      })
    }
  )

  // The file of the row turns out to be a duplicate of the file of the asset during the read.
  // The row then becomes the original of that duplicate, a row of the asset.
  it('gives a row that becomes a row of the asset while it is read what the read finds', async () => {
    const store = useUploadQueuesStore()
    dam.assets.set('asset-1', damAssetWithFile('asset-1', 'file-1', AssetFileProcessStatus.Processed, { licence }))
    await store.addByCopyToLicence(QUEUE, extSystem, licence, ['asset-2'], 'default')
    const [row] = store.getQueueItems(QUEUE)
    expect(row!.status).not.toBe(UploadQueueItemStatus.Uploaded)
    const detail = dam.fileBecomes('asset-1', AssetFileProcessStatus.Processed, saved)
    const reads = holdReadsOf('asset-1')
    const written = store.updateFromDetail(detail, 'default')
    await vi.waitFor(() => expect(reads.waiting).toHaveLength(1))

    row!.assetId = 'asset-1'
    row!.status = UploadQueueItemStatus.Uploaded
    reads.release()
    await written

    expect(row).toMatchObject({ keywords: ['keyword-saved'], authors: ['author-saved'] })
  })

  // Only a row of the licence of the asset can become its row. The DAM finds a duplicate within the licence of a file.
  it('reads nothing for a row of another licence the server is processing', async () => {
    const store = useUploadQueuesStore()
    await store.addByCopyToLicence(QUEUE, extSystem, licence + 1, ['asset-2'], 'default')
    expect(store.getQueueItems(QUEUE)[0]!.status).toBe(UploadQueueItemStatus.Processing)
    const before = dam.assetReads().length
    const detail = damAssetWithFile('asset-1', 'file-1', AssetFileProcessStatus.Processed, { licence, ...saved })

    await store.updateFromDetail(detail, 'default')

    expect(dam.assetReads()).toHaveLength(before)
  })

  it('reads nothing when no row has the asset and none is still on its way', async () => {
    const row = await rowOfTheAsset()
    const before = dam.assetReads().length
    const other = damAssetWithFile('asset-9', 'file-9', AssetFileProcessStatus.Processed)

    await useUploadQueuesStore().updateFromDetail(other, 'default')

    expect(dam.assetReads()).toHaveLength(before)
    expect(row.keywords).toEqual(['keyword-before'])
  })
})

// The second save is pressed while the first is still being written, with
// its read on the way. The rows must end with the values of the later save.
// Regressions guarded: the second save kept the values of the first as if the user had
// typed them, or the first save wrote over the second when its read answered last.
describe('two saves in the asset detail of a row of the queue, one after the other', () => {
  const asSaved = (title: string) => ({
    ...saved,
    keywords: [`keyword-of-${title}`],
    metadata: { ...saved.metadata, customData: { title } },
  })
  const answer = (title: string) => ({
    status: 200,
    data: damAssetWithFile('asset-1', 'file-1', AssetFileProcessStatus.Processed, asSaved(title)),
  })

  it.each<[string, boolean]>([
    ['first', true],
    ['last', false],
  ])('end with what the later one saved when the read of the earlier one answers %s', async (_when, earlierFirst) => {
    const row = await rowOfTheAsset()
    const store = useUploadQueuesStore()
    const reads = holdReadsOf('asset-1')
    const firstNote = store.noteRowsOfAsset('asset-1', 'default')
    const first = store.updateFromDetail(
      dam.fileBecomes('asset-1', AssetFileProcessStatus.Processed, asSaved('first')),
      'default',
      undefined,
      firstNote
    )
    await vi.waitFor(() => expect(reads.waiting).toHaveLength(1))
    const secondNote = store.noteRowsOfAsset('asset-1', 'default')
    const second = store.updateFromDetail(
      dam.fileBecomes('asset-1', AssetFileProcessStatus.Processed, asSaved('second')),
      'default',
      undefined,
      secondNote
    )
    await vi.waitFor(() => expect(reads.waiting).toHaveLength(2))
    const [ofTheFirst, ofTheSecond] = reads.waiting

    if (earlierFirst) {
      ofTheFirst!.release(answer('first'))
      await first
      ofTheSecond!.release(answer('second'))
      await second
    } else {
      ofTheSecond!.release(answer('second'))
      await second
      ofTheFirst!.release(answer('first'))
      await first
    }

    expect(row).toMatchObject({ keywords: ['keyword-of-second'], customData: { title: 'second' } })
  })

  // The number of a write is never given twice.
  // Before, a third save numbered as the first let the late read of the first write after the second had ended.
  it('end with what the latest one saved when a third begins after the second has written, the read of the first still on its way', async () => {
    const row = await rowOfTheAsset()
    const store = useUploadQueuesStore()
    const reads = holdReadsOf('asset-1')
    const saveOf = (title: string) =>
      store.updateFromDetail(
        dam.fileBecomes('asset-1', AssetFileProcessStatus.Processed, asSaved(title)),
        'default',
        undefined,
        store.noteRowsOfAsset('asset-1', 'default')
      )
    const first = saveOf('first')
    await vi.waitFor(() => expect(reads.waiting).toHaveLength(1))
    const second = saveOf('second')
    await vi.waitFor(() => expect(reads.waiting).toHaveLength(2))
    reads.waiting[1]!.release(answer('second'))
    await second
    expect(row.keywords).toEqual(['keyword-of-second'])

    const third = saveOf('third')
    await vi.waitFor(() => expect(reads.waiting).toHaveLength(2))
    const [ofTheFirst, ofTheThird] = reads.waiting
    ofTheFirst!.release(answer('first'))
    await first

    expect(row.keywords).toEqual(['keyword-of-second'])
    ofTheThird!.release(answer('third'))
    await third
    expect(row).toMatchObject({ keywords: ['keyword-of-third'], customData: { title: 'third' } })
  })

  it('end with what the later one saved when it is pressed before the earlier one writes', async () => {
    const row = await rowOfTheAsset()
    const store = useUploadQueuesStore()
    const firstNote = store.noteRowsOfAsset('asset-1', 'default')
    const secondNote = store.noteRowsOfAsset('asset-1', 'default')
    await store.updateFromDetail(
      dam.fileBecomes('asset-1', AssetFileProcessStatus.Processed, asSaved('first')),
      'default',
      undefined,
      firstNote
    )
    expect(row).toMatchObject({ keywords: ['keyword-of-first'] })

    await store.updateFromDetail(
      dam.fileBecomes('asset-1', AssetFileProcessStatus.Processed, asSaved('second')),
      'default',
      undefined,
      secondNote
    )

    expect(row).toMatchObject({ keywords: ['keyword-of-second'], customData: { title: 'second' } })
  })
})
