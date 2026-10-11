import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, type Pinia, setActivePinia } from 'pinia'
import {
  consumerProfiles,
  installConsumerProfile,
  ugcConfiguration,
} from '@/domains/dam/__tests__/support/consumerProfiles'
import { type DamSocket, stubDamSocket } from '@/domains/dam/__tests__/support/damSocket'
import { createFakeDam, damAssetWithFile, type FakeDam } from '@/domains/dam/__tests__/support/fakeDam'
import { holdLongWaits, type LongWaits } from '@/domains/dam/__tests__/support/longWaits'
import { destroyDamNotifications, initDamNotifications } from '@/domains/dam/composables/damNotifications'
import { useDamNotificationsEventBus } from '@/domains/dam/composables/damNotificationsEventBus'
import { AssetFileFailReason, AssetFileProcessStatus } from '@/domains/dam/types/AssetFile'
import { UploadQueueItemStatus, type UploadQueueItemStatusType } from '@/domains/dam/types/UploadQueue'
import UploadQueueDialog from '@/domains/dam/uploadQueue/components/UploadQueueDialog.vue'
import { useUploadQueuesStore } from '@/domains/dam/uploadQueue/store/uploadQueuesStore'

// What the user sees of an upload in the queue dialog of a widget, under each of the two applications: the title
// of the dialog, the row of the file, and whether its form and "save and apply" can be used. The real dialog with
// its real rows over the real queue; the DAM is a client that records its requests, and only the long waits are
// taken out of real time. No notification comes: what settles the row is a read of its asset.

const QUEUE = 'dialog-queue'

let pinia: Pinia
let dam: FakeDam
let waits: LongWaits
let socket: DamSocket
let wrapper: VueWrapper | undefined

const fromTheServer = {
  metadata: { customData: { description: 'from the server' }, authorSuggestions: {}, keywordSuggestions: {} },
}

describe.each(consumerProfiles)('the upload dialog under the $name', (profile) => {
  const { endPoints, extSystem, licence } = profile

  beforeEach(() => {
    pinia = createPinia()
    setActivePinia(pinia)
    dam = createFakeDam(endPoints)
    installConsumerProfile(profile, dam.client)
    waits = holdLongWaits()
    socket = stubDamSocket()
    if (profile.notifications) {
      initDamNotifications().openConnection()
      socket.accept()
    }
  })
  afterEach(() => {
    wrapper?.unmount()
    wrapper = undefined
    useUploadQueuesStore().stopUpload(QUEUE)
    destroyDamNotifications()
    waits.restore()
    socket.restore()
    useDamNotificationsEventBus().reset()
  })

  /** A file is picked: the widget queues it and opens the dialog of its queue. */
  const pickOne = async () => {
    const store = useUploadQueuesStore()
    await store.addByFiles(QUEUE, extSystem, licence, [
      new File([new Uint8Array(3000)], 'photo.jpg', { type: 'image/jpeg' }),
    ])
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
        // What has no say in how an upload settles: the picture of the row (it would ask the image server), the
        // inputs that ask the DAM for names to offer, the mass operations, and the ways to add more files.
        stubs: {
          AssetImage: true,
          AFormRemoteAutocompleteWithCached: true,
          AssetQueueSelectedSidebar: true,
          AFileInput: true,
          AFileDropzone: true,
        },
      },
    })
    const [item] = store.getQueueItems(QUEUE)
    return { store, item }
  }
  /** The text of the library for a key, as the dialog renders it. */
  const text = (key: string) => (wrapper!.vm as unknown as { $t: (key: string) => string }).$t(`common.damImage.${key}`)
  const toolbar = () => document.body.querySelector<HTMLElement>('.v-toolbar')!
  const row = () => document.body.querySelector<HTMLElement>('.dam-upload-queue__item')!
  // The fields of the row's form the user types into; a growing text field has a hidden twin that measures it.
  const fields = () =>
    Array.from(row().querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('input, textarea')).filter(
      (field) => field.getAttribute('aria-hidden') !== 'true'
    )
  const saveAndApply = () =>
    Array.from(toolbar().querySelectorAll<HTMLButtonElement>('button')).find((button) =>
      [text('upload.saveAndApply'), text('upload.apply')].includes(button.textContent?.trim() ?? '')
    )
  const save = () =>
    Array.from(toolbar().querySelectorAll<HTMLButtonElement>('button')).find((button) =>
      button.querySelector('.mdi-content-save')
    )!
  /** The two buttons a failed row can have: the one that takes it out, and the one that asks the server again. */
  const rowButtons = () => ({
    remove: row().querySelector('[data-cy="button-delete"]') !== null,
    refresh: row().querySelector('.mdi-refresh') !== null,
  })
  /** The file is sent, the server answers what the case says, and the queue asks. */
  const settled = async (status: UploadQueueItemStatusType, serverSays: () => unknown) => {
    const [item] = useUploadQueuesStore().getQueueItems(QUEUE)
    await vi.waitFor(() => expect(item.status).toBe(UploadQueueItemStatus.Processing))
    serverSays()
    await waits.elapse()
    await vi.waitFor(() => expect(item.status).toBe(status))
    await flushPromises()
  }

  it('says the upload runs while the server works on the file: no form to fill, nothing to apply', async () => {
    const { item } = await pickOne()
    await vi.waitFor(() => expect(item.status).toBe(UploadQueueItemStatus.Processing))
    await flushPromises()

    expect(toolbar().textContent).toContain(text('upload.title'))
    expect(toolbar().textContent).not.toContain(text('upload.titleDone'))
    expect(toolbar().textContent).toContain(`${text('upload.uploading')} 1/1`)
    expect(row().textContent).toContain('photo.jpg')
    expect(fields().length).toBeGreaterThan(0)
    expect(fields().every((field) => field.disabled)).toBe(true)
    expect(saveAndApply()).toBeUndefined()
    expect(save().disabled).toBe(true)
  })

  it('says the upload is done once a read finds the file processed: the form is filled and open', async () => {
    await pickOne()
    await settled(UploadQueueItemStatus.Uploaded, () =>
      dam.fileBecomes('asset-1', AssetFileProcessStatus.Processed, fromTheServer)
    )

    expect(toolbar().textContent).toContain(text('upload.titleDone'))
    expect(toolbar().textContent).not.toMatch(/\d+\/\d+/)
    expect(fields().map((field) => field.value)).toContain('from the server')
    expect(fields().some((field) => field.disabled)).toBe(false)
    expect(row().querySelector('.dam-upload-queue__overlay--error')).toBeNull()
    expect(saveAndApply()!.disabled).toBe(false)
    expect(save().disabled).toBe(false)
  })

  // admin-cms leaves the image to the library's map (the source is the names of the DAM authors: none here);
  // admin-ugc brings its own, which takes the source from its `author` field. Both read what the save answered.
  it('"save and apply" saves the row and hands over an image built from the answer, by the map of the application', async () => {
    await pickOne()
    await settled(UploadQueueItemStatus.Uploaded, () =>
      dam.fileBecomes('asset-1', AssetFileProcessStatus.Processed, {
        metadata: {
          customData: { description: ' described ', author: ' A. Author ' },
          authorSuggestions: {},
          keywordSuggestions: {},
        },
      })
    )

    saveAndApply()!.click()
    await vi.waitFor(() => expect(wrapper!.emitted('apply')).toHaveLength(1))

    const saves = dam.sentTo('PATCH', dam.routes.bulkMetadata)
    expect(saves.map((request) => request.url)).toEqual([`${endPoints.asset}/metadata-bulk-update`])
    expect(dam.body(saves[0])).toMatchObject([
      { id: 'asset-1', customData: { description: ' described ', author: ' A. Author ' } },
    ])
    expect(wrapper!.emitted('apply')![0]).toMatchObject([
      [
        {
          assetId: 'asset-1',
          texts: { description: 'described', source: profile === ugcConfiguration ? 'A. Author' : '' },
          dam: { damId: 'file-1', licenceId: licence, regionPosition: 0, internal: false },
          flags: { showSource: true, internal: false, overrideInternal: false },
          damAuthors: [],
          showDamAuthors: true,
        },
      ],
    ])
    // Its position is the widget's to give (finding 31).
    expect('position' in (wrapper!.emitted('apply')![0] as [object[]])[0][0]!).toBe(false)
    // Neither map asks for an author here.
    const ownPrefix = endPoints.asset.replace(/\/asset$/, '/')
    expect(dam.requests.filter((request) => !request.url.startsWith(ownPrefix))).toEqual([])
    expect(dam.unanswered).toEqual([])
  })

  it('says the file is a duplicate, and offers the form of the original', async () => {
    await pickOne()
    dam.assets.set(
      'asset-original',
      damAssetWithFile('asset-original', 'file-original', AssetFileProcessStatus.Processed, {
        metadata: { customData: { description: 'of the original' }, authorSuggestions: {}, keywordSuggestions: {} },
      })
    )
    await settled(UploadQueueItemStatus.Uploaded, () =>
      dam.fileBecomes('asset-1', AssetFileProcessStatus.Duplicate, {}, { originAssetFile: 'file-original' })
    )

    expect(toolbar().textContent).toContain(text('upload.titleDone'))
    expect(row().textContent).toContain(text('asset.detail.info.status.duplicate'))
    expect(fields().map((field) => field.value)).toContain('of the original')
    expect(fields().some((field) => field.disabled)).toBe(false)
    expect(saveAndApply()!.disabled).toBe(false)
  })

  it('says why the server refused the file, and offers nothing to save or apply', async () => {
    await pickOne()
    await settled(UploadQueueItemStatus.Failed, () =>
      dam.fileBecomes('asset-1', AssetFileProcessStatus.Failed, {}, { failReason: AssetFileFailReason.InvalidMimeType })
    )

    // A queue of failed rows only counts as finished.
    expect(toolbar().textContent).toContain(text('upload.titleDone'))
    const error = row().querySelector<HTMLElement>('.dam-upload-queue__overlay--error')!
    expect(error.textContent).toContain(text('queueItem.error'))
    expect(error.textContent).toContain(text('asset.assetFileFailReason.invalidMimeType'))
    expect(fields().every((field) => field.disabled)).toBe(true)
    expect(saveAndApply()!.disabled).toBe(true)
    expect(save().disabled).toBe(true)
    // The row can be taken out; asking the server again would change nothing.
    expect(rowButtons()).toEqual({ remove: true, refresh: false })
  })

  it('says only that there was an error when the browser could not finish the upload', async () => {
    dam.reply((request) =>
      request.method === 'PATCH' && dam.routes.finish.test(request.url) ? { status: 502 } : undefined
    )
    const { item } = await pickOne()
    await vi.waitFor(() => expect(item.status).toBe(UploadQueueItemStatus.Failed))
    await flushPromises()

    expect(toolbar().textContent).toContain(text('upload.titleDone'))
    const error = row().querySelector<HTMLElement>('.dam-upload-queue__overlay--error')!
    expect(error.textContent).toContain(text('queueItem.error'))
    expect(error.textContent).toContain(text('uploadErrors.unknownError'))
    expect(fields().every((field) => field.disabled)).toBe(true)
    expect(saveAndApply()!.disabled).toBe(true)
    // The request may have reached the server all the same: the row offers to ask it, at once.
    expect(rowButtons()).toEqual({ remove: true, refresh: true })
  })

  it('takes the refresh of such a row back once the server says the file failed', async () => {
    dam.reply((request) =>
      request.method === 'PATCH' && dam.routes.finish.test(request.url) ? { status: 502 } : undefined
    )
    const { item } = await pickOne()
    await vi.waitFor(() => expect(item.status).toBe(UploadQueueItemStatus.Failed))
    await flushPromises()
    expect(rowButtons()).toEqual({ remove: true, refresh: true })

    dam.fileBecomes('asset-1', AssetFileProcessStatus.Failed, {}, { failReason: AssetFileFailReason.InvalidMimeType })
    await waits.elapse()
    await vi.waitFor(() => expect(item.error.assetFileFailReason).toBe(AssetFileFailReason.InvalidMimeType))
    await flushPromises()

    expect(row().textContent).toContain(text('asset.assetFileFailReason.invalidMimeType'))
    expect(rowButtons()).toEqual({ remove: true, refresh: false })
  })

  // The server answered the finish request, and refused: it will not finish the file, whatever is asked later.
  it('offers no refresh on a row whose finish request the server refused, only to take it out', async () => {
    dam.reply((request) =>
      request.method === 'PATCH' && dam.routes.finish.test(request.url)
        ? {
            status: 422,
            data: { contextId: 'context', error: 'validation_failed', fields: { checksum: ['error_field_invalid'] } },
          }
        : undefined
    )
    const { item } = await pickOne()
    await vi.waitFor(() => expect(item.status).toBe(UploadQueueItemStatus.Failed))
    await flushPromises()

    expect(row().querySelector('.dam-upload-queue__overlay--error')).not.toBeNull()
    expect(rowButtons()).toEqual({ remove: true, refresh: false })
  })

  // The server never had the whole file: it will not finish it, and a refresh would only say "still uploading".
  it('offers no refresh on a row whose chunk the server refused, only to take it out', async () => {
    dam.reply((request) =>
      request.method === 'POST' && dam.routes.chunk.test(request.url)
        ? {
            status: 422,
            data: { contextId: 'context', error: 'validation_failed', fields: { size: ['error_field_invalid'] } },
          }
        : undefined
    )
    const { item } = await pickOne()
    await vi.waitFor(() => expect(item.status).toBe(UploadQueueItemStatus.Failed))
    await flushPromises()

    expect(item.assetId).toBe('asset-1')
    expect(row().querySelector('.dam-upload-queue__overlay--error')).not.toBeNull()
    expect(rowButtons()).toEqual({ remove: true, refresh: false })
  })
})
