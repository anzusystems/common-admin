import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, type Pinia, setActivePinia } from 'pinia'
import { type Component, defineComponent, h, shallowRef } from 'vue'
import { usePagination } from '@/domains/api/composables/pagination'
import { cmsConfiguration, installConsumerProfile } from '@/domains/dam/__tests__/support/consumerProfiles'
import { type DamSocket, stubDamSocket } from '@/domains/dam/__tests__/support/damSocket'
import { createFakeDam, damAsset, type FakeDam } from '@/domains/dam/__tests__/support/fakeDam'
import { holdLongWaits, type LongWaits } from '@/domains/dam/__tests__/support/longWaits'
import { forgetAlerts, shownAlerts } from '@/domains/dam/__tests__/support/uploadUi'
import type { AssetMetadataBulkItem } from '@/domains/dam/api/damAssetApi'
import { useAssetSelectStore } from '@/domains/dam/assetSelect/store/assetSelectStore'
import { createAuthor, fetchAuthorListByIds, useFetchAuthorList } from '@/domains/dam/author/api/authorApi'
import AuthorCreateButton from '@/domains/dam/author/components/AuthorCreateButton.vue'
import { useAuthorSelectActions } from '@/domains/dam/author/composables/authorActions'
import { useDamCachedAuthors } from '@/domains/dam/author/composables/cachedAuthors'
import {
  initCommonAdminCoreDamOptions,
  useCommonAdminCoreDamOptions,
} from '@/domains/dam/composables/commonAdminCoreDamOptions'
import { useDamNotificationsEventBus } from '@/domains/dam/composables/damNotificationsEventBus'
import ImageMediaWidgetInner from '@/domains/dam/imageWidget/components/ImageMediaWidgetInner.vue'
import ImageWidgetInner from '@/domains/dam/imageWidget/components/ImageWidgetInner.vue'
import ImageWidgetMultipleInner from '@/domains/dam/imageWidget/components/ImageWidgetMultipleInner.vue'
import { initCommonAdminImageOptions } from '@/domains/dam/imageWidget/composables/commonAdminImageOptions'
import { useImageMassOperations } from '@/domains/dam/imageWidget/composables/useImageMassOperations'
import { useImageStore } from '@/domains/dam/imageWidget/store/imageStore'
import { ImageWidgetUploadConfigKey } from '@/domains/dam/imageWidget/utils/imageWidgetInkectionKeys'
import { mapUploadMetadataToImages } from '@/domains/dam/imageWidget/utils/metadataToImageMap'
import { createKeyword, fetchKeywordListByIds, useFetchKeywordList } from '@/domains/dam/keyword/api/keywordApi'
import KeywordRemoteAutocompleteWithCached from '@/domains/dam/keyword/components/KeywordRemoteAutocompleteWithCached.vue'
import { useDamCachedKeywords } from '@/domains/dam/keyword/composables/cachedKeywords'
import { useKeywordSelectActions } from '@/domains/dam/keyword/composables/keywordActions'
import { DamAssetType } from '@/domains/dam/types/Asset'
import { AssetFileProcessStatus } from '@/domains/dam/types/AssetFile'
import { UploadQueueItemStatus, UploadQueueItemType } from '@/domains/dam/types/UploadQueue'
import UploadQueueDialog from '@/domains/dam/uploadQueue/components/UploadQueueDialog.vue'
import UploadQueueDialogSingle from '@/domains/dam/uploadQueue/components/UploadQueueDialogSingle.vue'
import { useUploadQueueItemFactory } from '@/domains/dam/uploadQueue/factory/UploadQueueItemFactory'
import { useUploadQueuesStore } from '@/domains/dam/uploadQueue/store/uploadQueuesStore'
import { createFilter, createFilterStore, type MakeFilterOption } from '@/domains/filters/composables/filterFactory'

// Where the authors and the keywords of DAM are asked for. The two addresses are the application's to say, in
// its DAM configuration (`endPointAuthor`, `endPointKeyword`), as the addresses of assets and images are; left
// unsaid they are what they always were, `/adm/v1/author` and `/adm/v1/keyword`. Nothing of the library is
// replaced: the DAM is a client that records its requests.

const { extSystem, licence } = cmsConfiguration
const OWN_AUTHOR = '/own/v2/author'
const OWN_KEYWORD = '/own/v2/keyword'

let dam: FakeDam
let pinia: Pinia

const NAMES = /\/(author|keyword)(\/|$)/
/** The method and the path of every request, without its query. */
const asked = () => dam.requests.map((request) => `${request.method} ${request.url.split('?')[0]}`)
/** Of those, the requests for authors and keywords. */
const askedForNames = () => asked().filter((request) => NAMES.test(request))
/** The DAM answers every list with nobody, and a created record with what it was sent. */
const answerAuthorsAndKeywords = () =>
  dam.reply((request) => {
    if (!NAMES.test(request.url.split('?')[0]!)) return undefined
    if (request.method === 'POST') return { status: 201, data: JSON.parse(request.data as string) }
    return { status: 200, data: { data: [], totalCount: 0 } }
  })
type OwnAddresses = { endPointAuthor?: string; endPointKeyword?: string }
/**
 * The configuration of admin-cms; with `own`, one that names its own addresses. With `named`, those are named by
 * a second configuration of that name, and `default` names none.
 */
const configure = (own: OwnAddresses = {}, named?: string) => {
  pinia = createPinia()
  setActivePinia(pinia)
  dam = createFakeDam(cmsConfiguration.endPoints)
  const { coreDam, image } = installConsumerProfile(cmsConfiguration, dam.client)
  const usual = coreDam.configs.default!
  initCommonAdminCoreDamOptions({
    ...coreDam,
    configs: named ? { default: usual, [named]: { ...usual, ...own } } : { default: { ...usual, ...own } },
  })
  if (named) initCommonAdminImageOptions({ ...image, configs: { ...image.configs, [named]: image.configs.default! } })
  answerAuthorsAndKeywords()
}

const fields = [{ name: 'text', default: '' }] as const satisfies readonly MakeFilterOption<string>[]
/** What a list is asked with: the first page, and a filter nobody has filled. */
const listArguments = () => {
  const { filterData, filterConfig } = createFilter(fields, createFilterStore(fields), {
    system: 'dam',
    subject: 'author',
  })
  return [usePagination('id').pagination, filterData, filterConfig] as const
}

describe('the requests for authors and keywords', () => {
  beforeEach(() => configure())

  it('go to the address they are handed: a lookup by ids, a list, and a new author', async () => {
    await fetchAuthorListByIds(dam.client, OWN_AUTHOR, 7, ['author-1', 'author-2'])
    await useFetchAuthorList(dam.client, OWN_AUTHOR, 7).execute(...listArguments())
    await createAuthor(dam.client, OWN_AUTHOR, { name: 'New Author' } as never)

    expect(asked()).toEqual([
      `GET ${OWN_AUTHOR}/ext-system/7/search`,
      `GET ${OWN_AUTHOR}/ext-system/7`,
      `POST ${OWN_AUTHOR}`,
    ])
    expect(dam.requests[0]!.url).toContain('author-1,author-2')
    expect(dam.body(dam.requests[2]!)).toEqual({ name: 'New Author' })
  })

  it('go to the address they are handed: a lookup by ids, a list, and a new keyword', async () => {
    await fetchKeywordListByIds(dam.client, OWN_KEYWORD, 7, ['keyword-1'])
    await useFetchKeywordList(dam.client, OWN_KEYWORD, 7).execute(...listArguments())
    await createKeyword(dam.client, OWN_KEYWORD, { name: 'new keyword' } as never)

    expect(asked()).toEqual([
      `GET ${OWN_KEYWORD}/ext-system/7/search`,
      `GET ${OWN_KEYWORD}/ext-system/7`,
      `POST ${OWN_KEYWORD}`,
    ])
    expect(dam.requests[0]!.url).toContain('keyword-1')
  })
})

describe('the addresses of authors and keywords in a DAM configuration', () => {
  it('are /adm/v1/author and /adm/v1/keyword when the application names none', () => {
    configure()

    expect(useCommonAdminCoreDamOptions()).toMatchObject({
      endPointAuthor: '/adm/v1/author',
      endPointKeyword: '/adm/v1/keyword',
    })
  })

  it.each([
    ['that of authors', { endPointAuthor: OWN_AUTHOR }, OWN_AUTHOR, '/adm/v1/keyword'],
    ['that of keywords', { endPointKeyword: OWN_KEYWORD }, '/adm/v1/author', OWN_KEYWORD],
  ])("are the application's where it names only %s, and the usual one for the other", (_name, own, author, keyword) => {
    configure(own)

    expect(useCommonAdminCoreDamOptions()).toMatchObject({ endPointAuthor: author, endPointKeyword: keyword })
  })
})

// Each of these has the client of a configuration, and asks at the address that configuration names.
describe.each([
  ['names none', {}, '/adm/v1/author', '/adm/v1/keyword'],
  ['names its own', { endPointAuthor: OWN_AUTHOR, endPointKeyword: OWN_KEYWORD }, OWN_AUTHOR, OWN_KEYWORD],
  ['names only that of authors', { endPointAuthor: OWN_AUTHOR }, OWN_AUTHOR, '/adm/v1/keyword'],
  ['names only that of keywords', { endPointKeyword: OWN_KEYWORD }, '/adm/v1/author', OWN_KEYWORD],
])('who asks for authors and keywords, when the configuration %s', (name, own, author, keyword) => {
  beforeEach(() => configure(own))

  it('the inputs that offer authors and keywords: what they find by a text, and what they show by ids', async () => {
    const authors = useAuthorSelectActions(extSystem)
    const keywords = useKeywordSelectActions(extSystem)

    await authors.fetchItems(...listArguments())
    await authors.fetchItemsMinimal(...listArguments())
    await authors.fetchItemsByIds(['author-1'])
    await authors.fetchItemsMinimalByIds(['author-2'])
    await keywords.fetchItems(...listArguments())
    await keywords.fetchItemsMinimal(...listArguments())
    await keywords.fetchItemsByIds(['keyword-1'])

    expect(asked()).toEqual([
      `GET ${author}/ext-system/${extSystem}`,
      `GET ${author}/ext-system/${extSystem}`,
      `GET ${author}/ext-system/${extSystem}/search`,
      `GET ${author}/ext-system/${extSystem}/search`,
      `GET ${keyword}/ext-system/${extSystem}`,
      `GET ${keyword}/ext-system/${extSystem}`,
      `GET ${keyword}/ext-system/${extSystem}/search`,
    ])
  })

  it('the mass operation of the image widget that fills the authors', async () => {
    await useImageMassOperations().replaceEmptyAuthors(['author-1'])

    expect(asked()).toEqual([`GET ${author}/ext-system/${extSystem}/search`])
  })

  // The map itself; that each upload dialog hands it the address of its configuration is among the mounted cases.
  it('the map of an upload to images, by the address it is handed', async () => {
    const row = useUploadQueueItemFactory().createDefault(
      'row',
      UploadQueueItemType.File,
      UploadQueueItemStatus.Uploaded,
      DamAssetType.Image,
      1,
      licence
    )
    row.assetId = 'asset-1'
    row.fileId = 'file-1'
    const saved = { id: 'asset-1', authors: ['author-1'], customData: {} } as unknown as AssetMetadataBulkItem

    await mapUploadMetadataToImages(
      [row],
      [saved],
      dam.client,
      extSystem,
      licence,
      useCommonAdminCoreDamOptions().endPointAuthor
    )

    expect(asked()).toEqual([`GET ${author}/ext-system/${extSystem}/search`])
  })

  // One cache of names for the page, which no component hands a configuration: it asks as the default one says.
  it('the caches of the names of authors and keywords', async () => {
    // The caches are the page's: what an earlier case has cached is not asked for again.
    const suffix = name.replaceAll(' ', '-')
    const { addToCachedAuthors, fetchCachedAuthors } = useDamCachedAuthors()
    const { addToCachedKeywords, fetchCachedKeywords } = useDamCachedKeywords()

    addToCachedAuthors([`author-cached-${suffix}`])
    addToCachedKeywords([`keyword-cached-${suffix}`])
    fetchCachedAuthors()
    fetchCachedKeywords()
    await vi.waitFor(() => expect(dam.requests).toHaveLength(2), { timeout: 8000, interval: 50 })

    expect(asked().sort()).toEqual(
      [`GET ${author}/ext-system/${extSystem}/search`, `GET ${keyword}/ext-system/${extSystem}/search`].sort()
    )
  })
})

// The components that hand the address on. Each is mounted and made to ask, and what the DAM was asked is read:
// handed another address than the one of its configuration, the component would ask elsewhere.
describe('the components that ask for authors and keywords, in a configuration that names its own addresses', () => {
  const QUEUE = 'names-queue'
  /** The author the DAM knows at the application's own address, and nowhere else. */
  const knownAtOwnAddress = () =>
    dam.reply((request) =>
      request.method === 'GET' && request.url.startsWith(`${OWN_AUTHOR}/ext-system/${extSystem}/search`)
        ? { status: 200, data: { data: [{ id: 'author-1', name: 'Own Author' }], totalCount: 1 } }
        : undefined
    )
  const lookup = `GET ${OWN_AUTHOR}/ext-system/${extSystem}/search`

  let wrapper: VueWrapper | undefined
  afterEach(() => {
    wrapper?.unmount()
    wrapper = undefined
  })

  // The widgets are given their configuration by name, and ask with its client at its addresses: here one that is
  // not the default, which names none.
  describe('the image widgets, by the configuration they are given', () => {
    const Picker = defineComponent({ emits: ['confirm'], setup: () => () => h('div') })
    const MetadataDialog = defineComponent({
      emits: ['confirm'],
      setup: (_, { expose }) => {
        expose({ confirm: () => undefined })
        return () => h('div')
      },
    })

    beforeEach(() => {
      configure({ endPointAuthor: OWN_AUTHOR, endPointKeyword: OWN_KEYWORD }, 'own')
      useAssetSelectStore().setSelectConfig([{ licence, extSystem, licenceName: '', extSystemConfig: {} as never }])
      dam.assets.set('asset-with', damAsset('asset-with', { licence, authors: ['author-1'] }))
      dam.assets.set('asset-without', damAsset('asset-without', { licence }))
      // What the image and media widget asks about a picked asset first.
      dam.reply((request) =>
        request.method === 'GET' && request.url.startsWith('/adm/v1/cms/asset/') ? { status: 200, data: {} } : undefined
      )
      forgetAlerts()
    })

    const mountWidget = (widget: Component, props: Record<string, unknown>) => {
      wrapper = mount(widget, {
        props: {
          queueKey: QUEUE,
          uploadLicence: licence,
          selectLicences: [licence],
          configName: 'own',
          ...props,
        } as never,
        global: {
          plugins: [pinia],
          provide: {
            [ImageWidgetUploadConfigKey as symbol]: shallowRef({
              licence,
              extSystem,
              licenceName: '',
              extSystemConfig: {},
            }),
          },
          stubs: {
            AAssetSelect: Picker,
            AAssetSelectMedia: Picker,
            ImageDetailDialogMetadata: MetadataDialog,
            ASortableListEditor: true,
            ImageWidgetMultipleLimitDialog: true,
            AssetDetailDialog: true,
            UploadQueueDialog: true,
            UploadQueueDialogSingle: true,
            AFileInput: true,
            AFileInputDialog: true,
            AFileDropzone: true,
          },
        },
      })
      return wrapper
    }
    /** An asset of the widget's own licence is picked in the asset select: nothing is copied. */
    const pick = async (asset: string) => {
      wrapper!.findComponent(Picker).vm.$emit('confirm', {
        type: 'asset',
        value: [
          {
            id: asset,
            licence,
            mainFile: { id: `file-of-${asset}` },
            attributes: { assetType: DamAssetType.Image },
            podcasts: [],
          },
        ],
      })
      await flushPromises()
      await flushPromises()
    }

    it.each<[string, Component, Record<string, unknown>]>([
      ['the image widget', ImageWidgetInner, { modelValue: null }],
      ['the image and media widget', ImageMediaWidgetInner, { image: null, media: null }],
    ])(
      '%s: the authors of a picked asset, and those added to it before its image is saved',
      async (_, widget, props) => {
        mountWidget(widget, props)

        await pick('asset-with')
        expect(askedForNames()).toEqual([lookup])

        // An asset without authors: the dialog of the image offers to add them to the asset, and its save looks
        // their names up for the source of the image.
        await pick('asset-without')
        expect(askedForNames()).toEqual([lookup])
        // As the dialog of the image hands the widget what the user picks in it.
        wrapper!.findComponent(MetadataDialog).vm.$emit('update:damAuthors', ['author-2'])
        wrapper!.findComponent(MetadataDialog).vm.$emit('confirm')
        await flushPromises()
        await flushPromises()

        expect(askedForNames()).toEqual([lookup, lookup])
        expect(dam.requests.filter((request) => NAMES.test(request.url)).map((request) => request.url)).toEqual([
          expect.stringContaining('author-1'),
          expect.stringContaining('author-2'),
        ])
        // The confirm writes the authors into the asset, after it has looked up their names.
        expect(dam.sentTo('PATCH', dam.routes.bulkMetadata).map((request) => [request.url, dam.body(request)])).toEqual(
          [
            [
              `${cmsConfiguration.endPoints.asset}/metadata-bulk-update`,
              [{ id: 'asset-without', authors: ['author-2'], described: true }],
            ],
          ]
        )
        // No warning that the asset was given authors meanwhile. (The image itself is not saved here: the case has no
        // image client, and says so as the widget says a failed save.)
        expect(shownAlerts().filter(([colour]) => colour === 'warning')).toEqual([])
      }
    )

    it('the widget of several images: the authors of picked assets, and those added before the images are saved', async () => {
      mountWidget(ImageWidgetMultipleInner, { modelValue: [] })

      await pick('asset-with')
      expect(askedForNames()).toEqual([lookup])

      await pick('asset-without')
      expect(askedForNames()).toEqual([lookup])
      const added = useImageStore().images.find((image) => image.assetId === 'asset-without')!
      added.damAuthors = ['author-2']
      await (wrapper!.vm as unknown as { saveImages: () => Promise<boolean> }).saveImages()

      expect(askedForNames()).toEqual([lookup, lookup])
      expect(dam.requests.filter((request) => NAMES.test(request.url))[1]!.url).toContain('author-2')
    })
  })

  // Given no configuration and inside nothing that has one, they ask as the default one says. Under a named one:
  // `damNamedConfigurationComponents.test.ts`.
  describe('the two that make a new author and a new keyword, by the default configuration', () => {
    beforeEach(() => configure({ endPointAuthor: OWN_AUTHOR, endPointKeyword: OWN_KEYWORD }))

    it('the button that adds an author', async () => {
      wrapper = mount(AuthorCreateButton, {
        attachTo: document.body,
        props: { extSystem, initialValue: 'New Author' },
        global: { plugins: [pinia] },
      })
      await wrapper.find('button').trigger('click')
      await flushPromises()

      document.body.querySelector<HTMLElement>('[data-cy="button-confirm"]')!.click()
      await vi.waitFor(() => expect(wrapper!.emitted('success')).toHaveLength(1))

      expect(askedForNames()).toEqual([`POST ${OWN_AUTHOR}`])
      expect(dam.body(dam.requests[0]!)).toMatchObject({ name: 'New Author', extSystem })
    })

    it('the input of keywords, when a keyword that is not there yet is typed and entered', async () => {
      const Input = defineComponent({
        emits: ['update:search'],
        setup: () => () => h('div', { class: 'keyword-input' }),
      })
      wrapper = mount(KeywordRemoteAutocompleteWithCached, {
        props: { modelValue: [], extSystem, multiple: true },
        global: { plugins: [pinia], stubs: { AFormRemoteAutocompleteWithCached: Input } },
      })

      wrapper.findComponent(Input).vm.$emit('update:search', 'new keyword')
      await flushPromises()
      await wrapper.find('.keyword-input').trigger('keyup', { key: 'Enter' })
      await vi.waitFor(() => expect(wrapper!.emitted('update:modelValue')).toHaveLength(1))

      expect(askedForNames()).toEqual([`POST ${OWN_KEYWORD}`])
      expect(dam.body(dam.requests[0]!)).toMatchObject({ name: 'new keyword', extSystem })
    })
  })

  // The dialog of an upload hands the address to the library's map of an upload to images, which looks up the
  // names of the authors for the source of each image. Here neither dialog is given a configuration, nor is inside
  // a widget that has one: both ask as the default one says. Under a named one:
  // `damNamedConfigurationComponents.test.ts`.
  describe('the two dialogs of an upload, on "save and apply", by the default configuration', () => {
    let waits: LongWaits
    let socket: DamSocket

    beforeEach(() => {
      configure({ endPointAuthor: OWN_AUTHOR, endPointKeyword: OWN_KEYWORD })
      knownAtOwnAddress()
      waits = holdLongWaits()
      socket = stubDamSocket()
    })
    afterEach(() => {
      wrapper?.unmount()
      wrapper = undefined
      useUploadQueuesStore().stopUpload(QUEUE)
      waits.restore()
      socket.restore()
      useDamNotificationsEventBus().reset()
    })

    /** A file is picked and sent, and a read finds it processed, with an author. */
    const uploaded = async (mountDialog: () => VueWrapper) => {
      const store = useUploadQueuesStore()
      await store.addByFiles(QUEUE, extSystem, licence, [
        new File([new Uint8Array(3000)], 'photo.jpg', { type: 'image/jpeg' }),
      ])
      wrapper = mountDialog()
      const [item] = store.getQueueItems(QUEUE)
      await vi.waitFor(() => expect(item.status).toBe(UploadQueueItemStatus.Processing))
      dam.fileBecomes('asset-1', AssetFileProcessStatus.Processed, { authors: ['author-1'] })
      await waits.elapse()
      await vi.waitFor(() => expect(item.status).toBe(UploadQueueItemStatus.Uploaded))
      await flushPromises()
    }
    const dialogProps = {
      queueKey: QUEUE,
      licenceId: licence,
      fileInputKey: 0,
      extSystem,
      accept: undefined,
      maxSizes: undefined,
    }
    /** The image the dialog hands over has the name the own address answered for its source. */
    const expectLookedUpAtOwnAddress = () => {
      expect(wrapper!.emitted('apply')![0]).toMatchObject([[{ assetId: 'asset-1', texts: { source: 'Own Author' } }]])
      expect(askedForNames().filter((request) => !request.includes(OWN_AUTHOR))).toEqual([])
      expect(askedForNames()).toContain(lookup)
    }

    it('the dialog of a queue of files', async () => {
      await uploaded(() =>
        mount(UploadQueueDialog, {
          attachTo: document.body,
          props: dialogProps,
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
      )
      const t = (key: string) => (wrapper!.vm as unknown as { $t: (key: string) => string }).$t(key)
      const saveAndApply = Array.from(document.body.querySelectorAll<HTMLButtonElement>('.v-toolbar button')).find(
        (button) =>
          [t('common.damImage.upload.saveAndApply'), t('common.damImage.upload.apply')].includes(
            button.textContent?.trim() ?? ''
          )
      )!

      saveAndApply.click()
      await vi.waitFor(() => expect(wrapper!.emitted('apply')).toHaveLength(1))

      expectLookedUpAtOwnAddress()
    })

    it('the dialog of a single file', async () => {
      const Sidebar = defineComponent({ emits: ['saveAndApply'], setup: () => () => h('div') })
      await uploaded(() =>
        mount(UploadQueueDialogSingle, {
          attachTo: document.body,
          props: dialogProps,
          global: {
            plugins: [pinia],
            stubs: {
              UploadQueueDialogSingleSidebar: Sidebar,
              AssetDetailDialogLoader: true,
              AssetImage: true,
              DamAssetImageRoiSelectLazy: true,
              UploadQueueButtonStop: true,
            },
          },
        })
      )
      await vi.waitFor(() => expect(wrapper!.findComponent(Sidebar).exists()).toBe(true))

      wrapper!.findComponent(Sidebar).vm.$emit('saveAndApply')
      await vi.waitFor(() => expect(wrapper!.emitted('apply')).toHaveLength(1))

      expectLookedUpAtOwnAddress()
    })
  })
})
