import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, type Pinia, setActivePinia } from 'pinia'
import {
  cmsConfiguration,
  consumerProfiles,
  installConsumerProfile,
} from '@/domains/dam/__tests__/support/consumerProfiles'
import { answerDamNames, damNameLookups, damNamesAsked } from '@/domains/dam/__tests__/support/damNames'
import { type DamSocket, stubDamSocket } from '@/domains/dam/__tests__/support/damSocket'
import { createFakeDam, type FakeDam } from '@/domains/dam/__tests__/support/fakeDam'
import { holdLongWaits, type LongWaits } from '@/domains/dam/__tests__/support/longWaits'
import {
  alertText,
  damText,
  forgetAlerts,
  shownAlerts,
  signInToDam,
  signOutOfDam,
  uiText,
} from '@/domains/dam/__tests__/support/uploadUi'
import AssetDetailSidebarROI from '@/domains/dam/assetDetail/components/AssetDetailSidebarROI.vue'
import { AssetDetailTabImageWithRoi, useAssetDetailStore } from '@/domains/dam/assetDetail/store/assetDetailStore'
import AuthorRemoteAutocompleteWithCached from '@/domains/dam/author/components/AuthorRemoteAutocompleteWithCached.vue'
import { initCommonAdminCoreDamOptions } from '@/domains/dam/composables/commonAdminCoreDamOptions'
import { destroyDamNotifications, initDamNotifications } from '@/domains/dam/composables/damNotifications'
import { useDamNotificationsEventBus } from '@/domains/dam/composables/damNotificationsEventBus'
import { useDamConfigStore } from '@/domains/dam/config/store/damConfigStore'
import DamAssetImageRoiSelectLazy from '@/domains/dam/cropper/components/DamAssetImageRoiSelectLazy.vue'
import type { UploadMetadataToImageMapFn } from '@/domains/dam/imageWidget/utils/metadataToImageMap'
import KeywordRemoteAutocompleteWithCached from '@/domains/dam/keyword/components/KeywordRemoteAutocompleteWithCached.vue'
import { DamAssetType } from '@/domains/dam/types/Asset'
import { AssetFileFailReason, AssetFileProcessStatus } from '@/domains/dam/types/AssetFile'
import { UploadQueueItemStatus } from '@/domains/dam/types/UploadQueue'
import UploadQueueDialogSingle from '@/domains/dam/uploadQueue/components/UploadQueueDialogSingle.vue'
import { useUploadQueueDialog } from '@/domains/dam/uploadQueue/composables/useUploadQueueDialog'
import { useUploadQueuesStore } from '@/domains/dam/uploadQueue/store/uploadQueuesStore'

// The dialog of an image widget for one uploaded file, under each of the two applications: what it consists of
// while the file is on its way and once it is done, who may edit the region of interest in it, and what its "save",
// its "save and apply" and its close button do. The real dialog with its real sidebar over the real queue; the DAM
// is a client that records its requests, and only the long waits are taken out of real time. The refresh the
// dialog comes to offer, and what it says of a duplicate, are in `uploadQueueDialogSingle.test.ts`.

const QUEUE = 'single-dialog'
const { Processing, Uploaded, Failed, Uploading } = UploadQueueItemStatus

let pinia: Pinia
let dam: FakeDam
let waits: LongWaits
let socket: DamSocket
let wrapper: VueWrapper | undefined
/** The map of the application from an upload to images, where it brings one: called as the dialog calls it. */
let mapOfTheApplication: Mock<UploadMetadataToImageMapFn> | undefined

const photo = () => new File([new Uint8Array(3000)], 'photo.jpg', { type: 'image/jpeg' })
const metadata = (customData: Record<string, unknown>) => ({
  metadata: { customData, authorSuggestions: {}, keywordSuggestions: {} },
})

describe.each(consumerProfiles)('the dialog of one uploaded file under the $name', (profile) => {
  const { endPoints, extSystem, licence, foreignPrefix } = profile
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

  const queue = () => useUploadQueuesStore(pinia)
  const item = () => queue().getQueueItems(QUEUE)[0]
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
        // The picture would ask the image server; the editor of the region of interest is the cropper, and its
        // sidebar asks the DAM for the regions; the inputs of keywords and authors ask it for names to offer.
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
  /** A file is picked: the widget queues it and opens the dialog of its queue. The row waits for the server. */
  const pickOne = async () => {
    await queue().addByFiles(QUEUE, extSystem, licence, [photo()])
    await mountDialog()
    await vi.waitFor(() => expect(item().status).toBe(Processing))
    await flushPromises()
  }
  /** The server has processed the file, the queue has asked, and the dialog has read the asset for its detail. */
  const uploaded = async (parts: Record<string, unknown> = metadata({ description: 'from the server' })) => {
    await pickOne()
    dam.fileBecomes('asset-1', AssetFileProcessStatus.Processed, parts)
    await waits.elapse()
    await vi.waitFor(() => expect(item().status).toBe(Uploaded))
    await vi.waitFor(() => expect(useAssetDetailStore(pinia).asset?.id).toBe('asset-1'))
    await flushPromises()
  }
  // The dialog is drawn into the body.
  const inDialog = <T extends Element>(selector: string) =>
    document.body.querySelector<T>(`.dam-image-detail ${selector}`)
  const allInDialog = <T extends Element>(selector: string) =>
    Array.from(document.body.querySelectorAll<T>(`.dam-image-detail ${selector}`))
  const toolbar = () => inDialog<HTMLElement>('.v-toolbar')!
  const leftPane = () => inDialog<HTMLElement>('.dam-image-detail__left')!
  const sidebar = () => inDialog<HTMLElement>('.dam-image-detail__sidebar')!
  const tab = (name: 'button-meta' | 'button-focus') => inDialog<HTMLElement>(`[data-cy="${name}"]`)
  const button = (name: 'button-save' | 'button-save-and-apply' | 'button-close') =>
    inDialog<HTMLButtonElement>(`[data-cy="${name}"]`)!
  const roiEditor = () => wrapper!.findComponent(DamAssetImageRoiSelectLazy)
  const labels = () =>
    allInDialog<HTMLElement>('.v-field .v-label, .v-switch .v-label').map((label) => label.textContent?.trim())
  // The fields the user types into; a growing text field has a hidden twin that measures it.
  const fields = () =>
    allInDialog<HTMLInputElement | HTMLTextAreaElement>('input[type="text"], textarea').filter(
      (field) => field.getAttribute('aria-hidden') !== 'true'
    )
  const type = async (field: HTMLInputElement | HTMLTextAreaElement, text: string) => {
    field.value = text
    field.dispatchEvent(new Event('input', { bubbles: true }))
    await flushPromises()
  }
  const saves = () => dam.sentTo('PATCH', dam.routes.bulkMetadata)
  const updated = ['success', alertText('common.alert.recordWas.updated')]
  const fixTheForm = ['error', alertText('common.alert.fixValidationErrors')]
  const outsideOwnPrefix = () =>
    dam.requests.filter((request) => request.url.startsWith(foreignPrefix) && !/\/(author|keyword)\//.test(request.url))

  describe('while the server works on the file', () => {
    it('says the upload runs, has the metadata tab alone, and can be neither filled nor saved', async () => {
      await pickOne()

      expect(toolbar().textContent).toContain(damText('upload.title'))
      expect(toolbar().textContent).not.toContain(damText('upload.titleDone'))
      // Also an application that asks for a sidebar without tabs has them until the file is done.
      expect([!!tab('button-meta'), !!tab('button-focus')]).toEqual([true, false])
      expect(roiEditor().exists()).toBe(false)
      expect(leftPane().querySelector('asset-image-stub')).not.toBeNull()
      expect(fields().length).toBe(2)
      expect(fields().every((field) => field.disabled)).toBe(true)
      expect([button('button-save').disabled, button('button-save-and-apply').disabled]).toEqual([true, true])
      // The dialog has read no asset for its detail yet.
      expect(useAssetDetailStore(pinia).asset).toBeNull()
    })
  })

  describe('once the file is uploaded', () => {
    it('reads the asset from the DAM of the application for its detail, says the upload is done and opens the form', async () => {
      await uploaded()

      expect(dam.sentTo('GET', dam.routes.one).map((request) => request.url)).toContain(`${endPoints.asset}/asset-1`)
      expect(outsideOwnPrefix()).toEqual([])
      expect(dam.unanswered).toEqual([])
      expect(toolbar().textContent).toContain(damText('upload.titleDone'))
      expect(fields().map((field) => field.value)).toContain('from the server')
      expect(fields().some((field) => field.disabled)).toBe(false)
      expect([button('button-save').disabled, button('button-save-and-apply').disabled]).toEqual([false, false])
    })

    // admin-cms: the sidebar of the DAM, with its two tabs. admin-ugc asks for the simple one: no tabs, the editor of
    // the region of interest in place of the picture at once, and its regions under the form.
    it('lays out the region of interest as the application asks: behind a tab of its own, or in place of the picture', async () => {
      await uploaded()

      expect([!!tab('button-meta'), !!tab('button-focus')]).toEqual(isCms ? [true, true] : [false, false])
      expect(sidebar().querySelector('.sidebar-info--no-tabs') !== null).toBe(!isCms)
      expect(roiEditor().exists()).toBe(!isCms)
      expect(leftPane().querySelector('asset-image-stub') !== null).toBe(isCms)
      expect(wrapper!.findComponent(AssetDetailSidebarROI).exists()).toBe(!isCms)

      if (!isCms) return
      // The tab of the region of interest puts its editor in place of the picture, and its regions in place of the
      // form; the buttons of the form go with the form.
      tab('button-focus')!.click()
      await vi.waitFor(() => expect(roiEditor().exists()).toBe(true))
      expect(leftPane().querySelector('asset-image-stub')).toBeNull()
      expect(wrapper!.findComponent(AssetDetailSidebarROI).exists()).toBe(true)
      expect(fields()).toEqual([])
      expect(inDialog('[data-cy="button-save-and-apply"]')).toBeNull()
      expect(useAssetDetailStore(pinia).activeTab).toBe(AssetDetailTabImageWithRoi.ROI)
    })

    // admin-cms: its two custom fields, the keywords and authors of the DAM, the single-use switch, and what the
    // DAM knows of the file. admin-ugc: its two custom fields and nothing else.
    it('has the fields of the application: its custom fields, and keywords, authors, the switch and the file panel only where it has them', async () => {
      await uploaded()

      expect(new Set(labels())).toEqual(
        new Set(isCms ? ['title', 'description', damText('asset.model.mainFileSingleUse')] : ['description', 'author'])
      )
      expect(fields()).toHaveLength(2)
      expect(wrapper!.findComponent(KeywordRemoteAutocompleteWithCached).exists()).toBe(isCms)
      expect(wrapper!.findComponent(AuthorRemoteAutocompleteWithCached).exists()).toBe(isCms)
      expect(inDialog('.v-switch') !== null).toBe(isCms)
      const panels = allInDialog<HTMLElement>('.v-expansion-panel-title').map((title) => title.textContent?.trim())
      expect(panels).toEqual(
        isCms
          ? [damText('asset.detail.info.metadata'), damText('asset.detail.info.file')]
          : [damText('asset.detail.info.metadata')]
      )
      // The file panel names the asset and its file.
      expect(sidebar().textContent!.includes('file-1')).toBe(isCms)
    })
  })

  describe('the editor of the region of interest', () => {
    const shown = async () => {
      await uploaded()
      if (isCms) {
        tab('button-focus')!.click()
        await vi.waitFor(() => expect(roiEditor().exists()).toBe(true))
      }
      return roiEditor()
    }

    if (isCms) {
      // The endpoint of admin-cms saves a region only for a user with the grant; without it the tab shows the image.
      it.each([
        [
          'can be edited by a user of the DAM who may update regions of interest',
          ['dam_regionOfInterest_update'],
          false,
        ],
        ['only shows the image to a user of the DAM without that grant', ['dam_image_update'], true],
      ])('%s', async (_what, grants, readonly) => {
        signInToDam(extSystem, grants)

        expect((await shown()).props('readonly')).toBe(readonly)
      })

      it('only shows the image while no user of the DAM is loaded', async () => {
        expect((await shown()).props('readonly')).toBe(true)
      })
    } else {
      // The endpoint of admin-ugc asks for no grant, and the application has no user of the DAM to ask one of.
      it('can be edited with no user of the DAM at all', async () => {
        expect((await shown()).props('readonly')).toBe(false)
      })
    }

    it('is handed the ext system of the upload', async () => {
      expect((await shown()).props('extSystem')).toBe(extSystem)
    })
  })

  describe('"save and apply"', () => {
    /** The uploaded file of an editor who has typed a description; in admin-cms its asset has two authors. */
    const typedIn = async () => {
      await uploaded({
        ...metadata({ description: 'from the server', author: ' A. Author ' }),
        authors: isCms ? ['author-1', 'author-2'] : [],
      })
      await damNamesAsked()
      await type(
        fields().find((field) => field.value === 'from the server')!,
        ' typed by the user '
      )
    }

    it('saves the metadata, hands the widget one image built from the answer, then empties the queue and closes the dialog', async () => {
      // The DAM answers a save with the asset as it is then, internal or not.
      dam.reply((request) =>
        request.method === 'PATCH' && dam.routes.bulkMetadata.test(request.url)
          ? {
              status: 200,
              data: (dam.body(request) as Array<Record<string, unknown>>).map((sent) => ({
                ...sent,
                mainFileInternal: true,
              })),
            }
          : undefined
      )
      await typedIn()
      const lookupsBefore = damNameLookups(dam).length

      button('button-save-and-apply').click()
      await vi.waitFor(() => expect(wrapper!.emitted('apply')).toHaveLength(1))
      await flushPromises()

      expect(saves().map((request) => request.url)).toEqual([bulkSave])
      const sent = dam.body(saves()[0]) as Array<Record<string, unknown>>
      expect(sent).toHaveLength(1)
      expect(sent[0]).toMatchObject({
        id: 'asset-1',
        keywords: [],
        authors: isCms ? ['author-1', 'author-2'] : [],
        described: true,
        customData: { description: ' typed by the user ', author: ' A. Author ' },
        // A row that has no word of the DAM on it is sent as not single-use.
        mainFileSingleUse: false,
      })
      expect(wrapper!.emitted('apply')![0]).toMatchObject([
        [
          {
            assetId: 'asset-1',
            texts: {
              description: 'typed by the user',
              source: isCms ? 'Name of author-1, Name of author-2' : 'A. Author',
            },
            dam: { damId: 'file-1', licenceId: licence, regionPosition: 0, internal: isCms },
            flags: { showSource: true, internal: false, overrideInternal: false },
            position: 1,
          },
        ],
      ])
      // The library's map asks for the names of the authors, once; the map of admin-ugc asks for nothing.
      expect(damNameLookups(dam).length - lookupsBefore).toBe(isCms ? 1 : 0)
      expect(outsideOwnPrefix()).toEqual([])
      expect(shownAlerts()).toEqual([updated])
      // Unlike the dialog of a queue of files, this one ends the upload itself.
      expect(queue().getQueueItems(QUEUE)).toEqual([])
      expect(useAssetDetailStore(pinia).asset).toBeNull()
      expect(useUploadQueueDialog().uploadQueueDialog.value).toBeNull()
    })

    it('goes through the map of the application where it brings one: the row, the answer of the save, the client, the ext system and the licence', async () => {
      await typedIn()

      button('button-save-and-apply').click()
      await vi.waitFor(() => expect(wrapper!.emitted('apply')).toHaveLength(1))

      if (!mapOfTheApplication) {
        // admin-cms brings none: the library's own map made the image.
        expect(isCms).toBe(true)
        return
      }
      expect(mapOfTheApplication).toHaveBeenCalledTimes(1)
      const [rowsHanded, answer, client, extSystemHanded, licenceHanded] = mapOfTheApplication.mock.calls[0]
      expect(rowsHanded.map((row) => [row.assetId, row.fileId])).toEqual([['asset-1', 'file-1']])
      expect(answer.map((saved) => [saved.id, saved.customData])).toEqual([
        ['asset-1', { description: ' typed by the user ', author: ' A. Author ' }],
      ])
      expect(client).toBe(dam.client)
      expect([extSystemHanded, licenceHanded]).toEqual([extSystem, licence])
    })

    it('sends nothing, and says what to fix, while a field the application requires is empty', async () => {
      const elements = useDamConfigStore(pinia).damConfigAssetCustomFormElements.get(extSystem)![DamAssetType.Image]
      elements.find((element) => element.property === 'description')!.attributes.required = true
      await uploaded(metadata({}))

      button('button-save-and-apply').click()
      await flushPromises()
      button('button-save').click()
      await flushPromises()

      expect(shownAlerts()).toEqual([fixTheForm, fixTheForm])
      expect(saves()).toEqual([])
      expect(wrapper!.emitted('apply')).toBeUndefined()
      expect(item().status).toBe(Uploaded)
      expect(useUploadQueueDialog().uploadQueueDialog.value).toBe(QUEUE)
    })

    // Today's behaviour, pinned as it is. A save the DAM refuses rejects with the error of axios as it is, and a
    // save answered with no asset throws an error of the dialog's own: the alert for errors lets both pass without
    // a word. The dialog stays as it was, with nothing said.
    it.each([
      ['refuses the save', { status: 500 }],
      ['answers the save with no asset', { status: 200, data: [] }],
    ])('hands over nothing, keeps the dialog and says nothing when the DAM %s', async (_what, answer) => {
      dam.reply((request) =>
        request.method === 'PATCH' && dam.routes.bulkMetadata.test(request.url) ? answer : undefined
      )
      await typedIn()

      button('button-save-and-apply').click()
      await vi.waitFor(() => expect(saves()).toHaveLength(1))
      await waits.settle()

      expect(wrapper!.emitted('apply')).toBeUndefined()
      expect(shownAlerts()).toEqual([])
      expect(item().status).toBe(Uploaded)
      expect(useAssetDetailStore(pinia).asset?.id).toBe('asset-1')
      expect(useUploadQueueDialog().uploadQueueDialog.value).toBe(QUEUE)
    })
  })

  describe('"save"', () => {
    it('saves the metadata and says so, and leaves the dialog and its queue as they are', async () => {
      await uploaded()
      await type(
        fields().find((field) => field.value === 'from the server')!,
        'typed by the user'
      )

      button('button-save').click()
      await vi.waitFor(() => expect(shownAlerts()).toEqual([updated]))

      expect(saves().map((request) => request.url)).toEqual([bulkSave])
      expect(dam.body(saves()[0])).toMatchObject([
        { id: 'asset-1', described: true, customData: { description: 'typed by the user' } },
      ])
      expect(wrapper!.emitted('apply')).toBeUndefined()
      expect(item().status).toBe(Uploaded)
      expect(useUploadQueueDialog().uploadQueueDialog.value).toBe(QUEUE)
    })
  })

  describe('a file the server refuses', () => {
    it('is said over the picture, with the reason, and can be neither filled nor saved', async () => {
      await pickOne()
      dam.fileBecomes('asset-1', AssetFileProcessStatus.Failed, {}, { failReason: AssetFileFailReason.InvalidMimeType })
      await waits.elapse()
      await vi.waitFor(() => expect(item().status).toBe(Failed))
      await flushPromises()

      const error = leftPane().querySelector<HTMLElement>('.dam-upload-queue__overlay--error')!
      expect(error.textContent).toContain(damText('queueItem.error'))
      expect(error.textContent).toContain(damText('asset.assetFileFailReason.invalidMimeType'))
      // A failed file counts as done, as in the queue of several files.
      expect(toolbar().textContent).toContain(damText('upload.titleDone'))
      expect(fields().every((field) => field.disabled)).toBe(true)
      expect([button('button-save').disabled, button('button-save-and-apply').disabled]).toEqual([true, true])
      // No asset is read for a detail, and the region of interest is not offered.
      expect(useAssetDetailStore(pinia).asset).toBeNull()
      expect(tab('button-focus')).toBeNull()
      expect(roiEditor().exists()).toBe(false)
    })
  })

  describe('the button that closes it', () => {
    const question = () => document.body.querySelector<HTMLElement>('[data-cy="delete-panel"]')

    it('asks first while the file is being sent; confirmed, it stops the upload, empties the queue and closes the dialog', async () => {
      const chunks = dam.hold('POST', dam.routes.chunk)
      await queue().addByFiles(QUEUE, extSystem, licence, [photo()])
      await mountDialog()
      await vi.waitFor(() => expect(chunks.waiting).toHaveLength(1))
      await flushPromises()
      const signal = chunks.waiting[0]!.request.config.signal as AbortSignal
      const fileInputKey = queue().getQueue(QUEUE)!.fileInputKey

      button('button-close').click()
      await flushPromises()
      expect(question()!.textContent).toContain(damText('upload.stopConfirmQuestion'))
      expect([item().status, signal.aborted]).toEqual([Uploading, false])

      question()!.querySelector<HTMLElement>('[data-cy="button-confirm"]')!.click()
      await flushPromises()

      expect(signal.aborted).toBe(true)
      expect(queue().getQueueItems(QUEUE)).toEqual([])
      expect(queue().getQueue(QUEUE)!.fileInputKey).toBeGreaterThan(fileInputKey)
      expect(useUploadQueueDialog().uploadQueueDialog.value).toBeNull()
      // Nothing more is sent, finished or asked about, however long the page stays open.
      await waits.elapseAll()
      expect(dam.sentTo('PATCH', dam.routes.finish)).toEqual([])
      expect(dam.assetReads()).toEqual([])
    })

    it('closes at once a dialog whose file is done: the row and the detail are dropped, saved or not', async () => {
      await uploaded()

      button('button-close').click()
      await flushPromises()

      expect(question()).toBeNull()
      expect(queue().getQueueItems(QUEUE)).toEqual([])
      expect(useAssetDetailStore(pinia).asset).toBeNull()
      expect(useUploadQueueDialog().uploadQueueDialog.value).toBeNull()
      expect(saves()).toEqual([])
      expect(wrapper!.emitted('apply')).toBeUndefined()
    })
  })

  // What a widget is left with when the file picked is of a type its ext system does not take: the dialog is
  // opened all the same, over a queue that got no row.
  describe('over a queue without a row', () => {
    it('shows a loader alone, whose close button closes the dialog', async () => {
      await mountDialog()

      expect(document.body.querySelector('.dam-image-detail .v-progress-circular')).not.toBeNull()
      expect(inDialog('.dam-image-detail__sidebar')).toBeNull()
      expect(inDialog('[data-cy="button-save-and-apply"]')).toBeNull()

      document.body
        .querySelector<HTMLElement>(`.dam-image-detail button[aria-label="${uiText('common.button.close')}"]`)!
        .click()
      await flushPromises()

      expect(useUploadQueueDialog().uploadQueueDialog.value).toBeNull()
      expect(dam.requests).toEqual([])
    })
  })
})
