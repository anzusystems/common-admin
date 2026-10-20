import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, type Pinia, setActivePinia } from 'pinia'
import { defineComponent, h } from 'vue'
import { cmsConfiguration, installConsumerProfile } from '@/domains/dam/__tests__/support/consumerProfiles'
import { createFakeDam, damAssetWithFile, type FakeDam } from '@/domains/dam/__tests__/support/fakeDam'
import { holdLongWaits, type LongWaits } from '@/domains/dam/__tests__/support/longWaits'
import { seedDamConfigOf } from '@/domains/dam/__tests__/support/namedDamConfig'
import AssetDetailSidebarMetadata from '@/domains/dam/assetDetail/components/AssetDetailSidebarMetadata.vue'
import { useAssetDetailStore } from '@/domains/dam/assetDetail/store/assetDetailStore'
import { useDamCachedAuthors } from '@/domains/dam/author/composables/cachedAuthors'
import { initCommonAdminCoreDamOptions } from '@/domains/dam/composables/commonAdminCoreDamOptions'
import { useDamConfigName } from '@/domains/dam/composables/damConfigName'
import { useDamNotificationsEventBus } from '@/domains/dam/composables/damNotificationsEventBus'
import { useExtSystemIdForCached } from '@/domains/dam/composables/extSystemIdForCached'
import { useDamCachedKeywords } from '@/domains/dam/keyword/composables/cachedKeywords'
import { type AssetDetailItemDto, DamAssetType } from '@/domains/dam/types/Asset'
import { AssetFileProcessStatus, type AssetFileProcessStatusType } from '@/domains/dam/types/AssetFile'
import { type UploadQueueItem, UploadQueueItemStatus } from '@/domains/dam/types/UploadQueue'
import { useLibraryUploadQueueListBinding } from '@/domains/dam/uploadQueue/components/uploadQueueBindings'
import { useUploadQueuesStore } from '@/domains/dam/uploadQueue/store/uploadQueuesStore'

// A page with two DAM configurations of two DAMs, `default` and `own`, each of which has given an asset `a-1`: a copy
// of it into the licence waits in a queue of each configuration. What happens in one DAM concerns only the rows of the
// queues of its configuration: the poll of a queue, the refresh of a row, a duplicate a widget knows of, the save of a
// detail. The names of a row go to the caches of its configuration. Nothing of the library is replaced: each DAM is a
// client that records its requests. The poll and the caches wait for longer than a case: they are held, and let pass
// where a case asserts what they did.

const { endPoints, extSystem, licence } = cmsConfiguration
const OWN = { asset: '/own/v2/asset', image: '/own/v2/image' }
const OWN_AUTHOR = '/own/v2/author'
const OWN_KEYWORD = '/own/v2/keyword'
const OF_DEFAULT = 'scope-of-default'
const OF_OWN = 'scope-of-own'
const ASSET = 'a-1'
const NAMES = /\/(author|keyword)\/ext-system\/\d+\/search$/
/** From here on a wait is held: below the 1.5 s the caches wait before they ask. */
const HELD_FROM_MS = 1_200
const { Processing, Uploaded } = UploadQueueItemStatus
const { Processed, Uploading } = AssetFileProcessStatus

let pinia: Pinia
let dam: FakeDam
let own: FakeDam
let waits: LongWaits
let wrapper: VueWrapper | undefined

/** A DAM knows every name it is asked for. */
const answerNames = (of: FakeDam) =>
  of.reply((request) => {
    const [path, query] = request.url.split('?')
    if (request.method !== 'GET' || !NAMES.test(path!)) return undefined
    const ids = (new URLSearchParams(query).get('id') ?? '').split(',')
    const found = ids.map((id) => ({ id, name: id, identifier: '', flags: { reviewed: true } }))
    return { status: 200, data: { data: found, totalCount: found.length } }
  })

beforeEach(() => {
  pinia = createPinia()
  setActivePinia(pinia)
  dam = createFakeDam(endPoints)
  own = createFakeDam(OWN)
  answerNames(dam)
  answerNames(own)
  const { coreDam } = installConsumerProfile(cmsConfiguration, dam.client)
  initCommonAdminCoreDamOptions({
    ...coreDam,
    configs: {
      ...coreDam.configs,
      own: {
        damClient: own.client,
        endPointAsset: OWN.asset,
        endPointImage: OWN.image,
        endPointAuthor: OWN_AUTHOR,
        endPointKeyword: OWN_KEYWORD,
      },
    },
  })
  seedDamConfigOf('own', pinia)
  useExtSystemIdForCached('own').cachedExtSystemId.value = extSystem
  waits = holdLongWaits(HELD_FROM_MS)
})

afterEach(async () => {
  wrapper?.unmount()
  wrapper = undefined
  const store = useUploadQueuesStore()
  store.stopUpload(OF_DEFAULT)
  store.stopUpload(OF_OWN)
  await waits.elapseAll()
  waits.restore()
  useDamNotificationsEventBus().reset()
})

/** The paths of the reads of the asset a DAM was asked, in order. */
const readsOf = (of: FakeDam) => of.assetReads().map((request) => request.url)
/** The paths of the reads of names a DAM was asked, in order. */
const namesAsked = (of: FakeDam) =>
  of.requests.map((request) => request.url.split('?')[0]!).filter((path) => NAMES.test(path))
/** `a-1` in the DAM `of`, its file in the state given, with names of its own: `<what>-<tag>`. */
const assetIn = (
  of: FakeDam,
  tag: string,
  status: AssetFileProcessStatusType = Processed,
  customData: Record<string, unknown> = {}
) =>
  of.fileBecomes(ASSET, status, {
    licence,
    keywords: [`keyword-${tag}`],
    authors: [`author-${tag}`],
    metadata: { customData, authorSuggestions: {}, keywordSuggestions: {} },
  })
/** What a row has of its asset. */
const fieldsOf = (row: UploadQueueItem) => ({
  status: row.status,
  keywords: [...row.keywords],
  authors: [...row.authors],
  customData: { ...row.customData },
})
const untouched = { status: Processing, keywords: [], authors: [], customData: {} }

/** A copy of `a-1` into the licence in the queue of each configuration: each waits for its DAM. */
const rowsOfA1 = async () => {
  const store = useUploadQueuesStore()
  await store.addByCopyToLicence(OF_DEFAULT, extSystem, licence, [ASSET], 'default')
  await store.addByCopyToLicence(OF_OWN, extSystem, licence, [ASSET], 'own')
  return { store, ofDefault: store.getQueueItems(OF_DEFAULT)[0]!, ofOwn: store.getQueueItems(OF_OWN)[0]! }
}

describe('rows of one asset id in the queues of two DAM configurations', () => {
  it.each(['own', 'default'] as const)(
    'are settled by the poll of a queue only in the queues of its configuration: done in %s',
    async (done) => {
      const { ofDefault, ofOwn } = await rowsOfA1()
      const [doneDam, waitingDam] = done === 'own' ? [own, dam] : [dam, own]
      const [settled, waiting] = done === 'own' ? [ofOwn, ofDefault] : [ofDefault, ofOwn]
      assetIn(doneDam, done)
      assetIn(waitingDam, 'waiting', Uploading)

      await waits.elapse()
      await vi.waitFor(() => expect(settled.status).toBe(Uploaded))
      await vi.waitFor(() => expect(readsOf(waitingDam)).toHaveLength(1))
      await flushPromises()

      expect(fieldsOf(settled)).toMatchObject({ keywords: [`keyword-${done}`], authors: [`author-${done}`] })
      expect(fieldsOf(waiting)).toEqual(untouched)
    }
  )

  it('are read by the client of each configuration that is told the file is processed', async () => {
    const { store, ofDefault, ofOwn } = await rowsOfA1()
    dam.assets.set(ASSET, damAssetWithFile(ASSET, 'file-default', Processed, { licence }))
    own.assets.set(ASSET, damAssetWithFile(ASSET, 'file-own', Processed, { licence }))

    await Promise.all([store.queueItemProcessed(ASSET, 'own'), store.queueItemProcessed(ASSET, 'default')])

    expect(readsOf(own)).toEqual([`${OWN.asset}/${ASSET}`])
    expect(readsOf(dam)).toEqual([`${endPoints.asset}/${ASSET}`])
    expect(ofOwn).toMatchObject({ status: Uploaded, fileId: 'file-own' })
    expect(ofDefault).toMatchObject({ status: Uploaded, fileId: 'file-default' })
  })

  it('are settled by the refresh of a row only in the queues of its configuration, read by its client', async () => {
    const { ofDefault, ofOwn } = await rowsOfA1()
    assetIn(dam, 'refresh-default')
    assetIn(own, 'refresh-own')

    const outcome = await useLibraryUploadQueueListBinding(OF_OWN, 'own').refresh(ofOwn)

    expect(outcome).toBe('settled')
    expect(readsOf(own)).toEqual([`${OWN.asset}/${ASSET}`])
    expect(readsOf(dam)).toEqual([])
    expect(fieldsOf(ofOwn)).toMatchObject({ status: Uploaded, keywords: ['keyword-refresh-own'] })
    expect(fieldsOf(ofDefault)).toEqual(untouched)
  })

  it('are made the original of a duplicate known under one configuration only in its queues', async () => {
    const { store, ofDefault, ofOwn } = await rowsOfA1()
    const original = (tag: string) =>
      damAssetWithFile(`original-${tag}`, 'original-file', Processed, {
        licence,
        keywords: [`keyword-original-${tag}`],
        metadata: { customData: {}, authorSuggestions: {}, keywordSuggestions: {} },
      })
    dam.assets.set('original-default', original('default'))
    own.assets.set('original-own', original('own'))

    await store.queueItemDuplicate(ASSET, 'original-file', DamAssetType.Image, 'own')

    expect(own.originReads()).toHaveLength(1)
    expect(dam.originReads()).toEqual([])
    expect(ofOwn).toMatchObject({ status: Uploaded, isDuplicate: true, assetId: 'original-own' })
    expect(ofOwn.keywords).toEqual(['keyword-original-own'])
    expect(ofDefault).toMatchObject({ status: Processing, isDuplicate: false, assetId: ASSET, keywords: [] })
    expect(useDamCachedKeywords('own').hasCachedKeyword('keyword-original-own')).toBe(true)
    expect(useDamCachedKeywords('default').hasCachedKeyword('keyword-original-own')).toBe(false)
  })

  it('hand the names a read gave a row to the caches of its configuration, which ask its DAM', async () => {
    const { ofOwn } = await rowsOfA1()
    assetIn(own, 'named')
    assetIn(dam, 'waiting-named', Uploading)

    await waits.elapse()
    await vi.waitFor(() => expect(ofOwn.status).toBe(Uploaded))
    await flushPromises()

    expect(useDamCachedAuthors('own').hasCachedAuthor('author-named')).toBe(true)
    expect(useDamCachedKeywords('own').hasCachedKeyword('keyword-named')).toBe(true)
    expect(useDamCachedAuthors('default').hasCachedAuthor('author-named')).toBe(false)
    expect(useDamCachedKeywords('default').hasCachedKeyword('keyword-named')).toBe(false)
    await waits.elapse()
    await flushPromises()
    expect(namesAsked(own).sort()).toEqual([
      `${OWN_AUTHOR}/ext-system/${extSystem}/search`,
      `${OWN_KEYWORD}/ext-system/${extSystem}/search`,
    ])
    expect(namesAsked(dam)).toEqual([])
  })
})

describe('the save of a detail of one asset id under two DAM configurations', () => {
  /** A component under `own` that hands the name to nothing by itself: what is in it has the name from it. */
  const UnderOwn = defineComponent({
    setup(_, { slots }) {
      useDamConfigName('own')

      return () => slots.default?.()
    },
  })
  /** The asset `a-1` of `of` as a detail has saved it. */
  const savedIn = (of: FakeDam, tag: string) => assetIn(of, tag, Processed, { title: `saved in ${tag}` })

  it('writes what the detail saved under one configuration only into the rows of its queues', async () => {
    const { ofDefault, ofOwn } = await rowsOfA1()
    const saved = savedIn(own, 'detail-own')
    assetIn(dam, 'detail-default', Uploading)
    const detail = useAssetDetailStore()
    detail.setAsset(structuredClone(saved))
    detail.updateUploadStore = true
    wrapper = mount(
      defineComponent({
        setup: () => () =>
          h(UnderOwn, () =>
            h(AssetDetailSidebarMetadata, {
              queueKey: OF_OWN,
              isActive: true,
              assetType: DamAssetType.Image,
              extSystem,
            })
          ),
      }),
      {
        attachTo: document.body,
        global: { plugins: [pinia], stubs: { AssetDetailSidebarActionsWrapper: true, AssetMetadata: true } },
      }
    )
    const subject = wrapper.findComponent(AssetDetailSidebarMetadata)

    await (subject.vm as unknown as { $: { setupState: { onSave: () => Promise<void> } } }).$.setupState.onSave()
    await flushPromises()

    expect(fieldsOf(ofOwn)).toMatchObject({
      keywords: ['keyword-detail-own'],
      customData: { title: 'saved in detail-own' },
    })
    expect(fieldsOf(ofDefault)).toEqual(untouched)
    expect(useDamCachedKeywords('own').hasCachedKeyword('keyword-detail-own')).toBe(true)
    expect(useDamCachedKeywords('default').hasCachedKeyword('keyword-detail-own')).toBe(false)
  })

  it.each([
    ['own', 'default'],
    ['default', 'own'],
  ] as const)(
    'writes the saves under %s and then under %s, on their way at once, each into its rows',
    async (...order) => {
      const { store, ofDefault, ofOwn } = await rowsOfA1()
      const saved: Record<string, AssetDetailItemDto> = {
        own: savedIn(own, 'at-once-own'),
        default: savedIn(dam, 'at-once-default'),
      }
      const reads = [own.hold('GET', own.routes.one), dam.hold('GET', dam.routes.one)]
      const notes = { own: store.noteRowsOfAsset(ASSET, 'own'), default: store.noteRowsOfAsset(ASSET, 'default') }

      const writes = order.map((name) => store.updateFromDetail(saved[name]!, name, undefined, notes[name]))
      await vi.waitFor(() => expect(reads[0]!.waiting.length + reads[1]!.waiting.length).toBe(2))
      reads.forEach((held) => held.release())
      await Promise.all(writes)

      expect(ofOwn.customData).toEqual({ title: 'saved in at-once-own' })
      expect(ofDefault.customData).toEqual({ title: 'saved in at-once-default' })
    }
  )

  it('has no save under one configuration wait for a save of the same asset id under the other', () => {
    const detail = useAssetDetailStore()
    const underDefault = new Promise<void>(() => undefined)
    detail.setSaving(ASSET, underDefault, 'default')

    expect(detail.savingOf(ASSET, 'own')).toBeNull()
    expect(detail.savingOf(ASSET, 'default')).not.toBeNull()
  })
})
