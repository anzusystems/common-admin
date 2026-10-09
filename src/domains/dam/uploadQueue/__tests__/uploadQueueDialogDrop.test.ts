import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, type Pinia, setActivePinia } from 'pinia'
import { type Component, shallowRef } from 'vue'
import { cmsConfiguration, installConsumerProfile } from '@/domains/dam/__tests__/support/consumerProfiles'
import { createFakeDam, type FakeDam, type FakeDamRequest } from '@/domains/dam/__tests__/support/fakeDam'
import { holdLongWaits, type LongWaits } from '@/domains/dam/__tests__/support/longWaits'
import AAssetListInner from '@/domains/dam/assetSelect/components/AAssetListInner.vue'
import { useAssetSelectStore } from '@/domains/dam/assetSelect/store/assetSelectStore'
import { useDamNotificationsEventBus } from '@/domains/dam/composables/damNotificationsEventBus'
import { useDamConfigStore } from '@/domains/dam/config/store/damConfigStore'
import ImageWidgetMultipleInner from '@/domains/dam/imageWidget/components/ImageWidgetMultipleInner.vue'
import { ImageWidgetUploadConfigKey } from '@/domains/dam/imageWidget/utils/imageWidgetInkectionKeys'
import { DamAssetType } from '@/domains/dam/types/Asset'
import type { DamConfigLicenceExtSystemReturnType } from '@/domains/dam/types/DamConfig'
import { useUploadQueueDialog } from '@/domains/dam/uploadQueue/composables/useUploadQueueDialog'
import { useUploadQueuesStore } from '@/domains/dam/uploadQueue/store/uploadQueuesStore'

// The open queue dialog covers its host, and has a file input and a dropzone of its own. Both check what they
// are given against the types and sizes the ext system allows, and hand the rest to the host, which queues it the
// way it queues the files of its own file input. The two hosts of the dialog, each mounted with the real dialog
// over the real queue: files are picked through the dialog's `<input type="file">` and dropped onto its dropzone
// as a browser does it. Only the list of rows inside the dialog is a stub.

const { endPoints, extSystem, licence } = cmsConfiguration
const QUEUE = 'host-queue'
/** The largest image the ext system of these cases takes, in bytes. */
const SIZE_LIMIT = 1_000

let pinia: Pinia
let dam: FakeDam
let waits: LongWaits
let wrapper: VueWrapper | undefined

/** The list of assets the asset list asks for, a moment after it mounts. */
const isListRequest = (request: FakeDamRequest) =>
  request.method === 'GET' && request.url.startsWith(`${endPoints.asset}/licence/${licence}/search?`)
// The queue of the pinia the host is mounted with, whichever pinia is the active one: an action of any store
// makes its own pinia the active one, also one that a host of an earlier case still had on its way.
const queue = () => useUploadQueuesStore(pinia)

beforeEach(() => {
  pinia = createPinia()
  setActivePinia(pinia)
  dam = createFakeDam(endPoints)
  installConsumerProfile(cmsConfiguration, dam.client)
  dam.reply((request) => (isListRequest(request) ? { status: 200, data: { data: [], totalCount: 0 } } : undefined))
  // A file added is held back at its first chunk.
  dam.hold('POST', dam.routes.chunk)
  waits = holdLongWaits()
})
afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  useUploadQueueDialog().uploadQueueDialog.value = null
  queue().stopUpload(QUEUE)
  waits.restore()
  useDamNotificationsEventBus().reset()
})

/** What the widget is given to upload with: the ext system's settings for images, with a size limit of its own. */
const uploadConfig = (): DamConfigLicenceExtSystemReturnType => {
  const config = useDamConfigStore(pinia).damConfigExtSystem.get(extSystem)!
  return {
    licence,
    extSystem,
    licenceName: 'cms',
    extSystemConfig: { ...config, image: { ...config.image!, sizeLimit: SIZE_LIMIT } },
  }
}
const image = (name: string, size = 100, type = 'image/jpeg') => new File([new Uint8Array(size)], name, { type })
const images = (count: number) => Array.from({ length: count }, (_, index) => image(`photo-${index + 1}.jpg`))
/** Two files the ext system takes, and between them one of a type and one of a size it does not. */
const mixed = () => [
  image('fits.jpg'),
  image('notes.pdf', 100, 'application/pdf'),
  image('too-large.jpg', SIZE_LIMIT + 1),
  image('fits-exactly.png', SIZE_LIMIT, 'image/png'),
]
const names = (files: File[]) => files.map((file) => file.name)
const newTitles = () =>
  queue()
    .getQueueItems(QUEUE)
    .map((item) => item.displayTitle)
    .filter((title) => title !== '')
/** Rows that wait for the server and send nothing: copies to the licence. */
const alreadyQueued = (count: number) =>
  queue().addByCopyToLicence(
    QUEUE,
    extSystem,
    licence,
    Array.from({ length: count }, (_, index) => `asset-queued-${index + 1}`)
  )

const carrying = (files: File[]) => {
  const dataTransfer = new DataTransfer()
  files.forEach((file) => dataTransfer.items.add(file))
  return dataTransfer
}
// The queue dialog is drawn into the body, over everything; the host has a file input and a dropzone too.
const inTheDialog = <T extends Element>(selector: string) => {
  const found = document.body.querySelector<T>(`.overlay--sidebar ${selector}`)
  if (!found) throw new Error(`The queue dialog has no ${selector}.`)
  return found
}
const ways = {
  /** The user picks the files with the "+" of the dialog. */
  picked: async (files: File[]) => {
    const input = inTheDialog<HTMLInputElement>('input[type="file"]')
    input.files = carrying(files).files
    input.dispatchEvent(new Event('change', { bubbles: true }))
    await flushPromises()
  },
  /** The user drops the files onto the dialog. */
  dropped: async (files: File[]) => {
    inTheDialog('.a-file-dropzone').dispatchEvent(
      new DragEvent('drop', { dataTransfer: carrying(files), bubbles: true, cancelable: true })
    )
    await flushPromises()
  },
}
const eitherWay = ['picked', 'dropped'] as const

/** The host with the dialog of its queue open. */
const mountHost = async (host: Component, props: Record<string, unknown>, stubs: string[]) => {
  wrapper = mount(host, {
    attachTo: document.body,
    props: { queueKey: QUEUE, ...props },
    global: {
      plugins: [pinia],
      provide: { [ImageWidgetUploadConfigKey as symbol]: shallowRef(uploadConfig()) },
      // The rows of the queue are not what is asked here; the dialog around them is the real one.
      stubs: Object.fromEntries(['UploadQueueEditable', ...stubs].map((name) => [name, true])),
    },
  })
  useUploadQueueDialog().uploadQueueDialog.value = QUEUE
  await flushPromises()
  await vi.waitFor(() => inTheDialog('.a-file-dropzone'))
}
// The dialog that asks about the limit is drawn into the body as well, in a card of its own.
const limitDialog = () =>
  Array.from(document.body.querySelectorAll<HTMLElement>('.v-overlay--active .v-card')).find((card) =>
    card.textContent?.includes('You are trying to upload')
  )

describe('files given to the open queue dialog of a widget of several images', () => {
  const mountWidget = (props: Record<string, unknown> = {}) =>
    mountHost(
      ImageWidgetMultipleInner,
      { modelValue: [], uploadLicence: licence, selectLicences: [licence], ...props },
      ['ASortableListEditor', 'AAssetSelect', 'AssetDetailDialog']
    )

  it.each(eitherWay)('are queued when %s, without the ones the ext system does not take', async (way) => {
    await mountWidget()
    await alreadyQueued(2)

    await ways[way](mixed())

    expect(limitDialog()).toBeUndefined()
    expect(newTitles()).toEqual(['fits.jpg', 'fits-exactly.png'])
    expect(queue().getQueueTotalCount(QUEUE)).toBe(4)
    expect(useUploadQueueDialog().uploadQueueDialog.value).toBe(QUEUE)
  })

  // The queue of this widget takes fifty rows: the files of its own file input are held back over that, and so
  // are these.
  it.each(eitherWay)(
    'are held back when %s, and the user asked, when they would take the queue over its fifty rows',
    async (way) => {
      await mountWidget()
      await alreadyQueued(49)

      await ways[way](images(3))

      expect(limitDialog()!.textContent).toContain('You are trying to upload additional 3 files')
      expect(newTitles()).toEqual([])
      expect(queue().getQueueTotalCount(QUEUE)).toBe(49)
      expect(dam.sentTo('POST', dam.routes.start)).toEqual([])
    }
  )

  it.each(eitherWay)('are not queued when %s in a widget that is read-only', async (way) => {
    await mountWidget({ readonly: true })

    await ways[way](images(1))

    expect(queue().getQueueItems(QUEUE)).toEqual([])
  })
})

describe('files given to the open queue dialog of the asset list', () => {
  const mountList = async () => {
    await mountHost(
      AAssetListInner,
      { assetType: DamAssetType.Image, selectConfigs: [uploadConfig()], skipCurrentUserCheck: true },
      [
        'AFilterWrapper',
        'AssetSelectListBar',
        'AssetSelectListTiles',
        'AssetSelectListTable',
        'AssetMetadata',
        'AssetDetailDialog',
      ]
    )
    // The list has asked for its assets and has its answer: nothing of it is on its way when the case ends.
    await vi.waitFor(() => expect(dam.requests.filter(isListRequest)).toHaveLength(1))
    await vi.waitFor(() => expect(useAssetSelectStore(pinia).loader).toBe(false))
  }

  it.each(eitherWay)('are queued when %s, without the ones the ext system does not take', async (way) => {
    await mountList()

    await ways[way](mixed())

    expect(newTitles()).toEqual(['fits.jpg', 'fits-exactly.png'])
    await vi.waitFor(() => expect(dam.sentTo('POST', dam.routes.start)).toHaveLength(2))
    expect(useUploadQueueDialog().uploadQueueDialog.value).toBe(QUEUE)
  })

  // This queue has no limit of its own: nobody is asked, whatever the number of rows.
  it.each(eitherWay)('are queued all when %s, however long the queue gets', async (way) => {
    await mountList()
    await alreadyQueued(49)
    const files = images(3)

    await ways[way](files)

    expect(limitDialog()).toBeUndefined()
    expect(newTitles()).toEqual(names(files))
    expect(queue().getQueueTotalCount(QUEUE)).toBe(52)
  })
})
