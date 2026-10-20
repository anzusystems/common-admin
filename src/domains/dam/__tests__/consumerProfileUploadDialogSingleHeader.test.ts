import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, type Pinia, setActivePinia } from 'pinia'
import { consumerProfiles, installConsumerProfile } from '@/domains/dam/__tests__/support/consumerProfiles'
import { answerDamNames } from '@/domains/dam/__tests__/support/damNames'
import { type DamSocket, stubDamSocket } from '@/domains/dam/__tests__/support/damSocket'
import { createFakeDam, type FakeDam } from '@/domains/dam/__tests__/support/fakeDam'
import { holdLongWaits, type LongWaits } from '@/domains/dam/__tests__/support/longWaits'
import { damText, forgetAlerts, signOutOfDam } from '@/domains/dam/__tests__/support/uploadUi'
import { destroyDamNotifications, initDamNotifications } from '@/domains/dam/composables/damNotifications'
import { useDamNotificationsEventBus } from '@/domains/dam/composables/damNotificationsEventBus'
import { AssetFileFailReason, AssetFileProcessStatus } from '@/domains/dam/types/AssetFile'
import { UploadQueueItemStatus } from '@/domains/dam/types/UploadQueue'
import UploadQueueDialogSingle from '@/domains/dam/uploadQueue/components/UploadQueueDialogSingle.vue'
import { useUploadQueueDialog } from '@/domains/dam/uploadQueue/composables/useUploadQueueDialog'
import { useUploadQueuesStore } from '@/domains/dam/uploadQueue/store/uploadQueuesStore'

// The title of the dialog of one uploaded file, under each of the two applications: "done" once the file is no longer
// on its way, as before, and in the colour the dialog says an error in when the file was refused or failed, not in
// the colour of a success. The real dialog over the real queue; the DAM is a client that records its requests.

const QUEUE = 'single-dialog-header'
const { Processing, Uploaded, Failed } = UploadQueueItemStatus

let pinia: Pinia
let dam: FakeDam
let waits: LongWaits
let socket: DamSocket
let wrapper: VueWrapper | undefined

const photo = () => new File([new Uint8Array(3000)], 'photo.jpg', { type: 'image/jpeg' })

describe.each(consumerProfiles)('the title of the dialog of one uploaded file under the $name', (profile) => {
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
    // As the widget leaves it when it opens the dialog of its queue.
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
    signOutOfDam()
  })

  const item = () => useUploadQueuesStore(pinia).getQueueItems(QUEUE)[0]!
  /** A file is picked: the widget queues it and opens the dialog of its queue. */
  const pickOne = async () => {
    await useUploadQueuesStore(pinia).addByFiles(QUEUE, extSystem, licence, [photo()], 'default')
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
  /** The title in the toolbar of the dialog, which is drawn into the body, within the place the frame gives it. */
  const title = () =>
    document.body.querySelector<HTMLElement>('.dam-image-detail .v-toolbar .text-label-large > .text-label-large')!
  const colours = () => [...title().classList].filter((name) => name === 'text-error' || name.startsWith('text-green'))

  it('a file the server refuses: says the upload is done, in the colour of an error', async () => {
    await pickOne()
    await vi.waitFor(() => expect(item().status).toBe(Processing))
    dam.fileBecomes('asset-1', AssetFileProcessStatus.Failed, {}, { failReason: AssetFileFailReason.InvalidMimeType })
    await waits.elapse()
    await vi.waitFor(() => expect(item().status).toBe(Failed))
    await flushPromises()

    expect(title().textContent?.trim()).toBe(damText('upload.titleDone'))
    expect(colours()).toEqual(['text-error'])
  })

  it('a file whose upload failed in the browser: the same', async () => {
    dam.reply((request) =>
      request.method === 'POST' && dam.routes.start.test(request.url) ? { status: 500 } : undefined
    )
    await pickOne()
    await vi.waitFor(() => expect(item().status).toBe(Failed))
    await flushPromises()

    expect(title().textContent?.trim()).toBe(damText('upload.titleDone'))
    expect(colours()).toEqual(['text-error'])
  })

  it('an uploaded file: says the upload is done, in the colour of a success', async () => {
    await pickOne()
    await vi.waitFor(() => expect(item().status).toBe(Processing))
    dam.fileBecomes('asset-1', AssetFileProcessStatus.Processed)
    await waits.elapse()
    await vi.waitFor(() => expect(item().status).toBe(Uploaded))
    await flushPromises()

    expect(title().textContent?.trim()).toBe(damText('upload.titleDone'))
    expect(colours()).toEqual(['text-green-darken-3'])
  })
})
