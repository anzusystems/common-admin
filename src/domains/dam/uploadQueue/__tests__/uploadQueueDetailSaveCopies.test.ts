import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { cmsConfiguration, installConsumerProfile } from '@/domains/dam/__tests__/support/consumerProfiles'
import { answerDamNames, damNamesAsked } from '@/domains/dam/__tests__/support/damNames'
import { createFakeDam, damAssetWithFile, type FakeDam } from '@/domains/dam/__tests__/support/fakeDam'
import { holdLongWaits, type LongWaits } from '@/domains/dam/__tests__/support/longWaits'
import {
  type DamNotification,
  DamNotificationName,
  type DamNotificationNameType,
  useDamNotificationsEventBus,
} from '@/domains/dam/composables/damNotificationsEventBus'
import { DamAssetType } from '@/domains/dam/types/Asset'
import { AssetFileProcessStatus } from '@/domains/dam/types/AssetFile'
import { useUploadQueueMassOperations } from '@/domains/dam/uploadQueue/composables/uploadQueueMassOperations'
import { useUploadQueuesStore } from '@/domains/dam/uploadQueue/store/uploadQueuesStore'

// One asset can be a row of two queues (two widgets of a page). A save in its detail gives both rows what the DAM
// then answers for it, from one read: each row gets its own lists and custom data, as when the read fails. A fill or
// an edit in one queue changed the row of the other queue too, and that queue's next save sent it for the asset.

const { endPoints, extSystem, licence } = cmsConfiguration
const QUEUE = 'detail-save-queue'
const OTHER_QUEUE = 'detail-save-queue-of-another-widget'

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
  const store = useUploadQueuesStore()
  store.stopUpload(QUEUE)
  store.stopUpload(OTHER_QUEUE)
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
    customData: { title: 'saved in the detail', tags: ['saved'] },
    authorSuggestions: {},
    keywordSuggestions: {},
  },
}

/** A copy of one asset in two queues, settled, with its form; its detail saved. */
const savedInTheDetailOfARowInTwoQueues = async () => {
  const store = useUploadQueuesStore()
  dam.assets.set('asset-1', damAssetWithFile('asset-1', 'file-1', AssetFileProcessStatus.Processed))
  await store.addByCopyToLicence(QUEUE, extSystem, licence, ['asset-1'])
  await store.addByCopyToLicence(OTHER_QUEUE, extSystem, licence, ['asset-1'])
  notify(DamNotificationName.AssetFileCopied, { asset: 'asset-1' })
  const [here] = store.getQueueItems(QUEUE)
  const [there] = store.getQueueItems(OTHER_QUEUE)
  await vi.waitFor(() => expect([here, there].map((item) => item!.canEditMetadata)).toEqual([true, true]))
  const detail = dam.fileBecomes('asset-1', AssetFileProcessStatus.Processed, saved)
  await store.updateFromDetail(detail)
  expect(there).toMatchObject({
    keywords: saved.keywords,
    authors: saved.authors,
    customData: { title: 'saved in the detail' },
  })
  return { here: here!, there: there! }
}

describe('a save in the asset detail of a row of two queues', () => {
  it('leaves the row of the other queue as saved when a field is filled in one queue', async () => {
    const { here, there } = await savedInTheDetailOfARowInTwoQueues()

    useUploadQueueMassOperations(QUEUE).replaceEmptyCustomDataValue(
      { assetType: DamAssetType.Image, elementProperty: 'title', value: 'filled in this queue' },
      true
    )

    expect(here.customData.title).toBe('filled in this queue')
    expect(there.customData.title).toBe('saved in the detail')
  })

  it('gives each row lists and custom data of its own: an edit of one row leaves the other', async () => {
    const { here, there } = await savedInTheDetailOfARowInTwoQueues()

    here.keywords.push('typed-into-the-row')
    here.authors.push('typed-into-the-row')
    here.customData.tags.push('typed into the row')

    expect(there).toMatchObject({
      keywords: ['keyword-saved'],
      authors: ['author-saved'],
      customData: { title: 'saved in the detail', tags: ['saved'] },
    })
  })
})
