import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, type Pinia, setActivePinia } from 'pinia'
import { reactive } from 'vue'
import { cmsConfiguration, installConsumerProfile } from '@/domains/dam/__tests__/support/consumerProfiles'
import { answerDamNames, DAM_NAMES, damNameLookups, damNamesAsked } from '@/domains/dam/__tests__/support/damNames'
import { createFakeDam, type FakeDam } from '@/domains/dam/__tests__/support/fakeDam'
import { useDamCachedAuthors } from '@/domains/dam/author/composables/cachedAuthors'
import { useDamCachedKeywords } from '@/domains/dam/keyword/composables/cachedKeywords'
import { DamAssetType } from '@/domains/dam/types/Asset'
import { type UploadQueueItem, UploadQueueItemStatus, UploadQueueItemType } from '@/domains/dam/types/UploadQueue'
import UploadQueueEditable from '@/domains/dam/uploadQueue/components/UploadQueueEditable.vue'
import { useUploadQueueItemFactory } from '@/domains/dam/uploadQueue/factory/UploadQueueItemFactory'
import { useUploadQueuesStore } from '@/domains/dam/uploadQueue/store/uploadQueuesStore'

// The list of a queue over the library's own store, without a binding of its host: as it mounts, it hands the
// keywords and the authors of its rows to the name caches, and they ask the DAM for their names. Only the binding of a
// host had a case of its own (`uploadQueueListHosted.test.ts`). The rows are stand-ins, so the names are asked for by
// the list alone; the DAM is a client that records its requests.

const { endPoints, extSystem, licence } = cmsConfiguration
const QUEUE = 'library-queue'

let pinia: Pinia
let dam: FakeDam
let wrapper: VueWrapper | undefined

beforeEach(() => {
  pinia = createPinia()
  setActivePinia(pinia)
  dam = createFakeDam(endPoints)
  installConsumerProfile(cmsConfiguration, dam.client)
  answerDamNames(dam)
})
afterEach(async () => {
  wrapper?.unmount()
  wrapper = undefined
  await damNamesAsked()
  useDamCachedAuthors().cachedAuthors.value.clear()
  useDamCachedKeywords().cachedKeywords.value.clear()
})

const row = (key: string) => {
  const item = reactive(
    useUploadQueueItemFactory().createDefault(
      key,
      UploadQueueItemType.File,
      UploadQueueItemStatus.Uploaded,
      DamAssetType.Image,
      extSystem,
      licence
    )
  )
  item.assetId = `asset-of-${key}`
  item.keywords = [`keyword-of-${key}`]
  item.authors = [`author-of-${key}`]
  return item as UploadQueueItem
}
/** The ids of the names of that kind the DAM was asked for, over all its lookups. */
const askedFor = (kind: 'author' | 'keyword') =>
  damNameLookups(dam)
    .map((request) => request.url.match(DAM_NAMES)!)
    .filter((match) => match[1] === kind)
    .flatMap((match) => (new URLSearchParams(match[3]).get('id') ?? '').split(','))
    .sort()

describe('the list of a queue of the library', () => {
  it('has the DAM asked for the names of the keywords and authors of its rows as it mounts', async () => {
    const store = useUploadQueuesStore(pinia)
    store.forceReloadFileInput(QUEUE)
    store.getQueue(QUEUE)!.items.push(row('a'), row('b'))

    wrapper = mount(UploadQueueEditable, {
      attachTo: document.body,
      props: { queueKey: QUEUE, extSystem, massOperations: false },
      global: { plugins: [pinia], stubs: { UploadQueueItemEditable: true, AssetQueueSelectedSidebar: true } },
    })
    await flushPromises()
    await damNamesAsked()

    expect(askedFor('keyword')).toEqual(['keyword-of-a', 'keyword-of-b'])
    expect(askedFor('author')).toEqual(['author-of-a', 'author-of-b'])
  })
})
