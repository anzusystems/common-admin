import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, type Pinia, setActivePinia } from 'pinia'
import { consumerProfiles, installConsumerProfile } from '@/domains/dam/__tests__/support/consumerProfiles'
import { answerDamNames } from '@/domains/dam/__tests__/support/damNames'
import { type DamSocket, stubDamSocket } from '@/domains/dam/__tests__/support/damSocket'
import { createFakeDam, type FakeDam } from '@/domains/dam/__tests__/support/fakeDam'
import { holdLongWaits, type LongWaits } from '@/domains/dam/__tests__/support/longWaits'
import { alertText, damText, forgetAlerts, shownAlerts } from '@/domains/dam/__tests__/support/uploadUi'
import { destroyDamNotifications, initDamNotifications } from '@/domains/dam/composables/damNotifications'
import {
  type DamNotification,
  DamNotificationName,
  useDamNotificationsEventBus,
} from '@/domains/dam/composables/damNotificationsEventBus'
import { AssetFileFailReason, AssetFileProcessStatus } from '@/domains/dam/types/AssetFile'
import type { ImageStoreItem } from '@/domains/dam/types/ImageAware'
import { UploadQueueItemStatus } from '@/domains/dam/types/UploadQueue'
import UploadQueueDialog from '@/domains/dam/uploadQueue/components/UploadQueueDialog.vue'
import { useUploadQueueItemRefresh } from '@/domains/dam/uploadQueue/composables/uploadQueueItemRefresh'
import { useUploadQueueDialog } from '@/domains/dam/uploadQueue/composables/useUploadQueueDialog'
import { useUploadQueuesStore } from '@/domains/dam/uploadQueue/store/uploadQueuesStore'

// "Save and apply" reads again every uploaded row that has no form yet. Such a read counts like any other.
// The third read that finds no asset fails the row ("Asset už
// neexistuje."). The row is not handed over and the user is told why.

const QUEUE = 'dialog-save-asset-gone'
const { Processing, Uploaded, Failed } = UploadQueueItemStatus
const ASSET_GONE = 'common.damImage.queueItem.assetGone'

let pinia: Pinia
let dam: FakeDam
let waits: LongWaits
let socket: DamSocket
let wrapper: VueWrapper | undefined

const photo = (name: string) => new File([new Uint8Array(3000)], name, { type: 'image/jpeg' })
const metadata = (customData: Record<string, unknown>) => ({
  metadata: { customData, authorSuggestions: {}, keywordSuggestions: {} },
})

describe.each(consumerProfiles)('"save and apply" of the upload dialog under the $name', (profile) => {
  const { endPoints, extSystem, licence } = profile

  beforeEach(() => {
    pinia = createPinia()
    setActivePinia(pinia)
    dam = createFakeDam(endPoints)
    installConsumerProfile(profile, dam.client)
    answerDamNames(dam)
    waits = holdLongWaits()
    socket = stubDamSocket()
    forgetAlerts()
    if (profile.notifications) {
      initDamNotifications().openConnection()
      socket.accept()
    }
    useUploadQueueDialog().uploadQueueDialog.value = QUEUE
  })
  afterEach(() => {
    wrapper?.unmount()
    wrapper = undefined
    useUploadQueuesStore(pinia).stopUpload(QUEUE)
    useUploadQueueDialog().uploadQueueDialog.value = null
    destroyDamNotifications()
    waits.restore()
    socket.restore()
    useDamNotificationsEventBus().reset()
  })

  const statuses = () =>
    useUploadQueuesStore(pinia)
      .getQueueItems(QUEUE)
      .map((item) => item.status)
  const saveAndApply = () =>
    Array.from(document.body.querySelectorAll<HTMLButtonElement>('.v-toolbar button')).find((button) =>
      [damText('upload.saveAndApply'), damText('upload.apply')].includes(button.textContent?.trim() ?? '')
    )!

  const secondWithoutItsFormAndGone = async () => {
    await useUploadQueuesStore(pinia).addByFiles(QUEUE, extSystem, licence, [photo('a.jpg'), photo('b.jpg')], 'default')
    wrapper = mount(UploadQueueDialog, {
      attachTo: document.body,
      props: {
        queueKey: QUEUE,
        licenceId: licence,
        fileInputKey: 0,
        extSystem,
        accept: undefined,
        maxSizes: undefined,
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
    const [a, b] = useUploadQueuesStore(pinia).getQueueItems(QUEUE)
    await vi.waitFor(() => expect(statuses()).toEqual([Processing, Processing]))
    dam.fileBecomes(a!.assetId!, AssetFileProcessStatus.Processed, metadata({ description: 'first' }))
    dam.fileBecomes(b!.assetId!, AssetFileProcessStatus.Processed, metadata({ description: 'second' }))
    useDamNotificationsEventBus().emit({
      name: DamNotificationName.AssetFileProcessed,
      data: { asset: b!.assetId, id: b!.fileId },
    } as unknown as DamNotification)
    await vi.waitFor(() => expect(statuses()).toEqual([Processing, Uploaded]))
    await waits.elapse()
    await vi.waitFor(() => expect(statuses()).toEqual([Uploaded, Uploaded]))
    await flushPromises()
    expect([a!.canEditMetadata, b!.canEditMetadata]).toEqual([true, false])
    dam.assets.delete(b!.assetId!)
    return { a: a!, b: b! }
  }

  it('fails a row its read is the third to find without its asset, hands over the others, and says the asset no longer exists', async () => {
    const { a, b } = await secondWithoutItsFormAndGone()
    const { refreshItem } = useUploadQueueItemRefresh('default')
    await refreshItem(b.assetId!, b, QUEUE)
    await refreshItem(b.assetId!, b, QUEUE)
    expect(b.status).toBe(Uploaded)
    forgetAlerts()

    saveAndApply().click()
    await vi.waitFor(() => expect(wrapper!.emitted('apply')).toHaveLength(1))

    expect(b).toMatchObject({ status: Failed, error: { hasError: true, message: alertText(ASSET_GONE) } })
    const [images] = wrapper!.emitted('apply')![0] as [ImageStoreItem[]]
    expect(images.map((image) => image.assetId)).toEqual([a.assetId])
    expect(shownAlerts()).toEqual([['warning', alertText(ASSET_GONE)]])
  })

  it('says nothing of a row its read finds failed by the server, which it leaves out', async () => {
    const { a, b } = await secondWithoutItsFormAndGone()
    dam.fileBecomes(b.assetId!, AssetFileProcessStatus.Failed, {}, { failReason: AssetFileFailReason.None })

    saveAndApply().click()
    await vi.waitFor(() => expect(wrapper!.emitted('apply')).toHaveLength(1))

    expect(b).toMatchObject({ status: Failed, error: { assetFileFailReason: AssetFileFailReason.None } })
    const [images] = wrapper!.emitted('apply')![0] as [ImageStoreItem[]]
    expect(images.map((image) => image.assetId)).toEqual([a.assetId])
    expect(shownAlerts()).toEqual([])
  })

  it('says nothing of a row a failed notification fails while its read is on its way', async () => {
    const { a, b } = await secondWithoutItsFormAndGone()
    const reads = dam.hold('GET', dam.routes.one)

    saveAndApply().click()
    await vi.waitFor(() => expect(reads.waiting).toHaveLength(1))
    useDamNotificationsEventBus().emit({
      name: DamNotificationName.AssetFileFailed,
      data: { asset: b.assetId, failReason: AssetFileFailReason.None },
    } as unknown as DamNotification)
    await vi.waitFor(() => expect(b.status).toBe(Failed))
    reads.release()
    await vi.waitFor(() => expect(wrapper!.emitted('apply')).toHaveLength(1))

    const [images] = wrapper!.emitted('apply')![0] as [ImageStoreItem[]]
    expect(images.map((image) => image.assetId)).toEqual([a.assetId])
    expect(shownAlerts()).toEqual([])
  })
})
