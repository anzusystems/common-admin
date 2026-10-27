import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, type Pinia, setActivePinia } from 'pinia'
import { type Component, shallowRef } from 'vue'
import { cmsConfiguration, installConsumerProfile } from '@/domains/dam/__tests__/support/consumerProfiles'
import { type DamSocket, stubDamSocket } from '@/domains/dam/__tests__/support/damSocket'
import { createFakeDam, damAssetWithFile, type FakeDam } from '@/domains/dam/__tests__/support/fakeDam'
import { holdLongWaits, type LongWaits } from '@/domains/dam/__tests__/support/longWaits'
import { seedDamConfigOf } from '@/domains/dam/__tests__/support/namedDamConfig'
import { initCommonAdminCoreDamOptions } from '@/domains/dam/composables/commonAdminCoreDamOptions'
import { useDamNotificationsEventBus } from '@/domains/dam/composables/damNotificationsEventBus'
import { useExtSystemIdForCached } from '@/domains/dam/composables/extSystemIdForCached'
import ImageMediaWidgetInner from '@/domains/dam/imageWidget/components/ImageMediaWidgetInner.vue'
import ImageWidgetInner from '@/domains/dam/imageWidget/components/ImageWidgetInner.vue'
import ImageWidgetMultipleInner from '@/domains/dam/imageWidget/components/ImageWidgetMultipleInner.vue'
import { initCommonAdminImageOptions } from '@/domains/dam/imageWidget/composables/commonAdminImageOptions'
import { ImageWidgetUploadConfigKey } from '@/domains/dam/imageWidget/utils/imageWidgetInkectionKeys'
import { AssetFileProcessStatus } from '@/domains/dam/types/AssetFile'
import { UploadQueueItemStatus } from '@/domains/dam/types/UploadQueue'
import UploadQueueDialog from '@/domains/dam/uploadQueue/components/UploadQueueDialog.vue'
import { useUploadQueueDialog } from '@/domains/dam/uploadQueue/composables/useUploadQueueDialog'
import { useUploadQueuesStore } from '@/domains/dam/uploadQueue/store/uploadQueuesStore'

const { endPoints, extSystem, licence } = cmsConfiguration
const OWN = { asset: '/own/v2/asset', image: '/own/v2/image' }
const OF_DEFAULT = 'entries-of-default'
const OF_OWN = 'entries-of-own'
const ASSET = 'a-1'
/**
 * Waits from this length are held. The caches wait 1.5 s before they ask.
 */
const HELD_FROM_MS = 1_200
const { Processing, Uploaded } = UploadQueueItemStatus
const { Processed } = AssetFileProcessStatus

let pinia: Pinia
let dam: FakeDam
let own: FakeDam
let waits: LongWaits
let socket: DamSocket
let wrapper: VueWrapper | undefined

beforeEach(() => {
  pinia = createPinia()
  setActivePinia(pinia)
  dam = createFakeDam(endPoints)
  own = createFakeDam(OWN)
  const { coreDam, image } = installConsumerProfile(cmsConfiguration, dam.client)
  initCommonAdminCoreDamOptions({
    ...coreDam,
    configs: { ...coreDam.configs, own: { damClient: own.client, endPointAsset: OWN.asset, endPointImage: OWN.image } },
  })
  initCommonAdminImageOptions({ ...image, configs: { ...image.configs, own: image.configs.default! } })
  seedDamConfigOf('own', pinia)
  useExtSystemIdForCached('own').cachedExtSystemId.value = extSystem
  waits = holdLongWaits(HELD_FROM_MS)
  socket = stubDamSocket()
})

afterEach(async () => {
  wrapper?.unmount()
  wrapper = undefined
  useUploadQueueDialog().uploadQueueDialog.value = null
  const store = useUploadQueuesStore()
  store.stopUpload(OF_DEFAULT)
  store.stopUpload(OF_OWN)
  await waits.elapseAll()
  waits.restore()
  socket.restore()
  useDamNotificationsEventBus().reset()
})

const readsOfA1 = (of: FakeDam) =>
  of
    .assetReads()
    .map((request) => request.url)
    .filter((url) => url.endsWith(`/${ASSET}`))
const rowOfDefault = async () => {
  const store = useUploadQueuesStore()
  await store.addByCopyToLicence(OF_DEFAULT, extSystem, licence, [ASSET], 'default')
  return store.getQueueItems(OF_DEFAULT)[0]!
}

describe('a widget under a named DAM configuration whose copy into the licence is there already', () => {
  const widgets: Array<[string, Component, Record<string, unknown>]> = [
    ['the image widget', ImageWidgetInner, { modelValue: null }],
    ['the image and media widget', ImageMediaWidgetInner, { image: null, media: null }],
    ['the widget of several images', ImageWidgetMultipleInner, { modelValue: [] }],
  ]

  it.each(widgets)(
    '%s makes only the row of its queue the original, read from its DAM',
    async (_name, widget, props) => {
      const ofDefault = await rowOfDefault()
      const original = (tag: string) => damAssetWithFile(`original-${tag}`, 'original-file', Processed, { licence })
      dam.assets.set('original-default', original('default'))
      own.assets.set('original-own', original('own'))
      wrapper = mount(widget, {
        attachTo: document.body,
        props: {
          queueKey: OF_OWN,
          uploadLicence: licence,
          selectLicences: [licence],
          configName: 'own',
          ...props,
        } as never,
        global: {
          plugins: [pinia],
          provide: {
            [ImageWidgetUploadConfigKey as symbol]: shallowRef({
              licence,
              extSystem,
              licenceName: '',
              extSystemConfig: {},
            }),
          },
          stubs: {
            AAssetSelect: true,
            AAssetSelectMedia: true,
            ImageDetailDialogMetadata: true,
            ASortableListEditor: true,
            AssetDetailDialog: true,
            UploadQueueDialog: true,
            UploadQueueDialogSingle: true,
            AFileInput: true,
            AFileInputDialog: true,
            AFileDropzone: true,
          },
        },
      })
      await flushPromises()
      const onCopyToLicence = (
        wrapper.vm as unknown as { $: { setupState: { onCopyToLicence: (data: unknown) => void } } }
      ).$.setupState.onCopyToLicence

      onCopyToLicence([
        {
          asset: 'picked',
          targetAsset: ASSET,
          targetMainFile: 'original-file',
          targetAssetLicence: licence,
          result: 'exists',
          assetConflicts: [],
        },
      ])
      const [ofOwn] = useUploadQueuesStore().getQueueItems(OF_OWN)
      await vi.waitFor(() => expect(ofOwn).toMatchObject({ isDuplicate: true, assetId: 'original-own' }))

      expect(own.originReads()).toHaveLength(1)
      expect(dam.originReads()).toEqual([])
      expect(ofDefault).toMatchObject({ status: Processing, isDuplicate: false, assetId: ASSET })
    }
  )
})

describe('the dialog of a queue under a named DAM configuration', () => {
  it('asks about a row without its form on "save and apply" only in its DAM, for the rows of its configuration', async () => {
    const ofDefault = await rowOfDefault()
    dam.assets.set(ASSET, damAssetWithFile(ASSET, 'file-default', Processed, { licence }))
    own.assets.set(ASSET, damAssetWithFile(ASSET, 'file-own', Processed, { licence }))
    const store = useUploadQueuesStore()
    await store.addByCopyToLicence(OF_OWN, extSystem, licence, [ASSET], 'own')
    await store.queueItemProcessed(ASSET, 'own')
    const [ofOwn] = store.getQueueItems(OF_OWN)
    expect(ofOwn).toMatchObject({ status: Uploaded, canEditMetadata: false })
    const before = readsOfA1(own).length
    wrapper = mount(UploadQueueDialog, {
      attachTo: document.body,
      props: {
        queueKey: OF_OWN,
        licenceId: licence,
        fileInputKey: 0,
        extSystem,
        accept: undefined,
        maxSizes: undefined,
        configName: 'own',
      },
      global: {
        plugins: [pinia],
        stubs: {
          AssetImage: true,
          AFormRemoteAutocompleteWithCached: true,
          AssetQueueSelectedSidebar: true,
          AFileInput: true,
          AFileDropzone: true,
        },
      },
    })
    await flushPromises()

    await (
      wrapper.vm as unknown as { $: { setupState: { onSaveAndApply: () => Promise<void> } } }
    ).$.setupState.onSaveAndApply()
    await flushPromises()

    expect(readsOfA1(own).slice(before)).toEqual([`${OWN.asset}/${ASSET}`])
    expect(readsOfA1(dam)).toEqual([])
    expect(ofOwn).toMatchObject({ fileId: 'file-own', canEditMetadata: true })
    expect(ofDefault).toMatchObject({ status: Processing, fileId: null })
  })
})
