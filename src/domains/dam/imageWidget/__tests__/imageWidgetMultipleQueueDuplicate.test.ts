import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, type Pinia, setActivePinia } from 'pinia'
import { defineComponent, h, shallowRef } from 'vue'
import { type ConsumerImageApi, installConsumerImageApi } from '@/domains/dam/__tests__/support/consumerImageApi'
import { cmsConfiguration, installConsumerProfile } from '@/domains/dam/__tests__/support/consumerProfiles'
import { answerDamNames, damNamesAsked } from '@/domains/dam/__tests__/support/damNames'
import { createFakeDam, damAssetWithFile, type FakeDam } from '@/domains/dam/__tests__/support/fakeDam'
import { holdLongWaits, type LongWaits } from '@/domains/dam/__tests__/support/longWaits'
import { forgetAlerts, signInToDam, signOutOfDam } from '@/domains/dam/__tests__/support/uploadUi'
import { useDamNotificationsEventBus } from '@/domains/dam/composables/damNotificationsEventBus'
import { useDamConfigStore } from '@/domains/dam/config/store/damConfigStore'
import ImageWidgetMultipleInner from '@/domains/dam/imageWidget/components/ImageWidgetMultipleInner.vue'
import { useImageMassOperations } from '@/domains/dam/imageWidget/composables/useImageMassOperations'
import { useImageStore } from '@/domains/dam/imageWidget/store/imageStore'
import { ImageWidgetUploadConfigKey } from '@/domains/dam/imageWidget/utils/imageWidgetInkectionKeys'
import { AssetFileProcessStatus } from '@/domains/dam/types/AssetFile'
import type { ImageAware, ImageStoreItem } from '@/domains/dam/types/ImageAware'
import { useUploadQueueDialog } from '@/domains/dam/uploadQueue/composables/useUploadQueueDialog'

// A file uploaded into the gallery that duplicates an asset a
// row has: the upload dialog has saved that asset's authors.
// Rows offering the author pick take them. Their source takes the names only if it is
// empty or was written by "fill empty". It used to always take the upload's source.
// admin-cms only.

const profile = cmsConfiguration
const { endPoints, extSystem, licence } = profile
const QUEUE = 'gallery-duplicate'
const SEARCH = new RegExp(
  `^${endPoints.asset.replace(/\//g, '\\/')}\\/licence\\/(\\d+)\\/search\\?assetAndMainFileIds=([^&]*)`
)
const Picker = defineComponent({ name: 'AAssetSelect', emits: ['confirm'], setup: () => () => h('div') })
const Editor = defineComponent({
  name: 'ASortableListEditor',
  setup: (_, { slots, expose }) => {
    expose({ commit: () => undefined, cancelReorderMode: () => undefined })
    return () => h('div', slots['view-body']?.())
  },
})
const UploadDialog = defineComponent({ name: 'UploadQueueDialog', emits: ['apply'], setup: () => () => h('div') })

let pinia: Pinia
let dam: FakeDam
let imageApi: ConsumerImageApi
let waits: LongWaits
let widget: VueWrapper | undefined

beforeEach(() => {
  pinia = createPinia()
  setActivePinia(pinia)
  dam = createFakeDam(endPoints)
  imageApi = installConsumerImageApi(profile, installConsumerProfile(profile, dam.client))
  answerDamNames(dam)
  dam.reply((request) => {
    const match = request.method === 'GET' ? request.url.match(SEARCH) : null
    if (!match) return undefined
    const files = match[2]!.split(',')
    const found = [...dam.assets.values()].filter((asset) => asset.mainFile && files.includes(asset.mainFile.id))
    return { status: 200, data: { data: found, totalCount: found.length } }
  })
  waits = holdLongWaits()
  forgetAlerts()
  signInToDam(extSystem)
})
afterEach(async () => {
  widget?.unmount()
  widget = undefined
  useUploadQueueDialog().uploadQueueDialog.value = null
  await damNamesAsked()
  waits.restore()
  useDamNotificationsEventBus().reset()
  signOutOfDam()
})

const images = () => useImageStore(pinia).images

const galleryWith = async (source: string) => {
  const image: ImageAware = {
    id: 12,
    texts: { description: 'image 12', source },
    dam: { damId: 'file-12', licenceId: licence, regionPosition: 0, internal: false },
    flags: { showSource: true, internal: false, overrideInternal: false },
    position: 1,
  }
  imageApi.has(image)
  dam.assets.set('asset-12', damAssetWithFile('asset-12', 'file-12', AssetFileProcessStatus.Processed, { licence }))
  const mounted: VueWrapper = mount(ImageWidgetMultipleInner, {
    attachTo: document.body,
    props: {
      modelValue: [12],
      queueKey: QUEUE,
      uploadLicence: licence,
      selectLicences: [licence],
      'onUpdate:modelValue': (value: number[]) => mounted.setProps({ modelValue: value }),
    } as never,
    global: {
      plugins: [pinia],
      provide: {
        [ImageWidgetUploadConfigKey as symbol]: shallowRef({
          licence,
          extSystem,
          licenceName: '',
          extSystemConfig: useDamConfigStore(pinia).damConfigExtSystem.get(extSystem)!,
        }),
      },
      stubs: {
        ASortableListEditor: Editor,
        AAssetSelect: Picker,
        UploadQueueDialog: UploadDialog,
        AssetDetailDialogFrame: true,
        AImageWidgetSimple: true,
        AssetImage: true,
        AssetQueueSelectedSidebar: true,
        AFileDropzone: true,
        AFormRemoteAutocompleteWithCached: true,
      },
    },
  })
  widget = mounted
  await vi.waitFor(() => expect(images()).toHaveLength(1))
  await damNamesAsked()
  await flushPromises()
  expect(images()[0]!.showDamAuthors).toBe(true)
}

const applyDuplicate = async () => {
  useUploadQueueDialog().uploadQueueDialog.value = QUEUE
  await flushPromises()
  const duplicate: ImageStoreItem = {
    key: 'from-the-queue',
    texts: { description: 'a duplicate', source: 'Name of author-3' },
    dam: { damId: 'file-12', licenceId: licence, regionPosition: 0, internal: false },
    flags: { showSource: true, internal: false, overrideInternal: false },
    position: 2,
    assetId: 'asset-12',
    damAuthors: ['author-3'],
    showDamAuthors: false,
  }
  widget!.findComponent(UploadDialog).vm.$emit('apply', [duplicate])
  await flushPromises()
}

describe('a duplicate of an asset of a row, applied by the upload dialog of the gallery', () => {
  it.each<[string, string, () => Promise<void>, string]>([
    ['its own source, which stays', 'typed by hand', async () => undefined, 'typed by hand'],
    ['their names, where its source is empty', '', async () => undefined, 'Name of author-3'],
    [
      'their names, where its source is what "fill empty" wrote',
      '',
      async () => {
        await useImageMassOperations('default').replaceEmptyAuthors(['author-5'])
        await flushPromises()
      },
      'Name of author-3',
    ],
  ])('gives the row of that asset its authors, the pick gone, with %s', async (_what, source, before, shown) => {
    await galleryWith(source)
    await before()

    await applyDuplicate()

    const [row] = images()
    expect([row!.damAuthors, row!.showDamAuthors, row!.texts.source]).toEqual([['author-3'], false, shown])
  })
})
