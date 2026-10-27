import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, type Pinia, setActivePinia } from 'pinia'
import { userEvent } from 'vitest/browser'
import { CustomDataFormElementType } from '@/domains/customDataForm/types/CustomDataFormElementTypes'
import {
  cmsConfiguration,
  consumerProfiles,
  installConsumerProfile,
} from '@/domains/dam/__tests__/support/consumerProfiles'
import { answerDamNames, damNameLookups, damNamesAsked } from '@/domains/dam/__tests__/support/damNames'
import { type DamSocket, stubDamSocket } from '@/domains/dam/__tests__/support/damSocket'
import { createFakeDam, type FakeDam, type FakeDamAnswer } from '@/domains/dam/__tests__/support/fakeDam'
import { holdLongWaits, type LongWaits } from '@/domains/dam/__tests__/support/longWaits'
import { alertText, damText, forgetAlerts, shownAlerts } from '@/domains/dam/__tests__/support/uploadUi'
import { useAssetDetailStore } from '@/domains/dam/assetDetail/store/assetDetailStore'
import { initCommonAdminCoreDamOptions } from '@/domains/dam/composables/commonAdminCoreDamOptions'
import { destroyDamNotifications, initDamNotifications } from '@/domains/dam/composables/damNotifications'
import { DamNotificationName, useDamNotificationsEventBus } from '@/domains/dam/composables/damNotificationsEventBus'
import { useDamConfigStore } from '@/domains/dam/config/store/damConfigStore'
import { useImageStore } from '@/domains/dam/imageWidget/store/imageStore'
import type { UploadMetadataToImageMapFn } from '@/domains/dam/imageWidget/utils/metadataToImageMap'
import { DamAssetType } from '@/domains/dam/types/Asset'
import { AssetFileProcessStatus } from '@/domains/dam/types/AssetFile'
import type { ImageStoreItem } from '@/domains/dam/types/ImageAware'
import { UploadQueueItemStatus } from '@/domains/dam/types/UploadQueue'
import UploadQueueDialog from '@/domains/dam/uploadQueue/components/UploadQueueDialog.vue'
import { useUploadQueueDialog } from '@/domains/dam/uploadQueue/composables/useUploadQueueDialog'
import { useUploadQueuesStore } from '@/domains/dam/uploadQueue/store/uploadQueuesStore'

// Covers the buttons of the queue dialog under each application: "save",
// "save and apply", close, mass operations and "edit asset" of a row.
// Uses the real dialog, rows and queue. The DAM is a recording
// client and only the long waits are taken out of real time.
// What the dialog says while an upload settles is in `consumerProfileUploadDialog.test.ts`.

const QUEUE = 'dialog-actions'
const { Processing, Uploaded, Failed } = UploadQueueItemStatus

let pinia: Pinia
let dam: FakeDam
let waits: LongWaits
let socket: DamSocket
let wrapper: VueWrapper | undefined
let mapOfTheApplication: Mock<UploadMetadataToImageMapFn> | undefined

const photo = (name: string) => new File([new Uint8Array(3000)], name, { type: 'image/jpeg' })
const metadata = (customData: Record<string, unknown>) => ({
  metadata: { customData, authorSuggestions: {}, keywordSuggestions: {} },
})

describe.each(consumerProfiles)('the buttons of the upload dialog under the $name', (profile) => {
  const { endPoints, extSystem, licence } = profile
  const isCms = profile === cmsConfiguration
  const bulkSave = `${endPoints.asset}/metadata-bulk-update`

  beforeEach(() => {
    pinia = createPinia()
    setActivePinia(pinia)
    dam = createFakeDam(endPoints)
    const { coreDam } = installConsumerProfile(profile, dam.client)
    const own = coreDam.configs.default!
    mapOfTheApplication = own.customUploadMetadataToImageMap ? vi.fn(own.customUploadMetadataToImageMap) : undefined
    if (mapOfTheApplication) {
      initCommonAdminCoreDamOptions({
        ...coreDam,
        configs: { default: { ...own, customUploadMetadataToImageMap: mapOfTheApplication } },
      })
    }
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
    useUploadQueueDialog().uploadQueueSidebar.value = false
    destroyDamNotifications()
    waits.restore()
    socket.restore()
    useDamNotificationsEventBus().reset()
  })

  const queue = () => useUploadQueuesStore(pinia)
  const rowsOfQueue = () => queue().getQueueItems(QUEUE)
  /**
   * The dialog over its queue. `takesFiles`: with its real "+" and dropzone, whose files are queued as the widget
   * queues them; left out, the two are not drawn.
   */
  const mountDialog = (takesFiles = false) => {
    const add = (files: File[]) => {
      if (files.length > 0) void queue().addByFiles(QUEUE, extSystem, licence, files, 'default')
    }
    return mount(UploadQueueDialog, {
      attachTo: document.body,
      props: {
        queueKey: QUEUE,
        licenceId: licence,
        fileInputKey: 0,
        extSystem,
        accept: undefined,
        maxSizes: undefined,
        ...(takesFiles ? { onFilesInput: add, onDrop: add } : {}),
      },
      global: {
        plugins: [pinia],
        // What has no say in what the buttons do: the picture of a row (it would ask the image server), the
        // inputs that ask the DAM for names to offer, the form of the mass operations, and the ways to add files.
        stubs: {
          AssetImage: true,
          AFormRemoteAutocompleteWithCached: true,
          AssetQueueSelectedSidebar: true,
          AFileInput: !takesFiles,
          AFileDropzone: !takesFiles,
        },
      },
    })
  }
  const pick = async (...names: string[]) => {
    await queue().addByFiles(QUEUE, extSystem, licence, names.map(photo), 'default')
    wrapper = mountDialog()
    await flushPromises()
    return rowsOfQueue()
  }
  const statuses = () => rowsOfQueue().map((item) => item.status)
  const asked = async (expected: string[]) => {
    await waits.elapse()
    await vi.waitFor(() => expect(statuses()).toEqual(expected))
    await flushPromises()
  }
  // The dialog is drawn into the body.
  const toolbar = () => document.body.querySelector<HTMLElement>('.v-toolbar')!
  const rows = () => Array.from(document.body.querySelectorAll<HTMLElement>('.dam-upload-queue__item'))
  const toolbarButtons = () => Array.from(toolbar().querySelectorAll<HTMLButtonElement>('button'))
  const saveAndApply = () =>
    toolbarButtons().find((button) =>
      [damText('upload.saveAndApply'), damText('upload.apply')].includes(button.textContent?.trim() ?? '')
    )
  const save = () => toolbarButtons().find((button) => button.querySelector('.mdi-content-save'))!
  const close = () => toolbar().querySelector<HTMLButtonElement>('[data-cy="button-close"]')!
  const massOperations = () =>
    toolbar().querySelector<HTMLButtonElement>(`button[aria-label="${damText('asset.massOperations.title')}"]`)!
  const question = () => document.body.querySelector<HTMLElement>('[data-cy="delete-panel"]')
  // The fields of a row the user types into; a growing text field has a hidden twin that measures it.
  const fieldsOf = (row: HTMLElement) =>
    Array.from(row.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('input[type="text"], textarea')).filter(
      (field) => field.getAttribute('aria-hidden') !== 'true'
    )
  const type = async (field: HTMLInputElement | HTMLTextAreaElement, text: string) => {
    field.value = text
    field.dispatchEvent(new Event('input', { bubbles: true }))
    await flushPromises()
  }
  const saves = () => dam.sentTo('PATCH', dam.routes.bulkMetadata)
  const refuseChunkOf = (name: string) =>
    dam.reply((request) =>
      request.method === 'POST' && dam.routes.chunk.test(request.url) && dam.chunkOf(request) === name
        ? {
            status: 422,
            data: { contextId: 'context', error: 'validation_failed', fields: { size: ['error_field_invalid'] } },
          }
        : undefined
    )
  const updated = ['success', alertText('common.alert.recordWas.updated')]
  const fixTheForm = ['error', alertText('common.alert.fixValidationErrors')]
  const systemError = ['error', alertText('common.alert.unknownError')]
  const refusalSaid = () => {
    expect(shownAlerts()).toHaveLength(1)
    const [[colour, text]] = shownAlerts() as Array<[string, string]>
    const [heading, ...lines] = text.split('\n')

    return { colour, heading, fields: lines.map((line) => line.split(': ')[0]) }
  }
  const refuseSaves = (answer: FakeDamAnswer) =>
    dam.reply((request) =>
      request.method === 'PATCH' && dam.routes.bulkMetadata.test(request.url) ? answer : undefined
    )

  const oneOfEachKind = async () => {
    refuseChunkOf('b.jpg')
    const [a, b, c] = await pick('a.jpg', 'b.jpg', 'c.jpg')
    await vi.waitFor(() => expect(statuses()).toEqual([Processing, Failed, Processing]))
    dam.fileBecomes(a.assetId!, AssetFileProcessStatus.Processed, {
      ...metadata({ description: 'from the server' }),
      mainFileSingleUse: true,
    })
    await asked([Uploaded, Failed, Processing])
    return { a, b, c }
  }

  describe('"save"', () => {
    it('sends the rows whose metadata can be edited, as the user left them, and says the record was updated', async () => {
      const { a } = await oneOfEachKind()
      expect(toolbar().textContent).toContain(`${damText('upload.uploading')} 3/3`)
      expect(toolbar().textContent).not.toContain(damText('upload.titleDone'))
      expect(saveAndApply()).toBeUndefined()

      const described = fieldsOf(rows()[0]).find((field) => field.value === 'from the server')!
      await type(described, 'typed by the user')
      // admin-cms has the single-use switch on the row, and the user takes it off; admin-ugc has none, and the
      // save sends what the DAM said.
      if (isCms) {
        rows()[0].querySelector<HTMLInputElement>('.v-switch input')!.click()
        await flushPromises()
      }
      save().click()
      await vi.waitFor(() => expect(shownAlerts()).toEqual([updated]))

      expect(saves().map((request) => request.url)).toEqual([bulkSave])
      const sent = dam.body(saves()[0]) as Array<Record<string, unknown>>
      expect(sent).toHaveLength(1)
      expect(sent[0]).toMatchObject({
        id: a.assetId,
        keywords: [],
        authors: [],
        described: true,
        customData: { description: 'typed by the user' },
        mainFileSingleUse: !isCms,
      })
      expect(wrapper!.emitted('apply')).toBeUndefined()
      expect(statuses()).toEqual([Uploaded, Failed, Processing])
      expect(useUploadQueueDialog().uploadQueueDialog.value).toBe(QUEUE)
      expect(save().disabled).toBe(false)
    })

    it('sends nothing, and says what to fix, while a field the application requires is empty', async () => {
      const elements = useDamConfigStore(pinia).damConfigAssetCustomFormElements.get(extSystem)![DamAssetType.Image]
      const description = elements.find((element) => element.property === 'description')!
      expect(description.attributes.type).toBe(CustomDataFormElementType.String)
      description.attributes.required = true
      const [a] = await pick('a.jpg')
      await vi.waitFor(() => expect(statuses()).toEqual([Processing]))
      dam.fileBecomes(a.assetId!, AssetFileProcessStatus.Processed, metadata({}))
      await asked([Uploaded])

      save().click()
      await flushPromises()
      saveAndApply()!.click()
      await flushPromises()

      expect(shownAlerts()).toEqual([fixTheForm, fixTheForm])
      expect(saves()).toEqual([])
      expect(wrapper!.emitted('apply')).toBeUndefined()
      expect([save().disabled, saveAndApply()!.disabled]).toEqual([false, false])

      const empty = fieldsOf(rows()[0]).filter((field) => field.value === '')
      for (const field of empty) await type(field, 'filled in')
      save().click()
      await vi.waitFor(() => expect(shownAlerts().at(-1)).toEqual(updated))
      expect(saves()).toHaveLength(1)
    })

    it('says the save failed when the DAM refuses it: the button stops spinning, and can be pressed again', async () => {
      const refusal = refuseSaves({ status: 500 })
      await oneOfEachKind()

      save().click()
      await vi.waitFor(() => expect(saves()).toHaveLength(1))
      await vi.waitFor(() => expect(save().querySelector('.v-btn__loader')).toBeNull())
      await flushPromises()

      expect(shownAlerts()).toEqual([systemError])
      expect(wrapper!.emitted('apply')).toBeUndefined()
      expect(save().disabled).toBe(false)

      refusal()
      save().click()
      await vi.waitFor(() => expect(shownAlerts()).toEqual([systemError, updated]))
      expect(saves()).toHaveLength(2)
    })

    it('says the user may not, when the DAM forbids the save', async () => {
      refuseSaves({ status: 403 })
      await oneOfEachKind()

      save().click()
      await vi.waitFor(() => expect(shownAlerts()).toEqual([['error', alertText('common.alert.forbiddenError')]]))
      expect(saves()).toHaveLength(1)
    })

    // The server names a field by the place of its asset in the request: one of each asset, said once, by the name
    // the form of the rows gives it.
    it('names the fields the DAM refuses as the form of the rows does, each once', async () => {
      const elements = useDamConfigStore(pinia).damConfigAssetCustomFormElements.get(extSystem)![DamAssetType.Image]
      elements.find((element) => element.property === 'description')!.name = 'Description of the image'
      refuseSaves({
        status: 422,
        data: {
          contextId: 'context',
          error: 'validation_failed',
          fields: {
            '[0].customData.description': ['error_field_empty'],
            '[1].customData.description': ['error_field_empty'],
            '[1].keywords': ['error_field_empty'],
          },
        },
      })
      const [a, b] = await pick('a.jpg', 'b.jpg')
      await vi.waitFor(() => expect(statuses()).toEqual([Processing, Processing]))
      dam.fileBecomes(a.assetId!, AssetFileProcessStatus.Processed, metadata({ description: 'first' }))
      dam.fileBecomes(b.assetId!, AssetFileProcessStatus.Processed, metadata({ description: 'second' }))
      await asked([Uploaded, Uploaded])

      save().click()
      await vi.waitFor(() => expect(shownAlerts()).toHaveLength(1))

      expect(refusalSaid()).toEqual({
        colour: 'error',
        heading: alertText('common.alert.fixApiValidationErrors'),
        fields: ['Description of the image', alertText('common.damImage.asset.model.keywords')],
      })
      expect((dam.body(saves()[0]) as Array<{ id: string }>).map((sent) => sent.id)).toEqual([a.assetId, b.assetId])
    })
  })

  describe('"save and apply"', () => {
    const twoUploadedOneFailed = async () => {
      const third = () => rowsOfQueue()[2]
      dam.reply((request) =>
        request.method === 'PATCH' &&
        dam.routes.finish.test(request.url) &&
        !!third()?.fileId &&
        request.url === `${endPoints.image}/${third().fileId}/uploaded`
          ? { status: 502 }
          : undefined
      )
      const [a, b, c] = await pick('a.jpg', 'b.jpg', 'c.jpg')
      await vi.waitFor(() => expect(statuses()).toEqual([Processing, Processing, Failed]))
      dam.fileBecomes(a.assetId!, AssetFileProcessStatus.Processed, {
        ...metadata({ description: ' first ', author: ' A. Author ' }),
        authors: isCms ? ['author-1', 'author-2'] : [],
      })
      dam.fileBecomes(b.assetId!, AssetFileProcessStatus.Processed, metadata({ description: 'second' }))
      await asked([Uploaded, Uploaded, Failed])
      // The names of the authors the rows show have been asked for by then.
      await damNamesAsked()
      return { a, b, c }
    }

    // Finding 31: the images are handed over without a position and the widget's count is left alone.
    it('saves the rows that can be saved, and hands the widget an image of each uploaded row, for it to place', async () => {
      const { a, b, c } = await twoUploadedOneFailed()
      useImageStore(pinia).maxPosition = 7
      const lookupsBefore = damNameLookups(dam).length
      const requestsBefore = dam.requests.length
      expect(toolbar().textContent).toContain(damText('upload.titleDone'))

      saveAndApply()!.click()
      await vi.waitFor(() => expect(wrapper!.emitted('apply')).toHaveLength(1))

      expect(
        dam.requests.slice(requestsBefore).map((request) => `${request.method} ${request.url.split('?')[0]}`)
      ).toEqual([`PATCH ${bulkSave}`, ...(isCms ? [`GET /adm/v1/author/ext-system/${extSystem}/search`] : [])])
      expect(saves().map((request) => request.url)).toEqual([bulkSave])
      expect((dam.body(saves()[0]) as Array<{ id: string }>).map((sent) => sent.id)).toEqual([a.assetId, b.assetId])
      const [images] = wrapper!.emitted('apply')![0] as [ImageStoreItem[]]
      expect(images).toMatchObject([
        {
          assetId: a.assetId,
          texts: {
            description: 'first',
            source: isCms ? 'Name of author-1, Name of author-2' : 'A. Author',
          },
          dam: { damId: a.fileId, licenceId: licence, regionPosition: 0, internal: false },
          flags: { showSource: true, internal: false, overrideInternal: false },
          // The authors of the DAM are offered in the widget only for an image that came without any.
          damAuthors: isCms ? ['author-1', 'author-2'] : [],
          showDamAuthors: !isCms,
        },
        {
          assetId: b.assetId,
          texts: { description: 'second', source: '' },
          dam: { damId: b.fileId, licenceId: licence },
          damAuthors: [],
          showDamAuthors: true,
        },
      ])
      expect(images.map((image) => image.assetId)).not.toContain(c.assetId)
      expect(new Set(images.map((image) => image.key)).size).toBe(2)
      expect(images.map((image) => 'position' in image)).toEqual([false, false])
      expect(useImageStore(pinia).maxPosition).toBe(7)
      expect(damNameLookups(dam).length - lookupsBefore).toBe(isCms ? 1 : 0)
      expect(dam.unanswered).toEqual([])
      expect(statuses()).toEqual([Uploaded, Uploaded, Failed])
      expect(useUploadQueueDialog().uploadQueueDialog.value).toBe(QUEUE)
    })

    it('goes through the map of the application where it brings one: the uploaded rows, the answer of the save, the client, the ext system and the licence', async () => {
      const { a, b } = await twoUploadedOneFailed()

      saveAndApply()!.click()
      await vi.waitFor(() => expect(wrapper!.emitted('apply')).toHaveLength(1))

      if (!mapOfTheApplication) {
        expect(isCms).toBe(true)
        return
      }
      expect(mapOfTheApplication).toHaveBeenCalledTimes(1)
      const [rowsHanded, answer, client, extSystemHanded, licenceHanded] = mapOfTheApplication.mock.calls[0]
      expect(rowsHanded.map((row) => [row.assetId, row.status])).toEqual([
        [a.assetId, Uploaded],
        [b.assetId, Uploaded],
      ])
      expect(answer.map((saved) => saved.id)).toEqual([a.assetId, b.assetId])
      expect(answer[0].customData).toEqual({ description: ' first ', author: ' A. Author ' })
      expect(client).toBe(dam.client)
      expect([extSystemHanded, licenceHanded]).toEqual([extSystem, licence])
    })

    // The images are made from what the save answers. An asset without an answer
    // is still handed over, without authors, and it is unknown whether it has any.
    // So the widget is told to offer the DAM authors only for assets the save answered
    // for. The picked author is written into the asset in place of its authors.
    it('has the widget offer the authors of the DAM for no image whose asset the save did not answer for', async () => {
      const { a, b } = await twoUploadedOneFailed()
      dam.reply((request) =>
        request.method === 'PATCH' && dam.routes.bulkMetadata.test(request.url)
          ? { status: 200, data: (dam.body(request) as Array<{ id: string }>).filter((sent) => sent.id !== b.assetId) }
          : undefined
      )

      saveAndApply()!.click()
      await vi.waitFor(() => expect(wrapper!.emitted('apply')).toHaveLength(1))

      const [images] = wrapper!.emitted('apply')![0] as [ImageStoreItem[]]
      expect(images.map((image) => [image.assetId, image.damAuthors, image.showDamAuthors])).toEqual([
        [a.assetId, isCms ? ['author-1', 'author-2'] : [], !isCms],
        [b.assetId, [], false],
      ])
      expect(images[1]).toMatchObject({ texts: { description: '', source: '' }, dam: { damId: b.fileId } })
    })

    // With notifications a file is uploaded before its metadata arrives, and "save and apply" is already offered.
    // The save skips a row without metadata, so its image was handed
    // over without texts and its asset stayed unsaved, silently.
    // The dialog now reads such a row once more first, as the row refresh does.
    // The user sees any new form before anything is saved or handed over.
    if (profile.notifications) {
      const justLoaded = ['warning', alertText('common.damImage.upload.metadataJustLoaded')]
      const sentIds = () =>
        saves().map((request) => (dam.body(request) as Array<{ id: string }>).map((sent) => sent.id))
      const spins = () => saveAndApply()!.classList.contains('v-btn--loading')
      const readsOf = (asset: string | null) =>
        dam.sentTo('GET', dam.routes.one).filter((request) => request.url === `${endPoints.asset}/${asset}`)

      const secondWithoutItsForm = async () => {
        const [a, b] = await pick('a.jpg', 'b.jpg')
        await vi.waitFor(() => expect(statuses()).toEqual([Processing, Processing]))
        dam.fileBecomes(a.assetId!, AssetFileProcessStatus.Processed, metadata({ description: 'first' }))
        dam.fileBecomes(b.assetId!, AssetFileProcessStatus.Processed, {
          ...metadata({ description: 'second' }),
          authors: ['author-1'],
          mainFileInternal: true,
        })
        socket.deliver(DamNotificationName.AssetFileProcessed, { asset: b.assetId, id: b.fileId })
        await vi.waitFor(() => expect(statuses()).toEqual([Processing, Uploaded]))
        await asked([Uploaded, Uploaded])
        await damNamesAsked()
        expect([a.canEditMetadata, b.canEditMetadata]).toEqual([true, false])
        expect(b.authors).toEqual([])
        return { a, b }
      }

      it('reads a row uploaded without its form once more, and stops with a warning when its form comes: pressed again, it saves and hands over all', async () => {
        const { a, b } = await secondWithoutItsForm()
        const readsBefore = dam.assetReads().length

        saveAndApply()!.click()
        await vi.waitFor(() => expect(shownAlerts()).toEqual([justLoaded]))
        await vi.waitFor(() => expect(spins()).toBe(false))
        await flushPromises()

        expect(
          dam
            .assetReads()
            .slice(readsBefore)
            .map((request) => request.url)
        ).toEqual([`${endPoints.asset}/${b.assetId}`])
        expect(b).toMatchObject({
          canEditMetadata: true,
          authors: ['author-1'],
          customData: { description: 'second' },
        })
        expect(saves()).toEqual([])
        expect(wrapper!.emitted('apply')).toBeUndefined()
        expect(statuses()).toEqual([Uploaded, Uploaded])
        expect(useUploadQueueDialog().uploadQueueDialog.value).toBe(QUEUE)
        expect([saveAndApply()!.disabled, save().disabled]).toEqual([false, false])
        expect(useUploadQueueDialog().uploadQueueDialogSaving.value).toBeNull()

        await damNamesAsked()
        saveAndApply()!.click()
        await vi.waitFor(() => expect(wrapper!.emitted('apply')).toHaveLength(1))

        expect(dam.assetReads()).toHaveLength(readsBefore + 1)
        expect(sentIds()).toEqual([[a.assetId, b.assetId]])
        const [images] = wrapper!.emitted('apply')![0] as [ImageStoreItem[]]
        expect(images).toMatchObject([
          { assetId: a.assetId, texts: { description: 'first', source: '' }, damAuthors: [], showDamAuthors: true },
          {
            assetId: b.assetId,
            texts: { description: 'second', source: 'Name of author-1' },
            dam: { damId: b.fileId },
            damAuthors: ['author-1'],
            showDamAuthors: false,
          },
        ])
        expect(shownAlerts()).toEqual([justLoaded])
      })

      // The save skips the row and its image is handed over without texts and authors.
      // The row knows whether its file is internal from the read
      // that settled it. The save has no answer to take it from.
      it.each<[string, FakeDamAnswer]>([
        ['fails', { status: 500 }],
        ['finds no asset', { status: 404 }],
      ])(
        'hands over a row uploaded without its form as it is when the read of its asset %s, and says nothing',
        async (_what, answer) => {
          const { a, b } = await secondWithoutItsForm()
          dam.reply((request) =>
            request.method === 'GET' && request.url === `${endPoints.asset}/${b.assetId}` ? answer : undefined
          )
          const readsBefore = readsOf(b.assetId).length

          saveAndApply()!.click()
          await vi.waitFor(() => expect(wrapper!.emitted('apply')).toHaveLength(1))

          expect(readsOf(b.assetId)).toHaveLength(readsBefore + 1)
          expect(b.canEditMetadata).toBe(false)
          expect(sentIds()).toEqual([[a.assetId]])
          const [images] = wrapper!.emitted('apply')![0] as [ImageStoreItem[]]
          expect(images).toMatchObject([
            { assetId: a.assetId, texts: { description: 'first' }, damAuthors: [], showDamAuthors: true },
            {
              assetId: b.assetId,
              texts: { description: '', source: '' },
              dam: { damId: b.fileId, internal: true },
              damAuthors: [],
              showDamAuthors: false,
            },
          ])
          expect(shownAlerts()).toEqual([])
        }
      )

      // The read is part of the press: the button spins from the first of it, and the dialog takes no file meanwhile.
      it('takes no second press while it reads: one read, one warning, and its host is told it is busy', async () => {
        const { b } = await secondWithoutItsForm()
        const readsBefore = readsOf(b.assetId).length
        const held = dam.hold('GET', dam.routes.one)

        saveAndApply()!.click()
        expect(useUploadQueueDialog().uploadQueueDialogSaving.value).toBe(QUEUE)
        await vi.waitFor(() => expect(held.waiting).toHaveLength(1))
        await flushPromises()
        expect(spins()).toBe(true)
        expect(save().disabled).toBe(true)
        saveAndApply()!.click()
        saveAndApply()!.click()
        await flushPromises()

        held.release()
        await vi.waitFor(() => expect(spins()).toBe(false))
        await waits.settle()
        expect(held.waiting).toEqual([])
        expect(readsOf(b.assetId)).toHaveLength(readsBefore + 1)
        expect(shownAlerts()).toEqual([justLoaded])
        expect(saves()).toEqual([])
        expect(wrapper!.emitted('apply')).toBeUndefined()
        expect(useUploadQueueDialog().uploadQueueDialogSaving.value).toBeNull()
      })

      it('reads such a row before it checks the forms: a field to fix is said on the next press', async () => {
        const elements = useDamConfigStore(pinia).damConfigAssetCustomFormElements.get(extSystem)![DamAssetType.Image]
        elements.find((element) => element.property === 'title')!.attributes.required = true
        const { b } = await secondWithoutItsForm()

        saveAndApply()!.click()
        await vi.waitFor(() => expect(shownAlerts()).toEqual([justLoaded]))
        await vi.waitFor(() => expect(spins()).toBe(false))
        expect(b.canEditMetadata).toBe(true)

        saveAndApply()!.click()
        await vi.waitFor(() => expect(shownAlerts()).toEqual([justLoaded, fixTheForm]))
        await flushPromises()
        expect(saves()).toEqual([])
        expect(wrapper!.emitted('apply')).toBeUndefined()
      })

      it('leaves "save" as it was: it asks about no row, and sends the rows that have their form', async () => {
        const { a, b } = await secondWithoutItsForm()
        const readsBefore = dam.assetReads().length

        save().click()
        await vi.waitFor(() => expect(shownAlerts()).toEqual([updated]))

        expect(dam.assetReads()).toHaveLength(readsBefore)
        expect(sentIds()).toEqual([[a.assetId]])
        expect(b.canEditMetadata).toBe(false)
        expect(wrapper!.emitted('apply')).toBeUndefined()
      })
    }

    it('hands over nothing when the DAM refuses the save, and says the save failed', async () => {
      refuseSaves({ status: 500 })
      await twoUploadedOneFailed()

      saveAndApply()!.click()
      await vi.waitFor(() => expect(saves()).toHaveLength(1))
      await vi.waitFor(() => expect(saveAndApply()!.querySelector('.v-btn__loader')).toBeNull())
      await flushPromises()

      expect(wrapper!.emitted('apply')).toBeUndefined()
      expect(shownAlerts()).toEqual([systemError])
      expect(useImageStore(pinia).maxPosition).toBe(0)
      expect(saveAndApply()!.disabled).toBe(false)
    })

    // admin-ugc brings its own map. An error it throws after the save is not reported as a save error.
    if (!isCms) {
      it('says nothing of the save when the map of the application fails after it', async () => {
        await twoUploadedOneFailed()
        mapOfTheApplication!.mockRejectedValue(new Error('the map of the application failed'))

        saveAndApply()!.click()
        await vi.waitFor(() => expect(mapOfTheApplication).toHaveBeenCalledTimes(1))
        await vi.waitFor(() => expect(saveAndApply()!.querySelector('.v-btn__loader')).toBeNull())
        await flushPromises()

        expect(saves()).toHaveLength(1)
        expect(wrapper!.emitted('apply')).toBeUndefined()
        expect(shownAlerts()).toEqual([])
      })
    }
  })

  // The button that saves spins and takes no click of the mouse; it still takes Enter and Space. As in the dialog
  // of one file, a press while the save runs sends nothing more.
  describe('a button pressed again while its save runs', () => {
    it.each([
      ['"save"', () => save(), false],
      ['"save and apply"', () => saveAndApply()!, true],
    ])('%s sends one request, and does its work once', async (_name, pressed, applies) => {
      const held = dam.hold('PATCH', dam.routes.bulkMetadata)
      const [a] = await pick('a.jpg')
      await vi.waitFor(() => expect(statuses()).toEqual([Processing]))
      dam.fileBecomes(a.assetId!, AssetFileProcessStatus.Processed, metadata({ description: 'from the server' }))
      await asked([Uploaded])

      pressed().click()
      await vi.waitFor(() => expect(held.waiting).toHaveLength(1))
      await flushPromises()
      expect(pressed().classList.contains('v-btn--loading')).toBe(true)
      pressed().click()
      pressed().click()
      await flushPromises()
      expect(saves()).toHaveLength(1)

      held.release()
      await vi.waitFor(() => expect(pressed().classList.contains('v-btn--loading')).toBe(false))
      await flushPromises()
      expect(saves()).toHaveLength(1)
      expect(wrapper!.emitted('apply') ?? []).toHaveLength(applies ? 1 : 0)
      expect(shownAlerts()).toEqual(applies ? [] : [updated])
    })
  })

  // "Save and apply" ends with the host closing the dialog and emptying its queue. A file added while
  // it ran began uploading and was lost with the queue, silently, leaving its asset in the DAM.
  // While either save runs, the dialog takes no file: its "+" is off and its dropzone ignores drops.
  describe('files added through the dialog', () => {
    let choicesOpened = 0

    const plus = () => toolbar().querySelector<HTMLButtonElement>(`button[aria-label="${damText('upload.add')}"]`)!
    const fileInput = () => toolbar().querySelector<HTMLInputElement>('input[type="file"]')!
    const titles = () => rowsOfQueue().map((row) => row.displayTitle)
    const savingTold = () => useUploadQueueDialog().uploadQueueDialogSaving.value
    const carrying = (names: string[]) => {
      const transfer = new DataTransfer()
      names.forEach((name) => transfer.items.add(photo(name)))
      return transfer
    }
    const oneUploaded = async () => {
      await queue().addByFiles(QUEUE, extSystem, licence, [photo('a.jpg')], 'default')
      wrapper = mountDialog(true)
      await flushPromises()
      await vi.waitFor(() => expect(statuses()).toEqual([Processing]))
      const [a] = rowsOfQueue()
      dam.fileBecomes(a.assetId!, AssetFileProcessStatus.Processed, metadata({ description: 'from the server' }))
      await asked([Uploaded])
      choicesOpened = 0
      // The "+" clicks the input, which opens the choice of the system: counted here, and not opened.
      fileInput().addEventListener('click', (event) => {
        choicesOpened++
        event.preventDefault()
      })
    }
    const choose = async (...names: string[]) => {
      fileInput().files = carrying(names).files
      fileInput().dispatchEvent(new Event('change', { bubbles: true }))
      await flushPromises()
    }
    const drop = async (...names: string[]) => {
      document.body
        .querySelector<HTMLElement>('.a-file-dropzone')!
        .dispatchEvent(new DragEvent('drop', { dataTransfer: carrying(names), bubbles: true, cancelable: true }))
      await flushPromises()
    }

    it.each<[string, () => HTMLButtonElement]>([
      ['"save and apply"', () => saveAndApply()!],
      ['"save"', () => save()],
    ])('are not taken while %s runs: the "+" is off, and a drop adds nothing', async (_name, pressed) => {
      const held = dam.hold('PATCH', dam.routes.bulkMetadata)
      await oneUploaded()
      expect(plus().disabled).toBe(false)

      pressed().click()
      // Its host is told at once, for an entry of its own to the queue: not a moment after the save began.
      expect(savingTold()).toBe(QUEUE)
      await vi.waitFor(() => expect(held.waiting).toHaveLength(1))
      await flushPromises()

      expect(plus().disabled).toBe(true)
      plus().click()
      await drop('dropped.jpg')
      await waits.settle()
      expect(choicesOpened).toBe(0)
      expect(titles()).toEqual(['a.jpg'])
      expect(dam.sentTo('POST', dam.routes.start)).toHaveLength(1)
      expect(savingTold()).toBe(QUEUE)

      held.release()
      await vi.waitFor(() => expect(pressed().classList.contains('v-btn--loading')).toBe(false))
      expect(savingTold()).toBeNull()
    })

    // The input under the "+" is hidden and the dropzone only takes mouse input.
    // The "+" is the only way to add a file to the open dialog from the keyboard.
    it('are added from the keyboard too: Tab stops at the "+", and Enter and Space open the choice of files', async () => {
      await oneUploaded()
      save().focus()

      await userEvent.tab()
      expect(document.activeElement).toBe(plus())

      await userEvent.keyboard('{Enter}')
      expect(choicesOpened).toBe(1)
      // The input ignores a second click shortly after the first.
      await waits.settle(300)
      await userEvent.keyboard(' ')
      expect(choicesOpened).toBe(2)

      await choose('picked.jpg')
      await vi.waitFor(() => expect(titles()).toEqual(['a.jpg', 'picked.jpg']))
    })

    it('are not offered to the keyboard while a save runs: Tab passes the "+" by', async () => {
      const held = dam.hold('PATCH', dam.routes.bulkMetadata)
      await oneUploaded()
      saveAndApply()!.click()
      await vi.waitFor(() => expect(held.waiting).toHaveLength(1))
      await flushPromises()
      saveAndApply()!.focus()

      await userEvent.tab()
      expect(document.activeElement).toBe(massOperations())

      held.release()
      await vi.waitFor(() => expect(saveAndApply()!.classList.contains('v-btn--loading')).toBe(false))
    })

    it('takes back what it told its host of a save when it goes in the middle of one', async () => {
      const held = dam.hold('PATCH', dam.routes.bulkMetadata)
      await oneUploaded()
      saveAndApply()!.click()
      await vi.waitFor(() => expect(held.waiting).toHaveLength(1))
      expect(savingTold()).toBe(QUEUE)

      wrapper!.unmount()
      wrapper = undefined
      expect(savingTold()).toBeNull()

      held.release()
      await waits.settle()
      expect(savingTold()).toBeNull()
    })

    it('tells its host nothing of a save that a field of a row stops before it is sent', async () => {
      const elements = useDamConfigStore(pinia).damConfigAssetCustomFormElements.get(extSystem)![DamAssetType.Image]
      elements.find((element) => element.property === 'description')!.attributes.required = true
      await queue().addByFiles(QUEUE, extSystem, licence, [photo('a.jpg')], 'default')
      wrapper = mountDialog(true)
      await flushPromises()
      await vi.waitFor(() => expect(statuses()).toEqual([Processing]))
      dam.fileBecomes(rowsOfQueue()[0].assetId!, AssetFileProcessStatus.Processed, metadata({}))
      await asked([Uploaded])

      saveAndApply()!.click()
      await flushPromises()

      expect(shownAlerts()).toEqual([fixTheForm])
      expect([savingTold(), plus().disabled]).toEqual([null, false])
    })

    it.each<[string, () => HTMLButtonElement, FakeDamAnswer | undefined]>([
      ['"save" that went through', () => save(), undefined],
      ['"save" the DAM refused', () => save(), { status: 500 }],
      ['"save and apply" the DAM refused', () => saveAndApply()!, { status: 500 }],
    ])('are taken again after %s: picked with the "+", and dropped', async (_name, pressed, refusal) => {
      if (refusal) refuseSaves(refusal)
      await oneUploaded()

      pressed().click()
      await vi.waitFor(() => expect(saves()).toHaveLength(1))
      await vi.waitFor(() => expect(pressed().classList.contains('v-btn--loading')).toBe(false))
      await flushPromises()

      expect(plus().disabled).toBe(false)
      plus().click()
      expect(choicesOpened).toBe(1)
      await choose('picked.jpg')
      await vi.waitFor(() => expect(titles()).toEqual(['a.jpg', 'picked.jpg']))
      await drop('dropped.jpg')
      await vi.waitFor(() => expect(titles()).toEqual(['a.jpg', 'picked.jpg', 'dropped.jpg']))
    })
  })

  describe('the button that closes it', () => {
    it('asks first while files are being sent; confirmed, it stops them, empties the queue and closes the dialog', async () => {
      const chunks = dam.hold('POST', dam.routes.chunk)
      await pick('a.jpg', 'b.jpg', 'c.jpg')
      await vi.waitFor(() => expect(chunks.waiting).toHaveLength(2))
      const inFlight = dam.sentTo('POST', dam.routes.chunk).map((request) => request.config.signal as AbortSignal)
      const fileInputKey = queue().getQueue(QUEUE)!.fileInputKey

      close().click()
      await flushPromises()
      expect(question()!.textContent).toContain(damText('upload.stopConfirmQuestion'))
      expect(rowsOfQueue()).toHaveLength(3)
      expect(inFlight.map((signal) => signal.aborted)).toEqual([false, false])

      question()!.querySelector<HTMLElement>('[data-cy="button-confirm"]')!.click()
      await flushPromises()

      expect(inFlight.map((signal) => signal.aborted)).toEqual([true, true])
      expect(rowsOfQueue()).toEqual([])
      expect([queue().getQueueTotalCount(QUEUE), queue().getQueueProcessedCount(QUEUE)]).toEqual([0, 0])
      expect(queue().getQueue(QUEUE)!.fileInputKey).toBeGreaterThan(fileInputKey)
      expect(useUploadQueueDialog().uploadQueueDialog.value).toBeNull()
      await waits.elapseAll()
      expect(dam.sentTo('POST', dam.routes.start)).toHaveLength(2)
      expect(dam.sentTo('PATCH', dam.routes.finish)).toEqual([])
      expect(dam.assetReads()).toEqual([])
    })

    it('leaves the upload alone when the user answers no', async () => {
      const chunks = dam.hold('POST', dam.routes.chunk)
      await pick('a.jpg')
      await vi.waitFor(() => expect(chunks.waiting).toHaveLength(1))

      close().click()
      await flushPromises()
      question()!.querySelector<HTMLElement>('[data-cy="button-cancel"]')!.click()
      await flushPromises()

      expect(statuses()).toEqual([UploadQueueItemStatus.Uploading])
      expect(useUploadQueueDialog().uploadQueueDialog.value).toBe(QUEUE)
      chunks.release()
      await vi.waitFor(() => expect(statuses()).toEqual([Processing]))
    })

    it('closes at once a dialog whose queue is finished: the rows are dropped, saved or not', async () => {
      const [a] = await pick('a.jpg')
      await vi.waitFor(() => expect(statuses()).toEqual([Processing]))
      dam.fileBecomes(a.assetId!, AssetFileProcessStatus.Processed, metadata({ description: 'from the server' }))
      await asked([Uploaded])

      close().click()
      await flushPromises()

      expect(question()).toBeNull()
      expect(rowsOfQueue()).toEqual([])
      expect(useUploadQueueDialog().uploadQueueDialog.value).toBeNull()
      expect(saves()).toEqual([])
      expect(wrapper!.emitted('apply')).toBeUndefined()
    })
  })

  describe('"edit asset" of a row', () => {
    it('reads the asset from the DAM of the application and hands it to the asset detail of this queue', async () => {
      const [a] = await pick('a.jpg')
      await vi.waitFor(() => expect(statuses()).toEqual([Processing]))
      dam.fileBecomes(a.assetId!, AssetFileProcessStatus.Processed, metadata({ description: 'from the server' }))
      await asked([Uploaded])
      const readsBefore = dam.sentTo('GET', dam.routes.one).length

      const edit = Array.from(rows()[0].querySelectorAll('button')).find(
        (button) => button.textContent?.trim() === damText('image.button.editAsset')
      )!
      edit.click()
      const detail = useAssetDetailStore(pinia)
      await vi.waitFor(() => expect(detail.asset?.id).toBe(a.assetId))

      expect(
        dam
          .sentTo('GET', dam.routes.one)
          .slice(readsBefore)
          .map((request) => request.url)
      ).toEqual([`${endPoints.asset}/${a.assetId}`])
      expect([detail.dialog, detail.updateUploadStore, detail.loading]).toEqual([QUEUE, true, false])
      expect(detail.asset!.metadata.customData).toEqual({ description: 'from the server' })
    })
  })

  describe('the button of the mass operations', () => {
    it('gives the mass operations their room beside the rows, and takes it back', async () => {
      dam.hold('POST', dam.routes.chunk)
      await pick('a.jpg')
      const list = () => document.body.querySelector<HTMLElement>('.asset-queue-editable')!
      expect(list().classList.contains('asset-queue-editable--sidebar-active')).toBe(false)

      massOperations().click()
      await flushPromises()
      expect(list().classList.contains('asset-queue-editable--sidebar-active')).toBe(true)

      massOperations().click()
      await flushPromises()
      expect(list().classList.contains('asset-queue-editable--sidebar-active')).toBe(false)
    })
  })
})
