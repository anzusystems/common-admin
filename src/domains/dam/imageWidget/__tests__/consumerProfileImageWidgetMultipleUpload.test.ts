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
import { answerDamNames, damNameLookups, damNamesAsked } from '@/domains/dam/__tests__/support/damNames'
import { type DamSocket, stubDamSocket } from '@/domains/dam/__tests__/support/damSocket'
import { createFakeDam, damAssetWithFile, type FakeDam } from '@/domains/dam/__tests__/support/fakeDam'
import { holdLongWaits, type LongWaits } from '@/domains/dam/__tests__/support/longWaits'
import {
  alertText,
  damText,
  forgetAlerts,
  shownAlerts,
  signInToDam,
  signOutOfDam,
} from '@/domains/dam/__tests__/support/uploadUi'
import AuthorRemoteAutocompleteWithCached from '@/domains/dam/author/components/AuthorRemoteAutocompleteWithCached.vue'
import { useCommonAdminCoreDamOptions } from '@/domains/dam/composables/commonAdminCoreDamOptions'
import { destroyDamNotifications, initDamNotifications } from '@/domains/dam/composables/damNotifications'
import { useDamNotificationsEventBus } from '@/domains/dam/composables/damNotificationsEventBus'
import { useDamConfigStore } from '@/domains/dam/config/store/damConfigStore'
import ImageWidgetMultipleInner from '@/domains/dam/imageWidget/components/ImageWidgetMultipleInner.vue'
import ImageWidgetMultipleItem from '@/domains/dam/imageWidget/components/ImageWidgetMultipleItem.vue'
import { useImageStore } from '@/domains/dam/imageWidget/store/imageStore'
import { ImageWidgetUploadConfigKey } from '@/domains/dam/imageWidget/utils/imageWidgetInkectionKeys'
import type { DamImageCopyToLicenceResponseItem } from '@/domains/dam/types/Asset'
import { AssetFileProcessStatus } from '@/domains/dam/types/AssetFile'
import type { ImageAware } from '@/domains/dam/types/ImageAware'
import { UploadQueueItemStatus } from '@/domains/dam/types/UploadQueue'
import UploadQueueDialog from '@/domains/dam/uploadQueue/components/UploadQueueDialog.vue'
import { useUploadQueueDialog } from '@/domains/dam/uploadQueue/composables/useUploadQueueDialog'
import { useUploadQueuesStore } from '@/domains/dam/uploadQueue/store/uploadQueuesStore'

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
      // Today's behaviour, pinned as it is: the dialog and the widget each count the position on, so the new
      // images come after the old ones with a gap of their own number between.
      expect(images().map((image) => image.position)).toEqual([1, 2, 5, 6])
      expect(useImageStore(pinia).maxPosition).toBe(6)
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
    const save = () => (widget!.vm as unknown as { saveImages: () => Promise<boolean> }).saveImages()

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
        [undefined, 5, a.fileId],
        [undefined, 6, b.fileId],
      ])
      expect(imageApi.requests.at(-1)?.url).toBe(isCms ? '/adm/v1/image' : undefined)
      expect(mounted.emitted('update:modelValue')!.at(-1)).toEqual([[11, 12, 501, 502]])
      expect(images().map((image) => image.id)).toEqual([11, 12, 501, 502])
      expect(shownAlerts().filter(([colour]) => colour === 'error')).toEqual([])
      // Today's behaviour, pinned as it is: admin-cms writes the authors of every image that is offered the
      // authors of the DAM back into its asset, also when the user picked none: an empty list, for the assets
      // that had no author when the widget read them. admin-ugc writes nothing into the DAM.
      const authorWrites = dam.sentTo('PATCH', dam.routes.bulkMetadata).slice(writesBefore)
      expect(authorWrites.map((request) => dam.body(request))).toEqual(
        isCms
          ? [
              [
                { id: 'asset-12', authors: [] },
                { id: b.assetId, authors: [] },
              ],
            ]
          : []
      )
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
