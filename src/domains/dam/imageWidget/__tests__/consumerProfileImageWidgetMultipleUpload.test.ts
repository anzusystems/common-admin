import axios from 'axios'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, type Pinia, setActivePinia } from 'pinia'
import { defineComponent, h, shallowRef } from 'vue'
import { type ConsumerImageApi, installConsumerImageApi } from '@/domains/dam/__tests__/support/consumerImageApi'
import {
  cmsConfiguration,
  consumerProfiles,
  installConsumerProfile,
} from '@/domains/dam/__tests__/support/consumerProfiles'
import { answerDamNames, DAM_NAMES, damNameLookups, damNamesAsked } from '@/domains/dam/__tests__/support/damNames'
import { type DamSocket, stubDamSocket } from '@/domains/dam/__tests__/support/damSocket'
import {
  createFakeDam,
  damAssetWithFile,
  type FakeDam,
  type FakeDamRequest,
  type FakeDamRule,
} from '@/domains/dam/__tests__/support/fakeDam'
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
import { updateAssetMetadata } from '@/domains/dam/api/damAssetApi'
import AssetDetailSidebarActionsTeleportTarget from '@/domains/dam/assetDetail/components/AssetDetailSidebarActionsTeleportTarget.vue'
import AssetDetailSidebarMetadata from '@/domains/dam/assetDetail/components/AssetDetailSidebarMetadata.vue'
import { useAssetDetailStore } from '@/domains/dam/assetDetail/store/assetDetailStore'
import { useAssetSelectStore } from '@/domains/dam/assetSelect/store/assetSelectStore'
import AuthorRemoteAutocompleteWithCached from '@/domains/dam/author/components/AuthorRemoteAutocompleteWithCached.vue'
import { useCommonAdminCoreDamOptions } from '@/domains/dam/composables/commonAdminCoreDamOptions'
import { destroyDamNotifications, initDamNotifications } from '@/domains/dam/composables/damNotifications'
import { useExtSystemIdForCached } from '@/domains/dam/composables/extSystemIdForCached'
import { DamNotificationName, useDamNotificationsEventBus } from '@/domains/dam/composables/damNotificationsEventBus'
import { useDamConfigStore } from '@/domains/dam/config/store/damConfigStore'
import ImageWidgetMultipleInner from '@/domains/dam/imageWidget/components/ImageWidgetMultipleInner.vue'
import ImageWidgetMultipleItem from '@/domains/dam/imageWidget/components/ImageWidgetMultipleItem.vue'
import { useImageMassOperations } from '@/domains/dam/imageWidget/composables/useImageMassOperations'
import { useImageStore } from '@/domains/dam/imageWidget/store/imageStore'
import { ImageWidgetUploadConfigKey } from '@/domains/dam/imageWidget/utils/imageWidgetInkectionKeys'
import { DamAssetType, type DamImageCopyToLicenceResponseItem } from '@/domains/dam/types/Asset'
import { AssetFileProcessStatus } from '@/domains/dam/types/AssetFile'
import type { ImageAware } from '@/domains/dam/types/ImageAware'
import { UploadQueueItemStatus } from '@/domains/dam/types/UploadQueue'
import UploadQueueDialog from '@/domains/dam/uploadQueue/components/UploadQueueDialog.vue'
import { useUploadQueueDialog } from '@/domains/dam/uploadQueue/composables/useUploadQueueDialog'
import { useUploadQueuesStore } from '@/domains/dam/uploadQueue/store/uploadQueuesStore'
import type { DocId, IntegerId } from '@/shared/types/common'

// The widget of several images (a gallery), under each of the two applications: how it loads the images it
// has, what an upload adds to them, what a row of it offers, and what its save writes. The real widget with its real
// file input, limit check, queue dialog and rows over the real queue and the real image store; the DAM and the
// backend of the images are clients that record their requests, and only the long waits are taken out of real time.
// Not mounted for real: the sortable list around the rows (a stand-in draws the rows), the asset picker, the
// pictures, what the dialog of the asset detail frames (the dialog itself is the real one, and closes as it does),
// the mass operations of the queue dialog, the dropzones, and the inputs that ask the DAM for names to offer.

const QUEUE = 'gallery'
const { Processing, Uploaded } = UploadQueueItemStatus

let pinia: Pinia
let dam: FakeDam
let imageApi: ConsumerImageApi
let waits: LongWaits
let socket: DamSocket
let widget: VueWrapper | undefined

const photo = (name: string) => new File([new Uint8Array(3000)], name, { type: 'image/jpeg' })
const metadata = (customData: Record<string, unknown>) => ({
  metadata: { customData, authorSuggestions: {}, keywordSuggestions: {} },
})
const Picker = defineComponent({ name: 'AAssetSelect', emits: ['confirm'], setup: () => () => h('div') })
// The list editor around the rows: only its view is drawn, and a commit of its rows is taken without a word.
const Editor = defineComponent({
  name: 'ASortableListEditor',
  setup: (_, { slots, expose }) => {
    expose({ commit: () => undefined, cancelReorderMode: () => undefined })
    return () => h('div', slots['view-body']?.())
  },
})
const carrying = (files: File[]) => {
  const dataTransfer = new DataTransfer()
  files.forEach((file) => dataTransfer.items.add(file))
  return dataTransfer
}

describe.each(consumerProfiles)('the widget of several images under the $name', (profile) => {
  const { endPoints, extSystem, licence, foreignPrefix } = profile
  const isCms = profile === cmsConfiguration

  /** An image the entity already has: `file-<id>` of `asset-<id>`. */
  const stored = (id: number, position: number): ImageAware => ({
    id,
    texts: { description: `image ${id}`, source: `source ${id}` },
    dam: { damId: `file-${id}`, licenceId: licence, regionPosition: 0, internal: false },
    flags: { showSource: true, internal: false, overrideInternal: false },
    position,
  })
  const SEARCH = new RegExp(
    `^${endPoints.asset.replace(/\//g, '\\/')}\\/licence\\/(\\d+)\\/search\\?assetAndMainFileIds=([^&]*)`
  )

  beforeEach(() => {
    pinia = createPinia()
    setActivePinia(pinia)
    dam = createFakeDam(endPoints)
    imageApi = installConsumerImageApi(profile, installConsumerProfile(profile, dam.client))
    answerDamNames(dam)
    // The search of the DAM for assets by their files, which the widget asks before it reads the assets.
    dam.reply((request) => {
      const match = request.method === 'GET' ? request.url.match(SEARCH) : null
      if (!match) return undefined
      const files = match[2]!.split(',')
      const found = [...dam.assets.values()].filter((asset) => asset.mainFile && files.includes(asset.mainFile.id))
      return { status: 200, data: { data: found, totalCount: found.length } }
    })
    waits = holdLongWaits()
    socket = stubDamSocket()
    forgetAlerts()
    if (profile.notifications) {
      initDamNotifications().openConnection()
      socket.accept()
    }
    if (isCms) signInToDam(extSystem)
  })
  afterEach(() => {
    widget?.unmount()
    widget = undefined
    useUploadQueuesStore(pinia).stopUpload(QUEUE)
    useUploadQueueDialog().uploadQueueDialog.value = null
    destroyDamNotifications()
    waits.restore()
    socket.restore()
    useDamNotificationsEventBus().reset()
    signOutOfDam()
  })

  const queue = () => useUploadQueuesStore(pinia)
  const images = () => useImageStore(pinia).images
  const mountWidget = async (modelValue: number[] = []) => {
    const mounted: VueWrapper = mount(ImageWidgetMultipleInner, {
      attachTo: document.body,
      props: {
        modelValue,
        queueKey: QUEUE,
        uploadLicence: licence,
        selectLicences: [licence],
        skipCurrentUserCheck: !isCms,
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
    await flushPromises()
    return mounted
  }
  /** The entity has two images: the first of an asset with an author of the DAM (admin-cms), the second without. */
  const withTwoImages = async () => {
    imageApi.has(stored(11, 1))
    imageApi.has(stored(12, 2))
    dam.assets.set(
      'asset-11',
      damAssetWithFile('asset-11', 'file-11', AssetFileProcessStatus.Processed, {
        licence,
        authors: isCms ? ['author-1'] : [],
      })
    )
    dam.assets.set('asset-12', damAssetWithFile('asset-12', 'file-12', AssetFileProcessStatus.Processed, { licence }))
    const mounted = await mountWidget([12, 11])
    await vi.waitFor(() => expect(images()).toHaveLength(2))
    await damNamesAsked()
    await flushPromises()
    return mounted
  }
  const rows = () => widget!.findAllComponents(ImageWidgetMultipleItem)
  // A growing text field has a hidden twin that measures it.
  const textsOf = (root: Element) =>
    Array.from(root.querySelectorAll<HTMLTextAreaElement>('textarea'))
      .filter((field) => field.getAttribute('aria-hidden') !== 'true')
      .map((field) => field.value)
  /** The user picks files with the upload button of the widget. */
  const pick = async (...names: string[]) => {
    const input = (widget!.element as Element).querySelector<HTMLInputElement>('input[type="file"]')!
    input.files = carrying(names.map(photo)).files
    input.dispatchEvent(new Event('change', { bubbles: true }))
    await flushPromises()
  }
  const statuses = () =>
    queue()
      .getQueueItems(QUEUE)
      .map((item) => item.status)
  /** Two files are uploaded: the first of them has an author of the DAM in admin-cms, the second has none. */
  const twoUploaded = async () => {
    await pick('a.jpg', 'b.jpg')
    await vi.waitFor(() => expect(statuses()).toEqual([Processing, Processing]))
    const [a, b] = queue().getQueueItems(QUEUE)
    dam.fileBecomes(a.assetId!, AssetFileProcessStatus.Processed, {
      ...metadata({ description: 'first upload', author: 'A. Author' }),
      authors: isCms ? ['author-2'] : [],
    })
    dam.fileBecomes(b.assetId!, AssetFileProcessStatus.Processed, metadata({ description: 'second upload' }))
    await waits.elapse()
    await vi.waitFor(() => expect(statuses()).toEqual([Uploaded, Uploaded]))
    await damNamesAsked()
    await flushPromises()
    return { a, b }
  }
  // The queue dialog is drawn into the body.
  const queueDialog = () => document.body.querySelector<HTMLElement>('.overlay--sidebar')
  const saveAndApply = () =>
    Array.from(queueDialog()!.querySelectorAll<HTMLButtonElement>('.v-toolbar button')).find((button) =>
      [damText('upload.saveAndApply'), damText('upload.apply')].includes(button.textContent?.trim() ?? '')
    )!
  const toForeignPrefix = () =>
    dam.requests.filter((request) => request.url.startsWith(foreignPrefix) && !/\/(author|keyword)\//.test(request.url))
  const save = () => (widget!.vm as unknown as { saveImages: () => Promise<boolean> }).saveImages()
  /** What each save of metadata has sent to the DAM, in order: those of the queue dialog, and the authors of rows. */
  const metadataWrites = () =>
    dam
      .sentTo('PATCH', dam.routes.bulkMetadata)
      .map((request) => dam.body(request) as Array<{ id: DocId; authors?: DocId[] }>)
  const offersAuthors = () => rows().map((row) => row.findComponent(AuthorRemoteAutocompleteWithCached).exists())
  /** "Replace everywhere" of the mass operations above the widget: every row gets the authors, named as its source. */
  const replaceAuthorsEverywhere = async (authors: DocId[]) => {
    await useImageMassOperations().replaceEmptyAuthors(authors, true)
    await flushPromises()
  }
  /** "Fill empty" of the same: the rows without authors of the DAM, but for one that shows a source filled in. */
  const fillEmptyAuthors = async (authors: DocId[]) => {
    await useImageMassOperations().replaceEmptyAuthors(authors)
    await flushPromises()
  }

  describe('the images the entity already has', () => {
    it('are read from the image API of the application, and their assets from the DAM of the application', async () => {
      await withTwoImages()

      expect(imageApi.calls).toEqual([['fetchImageListByIds', [12, 11]]])
      // admin-cms leaves the read to the library, which asks the CMS backend; admin-ugc reads by its own function.
      expect(imageApi.requests.map((request) => request.url.split('?')[0])).toEqual(isCms ? ['/adm/v1/image'] : [])
      // The assets are found by the files of the images, then read by their ids.
      const fromTheDam = dam.requests.filter((request) => request.url.startsWith(`${endPoints.asset}/`))
      expect(fromTheDam.map((request) => request.url.split('?')[0])).toEqual([
        `${endPoints.asset}/licence/${licence}/search`,
        `${endPoints.asset}/licence/${licence}/ids/asset-11,asset-12`,
      ])
      expect(fromTheDam[0].url).toContain('assetAndMainFileIds=file-11,file-12')
      expect(toForeignPrefix()).toEqual([])
      expect(dam.unanswered).toEqual([])
    })

    it('are shown in their stored order, each with the asset and the authors the DAM has for it', async () => {
      const mounted = await withTwoImages()

      expect(images().map((image) => [image.id, image.position, image.assetId, image.damAuthors])).toEqual([
        [11, 1, 'asset-11', isCms ? ['author-1'] : []],
        [12, 2, 'asset-12', []],
      ])
      // The authors of the DAM are offered for an image whose asset has none.
      expect(images().map((image) => image.showDamAuthors)).toEqual([!isCms, true])
      expect(useImageStore(pinia).maxPosition).toBe(2)
      expect(rows()).toHaveLength(2)
      // The form takes the ids in that order.
      expect(mounted.emitted('update:modelValue')).toEqual([[[11, 12]]])
    })
  })

  describe('a row of the widget', () => {
    // admin-cms: the ext system has the authors of the DAM, so an image whose asset has none is offered them in
    // place of the source. admin-ugc has no authors of the DAM: every row has its source.
    it('has the description and the source of the image, or the authors of the DAM where the application has them and the asset none', async () => {
      await withTwoImages()

      const [first, second] = rows()
      expect(textsOf(first.element)).toEqual(['image 11', 'source 11'])
      expect(first.findComponent(AuthorRemoteAutocompleteWithCached).exists()).toBe(false)
      expect(textsOf(second.element)).toEqual(isCms ? ['image 12'] : ['image 12', 'source 12'])
      expect(second.findComponent(AuthorRemoteAutocompleteWithCached).exists()).toBe(isCms)
      // admin-ugc names the source its own way and has no "show source" switch.
      const { sourceLabel } = useCommonAdminCoreDamOptions()
      expect(first.text()).toContain(sourceLabel)
      expect(first.find('.v-switch').exists()).toBe(isCms)
    })
  })

  describe('files picked with the upload button of the widget', () => {
    it('are queued under the key of the widget, in its upload licence, and the queue dialog opens over them', async () => {
      const chunks = dam.hold('POST', dam.routes.chunk)
      await mountWidget()
      expect(queueDialog()).toBeNull()

      await pick('a.jpg', 'b.jpg')
      await vi.waitFor(() => expect(chunks.waiting).toHaveLength(2))
      await flushPromises()

      expect(queue().getQueueItems(QUEUE)).toMatchObject([
        { displayTitle: 'a.jpg', licenceId: licence },
        { displayTitle: 'b.jpg', licenceId: licence },
      ])
      expect(dam.sentTo('POST', dam.routes.start).map((request) => request.url)).toEqual([
        `${endPoints.image}/licence/${licence}`,
        `${endPoints.image}/licence/${licence}`,
      ])
      expect(useUploadQueueDialog().uploadQueueDialog.value).toBe(QUEUE)
      expect(widget!.findComponent(UploadQueueDialog).exists()).toBe(true)
      expect(queueDialog()!.textContent).toContain(damText('upload.title'))
    })

    // Finding 30: nothing is queued, and no queue dialog opens over a queue that got no row. It used to, empty.
    const nothingIsQueued = () => {
      expect(queue().getQueueItems(QUEUE)).toEqual([])
      expect(dam.sentTo('POST', dam.routes.start)).toEqual([])
      expect(useUploadQueueDialog().uploadQueueDialog.value).toBeNull()
      expect(queueDialog()).toBeNull()
    }

    it('of a type the ext system does not take: is turned away with a warning, and no queue dialog opens', async () => {
      await mountWidget()
      const input = (widget!.element as Element).querySelector<HTMLInputElement>('input[type="file"]')!

      input.files = carrying([new File([new Uint8Array(3000)], 'scan.tiff', { type: 'image/tiff' })]).files
      input.dispatchEvent(new Event('change', { bubbles: true }))
      await flushPromises()

      expect(shownAlerts()).toEqual([['warning', `${alertText('common.system.upload.incorrectFormatSize')}:scan.tiff`]])
      nothingIsQueued()
    })

    // What is left of the files goes on as before: those the ext system takes are queued, the other is named.
    it('some of a type the ext system does not take: those are turned away with a warning, the rest is queued', async () => {
      const chunks = dam.hold('POST', dam.routes.chunk)
      await mountWidget()
      const input = (widget!.element as Element).querySelector<HTMLInputElement>('input[type="file"]')!

      input.files = carrying([
        new File([new Uint8Array(3000)], 'scan.tiff', { type: 'image/tiff' }),
        photo('a.jpg'),
        photo('b.jpg'),
      ]).files
      input.dispatchEvent(new Event('change', { bubbles: true }))
      await vi.waitFor(() => expect(chunks.waiting).toHaveLength(2))

      expect(shownAlerts()).toEqual([['warning', `${alertText('common.system.upload.incorrectFormatSize')}:scan.tiff`]])
      expect(queue().getQueueItems(QUEUE)).toMatchObject([{ displayTitle: 'a.jpg' }, { displayTitle: 'b.jpg' }])
      expect(useUploadQueueDialog().uploadQueueDialog.value).toBe(QUEUE)
    })

    // The dropzone checks the files as the input does, and hands over what is left: here, nothing.
    it('dropped, none of which the dropzone lets through: nothing is queued, and no queue dialog opens', async () => {
      await mountWidget()

      widget!.findComponent({ name: 'AFileDropzone' }).vm.$emit('drop', [])
      await flushPromises()

      nothingIsQueued()
    })

    it('dropped, which the dropzone lets through: are queued, and the queue dialog opens over them', async () => {
      const chunks = dam.hold('POST', dam.routes.chunk)
      await mountWidget()

      widget!.findComponent({ name: 'AFileDropzone' }).vm.$emit('drop', [photo('a.jpg')])
      await vi.waitFor(() => expect(chunks.waiting).toHaveLength(1))

      expect(queue().getQueueItems(QUEUE)).toMatchObject([{ displayTitle: 'a.jpg', licenceId: licence }])
      expect(useUploadQueueDialog().uploadQueueDialog.value).toBe(QUEUE)
    })

    // The queue takes fifty rows. Over that the user is asked first, and nothing is queued until the answer: the
    // queue dialog used to open at once all the same, empty, and stayed after "cancel".
    const tooMany = () => Array.from({ length: 51 }, (_, index) => `photo-${index + 1}.jpg`)
    const limitQuestion = () => document.body.querySelector<HTMLElement>('.v-overlay--active [data-cy="delete-panel"]')
    const answerLimit = (text: RegExp) =>
      Array.from(limitQuestion()!.querySelectorAll<HTMLButtonElement>('.v-card-actions button'))
        .find((button) => text.test(button.textContent ?? ''))!
        .click()

    it.each<[string, () => Promise<void>]>([
      ['picked with the upload button', () => pick(...tooMany())],
      [
        'dropped',
        async () => {
          widget!.findComponent({ name: 'AFileDropzone' }).vm.$emit('drop', tooMany().map(photo))
          await flushPromises()
        },
      ],
    ])(
      'more than the queue takes, %s: the user is asked, and no queue dialog opens, nor after "cancel"',
      async (_, add) => {
        await mountWidget()

        await add()

        expect(limitQuestion()!.textContent).toContain(damText('upload.limits.uploadWarning'))
        nothingIsQueued()

        answerLimit(new RegExp(uiText('common.button.cancel')))
        await vi.waitFor(() => expect(limitQuestion()).toBeNull())
        await flushPromises()
        nothingIsQueued()
      }
    )

    it('more than the queue takes, and the user takes the first fifty: they are queued, and the queue dialog opens over them', async () => {
      dam.hold('POST', dam.routes.chunk)
      await mountWidget()
      await pick(...tooMany())
      expect(useUploadQueueDialog().uploadQueueDialog.value).toBeNull()

      answerLimit(/Add first 50 file/)
      await vi.waitFor(() => expect(useUploadQueueDialog().uploadQueueDialog.value).toBe(QUEUE))
      await flushPromises()

      expect(queue().getQueueItems(QUEUE)).toHaveLength(50)
      expect(queue().getQueueItems(QUEUE).at(-1)).toMatchObject({ displayTitle: 'photo-50.jpg' })
      expect(queueDialog()).not.toBeNull()
    })
  })

  // Picked in the library and taken as they are (nothing is to be copied). What was picked outlives a change of
  // the licence browsed in the picker, so the assets of one pick can be of several licences: each is read under
  // its own. Under another licence the DAM leaves an asset out of its answer without a word, and its image came
  // in with no description, no source and no authors.
  describe('assets picked in the library, none of them to be copied', () => {
    const OTHER = 300003
    const OTHER_EXT_SYSTEM = 7
    const THIRD = 300005
    const THIRD_EXT_SYSTEM = 8
    /** An asset as the list of the picker has it. */
    const listed = (id: string, of: IntegerId) => ({
      id,
      licence: of,
      mainFile: { id: `file-of-${id}` },
      mainFileInternal: false,
    })
    /** What the DAM has for it: a description, and whoever each application takes for the source. */
    const inTheDam = (id: string, of: IntegerId, authors: string[]) =>
      dam.assets.set(
        id,
        damAssetWithFile(id, `file-of-${id}`, AssetFileProcessStatus.Processed, {
          licence: of,
          authors: isCms ? authors : [],
          ...metadata({ description: ` of ${id} `, author: ` Blogger of ${id} ` }),
        })
      )
    const offered = (of: IntegerId, ofExtSystem: IntegerId) => ({
      licence: of,
      extSystem: ofExtSystem,
      licenceName: '',
      extSystemConfig: useDamConfigStore(pinia).damConfigExtSystem.get(extSystem)!,
    })
    /** The picker has offered three licences, of three ext systems; the user confirms the pick over the one browsed. */
    const confirmInPicker = async (browsed: IntegerId, assets: Array<ReturnType<typeof listed>>) => {
      const mounted = await mountWidget()
      const picker = useAssetSelectStore(pinia)
      picker.setSelectConfig([
        offered(licence, extSystem),
        offered(OTHER, OTHER_EXT_SYSTEM),
        offered(THIRD, THIRD_EXT_SYSTEM),
      ])
      picker.selectedLicenceId = browsed
      mounted.findComponent(Picker).vm.$emit('confirm', { type: 'asset', value: assets })
      await vi.waitFor(() => expect(images()).toHaveLength(assets.length))
      await flushPromises()
    }
    const reads = () => dam.sentTo('GET', dam.routes.byIds).map((request) => request.url)
    /** The ext system and the ids of each lookup of the names of authors, in order. */
    const authorLookups = () =>
      damNameLookups(dam)
        .map((request) => request.url.match(DAM_NAMES)!)
        .filter((match) => match[1] === 'author')
        .map((match) => [Number(match[2]), new URLSearchParams(match[3]).get('id')])
    const textsOfImages = () => images().map((image) => [image.assetId, image.texts.description, image.texts.source])

    it.each([
      ['the licence of the widget', licence],
      ['the other licence', OTHER],
    ])(
      'are each read under the licence they are in, and their authors under its ext system, confirmed over %s',
      async (_which, browsed) => {
        inTheDam('asset-41', licence, ['author-1'])
        inTheDam('asset-42', OTHER, ['author-2'])
        inTheDam('asset-43', OTHER, ['author-2', 'author-3'])

        await confirmInPicker(browsed, [
          listed('asset-41', licence),
          listed('asset-42', OTHER),
          listed('asset-43', OTHER),
        ])

        expect(reads()).toEqual([
          `${endPoints.asset}/licence/${licence}/ids/asset-41`,
          `${endPoints.asset}/licence/${OTHER}/ids/asset-42,asset-43`,
        ])
        expect(textsOfImages()).toEqual([
          ['asset-41', 'of asset-41', isCms ? 'Name of author-1' : 'Blogger of asset-41'],
          ['asset-42', 'of asset-42', isCms ? 'Name of author-2' : 'Blogger of asset-42'],
          ['asset-43', 'of asset-43', isCms ? 'Name of author-2, Name of author-3' : 'Blogger of asset-43'],
        ])
        expect(images().map((image) => [image.dam.damId, image.dam.licenceId, image.position])).toEqual([
          ['file-of-asset-41', licence, 1],
          ['file-of-asset-42', OTHER, 2],
          ['file-of-asset-43', OTHER, 3],
        ])
        // admin-cms: the names of the authors, asked of the ext system of each licence. admin-ugc makes the source
        // by its own map, and asks for no author.
        expect(images().map((image) => image.damAuthors)).toEqual(
          isCms ? [['author-1'], ['author-2'], ['author-2', 'author-3']] : [[], [], []]
        )
        expect(authorLookups()).toEqual(
          isCms
            ? [
                [extSystem, 'author-1'],
                [OTHER_EXT_SYSTEM, 'author-2,author-3'],
              ]
            : []
        )
        expect(shownAlerts()).toEqual([])
        expect(toForeignPrefix()).toEqual([])
      }
    )

    // As before: one request for the assets, and one for the names of all their authors.
    it('of the licence browsed alone: are read in one request, and the names of their authors asked for once', async () => {
      inTheDam('asset-41', licence, ['author-1'])
      inTheDam('asset-44', licence, ['author-4', 'author-1'])

      await confirmInPicker(licence, [listed('asset-41', licence), listed('asset-44', licence)])

      expect(reads()).toEqual([`${endPoints.asset}/licence/${licence}/ids/asset-41,asset-44`])
      expect(authorLookups()).toEqual(isCms ? [[extSystem, 'author-1,author-4']] : [])
      expect(textsOfImages()).toEqual([
        ['asset-41', 'of asset-41', isCms ? 'Name of author-1' : 'Blogger of asset-41'],
        ['asset-44', 'of asset-44', isCms ? 'Name of author-4, Name of author-1' : 'Blogger of asset-44'],
      ])
    })

    // The images are added all the same, as before: those read keep their texts, the others come without. A read
    // the DAM refused used to pass without a word. A licence that cannot be read does not keep the others from
    // being read, and however many of them fail, it is said once.
    it.each<[string, IntegerId[]]>([
      ['the first of three licences', [licence]],
      ['the first and the last of three licences', [licence, THIRD]],
    ])(
      'whose read the DAM refuses for %s: says so once, reads the others, and adds every image',
      async (_which, refused) => {
        inTheDam('asset-41', licence, ['author-1'])
        inTheDam('asset-42', OTHER, ['author-2'])
        inTheDam('asset-45', THIRD, ['author-5'])
        dam.reply((request) => {
          const match = request.method === 'GET' ? request.url.match(dam.routes.byIds) : null
          return match && refused.includes(Number(match[1])) ? { status: 500 } : undefined
        })

        await confirmInPicker(OTHER, [
          listed('asset-41', licence),
          listed('asset-42', OTHER),
          listed('asset-45', THIRD),
        ])

        expect(reads()).toEqual([
          `${endPoints.asset}/licence/${licence}/ids/asset-41`,
          `${endPoints.asset}/licence/${OTHER}/ids/asset-42`,
          `${endPoints.asset}/licence/${THIRD}/ids/asset-45`,
        ])
        expect(shownAlerts()).toEqual([['error', alertText('common.alert.unknownError')]])
        const read = (id: string, of: IntegerId, author: string) =>
          refused.includes(of) ? [id, '', ''] : [id, `of ${id}`, isCms ? `Name of ${author}` : `Blogger of ${id}`]
        expect(textsOfImages()).toEqual([
          read('asset-41', licence, 'author-1'),
          read('asset-42', OTHER, 'author-2'),
          read('asset-45', THIRD, 'author-5'),
        ])
        const lookups = [
          [OTHER_EXT_SYSTEM, 'author-2'],
          ...(refused.includes(THIRD) ? [] : [[THIRD_EXT_SYSTEM, 'author-5']]),
        ]
        expect(authorLookups()).toEqual(isCms ? lookups : [])
      }
    )

    // An asset that could not be read may have authors all the same, and the authors picked in a row are written
    // into its asset in place of those it has. So its row has the source, as a row whose asset the DAM did not return
    // when the widget loaded: it used to offer an empty pick of the authors of the DAM.
    it.each<[string, boolean]>([
      ['whose read the DAM refuses', true],
      ['the DAM leaves out of its answer', false],
    ])('offers the source, not the authors of the DAM, for an asset %s', async (_which, refused) => {
      // Listed in the licence of the widget. Left out: the DAM has it in another licence by now.
      inTheDam('asset-41', refused ? licence : THIRD, ['author-1'])
      inTheDam('asset-42', OTHER, [])
      if (refused) {
        dam.reply((request) => {
          const match = request.method === 'GET' ? request.url.match(dam.routes.byIds) : null
          return match && Number(match[1]) === licence ? { status: 500 } : undefined
        })
      }

      await confirmInPicker(OTHER, [listed('asset-41', licence), listed('asset-42', OTHER)])

      expect(shownAlerts()).toEqual(refused ? [['error', alertText('common.alert.unknownError')]] : [])
      expect(images().map((image) => [image.assetId, image.damAuthors, image.showDamAuthors])).toEqual([
        ['asset-41', [], false],
        // Read, and without authors: admin-cms offers them, as before. admin-ugc has none to offer.
        ['asset-42', [], isCms],
      ])
      expect(offersAuthors()).toEqual([false, isCms])
      const [unread, read] = rows()
      expect(textsOf(unread.element)).toEqual(['', ''])
      expect(textsOf(read.element)).toEqual(isCms ? ['of asset-42'] : ['of asset-42', 'Blogger of asset-42'])
    })
  })

  describe('"save and apply" of its queue dialog', () => {
    it('adds an image of each uploaded file after the images the widget has, closes the dialog and empties the queue', async () => {
      await withTwoImages()
      const { a, b } = await twoUploaded()
      const lookupsBefore = damNameLookups(dam).length

      saveAndApply().click()
      await vi.waitFor(() => expect(images()).toHaveLength(4))
      await flushPromises()

      expect(images().slice(2)).toMatchObject([
        {
          assetId: a.assetId,
          texts: { description: 'first upload', source: isCms ? 'Name of author-2' : 'A. Author' },
          dam: { damId: a.fileId, licenceId: licence, regionPosition: 0, internal: false },
          damAuthors: isCms ? ['author-2'] : [],
          showDamAuthors: !isCms,
        },
        {
          assetId: b.assetId,
          texts: { description: 'second upload', source: '' },
          dam: { damId: b.fileId, licenceId: licence },
          damAuthors: [],
          showDamAuthors: true,
        },
      ])
      // Finding 31: the widget alone counts the position on, so the new images follow the old ones without a gap.
      // The dialog used to count it on as well: 5 and 6.
      expect(images().map((image) => image.position)).toEqual([1, 2, 3, 4])
      expect(useImageStore(pinia).maxPosition).toBe(4)
      expect(new Set(images().map((image) => image.key)).size).toBe(4)
      // Not saved as images yet: they have no id, and the form's value is as it was.
      expect(images().map((image) => image.id)).toEqual([11, 12, undefined, undefined])
      expect(imageApi.calls.map(([call]) => call)).toEqual(['fetchImageListByIds'])
      expect(queueDialog()).toBeNull()
      expect(useUploadQueueDialog().uploadQueueDialog.value).toBeNull()
      expect(queue().getQueueItems(QUEUE)).toEqual([])
      expect(damNameLookups(dam).length - lookupsBefore).toBe(isCms ? 1 : 0)
      expect(toForeignPrefix()).toEqual([])

      // The rows of the new images: the source where there is one, the authors of the DAM where admin-cms has none.
      const [, , third, fourth] = rows()
      expect(textsOf(third.element)).toEqual(['first upload', isCms ? 'Name of author-2' : 'A. Author'])
      expect(textsOf(fourth.element)).toEqual(isCms ? ['second upload'] : ['second upload', ''])
      expect(fourth.findComponent(AuthorRemoteAutocompleteWithCached).exists()).toBe(isCms)
    })

    // The save of the queue answers with every asset it was sent, and the images are made of that answer. An asset
    // it does not answer for is handed over without authors all the same, and whether it has any is not known: its
    // row has the source. It used to offer an empty pick of the authors of the DAM, and what was picked there was
    // written into the asset in place of the authors it has.
    it('gives the image of an uploaded file the save of the queue did not answer for its source, not the authors of the DAM', async () => {
      await mountWidget()
      const { a, b } = await twoUploaded()
      dam.reply((request) =>
        request.method === 'PATCH' && dam.routes.bulkMetadata.test(request.url)
          ? { status: 200, data: (dam.body(request) as Array<{ id: DocId }>).filter((sent) => sent.id !== b.assetId) }
          : undefined
      )

      saveAndApply().click()
      await vi.waitFor(() => expect(images()).toHaveLength(2))
      await flushPromises()

      expect(images().map((image) => [image.assetId, image.damAuthors, image.showDamAuthors])).toEqual([
        // Answered for: as before.
        [a.assetId, isCms ? ['author-2'] : [], !isCms],
        [b.assetId, [], false],
      ])
      expect(offersAuthors()).toEqual([false, false])
      expect(textsOf(rows()[1].element)).toEqual(['', ''])
    })

    // With the notifications a file is uploaded before its metadata comes, and "save and apply" is offered by then.
    // The save skips a row without its metadata, so its answer has nothing for the asset of that row. "Save and
    // apply" asks about such a row once more first, and stops where that brings its form.
    if (profile.notifications) {
      /**
       * Two files are uploaded: the first has its metadata and no authors, the second an author and no metadata yet.
       * `unreadable`: nor does the DAM answer for the asset of the second from here on, so no form comes of the read
       * "save and apply" makes, and the row is handed over as it is.
       */
      const secondWithoutItsMetadata = async (unreadable = true) => {
        await mountWidget()
        await pick('a.jpg', 'b.jpg')
        await vi.waitFor(() => expect(statuses()).toEqual([Processing, Processing]))
        const [a, b] = queue().getQueueItems(QUEUE)
        dam.fileBecomes(a.assetId!, AssetFileProcessStatus.Processed, metadata({ description: 'first upload' }))
        dam.fileBecomes(b.assetId!, AssetFileProcessStatus.Processed, {
          ...metadata({ description: 'second upload' }),
          authors: ['author-5'],
        })
        // The file of the second is announced as processed; its metadata is not.
        socket.deliver(DamNotificationName.AssetFileProcessed, { asset: b.assetId, id: b.fileId })
        await vi.waitFor(() => expect(statuses()).toEqual([Processing, Uploaded]))
        await waits.elapse()
        await vi.waitFor(() => expect(statuses()).toEqual([Uploaded, Uploaded]))
        await flushPromises()
        expect([a.canEditMetadata, b.canEditMetadata]).toEqual([true, false])
        if (unreadable) {
          dam.reply((request) =>
            request.method === 'GET' && request.url === `${endPoints.asset}/${b.assetId}` ? { status: 500 } : undefined
          )
        }
        return { a, b }
      }

      // The read "save and apply" makes of such a row brings its metadata: the press ends there, for the user to see
      // the form that has just come. Pressed again, the image comes with the texts and the authors of its asset. It
      // used to come at once, without them, and its asset was left unsaved.
      it('stops once when the metadata of an uploaded file comes with "save and apply": pressed again, its image has its texts', async () => {
        const { a, b } = await secondWithoutItsMetadata(false)

        saveAndApply().click()
        await vi.waitFor(() =>
          expect(shownAlerts()).toEqual([['warning', alertText('common.damImage.upload.metadataJustLoaded')]])
        )
        await vi.waitFor(() => expect(saveAndApply().classList.contains('v-btn--loading')).toBe(false))
        await flushPromises()

        expect(metadataWrites()).toEqual([])
        expect(images()).toEqual([])
        expect(queueDialog()).not.toBeNull()
        expect(statuses()).toEqual([Uploaded, Uploaded])
        expect(b).toMatchObject({
          canEditMetadata: true,
          authors: ['author-5'],
          customData: { description: 'second upload' },
        })

        await damNamesAsked()
        saveAndApply().click()
        await vi.waitFor(() => expect(images()).toHaveLength(2))
        await flushPromises()

        expect(metadataWrites().map((sent) => sent.map((one) => one.id))).toEqual([[a.assetId, b.assetId]])
        expect(images()).toMatchObject([
          { assetId: a.assetId, texts: { description: 'first upload' }, damAuthors: [], showDamAuthors: true },
          {
            assetId: b.assetId,
            texts: { description: 'second upload', source: 'Name of author-5' },
            dam: { damId: b.fileId },
            damAuthors: ['author-5'],
            showDamAuthors: false,
          },
        ])
        expect(offersAuthors()).toEqual([true, false])
        expect(textsOf(rows()[1].element)).toEqual(['second upload', 'Name of author-5'])
        expect(queueDialog()).toBeNull()
        expect(queue().getQueueItems(QUEUE)).toEqual([])
      })

      it('gives the image of an uploaded file whose metadata never came its source, and writes no authors into its asset', async () => {
        const { a, b } = await secondWithoutItsMetadata()

        saveAndApply().click()
        await vi.waitFor(() => expect(images()).toHaveLength(2))
        await flushPromises()

        // The save of the queue: the row with its metadata alone.
        expect(metadataWrites().map((sent) => sent.map((one) => one.id))).toEqual([[a.assetId]])
        expect(images()).toMatchObject([
          { assetId: a.assetId, texts: { description: 'first upload' }, damAuthors: [], showDamAuthors: true },
          {
            assetId: b.assetId,
            texts: { description: '', source: '' },
            dam: { damId: b.fileId },
            damAuthors: [],
            showDamAuthors: false,
          },
        ])
        expect(offersAuthors()).toEqual([true, false])
        expect(textsOf(rows()[1].element)).toEqual(['', ''])

        await replaceAuthorsEverywhere(['author-7'])
        expect(await save()).toBe(true)

        // Only the asset the save answered for gets the authors; the author of the other stays.
        expect(metadataWrites().slice(1)).toEqual([[{ id: a.assetId, authors: ['author-7'] }]])
        const [, sent] = imageApi.calls.at(-1) as ['bulkUpdateImages', ImageAware[]]
        expect(sent.map((image) => [image.dam.damId, image.texts.source])).toEqual([
          [a.fileId, 'Name of author-7'],
          [b.fileId, 'Name of author-7'],
        ])
      })

      // Unchanged: an uploaded file the save answered for, without authors, is offered them, and they are its.
      it('writes the authors picked in the row of an uploaded file without authors into its asset', async () => {
        const { a } = await secondWithoutItsMetadata()
        saveAndApply().click()
        await vi.waitFor(() => expect(images()).toHaveLength(2))
        await flushPromises()
        images()[1].texts.source = 'typed by hand'

        rows()[0].findComponent(AuthorRemoteAutocompleteWithCached).vm.$emit('update:modelValue', ['author-8'])
        await flushPromises()
        expect(await save()).toBe(true)

        expect(metadataWrites().slice(1)).toEqual([[{ id: a.assetId, authors: ['author-8'] }]])
        const [, sent] = imageApi.calls.at(-1) as ['bulkUpdateImages', ImageAware[]]
        expect(sent.map((image) => image.texts.source)).toEqual(['Name of author-8', 'typed by hand'])
      })
    }
  })

  // An uploaded file that is a duplicate of one the widget has becomes the asset of that image in the queue, with its
  // form, and "save and apply" writes the authors of that form into the asset and adds a second row of the file. The
  // row the widget had went on offering an empty pick of the authors of the DAM: what was picked there was written
  // over the authors just saved, and with nothing picked its image kept the source it had. admin-cms only: admin-ugc
  // has no authors of the DAM.
  if (isCms) {
    describe('"save and apply" over an uploaded file that is a duplicate of an image the widget has', () => {
      /** A file is uploaded that the DAM finds to be `file-12` again: its row of the queue is `asset-12`, with its form. */
      const duplicateOfTheSecondUploaded = async () => {
        await pick('again.jpg')
        await vi.waitFor(() => expect(statuses()).toEqual([Processing]))
        const [row] = queue().getQueueItems(QUEUE)
        dam.fileBecomes(row.assetId!, AssetFileProcessStatus.Duplicate, {}, { originAssetFile: 'file-12' })
        await waits.elapse()
        await vi.waitFor(() => expect(statuses()).toEqual([Uploaded]))
        await damNamesAsked()
        await flushPromises()
        expect(row).toMatchObject({ assetId: 'asset-12', fileId: 'file-12', isDuplicate: true, canEditMetadata: true })
      }
      /** The user picks authors in the form of that row of the queue. */
      const pickInQueueRow = async (authors: DocId[]) => {
        widget!
          .findComponent(UploadQueueDialog)
          .findComponent(AuthorRemoteAutocompleteWithCached)
          .vm.$emit('update:modelValue', authors)
        await flushPromises()
      }
      /** "Save and apply" is pressed, and the widget has the image of the file. */
      const applied = async (expected: number) => {
        saveAndApply().click()
        await vi.waitFor(() => expect(images()).toHaveLength(expected))
        await flushPromises()
      }
      const readsOfAssets = () => dam.assetReads().length + dam.originReads().length
      const asRows = () =>
        images().map((image) => [image.id, image.assetId, image.damAuthors, image.showDamAuthors, image.texts.source])
      const sourcesSaved = () => {
        const [, sent] = imageApi.calls.at(-1) as ['bulkUpdateImages', ImageAware[]]
        return sent.map((image) => [image.dam.damId, image.texts.source])
      }

      it('gives the row the widget had the authors the queue saved, named as its source: it offers them no more, and the save of the widget writes none into the asset', async () => {
        await withTwoImages()
        // What is picked in the row of the widget gives way to what the queue saves, as it does to a save of the detail.
        rows()[1].findComponent(AuthorRemoteAutocompleteWithCached).vm.$emit('update:modelValue', ['author-7'])
        await flushPromises()
        await duplicateOfTheSecondUploaded()
        await pickInQueueRow(['author-9', 'author-8'])
        expect(offersAuthors()).toEqual([false, true])
        const readBefore = readsOfAssets()

        await applied(3)

        // The save of the queue has written them into the asset.
        expect(metadataWrites().map((sent) => sent.map((one) => [one.id, one.authors]))).toEqual([
          [['asset-12', ['author-9', 'author-8']]],
        ])
        const names = 'Name of author-9, Name of author-8'
        expect(asRows()).toEqual([
          [11, 'asset-11', ['author-1'], false, 'source 11'],
          [12, 'asset-12', ['author-9', 'author-8'], false, names],
          [undefined, 'asset-12', ['author-9', 'author-8'], false, names],
        ])
        // Each row has a list of its own.
        expect(images()[1].damAuthors).not.toBe(images()[2].damAuthors)
        expect(offersAuthors()).toEqual([false, false, false])
        expect(textsOf(rows()[1].element)).toEqual(['image 12', names])
        // The applied image carries the authors and their names: no asset is read for them.
        await waits.settle()
        expect(readsOfAssets()).toBe(readBefore)

        expect(await save()).toBe(true)
        await flushPromises()

        expect(metadataWrites()).toHaveLength(1)
        expect(sourcesSaved()).toEqual([
          ['file-11', 'source 11'],
          ['file-12', names],
          ['file-12', names],
        ])
        // After the save the two rows of the file are the same but for their image.
        expect(asRows()).toEqual([
          [11, 'asset-11', ['author-1'], false, 'source 11'],
          [12, 'asset-12', ['author-9', 'author-8'], false, names],
          [501, 'asset-12', ['author-9', 'author-8'], false, names],
        ])
        expect(offersAuthors()).toEqual([false, false, false])
      })

      // Nothing was saved into the asset that the row does not know of.
      it('leaves the row the widget had as it is when the image of the file has no authors', async () => {
        await withTwoImages()
        rows()[1].findComponent(AuthorRemoteAutocompleteWithCached).vm.$emit('update:modelValue', ['author-7'])
        await flushPromises()
        await duplicateOfTheSecondUploaded()

        await applied(3)

        expect(asRows()).toEqual([
          [11, 'asset-11', ['author-1'], false, 'source 11'],
          [12, 'asset-12', ['author-7'], true, 'source 12'],
          [undefined, 'asset-12', [], true, ''],
        ])
        expect(offersAuthors()).toEqual([false, true, true])
      })

      it('gives them to every row of that asset that offers the pick: to none that has its source, and to none of another asset', async () => {
        // Three images: two of `file-12`, one of `file-14`.
        imageApi.has(stored(12, 1))
        imageApi.has({ ...stored(13, 2), dam: { ...stored(13, 2).dam, damId: 'file-12' } })
        imageApi.has(stored(14, 3))
        dam.assets.set(
          'asset-12',
          damAssetWithFile('asset-12', 'file-12', AssetFileProcessStatus.Processed, { licence })
        )
        dam.assets.set(
          'asset-14',
          damAssetWithFile('asset-14', 'file-14', AssetFileProcessStatus.Processed, { licence })
        )
        await mountWidget([12, 13, 14])
        await vi.waitFor(() => expect(images()).toHaveLength(3))
        await damNamesAsked()
        // The second has its source, as a row whose asset was not read when it was picked.
        images()[1].showDamAuthors = false
        images()[1].texts.source = 'typed by hand'
        await flushPromises()
        await duplicateOfTheSecondUploaded()
        await pickInQueueRow(['author-9'])

        await applied(4)

        expect(asRows()).toEqual([
          [12, 'asset-12', ['author-9'], false, 'Name of author-9'],
          [13, 'asset-12', [], false, 'typed by hand'],
          [14, 'asset-14', [], true, 'source 14'],
          [undefined, 'asset-12', ['author-9'], false, 'Name of author-9'],
        ])
        expect(offersAuthors()).toEqual([false, false, true, false])
      })

      // An ext system without the authors of the DAM: every row shows its source, which is the text of the user. The
      // asset of the duplicate can have authors all the same, and the image of the file is named after them.
      it('leaves the row the widget had as it is where the page draws no pick of the authors', async () => {
        const config = useDamConfigStore(pinia)
        const own = config.damConfigExtSystem.get(extSystem)!
        config.damConfigExtSystem.set(extSystem, {
          ...own,
          image: { ...own.image!, authors: { enabled: false, required: false } },
        })
        await withTwoImages()
        expect(offersAuthors()).toEqual([false, false])
        // The asset has got an author since the widget read it.
        dam.assets.get('asset-12')!.authors = ['author-9']
        await duplicateOfTheSecondUploaded()

        await applied(3)

        expect(asRows()).toEqual([
          [11, 'asset-11', ['author-1'], false, 'source 11'],
          [12, 'asset-12', [], true, 'source 12'],
          [undefined, 'asset-12', ['author-9'], false, 'Name of author-9'],
        ])
        expect(textsOf(rows()[1].element)).toEqual(['image 12', 'source 12'])
      })
    })
  }

  // The picker offers the copy when the user browses another licence than the one the widget uploads into, which
  // only admin-cms has. Where the request of the copy goes is not what is asked here.
  if (isCms) {
    describe('assets picked to be copied into the licence of the widget', () => {
      it('are rows of the queue: a copy waits for the server, one the licence already has is settled as a duplicate, a refused one is said', async () => {
        const COPY = /\/copy-to-licence$/
        const answer = (asset: string, result: DamImageCopyToLicenceResponseItem['result']) => ({
          asset,
          targetAsset: `copy-of-${asset}`,
          targetMainFile: `file-of-copy-of-${asset}`,
          targetAssetLicence: licence,
          result,
          assetConflicts: [],
        })
        dam.reply((request) =>
          request.method === 'PATCH' && COPY.test(request.url)
            ? { status: 200, data: [answer('there', 'exists'), answer('new', 'copy'), answer('refused', 'notAllowed')] }
            : undefined
        )
        dam.assets.set(
          'copy-of-there',
          damAssetWithFile('copy-of-there', 'file-of-copy-of-there', AssetFileProcessStatus.Processed, {
            licence,
            ...metadata({ description: 'already in the licence' }),
          })
        )
        const mounted = await mountWidget()

        mounted.findComponent(Picker).vm.$emit('confirm', {
          type: 'asset',
          copyToLicence: licence,
          value: ['there', 'new', 'refused'].map((id) => ({ id, licence: 300003, mainFile: { id: `file-of-${id}` } })),
        })
        await vi.waitFor(() => expect(statuses()).toEqual([Uploaded, Processing]))
        await flushPromises()

        expect(dam.sentTo('PATCH', COPY).map((request) => dam.body(request))).toEqual([
          ['there', 'new', 'refused'].map((asset) => ({ asset, targetAssetLicence: licence })),
        ])
        expect(queue().getQueueItems(QUEUE)).toMatchObject([
          {
            assetId: 'copy-of-there',
            fileId: 'file-of-copy-of-there',
            isDuplicate: true,
            canEditMetadata: true,
            customData: { description: 'already in the licence' },
          },
          { assetId: 'copy-of-new', isDuplicate: false, canEditMetadata: false },
        ])
        expect(shownAlerts()).toEqual([['error', alertText('common.damImage.queueItem.errorUnableToCopyToLicence')]])
        expect(useUploadQueueDialog().uploadQueueDialog.value).toBe(QUEUE)
        expect(queueDialog()).not.toBeNull()
        // Nothing is added to the widget yet: the copies go through the queue dialog first.
        expect(images()).toEqual([])
      })
    })
  }

  describe('the save of the widget', () => {
    it('writes the images, old and new, through the image API of the application, and hands the form their ids', async () => {
      const mounted = await withTwoImages()
      const { a, b } = await twoUploaded()
      saveAndApply().click()
      await vi.waitFor(() => expect(images()).toHaveLength(4))
      await flushPromises()
      const writesBefore = dam.sentTo('PATCH', dam.routes.bulkMetadata).length

      expect(await save()).toBe(true)

      const [call, sent] = imageApi.calls.at(-1) as ['bulkUpdateImages', ImageAware[]]
      expect(call).toBe('bulkUpdateImages')
      expect(sent.map((image) => [image.id, image.position, image.dam.damId])).toEqual([
        [11, 1, 'file-11'],
        [12, 2, 'file-12'],
        // One after another, without a gap (finding 31): they used to be 5 and 6.
        [undefined, 3, a.fileId],
        [undefined, 4, b.fileId],
      ])
      // Only the fields of an image (finding 36): neither the key, the asset and the authors of a row, nor what the
      // map of an upload added.
      expect(sent.map((image) => Object.keys(image).sort())).toEqual([
        ['dam', 'flags', 'id', 'position', 'texts'],
        ['dam', 'flags', 'id', 'position', 'texts'],
        ['dam', 'flags', 'position', 'texts'],
        ['dam', 'flags', 'position', 'texts'],
      ])
      expect(imageApi.requests.at(-1)?.url).toBe(isCms ? '/adm/v1/image' : undefined)
      expect(mounted.emitted('update:modelValue')!.at(-1)).toEqual([[11, 12, 501, 502]])
      expect(images().map((image) => image.id)).toEqual([11, 12, 501, 502])
      expect(shownAlerts().filter(([colour]) => colour === 'error')).toEqual([])
      // admin-cms writes the authors of an image into its asset only when the user picked some in its row: the
      // images offered the authors of the DAM here have none picked, and an empty list would take away an author
      // the asset got meanwhile. admin-ugc writes nothing into the DAM.
      expect(dam.sentTo('PATCH', dam.routes.bulkMetadata).slice(writesBefore)).toEqual([])
    })

    // The DAM does not return the asset of every image: it was deleted there, or its licence is not the user's.
    // Such a row has no asset to save authors into and keeps its source. Its first save used to turn the source
    // into an empty pick of authors, where the application has them, and the source was required no more.
    it('leaves a row whose asset the DAM did not return with its source, as before the save', async () => {
      imageApi.has(stored(11, 1))
      imageApi.has(stored(12, 2))
      dam.assets.set('asset-11', damAssetWithFile('asset-11', 'file-11', AssetFileProcessStatus.Processed, { licence }))
      await mountWidget([11, 12])
      await vi.waitFor(() => expect(images()).toHaveLength(2))
      await flushPromises()
      const offered = () => images().map((image) => [image.id, image.assetId, image.showDamAuthors])
      const sourceOrAuthors = () =>
        rows().map((row) => [textsOf(row.element), row.findComponent(AuthorRemoteAutocompleteWithCached).exists()])
      // The first row offers the authors of the DAM, where the application has them; the second has its source.
      const asLoaded = [
        [isCms ? ['image 11'] : ['image 11', 'source 11'], isCms],
        [['image 12', 'source 12'], false],
      ]
      expect(offered()).toEqual([
        [11, 'asset-11', true],
        [12, undefined, false],
      ])
      expect(sourceOrAuthors()).toEqual(asLoaded)

      expect(await save()).toBe(true)
      await flushPromises()

      expect(offered()).toEqual([
        [11, 'asset-11', true],
        [12, undefined, false],
      ])
      expect(sourceOrAuthors()).toEqual(asLoaded)
      expect(dam.sentTo('PATCH', dam.routes.bulkMetadata)).toEqual([])
    })

    if (isCms) {
      // The authors picked in a row are the asset's: they are saved into the DAM, and their names become the
      // source of the image.
      it('first saves the authors picked in a row into the asset of the DAM, with their names as the source of the image', async () => {
        await withTwoImages()
        rows()[1]
          .findComponent(AuthorRemoteAutocompleteWithCached)
          .vm.$emit('update:modelValue', ['author-7', 'author-8'])
        await flushPromises()
        /** How many images the image API had been asked to write when the DAM got the authors. */
        let imagesWrittenBefore: number | undefined
        dam.reply((request) => {
          if (request.method === 'PATCH' && dam.routes.bulkMetadata.test(request.url)) {
            imagesWrittenBefore = imageApi.calls.filter(([call]) => call === 'bulkUpdateImages').length
          }
          return undefined
        })

        expect(await save()).toBe(true)

        const patches = dam.sentTo('PATCH', dam.routes.bulkMetadata)
        expect(patches.map((request) => request.url)).toEqual(['/adm/v1/asset/metadata-bulk-update'])
        expect(dam.body(patches[0])).toMatchObject([{ id: 'asset-12', authors: ['author-7', 'author-8'] }])
        expect(imagesWrittenBefore).toBe(0)
        const [, sent] = imageApi.calls.at(-1) as ['bulkUpdateImages', ImageAware[]]
        expect(sent.map((image) => image.texts.source)).toEqual(['source 11', 'Name of author-7, Name of author-8'])
        // The row has its source from here on, and offers the authors of the DAM no more.
        await flushPromises()
        expect(images()[1]).toMatchObject({ damAuthors: ['author-7', 'author-8'], showDamAuthors: false })
        expect(textsOf(rows()[1].element)).toEqual(['image 12', 'Name of author-7, Name of author-8'])
      })

      /**
       * Two assets are picked in the library, one after the other: `asset-31` has an author and is not read (its
       * read is refused, or the DAM leaves it out of its answer), `asset-32` has none and is read.
       */
      const unreadAndReadPicked = async (refused: boolean) => {
        dam.assets.set(
          'asset-31',
          damAssetWithFile('asset-31', 'file-31', AssetFileProcessStatus.Processed, {
            // Left out: listed in the licence of the widget, the DAM has it in another one by now.
            licence: refused ? licence : 300003,
            authors: ['author-5'],
          })
        )
        dam.assets.set(
          'asset-32',
          damAssetWithFile('asset-32', 'file-32', AssetFileProcessStatus.Processed, { licence })
        )
        const mounted = await mountWidget()
        const confirmPick = async (id: number, expected: number) => {
          mounted.findComponent(Picker).vm.$emit('confirm', {
            type: 'asset',
            value: [{ id: `asset-${id}`, licence, mainFile: { id: `file-${id}` } }],
          })
          await vi.waitFor(() => expect(images()).toHaveLength(expected))
          await flushPromises()
        }
        const readAgain = refused
          ? dam.reply((request) =>
              request.method === 'GET' && dam.routes.byIds.test(request.url) ? { status: 500 } : undefined
            )
          : () => undefined
        await confirmPick(31, 1)
        readAgain()
        await confirmPick(32, 2)
        expect(dam.sentTo('GET', dam.routes.byIds)).toHaveLength(2)
        // A read that fails is said; an asset left out of an answer is not.
        expect(shownAlerts()).toEqual(refused ? [['error', alertText('common.alert.unknownError')]] : [])
        forgetAlerts()
      }

      // The asset has an author the widget does not know of. Its row used to offer an empty pick of the authors of
      // the DAM all the same, and what was picked there, also by the mass operations, was written into the asset in
      // place of the authors it has. The row has the source now, and nothing of it is the asset's.
      it.each<[string, boolean]>([
        ['whose read failed', true],
        ['the DAM left out of its answer', false],
      ])(
        'writes no authors into an asset picked from the DAM %s: its row has the source, not the authors',
        async (_what, refused) => {
          await unreadAndReadPicked(refused)
          expect(images().map((image) => [image.assetId, image.damAuthors, image.showDamAuthors])).toEqual([
            ['asset-31', [], false],
            ['asset-32', [], true],
          ])
          expect(offersAuthors()).toEqual([false, true])
          expect(textsOf(rows()[0].element)).toEqual(['', ''])

          await replaceAuthorsEverywhere(['author-7'])
          expect(await save()).toBe(true)

          // Only the asset that was read gets them.
          expect(metadataWrites()).toEqual([[{ id: 'asset-32', authors: ['author-7'] }]])
          const [call, sent] = imageApi.calls.at(-1) as ['bulkUpdateImages', ImageAware[]]
          expect([call, sent.map((image) => [image.dam.damId, image.texts.source])]).toEqual([
            'bulkUpdateImages',
            [
              ['file-31', 'Name of author-7'],
              ['file-32', 'Name of author-7'],
            ],
          ])
        }
      )

      // As every row that has the source: admin-cms requires it. The widget cannot name the authors of the asset,
      // so the source of such an image is typed by hand.
      it('asks for the source of an image whose asset could not be read, before it writes anything', async () => {
        await unreadAndReadPicked(true)

        expect(await save()).toBe(false)

        expect(shownAlerts()).toEqual([['error', alertText('common.alert.fixValidationErrors')]])
        expect(imageApi.calls.map(([call]) => call)).toEqual([])
        expect(metadataWrites()).toEqual([])

        images()[0].texts.source = 'typed by hand'
        await flushPromises()
        expect(await save()).toBe(true)

        expect(metadataWrites()).toEqual([])
        const [, sent] = imageApi.calls.at(-1) as ['bulkUpdateImages', ImageAware[]]
        expect(sent.map((image) => [image.dam.damId, image.texts.source])).toEqual([
          ['file-31', 'typed by hand'],
          ['file-32', ''],
        ])
      })

      // The empty source of such a row is filled by "fill empty" of the mass operations, with the names of the picked
      // authors. The authors themselves go with the rows that offer them: none is written into the unread asset.
      it('writes the source "fill empty" gave an image whose asset could not be read, and no authors into that asset', async () => {
        await unreadAndReadPicked(true)

        await fillEmptyAuthors(['author-7'])
        expect(textsOf(rows()[0].element)).toEqual(['', 'Name of author-7'])
        expect(await save()).toBe(true)

        expect(metadataWrites()).toEqual([[{ id: 'asset-32', authors: ['author-7'] }]])
        const [, sent] = imageApi.calls.at(-1) as ['bulkUpdateImages', ImageAware[]]
        expect(sent.map((image) => [image.dam.damId, image.texts.source])).toEqual([
          ['file-31', 'Name of author-7'],
          ['file-32', 'Name of author-7'],
        ])
      })

      // Once typed, the source of such a row is the user's: "fill empty" leaves it.
      it('keeps the source typed for an image whose asset could not be read, when "fill empty" fills the others', async () => {
        await unreadAndReadPicked(true)
        images()[0].texts.source = 'typed by hand'
        await flushPromises()

        await fillEmptyAuthors(['author-7'])
        expect(await save()).toBe(true)

        expect(metadataWrites()).toEqual([[{ id: 'asset-32', authors: ['author-7'] }]])
        const [, sent] = imageApi.calls.at(-1) as ['bulkUpdateImages', ImageAware[]]
        expect(sent.map((image) => [image.dam.damId, image.texts.source])).toEqual([
          ['file-31', 'typed by hand'],
          ['file-32', 'Name of author-7'],
        ])
      })

      // Unchanged: an asset that was read and has no authors is offered them, and what is picked in its row is its.
      it('writes the authors picked in the row of an asset picked from the DAM, read and without authors, into it', async () => {
        await unreadAndReadPicked(true)
        images()[0].texts.source = 'typed by hand'

        rows()[1]
          .findComponent(AuthorRemoteAutocompleteWithCached)
          .vm.$emit('update:modelValue', ['author-7', 'author-8'])
        await flushPromises()
        expect(await save()).toBe(true)

        expect(metadataWrites()).toEqual([[{ id: 'asset-32', authors: ['author-7', 'author-8'] }]])
        const [, sent] = imageApi.calls.at(-1) as ['bulkUpdateImages', ImageAware[]]
        expect(sent.map((image) => image.texts.source)).toEqual(['typed by hand', 'Name of author-7, Name of author-8'])
      })

      it('writes the authors picked in a row after a first save, into the asset of the row', async () => {
        await withTwoImages()
        expect(await save()).toBe(true)
        await flushPromises()
        const writesBefore = dam.sentTo('PATCH', dam.routes.bulkMetadata).length

        rows()[1].findComponent(AuthorRemoteAutocompleteWithCached).vm.$emit('update:modelValue', ['author-7'])
        await flushPromises()
        expect(await save()).toBe(true)

        const patches = dam.sentTo('PATCH', dam.routes.bulkMetadata).slice(writesBefore)
        expect(patches.map((request) => dam.body(request))).toEqual([[{ id: 'asset-12', authors: ['author-7'] }]])
      })

      /** An author is picked in the row of the second image, and the DAM answers the save of the authors so. */
      const authorPickedAndAnswered = async (rule: FakeDamRule) => {
        await withTwoImages()
        rows()[1].findComponent(AuthorRemoteAutocompleteWithCached).vm.$emit('update:modelValue', ['author-7'])
        await flushPromises()
        dam.reply((request) =>
          request.method === 'PATCH' && dam.routes.bulkMetadata.test(request.url) ? rule(request) : undefined
        )
      }

      it.each<[string, FakeDamRule, string]>([
        ['the user may not, when the DAM forbids', () => ({ status: 403 }), 'common.alert.forbiddenError'],
        [
          'the request timed out, when the DAM does not answer in time',
          (asked) => {
            throw new axios.AxiosError('timeout of 1ms exceeded', axios.AxiosError.ECONNABORTED, asked.config as never)
          },
          'error.apiTimedOut.message',
        ],
      ])('writes no images, and says %s the authors picked in a row', async (_what, rule, alert) => {
        await authorPickedAndAnswered(rule)

        expect(await save()).toBe(false)

        expect(shownAlerts()).toEqual([['error', alertText(alert)]])
        expect(imageApi.calls.map(([call]) => call)).toEqual(['fetchImageListByIds'])
      })

      it('writes no images, and names the authors, when the DAM refuses the authors picked in a row by validation', async () => {
        await authorPickedAndAnswered(() => ({
          status: 422,
          data: { contextId: 'context', error: 'validation_failed', fields: { '[0].authors': ['error_field_empty'] } },
        }))

        expect(await save()).toBe(false)

        expect(shownAlerts()).toHaveLength(1)
        const [[colour, text]] = shownAlerts() as Array<[string, string]>
        const [heading, ...lines] = text.split('\n')
        expect([colour, heading, lines.map((line) => line.split(': ')[0])]).toEqual([
          'error',
          alertText('common.alert.fixApiValidationErrors'),
          [alertText('common.damImage.asset.model.authors')],
        ])
        expect(imageApi.calls.map(([call]) => call)).toEqual(['fetchImageListByIds'])
      })

      // Nothing reads what the DAM answers a save of the authors with.
      it('writes the images when the DAM answers the save of the authors with 200 and no list', async () => {
        await authorPickedAndAnswered(() => ({ status: 200, data: {} }))

        expect(await save()).toBe(true)

        expect(shownAlerts().filter(([colour]) => colour === 'error')).toEqual([])
        expect(imageApi.calls.map(([call]) => call)).toEqual(['fetchImageListByIds', 'bulkUpdateImages'])
      })

      it('writes nothing, and says what to fix, while an image has neither a source nor authors of the DAM to take one from', async () => {
        await withTwoImages()
        images()[0].texts.source = ''
        await flushPromises()

        expect(await save()).toBe(false)

        expect(shownAlerts()).toEqual([['error', alertText('common.alert.fixValidationErrors')]])
        expect(imageApi.calls.map(([call]) => call)).toEqual(['fetchImageListByIds'])
        expect(dam.sentTo('PATCH', dam.routes.bulkMetadata)).toEqual([])
      })

      // The entity may have an image twice, and a file that is a duplicate of an image of the widget comes from the
      // queue as a second row of its asset. Each row was saved on its own: the authors picked in one went into the
      // asset, and the other row was saved with the source it had and no word of them; picked in two, the asset got
      // them twice, the last to stay. And after the save every row of a file took what the first row of that file
      // had: both rows offered an empty pick again, or a row lost the one it had.
      describe('over several rows of one asset', () => {
        /** The entity has these images, each of an asset without authors; a file named for one makes it a row more of that file. */
        const withImagesOf = async (ids: number[], files: Record<number, string> = {}) => {
          ids.forEach((id, index) => {
            const image = stored(id, index + 1)
            imageApi.has({ ...image, dam: { ...image.dam, damId: files[id] ?? image.dam.damId } })
            if (files[id]) return
            dam.assets.set(
              `asset-${id}`,
              damAssetWithFile(`asset-${id}`, `file-${id}`, AssetFileProcessStatus.Processed, { licence })
            )
          })
          await mountWidget(ids)
          await vi.waitFor(() => expect(images()).toHaveLength(ids.length))
          await damNamesAsked()
          await flushPromises()
        }
        const pickInRow = async (row: number, authors: DocId[]) => {
          rows()[row].findComponent(AuthorRemoteAutocompleteWithCached).vm.$emit('update:modelValue', authors)
          await flushPromises()
        }
        /** A row has its source, as one whose asset was not read when it was picked. */
        const hasItsSource = async (row: number) => {
          images()[row].showDamAuthors = false
          images()[row].texts.source = 'typed by hand'
          await flushPromises()
        }
        /** How often the names of exactly these authors were asked for. */
        const namesAskedOf = (ids: string) =>
          damNameLookups(dam)
            .map((request) => request.url.match(DAM_NAMES)!)
            .filter((match) => match[1] === 'author' && new URLSearchParams(match[3]).get('id') === ids).length
        /** The source each image went to the image API with. */
        const sourcesSaved = () => {
          const [, sent] = imageApi.calls.at(-1) as ['bulkUpdateImages', ImageAware[]]
          return sent.map((image) => [image.id, image.texts.source])
        }
        /** Each row as the widget has it: its image, its asset, the authors picked in it, whether it offers them, its source. */
        const asRows = () =>
          images().map((image) => [image.id, image.assetId, image.damAuthors, image.showDamAuthors, image.texts.source])
        const shownInRows = () => rows().map((row) => textsOf(row.element))

        it.each<[string, number]>([
          ['first', 0],
          ['second', 1],
        ])(
          'writes the authors picked in the %s of two rows of an asset into it once, and names them as the source of both',
          async (_which, row) => {
            await withImagesOf([12, 13], { 13: 'file-12' })
            expect(asRows()).toEqual([
              [12, 'asset-12', [], true, 'source 12'],
              [13, 'asset-12', [], true, 'source 13'],
            ])
            await pickInRow(row, ['author-7'])

            expect(await save()).toBe(true)
            await flushPromises()

            expect(metadataWrites()).toEqual([[{ id: 'asset-12', authors: ['author-7'] }]])
            expect(namesAskedOf('author-7')).toBe(1)
            expect(sourcesSaved()).toEqual([
              [12, 'Name of author-7'],
              [13, 'Name of author-7'],
            ])
            // Both rows have their source from here on, and neither offers the authors of the DAM.
            expect(asRows()).toEqual([
              [12, 'asset-12', ['author-7'], false, 'Name of author-7'],
              [13, 'asset-12', ['author-7'], false, 'Name of author-7'],
            ])
            expect(offersAuthors()).toEqual([false, false])
            expect(shownInRows()).toEqual([
              ['image 12', 'Name of author-7'],
              ['image 13', 'Name of author-7'],
            ])
            // Each row has a list of its own.
            expect(images()[0].damAuthors).not.toBe(images()[1].damAuthors)
            expect(shownAlerts().filter(([colour]) => colour === 'error')).toEqual([])
          }
        )

        it('gives the asset the authors picked in any of its rows, each once, in the order they come down the rows', async () => {
          await withImagesOf([12, 13, 14], { 13: 'file-12', 14: 'file-12' })
          await pickInRow(0, ['author-7', 'author-8'])
          await pickInRow(2, ['author-8', 'author-9'])

          expect(await save()).toBe(true)
          await flushPromises()

          const all = ['author-7', 'author-8', 'author-9']
          const named = 'Name of author-7, Name of author-8, Name of author-9'
          expect(metadataWrites()).toEqual([[{ id: 'asset-12', authors: all }]])
          expect(namesAskedOf(all.join(','))).toBe(1)
          expect(sourcesSaved()).toEqual([
            [12, named],
            [13, named],
            [14, named],
          ])
          expect(asRows()).toEqual([
            [12, 'asset-12', all, false, named],
            [13, 'asset-12', all, false, named],
            [14, 'asset-12', all, false, named],
          ])
          expect(offersAuthors()).toEqual([false, false, false])
        })

        it('leaves alone a row of that asset that has its source, and a row of another asset with nothing picked', async () => {
          await withImagesOf([12, 13, 14, 15], { 13: 'file-12', 15: 'file-12' })
          await hasItsSource(3)
          await pickInRow(1, ['author-7'])

          expect(await save()).toBe(true)
          await flushPromises()

          expect(metadataWrites()).toEqual([[{ id: 'asset-12', authors: ['author-7'] }]])
          expect(sourcesSaved()).toEqual([
            [12, 'Name of author-7'],
            [13, 'Name of author-7'],
            [14, 'source 14'],
            [15, 'typed by hand'],
          ])
          expect(asRows()).toEqual([
            [12, 'asset-12', ['author-7'], false, 'Name of author-7'],
            [13, 'asset-12', ['author-7'], false, 'Name of author-7'],
            [14, 'asset-14', [], true, 'source 14'],
            [15, 'asset-12', [], false, 'typed by hand'],
          ])
          expect(offersAuthors()).toEqual([false, false, true, false])
        })

        // The rows take the authors and their names once the DAM has them: refused, each row is as the user left it.
        it('leaves the rows as they were when the DAM does not take the authors: the pick stays in the row it was made in', async () => {
          await withImagesOf([12, 13], { 13: 'file-12' })
          await pickInRow(0, ['author-7'])
          const before = asRows()
          dam.reply((request) =>
            request.method === 'PATCH' && dam.routes.bulkMetadata.test(request.url) ? { status: 403 } : undefined
          )

          expect(await save()).toBe(false)
          await flushPromises()

          expect(shownAlerts()).toEqual([['error', alertText('common.alert.forbiddenError')]])
          expect(asRows()).toEqual(before)
          expect(
            rows().map((row) => row.findComponent(AuthorRemoteAutocompleteWithCached).props('modelValue'))
          ).toEqual([['author-7'], []])
          expect(imageApi.calls.map(([call]) => call)).toEqual(['fetchImageListByIds'])
        })

        // Unchanged: an empty list would take away the authors the asset got meanwhile.
        it('writes nothing into the asset, and asks for no names, while nothing is picked in any of its rows', async () => {
          await withImagesOf([12, 13], { 13: 'file-12' })
          const asLoaded = asRows()
          const lookups = damNameLookups(dam).length

          expect(await save()).toBe(true)
          await flushPromises()

          expect(metadataWrites()).toEqual([])
          expect(damNameLookups(dam)).toHaveLength(lookups)
          expect(sourcesSaved()).toEqual([
            [12, 'source 12'],
            [13, 'source 13'],
          ])
          expect(asRows()).toEqual(asLoaded)
          expect(offersAuthors()).toEqual([true, true])
        })

        // The pick is drawn by the ext system the page asks for names under, which the detail of an asset of another
        // ext system changes. Where it has no authors of the DAM the rows show their source, and the save goes by that.
        it('writes no authors, and leaves the rows their sources, once the page draws no pick of the authors', async () => {
          const WITHOUT_AUTHORS = 7
          const config = useDamConfigStore(pinia)
          const own = config.damConfigExtSystem.get(extSystem)!
          config.damConfigExtSystem.set(WITHOUT_AUTHORS, {
            ...own,
            image: { ...own.image!, authors: { enabled: false, required: false } },
          })
          await withImagesOf([12, 13], { 13: 'file-12' })
          await pickInRow(0, ['author-7'])
          useExtSystemIdForCached().cachedExtSystemId.value = WITHOUT_AUTHORS
          await flushPromises()
          expect(offersAuthors()).toEqual([false, false])
          const lookups = damNameLookups(dam).length

          expect(await save()).toBe(true)
          await flushPromises()

          expect(metadataWrites()).toEqual([])
          expect(damNameLookups(dam)).toHaveLength(lookups)
          expect(sourcesSaved()).toEqual([
            [12, 'source 12'],
            [13, 'source 13'],
          ])
        })

        it.each<[string, number]>([
          ['first', 0],
          ['second', 1],
        ])(
          'leaves each row what it had after the save: of two rows of one file the %s has its source, the other offers the authors',
          async (_which, withSource) => {
            await withImagesOf([12, 13], { 13: 'file-12' })
            await hasItsSource(withSource)
            const before = asRows()
            const offeredBefore = offersAuthors()
            expect(offeredBefore).toEqual([withSource === 1, withSource === 0])

            expect(await save()).toBe(true)
            await flushPromises()

            expect(metadataWrites()).toEqual([])
            expect(asRows()).toEqual(before)
            expect(offersAuthors()).toEqual(offeredBefore)
          }
        )
      })
    } else {
      it('writes nothing into the DAM: the application has no authors of the DAM to save', async () => {
        await withTwoImages()
        images()[0].texts.source = ''

        expect(await save()).toBe(true)

        expect(dam.sentTo('PATCH', dam.routes.bulkMetadata)).toEqual([])
        expect(imageApi.calls.map(([call]) => call)).toEqual(['fetchImageListByIds', 'bulkUpdateImages'])
        expect(toForeignPrefix()).toEqual([])
      })
    }
  })

  // "Edit asset" of a row opens the detail of its asset, where the user may save authors into it. The row was not
  // told: it went on offering an empty pick of the authors of the DAM, what was picked in it, also by the mass
  // operations, was written into the asset over the authors of the detail, and with nothing picked the image was
  // saved without a source. When the detail closes the asset it showed is read again, and the rows of that asset
  // that offer the pick take the authors it has by then.
  describe('the detail of the asset of a row, once it has closed', () => {
    let detailForm: VueWrapper | undefined

    afterEach(() => {
      detailForm?.unmount()
      detailForm = undefined
    })

    const detail = () => useAssetDetailStore(pinia)
    const byFile = (file: string) => `${endPoints.asset}/asset-file/${file}`
    /** The reads of the asset a file belongs to: what "edit asset" of a row opens the detail with. */
    const readsByFile = () => dam.sentTo('GET', dam.routes.byFile).map((request) => request.url)
    /** The reads of an asset by its id: what the widget reads again once the detail has closed. */
    const rereadsOf = (asset: DocId) =>
      dam.sentTo('GET', dam.routes.one).filter((request) => request.url === `${endPoints.asset}/${asset}`)
    /** The ext system of each lookup of the names of exactly these authors. */
    const namesAskedOf = (ids: string) =>
      damNameLookups(dam)
        .map((request) => request.url.match(DAM_NAMES)!)
        .filter((match) => match[1] === 'author' && new URLSearchParams(match[3]).get('id') === ids)
        .map((match) => Number(match[2]))
    /** The DAM takes the authors a save of metadata writes into an asset: a later read of it answers with them. */
    const keepAuthorsOf = (request: FakeDamRequest) => {
      for (const sent of dam.body(request) as Array<{ id: DocId; authors?: DocId[] }>) {
        const asset = dam.assets.get(sent.id)
        if (asset && sent.authors) asset.authors = [...sent.authors]
      }
    }
    const damKeepsAuthors = () =>
      dam.reply((request) => {
        if (request.method === 'PATCH' && dam.routes.bulkMetadata.test(request.url)) keepAuthorsOf(request)
        return undefined
      })
    /** The saves of metadata wait for `answer`: the DAM has their authors only from then on. */
    const holdSaves = () => {
      const held = dam.hold('PATCH', dam.routes.bulkMetadata)
      return {
        waiting: held.waiting,
        answer: () => {
          held.waiting.forEach(({ request }) => keepAuthorsOf(request))
          held.release()
        },
      }
    }
    /** What each save of metadata wrote into the DAM: the asset and its authors. */
    const authorsWritten = () => metadataWrites().map((sent) => sent.map((one) => [one.id, one.authors]))
    const sourcesSaved = () => {
      const [, sent] = imageApi.calls.at(-1) as ['bulkUpdateImages', ImageAware[]]
      return sent.map((image) => image.texts.source)
    }
    const clickEditAsset = async (row: number) => {
      const { editAssetLabel } = useCommonAdminCoreDamOptions()
      const buttons = rows()[row].findAll('button')
      await buttons.find((button) => button.text() === editAssetLabel)!.trigger('click')
    }
    /** What the DAM has of an asset is its own from here on: what is typed into the detail is not, until it is saved. */
    const detailHasItsOwn = (asset: DocId) => dam.assets.set(asset, structuredClone(dam.assets.get(asset)!))
    /** "Edit asset" of a row: the detail of its asset is open. */
    const editAssetOf = async (row: number) => {
      const asset = images()[row].assetId!
      await clickEditAsset(row)
      await vi.waitFor(() => expect(detail().asset?.id).toBe(asset))
      await flushPromises()
      detailHasItsOwn(asset)
    }
    /** The form of the detail is not drawn here: this is what its save sends, with the authors the user picks in it. */
    const saveInDetail = async (authors: DocId[]) => {
      const { damClient, endPointAsset } = useCommonAdminCoreDamOptions()
      detail().asset!.authors = authors
      await updateAssetMetadata(damClient, endPointAsset, detail().asset!, extSystem, detail().mainFileSingleUse)
      await flushPromises()
    }
    /** The part of the detail that saves, as the dialog draws it in its sidebar: the real form and its "save". */
    const mountDetailForm = async () => {
      const Form = defineComponent({
        setup: () => () =>
          h('div', [
            h(AssetDetailSidebarMetadata, {
              queueKey: QUEUE,
              isActive: true,
              assetType: DamAssetType.Image,
              extSystem,
            }),
            h(AssetDetailSidebarActionsTeleportTarget, { queueKey: QUEUE }),
          ]),
      })
      detailForm = mount(Form, {
        attachTo: document.body,
        global: { plugins: [pinia], stubs: { AFormRemoteAutocompleteWithCached: true, ACachedUserChip: true } },
      })
      await flushPromises()
      await flushPromises()
    }
    const saveOfDetail = () => document.body.querySelector<HTMLButtonElement>('[data-cy="button-save"]')!
    /** The detail is closed with its own button: the real dialog, of which only what it frames is not drawn. */
    const closeDetail = async () => {
      widget!.findComponent({ name: 'AssetDetailDialogFrame' }).vm.$emit('close')
      await flushPromises()
    }
    const pickInRow = async (row: number, authors: DocId[]) => {
      rows()[row].findComponent(AuthorRemoteAutocompleteWithCached).vm.$emit('update:modelValue', authors)
      await flushPromises()
    }
    const taken = (row: number) => vi.waitFor(() => expect(images()[row].showDamAuthors).toBe(false))
    /** The entity has these images, each of an asset without authors unless a file is named for it. */
    const withImages = async (
      ids: number[],
      files: Record<number, string> = {},
      licences: Record<number, IntegerId> = {}
    ) => {
      ids.forEach((id, index) => {
        const image = stored(id, index + 1)
        const of = licences[id] ?? licence
        imageApi.has({ ...image, dam: { ...image.dam, damId: files[id] ?? image.dam.damId, licenceId: of } })
        if (files[id]) return
        dam.assets.set(
          `asset-${id}`,
          damAssetWithFile(`asset-${id}`, `file-${id}`, AssetFileProcessStatus.Processed, { licence: of })
        )
      })
      const mounted = await mountWidget(ids)
      await vi.waitFor(() => expect(images()).toHaveLength(ids.length))
      await damNamesAsked()
      await flushPromises()
      return mounted
    }

    // That text is the user's, whatever authors the asset gets. admin-ugc has no authors of the DAM, so every row of
    // it has its source; in admin-cms the row of an asset that has authors has.
    it('reads nothing, and leaves alone a row that has its source', async () => {
      await withTwoImages()
      damKeepsAuthors()
      const row = isCms ? 0 : 1
      const asItWas = JSON.parse(JSON.stringify(images()))
      const shown = textsOf(rows()[row].element)

      await editAssetOf(row)
      await saveInDetail(['author-9'])
      await closeDetail()
      await waits.settle()

      expect(detail().dialog).toBeNull()
      expect(readsByFile()).toEqual([byFile(`file-1${row + 1}`)])
      expect(rereadsOf(`asset-1${row + 1}`)).toEqual([])
      expect(namesAskedOf('author-9')).toEqual([])
      expect(JSON.parse(JSON.stringify(images()))).toEqual(asItWas)
      expect(textsOf(rows()[row].element)).toEqual(shown)
      expect(shownAlerts()).toEqual([])
    })

    if (isCms) {
      it('gives a row that offers the authors of the DAM the authors the detail saved: named as its source, and offered no more', async () => {
        await withTwoImages()
        damKeepsAuthors()
        await editAssetOf(1)
        await saveInDetail(['author-9', 'author-8'])
        // Until the detail closes the row is as it was.
        expect(images()[1]).toMatchObject({ damAuthors: [], showDamAuthors: true })

        await closeDetail()
        await taken(1)
        await flushPromises()

        // The asset is read once more, by its id, and the names of its authors once.
        expect(readsByFile()).toEqual([byFile('file-12')])
        expect(rereadsOf('asset-12')).toHaveLength(1)
        expect(namesAskedOf('author-9,author-8')).toEqual([extSystem])
        expect(images()[1]).toMatchObject({
          id: 12,
          assetId: 'asset-12',
          damAuthors: ['author-9', 'author-8'],
          showDamAuthors: false,
          texts: { description: 'image 12', source: 'Name of author-9, Name of author-8' },
        })
        expect(offersAuthors()).toEqual([false, false])
        expect(textsOf(rows()[1].element)).toEqual(['image 12', 'Name of author-9, Name of author-8'])
        // The other row is of another asset.
        expect(images()[0]).toMatchObject({ damAuthors: ['author-1'], texts: { source: 'source 11' } })
        expect(shownAlerts()).toEqual([])

        // The save of the widget writes no authors into the asset, and the image with its source.
        expect(await save()).toBe(true)
        expect(authorsWritten()).toEqual([[['asset-12', ['author-9', 'author-8']]]])
        expect(sourcesSaved()).toEqual(['source 11', 'Name of author-9, Name of author-8'])
        expect(dam.assets.get('asset-12')!.authors).toEqual(['author-9', 'author-8'])
      })

      // What the user picked in the row before the detail was for an asset without authors: it gives way to what the
      // detail saved.
      it('writes nothing over the authors of the detail: those picked in the row before give way to them', async () => {
        await withTwoImages()
        damKeepsAuthors()
        await pickInRow(1, ['author-7'])
        await editAssetOf(1)
        await saveInDetail(['author-9'])

        await closeDetail()
        await taken(1)
        expect(images()[1]).toMatchObject({ damAuthors: ['author-9'], texts: { source: 'Name of author-9' } })
        expect(await save()).toBe(true)

        // Only the save of the detail has written into the asset.
        expect(authorsWritten()).toEqual([[['asset-12', ['author-9']]]])
        expect(dam.assets.get('asset-12')!.authors).toEqual(['author-9'])
        expect(sourcesSaved()).toEqual(['source 11', 'Name of author-9'])
      })

      it('lets "fill empty" of the mass operations write nothing over the authors of the detail', async () => {
        await withTwoImages()
        damKeepsAuthors()
        await editAssetOf(1)
        await saveInDetail(['author-9'])
        await closeDetail()
        await taken(1)

        await fillEmptyAuthors(['author-7'])
        expect(images()[1]).toMatchObject({ damAuthors: ['author-9'], texts: { source: 'Name of author-9' } })
        expect(await save()).toBe(true)

        expect(authorsWritten()).toEqual([[['asset-12', ['author-9']]]])
        expect(dam.assets.get('asset-12')!.authors).toEqual(['author-9'])
        expect(sourcesSaved()).toEqual(['source 11', 'Name of author-9'])
      })

      // The detail saved something else, or nothing: the asset is as the row knows it.
      it('leaves a row as it is while the asset has no authors: those picked in it are written into it as before', async () => {
        await withTwoImages()
        damKeepsAuthors()
        await pickInRow(1, ['author-7'])
        await editAssetOf(1)
        await saveInDetail([])

        await closeDetail()
        await vi.waitFor(() => expect(rereadsOf('asset-12')).toHaveLength(1))
        await waits.settle()

        expect(images()[1]).toMatchObject({
          damAuthors: ['author-7'],
          showDamAuthors: true,
          texts: { source: 'source 12' },
        })
        expect(offersAuthors()).toEqual([false, true])
        expect(shownAlerts()).toEqual([])
        expect(await save()).toBe(true)
        expect(dam.assets.get('asset-12')!.authors).toEqual(['author-7'])
        expect(sourcesSaved()).toEqual(['source 11', 'Name of author-7'])
      })

      // The rows of an asset are those that have its id: an image the entity has several times is as many of them.
      it('gives them to every row of that asset that offers the pick: to none that has its source, and to none of another asset', async () => {
        await withImages([12, 13, 14, 15], { 13: 'file-12', 15: 'file-12' })
        damKeepsAuthors()
        expect(images().map((image) => [image.assetId, image.showDamAuthors])).toEqual([
          ['asset-12', true],
          ['asset-12', true],
          ['asset-14', true],
          ['asset-12', true],
        ])
        // The last has its source, as a row whose asset was not read when it was picked.
        images()[3].showDamAuthors = false
        images()[3].texts.source = 'typed by hand'
        await flushPromises()

        await editAssetOf(1)
        await saveInDetail(['author-9'])
        await closeDetail()
        await taken(1)

        expect(images().map((image) => [image.id, image.damAuthors, image.showDamAuthors, image.texts.source])).toEqual(
          [
            [12, ['author-9'], false, 'Name of author-9'],
            [13, ['author-9'], false, 'Name of author-9'],
            [14, [], true, 'source 14'],
            [15, [], false, 'typed by hand'],
          ]
        )
        // Each row has a list of its own.
        expect(images()[0].damAuthors).not.toBe(images()[1].damAuthors)
        expect(rereadsOf('asset-12')).toHaveLength(1)
        expect(rereadsOf('asset-14')).toEqual([])
      })

      // The licence of an image need not be the one the widget uploads into: the names are those of the ext system
      // of the licence the asset is in, whatever ext system the page asks for names under by then.
      it('names the authors under the ext system of the licence of the asset', async () => {
        const OTHER = 300003
        const OTHER_EXT_SYSTEM = 7
        const config = useDamConfigStore(pinia)
        config.damConfigLicenceExtSystem.set(OTHER, { name: '', extSystem: OTHER_EXT_SYSTEM })
        config.damConfigExtSystem.set(OTHER_EXT_SYSTEM, config.damConfigExtSystem.get(extSystem)!)
        await withImages([12], {}, { 12: OTHER })
        damKeepsAuthors()

        await editAssetOf(0)
        await saveInDetail(['author-9'])
        // Another widget of the page has set it meanwhile.
        useExtSystemIdForCached().cachedExtSystemId.value = extSystem
        await closeDetail()
        await taken(0)

        expect(namesAskedOf('author-9')).toEqual([OTHER_EXT_SYSTEM])
        expect(images()[0]).toMatchObject({ damAuthors: ['author-9'], texts: { source: 'Name of author-9' } })
      })

      // The row keeps its pick, and the save of the widget goes on as it did: what is picked in the row is written
      // into the asset.
      it.each<[string, () => unknown]>([
        [
          'the asset cannot be read',
          () =>
            dam.reply((request) =>
              request.method === 'GET' && request.url === `${endPoints.asset}/asset-12` ? { status: 500 } : undefined
            ),
        ],
        [
          'the names of its authors cannot be read',
          () =>
            dam.reply((request) =>
              DAM_NAMES.test(request.url) && request.url.includes('author-9') ? { status: 500 } : undefined
            ),
        ],
      ])('leaves the row as it is, and says the read failed, when %s', async (_what, refuse) => {
        await withTwoImages()
        damKeepsAuthors()
        await pickInRow(1, ['author-7'])
        await editAssetOf(1)
        await saveInDetail(['author-9'])
        refuse()

        await closeDetail()
        await vi.waitFor(() => expect(shownAlerts()).toEqual([['error', alertText('common.alert.unknownError')]]))
        await waits.settle()

        expect(images()[1]).toMatchObject({
          damAuthors: ['author-7'],
          showDamAuthors: true,
          texts: { source: 'source 12' },
        })
        expect(offersAuthors()).toEqual([false, true])
        expect(shownAlerts()).toEqual([['error', alertText('common.alert.unknownError')]])

        expect(await save()).toBe(true)
        expect(authorsWritten()).toEqual([[['asset-12', ['author-9']]], [['asset-12', ['author-7']]]])
        expect(sourcesSaved()).toEqual(['source 11', 'Name of author-7'])
      })

      // The read takes a moment, and the row offers its pick until it lands: a save of the widget in that moment
      // waits for it, or it would write what the row has picked over the authors of the detail.
      it('holds the save of the widget until the asset of a detail that has just closed is read', async () => {
        await withTwoImages()
        damKeepsAuthors()
        await pickInRow(1, ['author-7'])
        await editAssetOf(1)
        await saveInDetail(['author-9'])
        const held = dam.hold('GET', dam.routes.one)

        await closeDetail()
        await vi.waitFor(() => expect(held.waiting).toHaveLength(1))
        const saved = save()
        await waits.settle()
        expect(authorsWritten()).toEqual([[['asset-12', ['author-9']]]])
        expect(imageApi.calls.map(([call]) => call)).toEqual(['fetchImageListByIds'])

        held.release()
        expect(await saved).toBe(true)

        expect(authorsWritten()).toEqual([[['asset-12', ['author-9']]]])
        expect(dam.assets.get('asset-12')!.authors).toEqual(['author-9'])
        expect(sourcesSaved()).toEqual(['source 11', 'Name of author-9'])
      })

      // The form of the detail is not locked while its save runs, and the detail can be closed before the DAM answers
      // it. Read at once, the asset was as it was before that save, and the row went on offering its pick.
      it('waits for a save of the detail that is on its way when the detail closes, and reads the asset once the DAM has answered it', async () => {
        await withTwoImages()
        await pickInRow(1, ['author-7'])
        await editAssetOf(1)
        await mountDetailForm()
        const saves = holdSaves()
        // An author is picked in the detail, "save" is pressed, and the detail closed at once.
        detail().asset!.authors = ['author-9']
        saveOfDetail().click()
        await vi.waitFor(() => expect(saves.waiting).toHaveLength(1))
        detailForm!.unmount()
        detailForm = undefined
        await closeDetail()
        await waits.settle()

        expect(rereadsOf('asset-12')).toEqual([])
        expect(images()[1]).toMatchObject({ damAuthors: ['author-7'], showDamAuthors: true })

        saves.answer()
        await taken(1)

        expect(rereadsOf('asset-12')).toHaveLength(1)
        expect(images()[1]).toMatchObject({ damAuthors: ['author-9'], texts: { source: 'Name of author-9' } })
        expect(detail().saving).toBeNull()
        expect(await save()).toBe(true)
        expect(authorsWritten()).toEqual([[['asset-12', ['author-9']]]])
        expect(sourcesSaved()).toEqual(['source 11', 'Name of author-9'])
      })

      // Closed from its loader and opened from another row, the detail has two reads on their way. It shows the asset
      // of the row that opened it last, whichever answer comes first, and that asset is read when it closes. The
      // answer that came last used to be shown, and read: this case pinned the asset of the row opened before.
      it.each<[string, boolean]>([
        ['first', true],
        ['last', false],
      ])(
        'reads the asset of the row that opened the detail last, when the answer for the row opened before comes %s',
        async (_when, olderFirst) => {
          await withImages([12, 14])
          damKeepsAuthors()
          const held = dam.hold('GET', dam.routes.byFile)
          await clickEditAsset(0)
          await vi.waitFor(() => expect(held.waiting).toHaveLength(1))
          const [first] = held.waiting
          await closeDetail()
          await clickEditAsset(1)
          await vi.waitFor(() => expect(held.waiting).toHaveLength(2))
          const second = held.waiting[1]
          if (olderFirst) {
            first.release()
            await waits.settle()
            expect([detail().asset, detail().loading]).toEqual([null, true])
            second.release()
          } else {
            second.release()
            await vi.waitFor(() => expect(detail().asset?.id).toBe('asset-14'))
            first.release()
          }
          await vi.waitFor(() => expect(detail().asset?.id).toBe('asset-14'))
          await waits.settle()
          expect(detail().asset?.id).toBe('asset-14')
          detailHasItsOwn('asset-14')
          await saveInDetail(['author-9'])

          await closeDetail()
          await taken(1)

          expect(rereadsOf('asset-14')).toHaveLength(1)
          expect(rereadsOf('asset-12')).toEqual([])
          expect(images().map((image) => [image.assetId, image.damAuthors, image.showDamAuthors])).toEqual([
            ['asset-12', [], true],
            ['asset-14', ['author-9'], false],
          ])
        }
      )

      // A detail that showed no asset had nothing saved in it. The answer that comes once it has closed is not taken:
      // it used to stay in the store of the detail, which this case pinned.
      it('reads nothing for a detail closed from its loader, and takes nothing of the answer that comes after', async () => {
        await withTwoImages()
        const held = dam.hold('GET', dam.routes.byFile)
        await clickEditAsset(1)
        await vi.waitFor(() => expect(held.waiting).toHaveLength(1))
        await closeDetail()
        held.release()
        await waits.settle()
        expect([detail().dialog, detail().asset, detail().loading]).toEqual([null, null, false])

        await clickEditAsset(1)
        await vi.waitFor(() => expect(held.waiting).toHaveLength(1))
        await closeDetail()
        held.release()
        await waits.settle()

        // The two reads "edit asset" made, and none after either close.
        expect(readsByFile()).toEqual([byFile('file-12'), byFile('file-12')])
        expect(rereadsOf('asset-12')).toEqual([])
        expect(detail().asset).toBeNull()
        expect(images()[1]).toMatchObject({ damAuthors: [], showDamAuthors: true })
        expect(shownAlerts()).toEqual([])
      })

      // Such a detail closes by itself: it used to stay, over the whole page, with nothing drawn in it, and this case
      // closed it by hand.
      it('reads nothing for a detail whose asset could not be read: it closes by itself, and that failure is said once', async () => {
        await withTwoImages()
        dam.reply((request) => (dam.routes.byFile.test(request.url) ? { status: 500 } : undefined))
        await clickEditAsset(1)
        await vi.waitFor(() => expect(shownAlerts()).toEqual([['error', alertText('common.alert.unknownError')]]))
        await waits.settle()

        expect([detail().dialog, detail().loading]).toEqual([null, false])
        expect(widget!.findComponent({ name: 'AssetDetailDialogFrame' }).exists()).toBe(false)
        expect(readsByFile()).toEqual([byFile('file-12')])
        expect(rereadsOf('asset-12')).toEqual([])
        expect(shownAlerts()).toEqual([['error', alertText('common.alert.unknownError')]])
      })

      // The detail a row of the queue dialog opens is drawn by the widget as well: its save writes into the rows of
      // the queue, and its close reads nothing for the rows of the widget, also when one of them is of that asset.
      // Nothing of a detail of a row of the widget is left for it: neither of one the user closed, nor of one that
      // closed by itself, of which the widget is told as of any close.
      it.each<[string, () => Promise<void>]>([
        [
          'the user closed',
          async () => {
            await editAssetOf(1)
            await closeDetail()
            await vi.waitFor(() => expect(rereadsOf('asset-12')).toHaveLength(1))
          },
        ],
        [
          'that closed by itself, its asset unreadable',
          async () => {
            const answerAgain = dam.reply((request) =>
              dam.routes.byFile.test(request.url) ? { status: 500 } : undefined
            )
            await clickEditAsset(1)
            await vi.waitFor(() => expect(shownAlerts()).toHaveLength(1))
            await waits.settle()
            expect(detail().dialog).toBeNull()
            answerAgain()
          },
        ],
      ])(
        'reads nothing when the detail was opened from a row of the queue dialog, after one of a row %s',
        async (_which, before) => {
          await withTwoImages()
          await before()
          // The queue has a row of the asset of that row: a copy to the licence, which waits for the server.
          await queue().addByCopyToLicence(QUEUE, extSystem, licence, ['asset-12'])
          useUploadQueueDialog().uploadQueueDialog.value = QUEUE
          await waits.elapse()
          await vi.waitFor(() => expect(statuses()).toEqual([Uploaded]))
          await flushPromises()

          Array.from(
            queueDialog()!.querySelectorAll<HTMLElement>('.dam-upload-queue__item')[0].querySelectorAll('button')
          )
            .find((button) => button.textContent?.trim() === damText('image.button.editAsset'))!
            .click()
          await vi.waitFor(() => expect(detail().asset?.id).toBe('asset-12'))
          await flushPromises()
          detailHasItsOwn('asset-12')
          damKeepsAuthors()
          await saveInDetail(['author-9'])
          const readBefore = rereadsOf('asset-12').length
          await closeDetail()
          await waits.settle()

          expect(detail().dialog).toBeNull()
          expect(rereadsOf('asset-12')).toHaveLength(readBefore)
          expect(images()[1]).toMatchObject({ damAuthors: [], showDamAuthors: true })
        }
      )

      // Whether the page draws the pick of the authors goes by one ext system for the whole page, which "edit asset"
      // sets to that of its asset. The rows that offered the pick when the detail closed are the ones that take the
      // authors, whatever the page draws by the time the read ends.
      it('gives the authors to the rows that offered the pick, also when the detail of an asset of an ext system without authors is opened before the read ends', async () => {
        const OTHER = 300003
        const OTHER_EXT_SYSTEM = 7
        const config = useDamConfigStore(pinia)
        const own = config.damConfigExtSystem.get(extSystem)!
        config.damConfigLicenceExtSystem.set(OTHER, { name: '', extSystem: OTHER_EXT_SYSTEM })
        config.damConfigExtSystem.set(OTHER_EXT_SYSTEM, {
          ...own,
          image: { ...own.image!, authors: { enabled: false, required: false } },
        })
        await withImages([12, 13], {}, { 13: OTHER })
        damKeepsAuthors()
        await editAssetOf(0)
        await saveInDetail(['author-9'])
        const held = dam.hold('GET', dam.routes.one)
        await closeDetail()
        await vi.waitFor(() => expect(held.waiting).toHaveLength(1))

        await editAssetOf(1)
        expect(offersAuthors()).toEqual([false, false])
        held.release()
        await taken(0)

        expect(namesAskedOf('author-9')).toEqual([extSystem])
        expect(images()[0]).toMatchObject({
          damAuthors: ['author-9'],
          showDamAuthors: false,
          texts: { source: 'Name of author-9' },
        })
      })

      it('reads nothing when the widget has turned read-only by the time the detail closes', async () => {
        const mounted = await withTwoImages()
        damKeepsAuthors()
        await editAssetOf(1)
        await saveInDetail(['author-9'])
        await mounted.setProps({ readonly: true })

        await closeDetail()
        await waits.settle()

        expect(rereadsOf('asset-12')).toEqual([])
        expect(images()[1]).toMatchObject({ damAuthors: [], showDamAuthors: true, texts: { source: 'source 12' } })
      })

      it('writes nothing into its rows when it turns read-only while the asset is read', async () => {
        const mounted = await withTwoImages()
        damKeepsAuthors()
        await editAssetOf(1)
        await saveInDetail(['author-9'])
        const held = dam.hold('GET', dam.routes.one)
        await closeDetail()
        await vi.waitFor(() => expect(held.waiting).toHaveLength(1))
        await mounted.setProps({ readonly: true })

        held.release()
        await vi.waitFor(() => expect(namesAskedOf('author-9')).toHaveLength(1))
        await waits.settle()

        expect(images()[1]).toMatchObject({ damAuthors: [], showDamAuthors: true, texts: { source: 'source 12' } })
      })

      // The store of the images is one for every widget of the page. By the time the read ends the widget may be
      // gone, and the store filled by the next one: with rows of the same asset when its entity has the same image.
      it.each<[string, boolean]>([
        ['finds authors in the asset', false],
        ['fails', true],
      ])(
        'writes nothing and says nothing once the widget is gone, when the read %s: the rows of the next widget stay as they are',
        async (_what, fails) => {
          const first = await withTwoImages()
          await editAssetOf(1)
          const held = dam.hold('GET', dam.routes.one)
          await closeDetail()
          await vi.waitFor(() => expect(held.waiting).toHaveLength(1))

          first.unmount()
          await mountWidget([12, 11])
          await vi.waitFor(() => expect(images()).toHaveLength(2))
          await flushPromises()
          await pickInRow(1, ['author-7'])

          held.release(
            fails ? { status: 500 } : { status: 200, data: { ...dam.assets.get('asset-12')!, authors: ['author-9'] } }
          )
          if (!fails) await vi.waitFor(() => expect(namesAskedOf('author-9')).toHaveLength(1))
          await waits.settle()

          expect(images()[1]).toMatchObject({ assetId: 'asset-12', damAuthors: ['author-7'], showDamAuthors: true })
          expect(offersAuthors()).toEqual([false, true])
          expect(shownAlerts()).toEqual([])
        }
      )
    }
  })
})
