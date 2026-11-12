import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, type Pinia, setActivePinia } from 'pinia'
import { cmsConfiguration, installConsumerProfile } from '@/domains/dam/__tests__/support/consumerProfiles'
import { answerDamNames, damNamesAsked } from '@/domains/dam/__tests__/support/damNames'
import { type DamSocket, stubDamSocket } from '@/domains/dam/__tests__/support/damSocket'
import {
  createFakeDam,
  damAssetWithFile,
  type FakeDam,
  type FakeDamAnswer,
} from '@/domains/dam/__tests__/support/fakeDam'
import { holdLongWaits, type LongWaits } from '@/domains/dam/__tests__/support/longWaits'
import { alertText, damText, forgetAlerts, shownAlerts } from '@/domains/dam/__tests__/support/uploadUi'
import { useAssetDetailStore } from '@/domains/dam/assetDetail/store/assetDetailStore'
import { destroyDamNotifications, initDamNotifications } from '@/domains/dam/composables/damNotifications'
import { DamNotificationName, useDamNotificationsEventBus } from '@/domains/dam/composables/damNotificationsEventBus'
import { DamAssetType } from '@/domains/dam/types/Asset'
import { AssetFileProcessStatus } from '@/domains/dam/types/AssetFile'
import { UploadQueueItemStatus } from '@/domains/dam/types/UploadQueue'
import UploadQueueDialog from '@/domains/dam/uploadQueue/components/UploadQueueDialog.vue'
import UploadQueueDialogSingle from '@/domains/dam/uploadQueue/components/UploadQueueDialogSingle.vue'
import { useUploadQueueDialog } from '@/domains/dam/uploadQueue/composables/useUploadQueueDialog'
import { useUploadQueuesStore } from '@/domains/dam/uploadQueue/store/uploadQueuesStore'

const profile = cmsConfiguration
const { endPoints, extSystem, licence } = profile
const QUEUE = 'dialog-during-read'
const { Processing, Uploaded } = UploadQueueItemStatus

let pinia: Pinia
let dam: FakeDam
let waits: LongWaits
let socket: DamSocket
let wrapper: VueWrapper | undefined

const photo = (name = 'photo.jpg') => new File([new Uint8Array(3000)], name, { type: 'image/jpeg' })
const metadata = (customData: Record<string, unknown>) => ({
  metadata: { customData, authorSuggestions: {}, keywordSuggestions: {} },
})

beforeEach(() => {
  pinia = createPinia()
  setActivePinia(pinia)
  dam = createFakeDam(endPoints)
  installConsumerProfile(profile, dam.client)
  answerDamNames(dam)
  waits = holdLongWaits()
  socket = stubDamSocket()
  forgetAlerts()
  initDamNotifications().openConnection()
  socket.accept()
  useUploadQueueDialog().uploadQueueDialog.value = QUEUE
})
afterEach(async () => {
  wrapper?.unmount()
  wrapper = undefined
  useUploadQueuesStore(pinia).stopUpload(QUEUE)
  useUploadQueueDialog().uploadQueueDialog.value = null
  await damNamesAsked()
  destroyDamNotifications()
  waits.restore()
  socket.restore()
  useDamNotificationsEventBus().reset()
})

const queue = () => useUploadQueuesStore(pinia)
const rowsOfQueue = () => queue().getQueueItems(QUEUE)
const statuses = () => rowsOfQueue().map((item) => item.status)
const readsOf = (asset: string) =>
  dam.sentTo('GET', dam.routes.one).filter((request) => request.url === `${endPoints.asset}/${asset}`)
const systemError = ['error', alertText('common.alert.unknownError')]
const originalInTheDam = () =>
  dam.assets.set(
    'asset-original',
    damAssetWithFile('asset-original', 'file-original', AssetFileProcessStatus.Processed, {
      licence,
      ...metadata({ description: 'of the original' }),
    })
  )

describe('the dialog of one uploaded file', () => {
  const mountDialog = async () => {
    wrapper = mount(UploadQueueDialogSingle, {
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
          DamAssetImageRoiSelectLazy: true,
          AssetDetailSidebarROI: true,
          AFormRemoteAutocompleteWithCached: true,
        },
      },
    })
    await flushPromises()
  }
  const row = () => rowsOfQueue()[0]!
  const processed = async () => {
    await queue().addByFiles(QUEUE, extSystem, licence, [photo()], 'default')
    await mountDialog()
    await vi.waitFor(() => expect(row().status).toBe(Processing))
    dam.fileBecomes('asset-1', AssetFileProcessStatus.Processed, metadata({ description: 'from the server' }))
    await waits.elapse()
    await vi.waitFor(() => expect(row().status).toBe(Uploaded))
  }
  const becomesTheOriginal = async () => {
    await queue().queueItemDuplicate('asset-1', 'file-original', DamAssetType.Image, 'default')
    await vi.waitFor(() => expect(row().assetId).toBe('asset-original'))
  }

  it('reads the asset of a row that becomes the original of a duplicate once it is done, and shows it', async () => {
    originalInTheDam()
    await processed()
    await vi.waitFor(() => expect(useAssetDetailStore(pinia).asset?.id).toBe('asset-1'))
    await flushPromises()

    await becomesTheOriginal()

    await vi.waitFor(() => expect(useAssetDetailStore(pinia).asset?.id).toBe('asset-original'))
    expect(readsOf('asset-original')).toHaveLength(1)
    expect(shownAlerts()).toEqual([])
  })

  it('says that the read failed of a row that became the original of a duplicate while it was on its way', async () => {
    originalInTheDam()
    let answerTheDialog: ((answer: FakeDamAnswer) => void) | undefined
    dam.reply((request) =>
      request.method === 'GET' &&
      request.url === `${endPoints.asset}/asset-1` &&
      rowsOfQueue()[0]?.status === Uploaded &&
      !answerTheDialog
        ? new Promise<FakeDamAnswer>((resolve) => (answerTheDialog = resolve))
        : undefined
    )
    await processed()
    await vi.waitFor(() => expect(answerTheDialog).toBeDefined())

    await becomesTheOriginal()
    answerTheDialog!({ status: 500 })

    await vi.waitFor(() => expect(shownAlerts()).toEqual([systemError]))
    await vi.waitFor(() => expect(useAssetDetailStore(pinia).asset?.id).toBe('asset-original'))
  })

  it("says nothing of a failed read of a dialog closed meanwhile, over the widget's next upload", async () => {
    let answerTheDialog: ((answer: FakeDamAnswer) => void) | undefined
    dam.reply((request) =>
      request.method === 'GET' &&
      request.url === `${endPoints.asset}/asset-1` &&
      rowsOfQueue()[0]?.status === Uploaded &&
      !answerTheDialog
        ? new Promise<FakeDamAnswer>((resolve) => (answerTheDialog = resolve))
        : undefined
    )
    await processed()
    await vi.waitFor(() => expect(answerTheDialog).toBeDefined())

    queue().stopUpload(QUEUE)
    await queue().addByFiles(QUEUE, extSystem, licence, [photo('next.jpg')], 'default')
    await flushPromises()
    expect(rowsOfQueue()).toHaveLength(1)
    answerTheDialog!({ status: 500 })
    await waits.settle()

    expect(shownAlerts()).toEqual([])
  })
})

describe('"save and apply" of the queue dialog', () => {
  const toolbar = () => document.body.querySelector<HTMLElement>('.v-toolbar')!
  const toolbarButtons = () => Array.from(toolbar().querySelectorAll<HTMLButtonElement>('button'))
  const saveAndApply = () =>
    toolbarButtons().find((button) =>
      [damText('upload.saveAndApply'), damText('upload.apply')].includes(button.textContent?.trim() ?? '')
    )!
  const close = () => toolbar().querySelector<HTMLButtonElement>('[data-cy="button-close"]')!
  const saves = () => dam.sentTo('PATCH', dam.routes.bulkMetadata)

  // With notifications a file is uploaded before its metadata comes, so the dialog reads such a row first.
  it('saves nothing and hands nothing over once the dialog is closed while it reads a row uploaded without its form', async () => {
    await queue().addByFiles(QUEUE, extSystem, licence, [photo('a.jpg'), photo('b.jpg')], 'default')
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
    await flushPromises()
    const [a, b] = rowsOfQueue()
    await vi.waitFor(() => expect(statuses()).toEqual([Processing, Processing]))
    dam.fileBecomes(a!.assetId!, AssetFileProcessStatus.Processed, metadata({ description: 'first' }))
    dam.fileBecomes(b!.assetId!, AssetFileProcessStatus.Processed, metadata({ description: 'second' }))
    socket.deliver(DamNotificationName.AssetFileProcessed, { asset: b!.assetId, id: b!.fileId })
    await vi.waitFor(() => expect(statuses()).toEqual([Processing, Uploaded]))
    await waits.elapse()
    await vi.waitFor(() => expect(statuses()).toEqual([Uploaded, Uploaded]))
    await damNamesAsked()
    expect([a!.canEditMetadata, b!.canEditMetadata]).toEqual([true, false])
    const reads = dam.hold('GET', new RegExp(`^${endPoints.asset}/${b!.assetId}$`))

    saveAndApply().click()
    await vi.waitFor(() => expect(reads.waiting).toHaveLength(1))
    close().click()
    await flushPromises()
    expect(useUploadQueueDialog().uploadQueueDialog.value).toBeNull()
    reads.release()
    await waits.settle()

    expect(saves()).toEqual([])
    expect(wrapper.emitted('apply')).toBeUndefined()
  })
})
