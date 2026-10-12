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
import { useAssetDetailStore } from '@/domains/dam/assetDetail/store/assetDetailStore'
import { useAssetSelectStore } from '@/domains/dam/assetSelect/store/assetSelectStore'
import AuthorRemoteAutocompleteWithCached from '@/domains/dam/author/components/AuthorRemoteAutocompleteWithCached.vue'
import { useCommonAdminCoreDamOptions } from '@/domains/dam/composables/commonAdminCoreDamOptions'
import { destroyDamNotifications, initDamNotifications } from '@/domains/dam/composables/damNotifications'
import { DamNotificationName, useDamNotificationsEventBus } from '@/domains/dam/composables/damNotificationsEventBus'
import { useDamConfigStore } from '@/domains/dam/config/store/damConfigStore'
import ImageWidgetMultipleInner from '@/domains/dam/imageWidget/components/ImageWidgetMultipleInner.vue'
import ImageWidgetMultipleItem from '@/domains/dam/imageWidget/components/ImageWidgetMultipleItem.vue'
import { useImageMassOperations } from '@/domains/dam/imageWidget/composables/useImageMassOperations'
import { useImageStore } from '@/domains/dam/imageWidget/store/imageStore'
import { ImageWidgetUploadConfigKey } from '@/domains/dam/imageWidget/utils/imageWidgetInkectionKeys'
import type { DamImageCopyToLicenceResponseItem } from '@/domains/dam/types/Asset'
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
// pictures, the asset detail, the mass operations of the queue dialog, the dropzones, and the inputs that ask the
// DAM for names to offer.

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
          AssetDetailDialog: true,
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
    // The save skips a row without its metadata, so its answer has nothing for the asset of that row.
    if (profile.notifications) {
      /** Two files are uploaded: the first has its metadata and no authors, the second an author and no metadata yet. */
      const secondWithoutItsMetadata = async () => {
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
        return { a, b }
      }

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

      /** Each list of authors written into the asset, in the order the DAM got them. */
      const authorsWrittenInto = (asset: DocId) =>
        dam
          .sentTo('PATCH', dam.routes.bulkMetadata)
          .flatMap((request) => dam.body(request) as Array<{ id: DocId; authors?: DocId[] }>)
          .filter((item) => item.id === asset && item.authors !== undefined)
          .map((item) => item.authors)

      // "Edit asset" of a row opens the detail of its asset. An author saved there is not taken into the row, which
      // goes on offering the authors of the DAM with none picked.
      it('keeps an author saved meanwhile in the detail of the asset, where the row has none picked', async () => {
        await withTwoImages()
        const { editAssetLabel, damClient, endPointAsset } = useCommonAdminCoreDamOptions()
        await rows()[1]
          .findAll('button')
          .find((button) => button.text() === editAssetLabel)!
          .trigger('click')
        const detail = useAssetDetailStore(pinia)
        await vi.waitFor(() => expect(detail.asset?.id).toBe('asset-12'))
        // The detail is not mounted here: this is what its save does with an author the user picks in it.
        detail.asset!.authors = ['author-9']
        await updateAssetMetadata(damClient, endPointAsset, detail.asset!, extSystem, detail.mainFileSingleUse)
        await flushPromises()
        expect(authorsWrittenInto('asset-12')).toEqual([['author-9']])
        expect(images()[1]).toMatchObject({ assetId: 'asset-12', damAuthors: [], showDamAuthors: true })

        expect(await save()).toBe(true)

        expect(authorsWrittenInto('asset-12')).toEqual([['author-9']])
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
})
