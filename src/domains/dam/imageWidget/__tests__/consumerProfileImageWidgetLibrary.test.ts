import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, type Pinia, setActivePinia } from 'pinia'
import { type Component, defineComponent, h, shallowRef } from 'vue'
import { type ConsumerImageApi, installConsumerImageApi } from '@/domains/dam/__tests__/support/consumerImageApi'
import {
  cmsConfiguration,
  consumerProfiles,
  installConsumerProfile,
} from '@/domains/dam/__tests__/support/consumerProfiles'
import { answerDamNames, DAM_NAMES, damNameLookups, damNamesAsked } from '@/domains/dam/__tests__/support/damNames'
import {
  createFakeDam,
  damAssetWithFile,
  type FakeDam,
  type FakeDamAnswer,
  type FakeDamRequest,
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
import AAssetSelect from '@/domains/dam/assetSelect/components/AAssetSelect.vue'
import AAssetSelectMedia from '@/domains/dam/assetSelect/components/AAssetSelectMedia.vue'
import { useSidebar } from '@/domains/dam/assetSelect/composables/assetSelectFilterSidebar'
import { useAssetSelectStore } from '@/domains/dam/assetSelect/store/assetSelectStore'
import AuthorRemoteAutocompleteWithCached from '@/domains/dam/author/components/AuthorRemoteAutocompleteWithCached.vue'
import {
  initCommonAdminCoreDamOptions,
  useCommonAdminCoreDamOptions,
} from '@/domains/dam/composables/commonAdminCoreDamOptions'
import { useDamNotificationsEventBus } from '@/domains/dam/composables/damNotificationsEventBus'
import { useExtSystemIdForCached } from '@/domains/dam/composables/extSystemIdForCached'
import { useDamConfigStore } from '@/domains/dam/config/store/damConfigStore'
import AImageWidget from '@/domains/dam/imageWidget/components/AImageWidget.vue'
import ImageMediaWidgetInner from '@/domains/dam/imageWidget/components/ImageMediaWidgetInner.vue'
import ImageWidgetInner from '@/domains/dam/imageWidget/components/ImageWidgetInner.vue'
import { useImageMediaWidgetStore } from '@/domains/dam/imageWidget/store/imageMediaWidgetStore'
import { ImageWidgetUploadConfigKey } from '@/domains/dam/imageWidget/utils/imageWidgetInkectionKeys'
import type { AssetSelectMetadataToImageMapFn } from '@/domains/dam/imageWidget/utils/metadataToImageMap'
import {
  DamAssetStatus,
  DamAssetType,
  type DamAssetTypeType,
  type DamImageCopyToLicenceResponseItem,
} from '@/domains/dam/types/Asset'
import { AssetFileProcessStatus } from '@/domains/dam/types/AssetFile'
import type { ImageAware } from '@/domains/dam/types/ImageAware'
import { UploadQueueItemStatus, UploadQueueItemType } from '@/domains/dam/types/UploadQueue'
import { useUploadQueueDialog } from '@/domains/dam/uploadQueue/composables/useUploadQueueDialog'
import { useUploadQueuesStore } from '@/domains/dam/uploadQueue/store/uploadQueuesStore'
import type { DocId, IntegerId } from '@/shared/types/common'
import { isNull, isUndefined } from '@/shared/utils/common'

// The image widget and the library of the DAM, under each of the two applications: where the widget takes its
// configuration from and whom it lets in, where the asset picker lists from, and what the widget makes of an asset
// picked there. The real widget; the DAM and the backend of the images are clients that record their requests. Not
// mounted for real: the pictures (they would ask the image server), the tiles and the table of the picker with
// the metadata of the asset picked in it, the inputs of its filter (each is named by a stand-in), the asset detail,
// the upload dialog, and the inputs that ask the DAM for names to offer. Where a case is about what the widget does
// with a picked asset, the picker itself is a stand-in that answers as the real one does.

const QUEUE = 'lead-image'
const FILTER_INPUTS = [
  'AFilterString',
  'AFilterBooleanSelect',
  'AFilterTimeInterval',
  'DamKeywordFilterRemoteAutocomplete',
  'DamAuthorFilterRemoteAutocomplete',
  'DamUserFilterRemoteAutocomplete',
]
const ALWAYS_STAND_INS = [
  'VImg',
  'AImageWidgetSimple',
  'AssetDetailDialog',
  'UploadQueueDialogSingle',
  'AFormRemoteAutocompleteWithCached',
  'AssetSelectListTiles',
  'AssetSelectListTable',
  'AssetMetadata',
  ...FILTER_INPUTS,
]
/** The id of the image the widget holds: what its form reads. */
const modelValueOf = (widget: VueWrapper) => (widget.props() as { modelValue: number | null }).modelValue
const PickerStandIn = defineComponent({ name: 'AAssetSelect', emits: ['confirm'], setup: () => () => h('div') })

let pinia: Pinia
let dam: FakeDam
let imageApi: ConsumerImageApi
let waits: LongWaits
let wrapper: VueWrapper | undefined
/** The map of the application from a picked asset to the texts of an image, where it brings one. */
let mapOfTheApplication: Mock<AssetSelectMetadataToImageMapFn> | undefined

describe.each(consumerProfiles)('the image widget and the library of the DAM under the $name', (profile) => {
  const { endPoints, extSystem, licence, foreignPrefix } = profile
  const isCms = profile === cmsConfiguration
  const isListRequest = (request: FakeDamRequest) =>
    request.method === 'GET' && request.url.startsWith(`${endPoints.asset}/licence/${licence}/search?`)
  const listRequests = () => dam.requests.filter(isListRequest)

  beforeEach(() => {
    pinia = createPinia()
    setActivePinia(pinia)
    dam = createFakeDam(endPoints)
    const options = installConsumerProfile(profile, dam.client)
    const own = options.coreDam.configs.default!
    mapOfTheApplication = own.customAssetSelectMetadataToImageMap
      ? vi.fn(own.customAssetSelectMetadataToImageMap)
      : undefined
    if (mapOfTheApplication) {
      initCommonAdminCoreDamOptions({
        ...options.coreDam,
        configs: { default: { ...own, customAssetSelectMetadataToImageMap: mapOfTheApplication } },
      })
    }
    imageApi = installConsumerImageApi(profile, options)
    answerDamNames(dam)
    dam.reply((request) => (isListRequest(request) ? { status: 200, data: { data: [], totalCount: 0 } } : undefined))
    waits = holdLongWaits()
    forgetAlerts()
  })
  afterEach(() => {
    wrapper?.unmount()
    wrapper = undefined
    useUploadQueuesStore(pinia).stopUpload(QUEUE)
    useUploadQueueDialog().uploadQueueDialog.value = null
    waits.restore()
    useDamNotificationsEventBus().reset()
    signOutOfDam()
  })

  const uploadConfig = () => ({
    licence,
    extSystem,
    licenceName: 'own',
    extSystemConfig: useDamConfigStore(pinia).damConfigExtSystem.get(extSystem)!,
  })
  /** The inner widget, with the upload configuration its parent provides: the way admin-ugc mounts it itself. */
  const mountInner = async (props: Record<string, unknown> = {}, picker: 'real' | 'stand-in' = 'real') => {
    const mounted: VueWrapper = mount(ImageWidgetInner, {
      attachTo: document.body,
      props: {
        queueKey: QUEUE,
        uploadLicence: licence,
        selectLicences: [licence],
        modelValue: null,
        'onUpdate:modelValue': (value: number | null) => mounted.setProps({ modelValue: value }),
        // admin-ugc has no user of the DAM, and says so; admin-cms has one.
        skipCurrentUserCheck: !isCms,
        ...props,
      } as never,
      global: {
        plugins: [pinia],
        provide: { [ImageWidgetUploadConfigKey as symbol]: shallowRef(uploadConfig()) },
        stubs: {
          ...Object.fromEntries(ALWAYS_STAND_INS.map((name) => [name, true])),
          ...(picker === 'stand-in' ? { AAssetSelect: PickerStandIn } : {}),
        },
      },
    })
    wrapper = mounted
    await flushPromises()
    return mounted
  }
  // Menus and dialogs are drawn into the body.
  const openMenuItems = () =>
    Array.from(document.body.querySelectorAll<HTMLElement>('.v-menu.v-overlay--active .v-list-item'))
  /** The user picks "add from the library" in the menu of the widget. */
  const openTheLibrary = async () => {
    await wrapper!.find(`button[aria-label="${damText('image.button.options')}"]`).trigger('click')
    await vi.waitFor(() => expect(openMenuItems().length).toBeGreaterThan(0))
    openMenuItems()
      .find((entry) => entry.textContent?.trim() === useCommonAdminCoreDamOptions().addFromDamLabel)!
      .click()
    await flushPromises()
  }
  const picker = () => document.body.querySelector<HTMLElement>('.subject-select__card')
  const toForeignPrefix = () => dam.requests.filter((request) => request.url.startsWith(foreignPrefix))
  const notAllowed = ['error', alertText('common.assetSelect.error.unallowedLicence')]
  /** The application turns the copy into the licence of a widget off, as one whose DAM API has no copy path would. */
  const copyOff = () => {
    const { coreDam } = profile.options(dam.client)
    initCommonAdminCoreDamOptions({
      ...coreDam,
      configs: { default: { ...coreDam.configs.default!, copyToLicenceEnabled: false } },
    })
  }

  describe('the asset picker of the widget', () => {
    it('opens over the assets of the licence, listed from the DAM of the application, and asks it for no configuration', async () => {
      if (isCms) signInToDam(extSystem)
      await mountInner()

      await openTheLibrary()
      await vi.waitFor(() => expect(listRequests()).toHaveLength(1))
      await vi.waitFor(() => expect(useAssetSelectStore(pinia).loader).toBe(false))

      expect(picker()).not.toBeNull()
      expect(picker()!.textContent).toContain(uiText('common.assetSelect.meta.texts.title'))
      expect(useAssetSelectStore(pinia).selectedLicenceId).toBe(licence)
      // The configuration is in the store by the time the inner widget mounts: admin-ugc writes it there itself.
      expect(dam.requests.filter((request) => !isListRequest(request))).toEqual([])
      expect(toForeignPrefix()).toEqual([])
      expect(shownAlerts()).toEqual([])
    })

    // admin-ugc names the two filters its users get; admin-cms names none and gets them all. None of the inputs
    // admin-ugc leaves out is there to ask the DAM for authors, keywords or users.
    it('has the filters the application asks for: all of them, or the ones it names', async () => {
      if (isCms) signInToDam(extSystem)
      await mountInner()
      await openTheLibrary()
      await vi.waitFor(() => expect(listRequests()).toHaveLength(1))

      const inputs = new Set(
        FILTER_INPUTS.flatMap((name) =>
          wrapper!.findAllComponents({ name }).map((input) => input.props('name') ?? input.props('nameFrom'))
        )
      )
      expect([...inputs].sort()).toEqual(
        isCms
          ? [
              'assetAndMainFileIds',
              'authorIds',
              'createdAtFrom',
              'createdByIds',
              'described',
              'generatedBySystem',
              'keywordIds',
              'text',
              'visible',
            ]
          : ['createdAtFrom', 'text']
      )
    })

    // Over the assets of another licence than the one the widget uploads into, the picker offers to copy the picked
    // one there, unless the application turns the copy off.
    it.each([
      ['offers', undefined, true],
      ['does not offer, where the application turns it off,', false, false],
    ])('%s the copy into the licence of the widget over the assets of another licence', async (_, enabled, offered) => {
      if (enabled === false) copyOff()
      if (isCms) signInToDam(extSystem)
      await mountInner({ uploadLicence: licence + 1 })

      await openTheLibrary()
      await vi.waitFor(() => expect(listRequests()).toHaveLength(1))
      await vi.waitFor(() => expect(useAssetSelectStore(pinia).loader).toBe(false))

      expect(useAssetSelectStore(pinia).selectedLicenceId).toBe(licence)
      expect(picker()!.textContent!.includes(uiText('common.assetSelect.meta.texts.copyToLicence'))).toBe(offered)
    })

    // Without a user of the DAM the licence is allowed to, the picker is for nobody, unless the application says
    // to skip the check (admin-ugc does on every widget). The widget is told so, and the dialog of the picker does
    // not open (finding 33: it used to open over no licence, listing nothing); pressed again, it says so again.
    it('says the licence is not allowed to a page without a user of the DAM that does not skip the check, and opens no picker', async () => {
      await mountInner({ skipCurrentUserCheck: false })

      await openTheLibrary()
      await waits.settle(400)

      expect(shownAlerts()).toEqual([notAllowed])
      expect(listRequests()).toEqual([])
      expect(dam.requests).toEqual([])
      expect(useAssetSelectStore(pinia).selectedLicenceId).toBe(0)
      expect(picker()).toBeNull()

      await openTheLibrary()
      await waits.settle(400)

      expect(shownAlerts()).toEqual([notAllowed, notAllowed])
      expect(picker()).toBeNull()
    })
  })

  // The pickers mounted for real, as the widgets mount them: over the licence of the widget, opened through their
  // model. The one of the image and media widget is given no `skipCurrentUserCheck` by its widget, so only a page with
  // a user of the DAM (admin-cms) gets past the check.
  describe('the asset pickers, as the widgets mount them', () => {
    const mountPicker = async (
      component: Component,
      props: Record<string, unknown> = {},
      standIns = ALWAYS_STAND_INS
    ) => {
      const mounted: VueWrapper = mount(component, {
        attachTo: document.body,
        props: {
          modelValue: false,
          'onUpdate:modelValue': (value: boolean) => mounted.setProps({ modelValue: value }),
          minCount: 1,
          maxCount: 1,
          selectLicences: [licence],
          uploadLicence: licence,
          returnType: 'asset',
          ...props,
        } as never,
        global: {
          plugins: [pinia],
          stubs: Object.fromEntries(standIns.map((name) => [name, true])),
        },
      })
      wrapper = mounted
      // Ready once it has the configurations of its licences.
      await flushPromises()
      return mounted
    }
    /** Opened as the widget opens it, and done listing. */
    const open = async (mounted: VueWrapper) => {
      const listedBefore = listRequests().length
      await mounted.setProps({ modelValue: true })
      await vi.waitFor(() => expect(listRequests()).toHaveLength(listedBefore + 1))
      await vi.waitFor(() => expect(useAssetSelectStore(pinia).loader).toBe(false))
    }
    const copySwitch = () =>
      Array.from(picker()!.querySelectorAll<HTMLElement>('.v-switch'))
        .find((one) => one.textContent?.includes(uiText('common.assetSelect.meta.texts.copyToLicence')))
        ?.querySelector('input')
    const confirmButton = () =>
      Array.from(picker()!.querySelectorAll<HTMLButtonElement>('button')).find(
        (button) => button.textContent?.trim() === uiText('common.button.confirm')
      )!
    /** An image of the given licence, as the list has it. */
    const listed = (id: string, of: IntegerId) =>
      ({
        id,
        licence: of,
        mainFile: { id: `file-of-${id}` },
        attributes: { assetType: DamAssetType.Image },
        podcasts: [],
      }) as never
    /** The images listed, and each picked in the list. */
    const pick = async (...assets: never[]) => {
      const store = useAssetSelectStore(pinia)
      store.setList(assets)
      assets.forEach((_, index) => store.toggleSelectedByIndex(index))
      await flushPromises()
    }
    /** The user browses another licence; what was picked stays picked. */
    const browse = async (other: IntegerId) => {
      useAssetSelectStore(pinia).selectedLicenceId = other
      await flushPromises()
    }
    const switchCopyOn = async () => {
      copySwitch()!.click()
      await flushPromises()
    }
    const confirm = async () => {
      confirmButton().click()
      await flushPromises()
    }
    const copyAsked = (mounted: VueWrapper) =>
      mounted.emitted('confirm')!.map(([data]) => (data as { copyToLicence: IntegerId | undefined }).copyToLicence)
    const pickers: Array<[string, Component, Record<string, unknown>]> = [
      ['the picker of the image widget', AAssetSelect, { assetType: DamAssetType.Image }],
      ['the picker of the image and media widget', AAssetSelectMedia, {}],
    ]

    if (isCms) {
      it.each([
        ['offers', undefined, true],
        ['does not offer, where the application turns it off,', false, false],
      ])(
        'the picker of the image and media widget %s the copy into the licence of the widget over the assets of another licence',
        async (_, enabled, offered) => {
          if (enabled === false) copyOff()
          signInToDam(extSystem)

          await open(await mountPicker(AAssetSelectMedia, { uploadLicence: licence + 1 }))

          expect(listRequests()).toHaveLength(1)
          expect(useAssetSelectStore(pinia).selectedLicenceId).toBe(licence)
          expect(isUndefined(copySwitch())).toBe(!offered)
        }
      )

      // The switch keeps the state the user left it in, and what was picked outlives a change of the licence browsed:
      // the licence of each picked asset decides, not the one browsed when the picker is confirmed.
      it.each(pickers)(
        '%s asks for the copy of an asset picked over another licence, confirmed over the licence of the upload',
        async (_, component, own) => {
          signInToDam(extSystem)
          const mounted = await mountPicker(component, { ...own, uploadLicence: licence + 1 })
          await open(mounted)
          await switchCopyOn()
          await pick(listed('asset-9', licence))

          await browse(licence + 1)
          expect(copySwitch()).toBeUndefined()
          await confirm()

          expect(copyAsked(mounted)).toEqual([licence + 1])
        }
      )

      it.each(pickers)(
        '%s asks for no copy of an asset picked in the licence of the upload, the switch on over another licence',
        async (_, component, own) => {
          signInToDam(extSystem)
          const mounted = await mountPicker(component, { ...own, uploadLicence: licence })
          await open(mounted)
          expect(copySwitch()).toBeUndefined()
          await pick(listed('asset-9', licence))

          await browse(licence + 1)
          await switchCopyOn()
          await confirm()

          expect(copyAsked(mounted)).toEqual([undefined])
        }
      )

      // Which of them the widget copies is the widget's to say: it copies those of another licence.
      it.each(pickers)(
        '%s asks for the copy of assets picked in both licences, and hands both over',
        async (_, component, own) => {
          signInToDam(extSystem)
          const mounted = await mountPicker(component, { ...own, uploadLicence: licence + 1, maxCount: 2 })
          await open(mounted)
          await switchCopyOn()
          await pick(listed('asset-9', licence), listed('asset-10', licence + 1))
          await confirm()

          expect(copyAsked(mounted)).toEqual([licence + 1])
          expect(
            (mounted.emitted('confirm')![0]![0] as { value: Array<{ id: string }> }).value.map((asset) => asset.id)
          ).toEqual(['asset-9', 'asset-10'])
        }
      )

      // The picker of the image and media widget lists one type at a time. A switch to another type emptied the list
      // and the side panel, but did not give up what a click on a tile had begun: the read of that asset was written
      // into the panel when it answered, beside the list of the other type. The place of the active tile was kept too,
      // so the tile at that place of the new list could not be made the active one. With its real tiles and its real
      // bar; the pictures and the metadata of the picked asset are stand-ins.
      describe('the picker of the image and media widget, switched to another type', () => {
        const tiles = () => Array.from(document.body.querySelectorAll<HTMLElement>('.asset-list-tiles__item'))
        const tilesDrawn = () =>
          tiles().map((tile) => [
            tile.querySelector('[data-cy="asset-tile-title"]')!.textContent!.trim(),
            tile.classList.contains('asset-list-tiles__item--active'),
          ])
        const panel = () => document.body.querySelector<HTMLElement>('.subject-select__sidebar-right')!
        const panelLoads = () => !!panel().querySelector('.v-progress-circular')
        const panelShowsAnAsset = () => wrapper!.findComponent({ name: 'AssetMetadata' }).exists()
        const noAssetPicked = () =>
          panel().textContent!.includes(uiText('common.assetSelect.meta.info.noAssetSelected'))
        const ofType = (id: string, assetType: DamAssetTypeType) =>
          damAssetWithFile(id, `file-of-${id}`, AssetFileProcessStatus.Processed, {
            licence,
            texts: { displayTitle: id },
            attributes: { assetType, assetStatus: DamAssetStatus.WithFile },
          })
        /** The picker over one image and one video of the licence, open on the images. */
        const openOnImages = async () => {
          signInToDam(extSystem)
          dam.assets.set('image-1', ofType('image-1', DamAssetType.Image))
          dam.assets.set('video-1', ofType('video-1', DamAssetType.Video))
          dam.reply((request) => {
            if (!isListRequest(request)) return undefined
            const type = request.url.match(/type\]?=(\w+)/)?.[1]
            const found = [...dam.assets.values()].filter((asset) => asset.attributes.assetType === type)
            return { status: 200, data: { data: found, totalCount: found.length } }
          })
          const mounted = await mountPicker(AAssetSelectMedia, {}, [
            'VImg',
            'AssetImagePreview',
            'AssetSelectListTable',
            'AssetMetadata',
            ...FILTER_INPUTS,
          ])
          await open(mounted)
          await vi.waitFor(() => expect(tilesDrawn()).toEqual([['image-1', false]]))
          return mounted
        }
        const typeButton = (type: 'image' | 'video') =>
          document.body.querySelector<HTMLButtonElement>(`[data-cy="button-${type}-types"]`)!
        /** The picker has asked for its list so many times, and has the last answer. */
        const listed = async (times: number) => {
          await vi.waitFor(() => expect(listRequests()).toHaveLength(times))
          await vi.waitFor(() => expect(useAssetSelectStore(pinia).loader).toBe(false))
          await flushPromises()
        }
        /** The user presses the button of a type in the bar, and the list of that type has come. */
        const switchTo = async (type: 'image' | 'video') => {
          const listedBefore = listRequests().length
          typeButton(type).click()
          await listed(listedBefore + 1)
        }
        const readOf = (asset: string) => new RegExp(`^${endPoints.asset}/${asset}$`)

        afterEach(() => useSidebar().closeSidebarRight())

        it('gives up the read of a tile clicked before the switch: the side panel loads nothing, and never shows that asset', async () => {
          await openOnImages()
          const read = dam.hold('GET', readOf('image-1'))
          tiles()[0]!.click()
          await vi.waitFor(() => expect(read.waiting).toHaveLength(1))
          expect(panelLoads()).toBe(true)

          const listedBefore = listRequests().length
          typeButton('video').click()
          await flushPromises()
          expect([panelLoads(), noAssetPicked()]).toEqual([false, true])
          await listed(listedBefore + 1)
          expect(tilesDrawn()).toEqual([['video-1', false]])
          read.release()
          await waits.settle()

          expect([panelLoads(), noAssetPicked(), panelShowsAnAsset()]).toEqual([false, true, false])
          expect(useAssetDetailStore(pinia).asset).toBeNull()
          expect(shownAlerts()).toEqual([])

          // Back on the images: the panel shows no asset, so the tile clicked before the switch is not the active one.
          await switchTo('image')
          expect(tilesDrawn()).toEqual([['image-1', false]])
          expect([panelLoads(), noAssetPicked()]).toEqual([false, true])
        })

        it('says nothing when that read fails after the switch', async () => {
          await openOnImages()
          const read = dam.hold('GET', readOf('image-1'))
          tiles()[0]!.click()
          await vi.waitFor(() => expect(read.waiting).toHaveLength(1))

          await switchTo('video')
          read.release({ status: 500 })
          await waits.settle()

          expect(shownAlerts()).toEqual([])
          expect([panelLoads(), noAssetPicked()]).toEqual([false, true])
        })

        it('shows the asset of a tile clicked after the switch, and marks that tile, also at the place of the one clicked before', async () => {
          await openOnImages()
          tiles()[0]!.click()
          await vi.waitFor(() => expect(useAssetDetailStore(pinia).asset?.id).toBe('image-1'))
          await flushPromises()
          expect(tilesDrawn()).toEqual([['image-1', true]])

          await switchTo('video')
          expect(tilesDrawn()).toEqual([['video-1', false]])
          expect([noAssetPicked(), panelShowsAnAsset()]).toEqual([true, false])
          tiles()[0]!.click()
          await vi.waitFor(() => expect(useAssetDetailStore(pinia).asset?.id).toBe('video-1'))
          await flushPromises()

          expect(tilesDrawn()).toEqual([['video-1', true]])
          expect(panelShowsAnAsset()).toBe(true)

          // Back on the images: the panel is empty again, so the tile clicked there before is not the active one.
          await switchTo('image')
          expect(tilesDrawn()).toEqual([['image-1', false]])
          expect([noAssetPicked(), panelShowsAnAsset()]).toEqual([true, false])
        })
      })
    }

    it('the picker of the image and media widget says the licence is not allowed to a page without a user of the DAM, and does not open, at each press', async () => {
      const mounted = await mountPicker(AAssetSelectMedia)

      await mounted.setProps({ modelValue: true })
      await waits.settle(400)
      expect(shownAlerts()).toEqual([notAllowed])
      expect(picker()).toBeNull()
      expect((mounted.props() as { modelValue: boolean }).modelValue).toBe(false)

      await mounted.setProps({ modelValue: true })
      await waits.settle(400)
      expect(shownAlerts()).toEqual([notAllowed, notAllowed])
      expect(picker()).toBeNull()
      expect(listRequests()).toEqual([])
    })
  })

  describe('an asset picked in the library', () => {
    const picked = (id: string, parts: Record<string, unknown> = {}) => ({
      id,
      // An asset of another licence than the one the widget uploads into.
      licence: 300003,
      mainFile: { id: `file-of-${id}` },
      mainFileInternal: true,
      attributes: { assetType: DamAssetType.Image },
      podcasts: [],
      ...parts,
    })
    /** What the DAM has for the picked asset; in admin-cms it has two authors. */
    const inTheDam = (id: string, authors: string[] = isCms ? ['author-3', 'author-4'] : []) =>
      dam.assets.set(
        id,
        damAssetWithFile(id, `file-of-${id}`, AssetFileProcessStatus.Processed, {
          licence: 300003,
          authors,
          metadata: {
            customData: { description: ' a picked image ', author: ' B. Blogger ' },
            authorSuggestions: {},
            keywordSuggestions: {},
          },
        })
      )
    const mountWithStandIn = async (props: Record<string, unknown> = {}) => {
      if (isCms) signInToDam(extSystem)
      const mounted = await mountInner(props, 'stand-in')
      // As the picker leaves it once it has been opened.
      useAssetSelectStore(pinia).setSelectConfig([uploadConfig()])
      return mounted
    }
    /** The user confirms the asset in the picker; nothing is to be copied. */
    const confirmInPicker = async (asset: Record<string, unknown>) => {
      wrapper!.findComponent(PickerStandIn).vm.$emit('confirm', { type: 'asset', value: [asset] })
      await flushPromises()
      await flushPromises()
    }
    const imageDialog = () =>
      Array.from(document.body.querySelectorAll<HTMLElement>('.v-overlay--active .v-card')).find((card) =>
        card.textContent?.includes(damText('image.meta.edit'))
      )
    // A growing text field has a hidden twin that measures it.
    const textsIn = (root: Element) =>
      Array.from(root.querySelectorAll<HTMLTextAreaElement>('textarea')).filter(
        (field) => field.getAttribute('aria-hidden') !== 'true'
      )
    const confirmImage = () =>
      Array.from(imageDialog()!.querySelectorAll<HTMLButtonElement>('button'))
        .find((button) => button.textContent?.trim() === uiText('common.button.confirm'))!
        .click()
    const source = isCms ? 'Name of author-3, Name of author-4' : 'B. Blogger'
    const imageOfPicked = {
      texts: { description: 'a picked image', source },
      flags: { showSource: true, internal: false, overrideInternal: false },
      // The file and the licence of the asset as it was listed, internal as the DAM has it.
      dam: { damId: 'file-of-asset-9', regionPosition: 0, licenceId: 300003, internal: true },
      position: 1,
    }
    const existing: ImageAware = {
      id: 7,
      texts: { description: 'the image before', source: 'Agency' },
      dam: { damId: 'file-before', licenceId: licence, regionPosition: 0, internal: false },
      flags: { showSource: true, internal: false, overrideInternal: false },
      position: 1,
    }

    it('is read from the DAM of the application, and the dialog of the image opens with its texts', async () => {
      inTheDam('asset-9')
      await mountWithStandIn()

      await confirmInPicker(picked('asset-9'))

      expect(dam.sentTo('GET', dam.routes.one).map((request) => request.url)).toEqual([`${endPoints.asset}/asset-9`])
      expect(useImageMediaWidgetStore(pinia).detail).toEqual(imageOfPicked)
      expect(textsIn(imageDialog()!).map((field) => field.value)).toEqual(['a picked image', source])
      // admin-cms: the source is the names of the authors of the asset, asked for once. admin-ugc: the texts are
      // made by its own map, from the asset as it was read, and no author is asked for.
      expect(damNameLookups(dam)).toHaveLength(isCms ? 1 : 0)
      if (mapOfTheApplication) {
        expect(mapOfTheApplication).toHaveBeenCalledTimes(1)
        expect(mapOfTheApplication.mock.calls[0][0]).toMatchObject({ id: 'asset-9', licence: 300003 })
      }
      expect(toForeignPrefix().filter((request) => !/\/author\//.test(request.url))).toEqual([])
      expect(imageApi.calls).toEqual([])
      expect(shownAlerts()).toEqual([])
    })

    it('becomes a new image on "confirm", or replaces the texts and the file of the image the widget has', async () => {
      inTheDam('asset-9')
      const mounted = await mountWithStandIn()
      await confirmInPicker(picked('asset-9'))

      confirmImage()
      await vi.waitFor(() => expect(mounted.emitted('afterMetadataSaveSuccess')).toHaveLength(1))
      expect(imageApi.calls[0]).toEqual(['createImage', imageOfPicked])
      expect(modelValueOf(mounted)).toBe(501)

      mounted.unmount()
      imageApi.calls.length = 0
      const withImage = await mountWithStandIn({ modelValue: 7, image: existing })
      await confirmInPicker(picked('asset-9'))
      expect(useImageMediaWidgetStore(pinia).detail).toEqual({ ...imageOfPicked, id: 7 })
      confirmImage()
      await vi.waitFor(() => expect(withImage.emitted('afterMetadataSaveSuccess')).toHaveLength(1))
      expect(imageApi.calls).toEqual([['updateImage', 7, { ...imageOfPicked, id: 7 }]])
    })

    if (isCms) {
      // The ext system has the authors of the DAM: an asset that has none is offered them in place of a source to
      // type, and what the user picks is saved into the asset before the image is.
      it('without an author: the dialog offers the authors of the DAM in place of the source, and saves them into the asset', async () => {
        inTheDam('asset-9', [])
        const mounted = await mountWithStandIn()

        await confirmInPicker(picked('asset-9'))
        expect(useImageMediaWidgetStore(pinia).detail).toMatchObject({
          texts: { description: 'a picked image', source: '' },
        })
        expect(textsIn(imageDialog()!).map((field) => field.value)).toEqual(['a picked image'])
        const authors = mounted.findComponent(AuthorRemoteAutocompleteWithCached)
        expect(authors.exists()).toBe(true)
        // The asset whose authors are offered is the widget's own: none is put into the store of the detail, which
        // is the page's.
        expect(useAssetDetailStore(pinia).asset).toBeNull()

        authors.vm.$emit('update:modelValue', ['author-5'])
        await flushPromises()
        /** Whether the image had been written when the DAM got the authors. */
        let imageWrittenFirst: boolean | undefined
        dam.reply((request) => {
          if (request.method === 'PATCH' && dam.routes.bulkMetadata.test(request.url)) {
            imageWrittenFirst = imageApi.calls.length > 0
          }
          return undefined
        })
        confirmImage()
        await vi.waitFor(() => expect(mounted.emitted('afterMetadataSaveSuccess')).toHaveLength(1))

        const writes = dam.sentTo('PATCH', dam.routes.bulkMetadata)
        expect(writes.map((request) => request.url)).toEqual(['/adm/v1/asset/metadata-bulk-update'])
        expect(dam.body(writes[0])).toEqual([{ id: 'asset-9', authors: ['author-5'], described: true }])
        expect(imageWrittenFirst).toBe(false)
        expect(imageApi.calls[0]).toMatchObject(['createImage', { texts: { source: 'Name of author-5' } }])
      })

      it('without an author, and none picked: the image is saved without a source, and nothing is written into the DAM', async () => {
        inTheDam('asset-9', [])
        const mounted = await mountWithStandIn()
        await confirmInPicker(picked('asset-9'))

        confirmImage()
        await vi.waitFor(() => expect(mounted.emitted('afterMetadataSaveSuccess')).toHaveLength(1))

        expect(imageApi.calls[0]).toMatchObject([
          'createImage',
          { texts: { description: 'a picked image', source: '' } },
        ])
        expect(dam.sentTo('PATCH', dam.routes.bulkMetadata)).toEqual([])
        expect(shownAlerts().filter(([colour]) => colour === 'error')).toEqual([])
      })
    } else {
      // admin-ugc has no authors of the DAM: its own map says what the source is, whatever the asset has.
      it('never offers the authors of the DAM, and asks the DAM for no author', async () => {
        inTheDam('asset-9', ['author-3'])
        const mounted = await mountWithStandIn()

        await confirmInPicker(picked('asset-9'))
        await damNamesAsked()

        expect(textsIn(imageDialog()!).map((field) => field.value)).toEqual(['a picked image', 'B. Blogger'])
        expect(mounted.findComponent(AuthorRemoteAutocompleteWithCached).exists()).toBe(false)
        expect(damNameLookups(dam)).toEqual([])
        expect(toForeignPrefix()).toEqual([])
      })
    }

    // The description takes 2 000 characters. Over that "confirm" said only that the form has errors, and the
    // field showed none: the source beside it shows its own.
    it('shows under the description of the dialog what "confirm" does not take of it', async () => {
      inTheDam('asset-9')
      await mountWithStandIn()
      await confirmInPicker(picked('asset-9'))
      const [description, source] = textsIn(imageDialog()!)
      const errorOf = (field: HTMLTextAreaElement) => {
        const input = field.closest('.v-input')!
        return [input.classList.contains('v-input--error'), input.querySelector('.v-messages')?.textContent?.trim()]
      }
      expect(errorOf(description)).toEqual([false, ''])

      description.value = 'x'.repeat(2001)
      description.dispatchEvent(new Event('input', { bubbles: true }))
      await flushPromises()
      confirmImage()
      await flushPromises()

      expect(shownAlerts()).toEqual([['error', alertText('common.alert.fixValidationErrors')]])
      expect(imageApi.calls).toEqual([])
      // The messages of the validators go through the instance of the plugin, as the alerts do.
      expect(errorOf(description)).toEqual([true, alertText('error.jsValidation.maxLength')])
      expect(errorOf(source)).toEqual([false, ''])
    })

    it('that has no file is not taken: nothing is read and no dialog opens', async () => {
      await mountWithStandIn()

      await confirmInPicker(picked('asset-9', { mainFile: null }))

      expect(dam.requests).toEqual([])
      expect(useImageMediaWidgetStore(pinia).detail).toBeNull()
      expect(imageDialog()).toBeUndefined()
    })

    // Today's behaviour, pinned as it is: the failed read is said, and the image is offered all the same, from
    // what the list knew of the asset: its file and its licence, and no texts.
    it('that cannot be read: says so, and still offers the image, without its texts', async () => {
      await mountWithStandIn()

      await confirmInPicker(picked('asset-gone'))

      expect(shownAlerts().map(([colour]) => colour)).toEqual(['error'])
      expect(useImageMediaWidgetStore(pinia).detail).toEqual({
        ...imageOfPicked,
        texts: { description: '', source: '' },
        dam: { ...imageOfPicked.dam, damId: 'file-of-asset-gone' },
      })
      expect(imageDialog()).toBeDefined()
    })
  })

  // The picker offers the copy when the user browses another licence than the one the widget uploads into, which
  // only admin-cms has. Where the request of the copy goes is not what is asked here.
  if (isCms) {
    describe('an asset picked to be copied into the licence of the widget', () => {
      const COPY = /\/copy-to-licence$/
      const copyAnswers = (result: DamImageCopyToLicenceResponseItem['result']) =>
        dam.reply((request) =>
          request.method === 'PATCH' && COPY.test(request.url)
            ? {
                status: 200,
                data: [
                  {
                    asset: 'asset-9',
                    targetAsset: 'asset-copy',
                    targetMainFile: 'file-copy',
                    targetAssetLicence: licence,
                    result,
                    assetConflicts: [],
                  },
                ],
              }
            : undefined
        )
      const pickToCopy = async () => {
        signInToDam(extSystem)
        await mountInner({}, 'stand-in')
        useAssetSelectStore(pinia).setSelectConfig([uploadConfig()])
        wrapper!.findComponent(PickerStandIn).vm.$emit('confirm', {
          type: 'asset',
          copyToLicence: licence,
          value: [
            {
              id: 'asset-9',
              licence: 300003,
              mainFile: { id: 'file-of-asset-9' },
              attributes: { assetType: DamAssetType.Image },
              podcasts: [],
            },
          ],
        })
        await flushPromises()
        await flushPromises()
        return useUploadQueuesStore(pinia).getQueueItems(QUEUE)
      }

      it('that the DAM copies: its copy is a row of the queue that waits for the server, under the upload dialog', async () => {
        copyAnswers('copy')

        const rows = await pickToCopy()

        expect(dam.sentTo('PATCH', COPY).map((request) => dam.body(request))).toEqual([
          [{ asset: 'asset-9', targetAssetLicence: licence }],
        ])
        expect(rows).toMatchObject([
          {
            type: UploadQueueItemType.Asset,
            status: UploadQueueItemStatus.Processing,
            assetId: 'asset-copy',
            licenceId: licence,
            isDuplicate: false,
            canEditMetadata: false,
          },
        ])
        expect(useUploadQueueDialog().uploadQueueDialog.value).toBe(QUEUE)
        // No image is made of the picked asset: the copy goes through the upload dialog first.
        expect(useImageMediaWidgetStore(pinia).detail).toBeNull()
        expect(shownAlerts()).toEqual([])
      })

      it('that the licence already has: the row is that asset, settled at once as a duplicate, with its form', async () => {
        copyAnswers('exists')
        dam.assets.set(
          'asset-copy',
          damAssetWithFile('asset-copy', 'file-copy', AssetFileProcessStatus.Processed, {
            licence,
            metadata: { customData: { description: 'of the copy' }, authorSuggestions: {}, keywordSuggestions: {} },
          })
        )

        const rows = await pickToCopy()
        await vi.waitFor(() => expect(rows[0]?.status).toBe(UploadQueueItemStatus.Uploaded))

        expect(rows).toMatchObject([
          {
            type: UploadQueueItemType.Asset,
            assetId: 'asset-copy',
            fileId: 'file-copy',
            isDuplicate: true,
            canEditMetadata: true,
            customData: { description: 'of the copy' },
            error: { hasError: false },
          },
        ])
        // Read by the file the DAM named, from the address of the application.
        expect(dam.originReads().map((request) => request.url)).toEqual(['/adm/v1/asset/asset-file/file-copy'])
        expect(useUploadQueueDialog().uploadQueueDialog.value).toBe(QUEUE)
      })

      it('that the DAM does not let the user copy: says so, queues nothing and opens no dialog', async () => {
        copyAnswers('notAllowed')

        const rows = await pickToCopy()

        expect(shownAlerts()).toEqual([['error', alertText('common.damImage.queueItem.errorUnableToCopyToLicence')]])
        expect(rows).toEqual([])
        expect(useUploadQueueDialog().uploadQueueDialog.value).toBeNull()
        expect(useImageMediaWidgetStore(pinia).detail).toBeNull()
      })

      // A picker of the application's own that still says to copy: the widget does not ask for it.
      it('where the application turns the copy off: none is asked for, and the asset is picked as it is', async () => {
        copyAnswers('copy')
        copyOff()
        dam.assets.set(
          'asset-9',
          damAssetWithFile('asset-9', 'file-of-asset-9', AssetFileProcessStatus.Processed, { licence: 300003 })
        )

        const rows = await pickToCopy()

        expect(dam.sentTo('PATCH', COPY)).toEqual([])
        expect(rows).toEqual([])
        await vi.waitFor(() =>
          expect(useImageMediaWidgetStore(pinia).detail).toMatchObject({ dam: { damId: 'file-of-asset-9' } })
        )
      })
    })
  }
})

// admin-cms mounts the outer widget, which takes the configuration of the DAM from the DAM itself and lets only a
// user the upload licence is allowed to change the image. (admin-ugc mounts the inner widget over a configuration it
// has written itself: the cases above.)
describe('the outer image widget of admin-cms, over a DAM configuration nobody has loaded yet', () => {
  const { endPoints, extSystem, licence } = cmsConfiguration

  beforeEach(() => {
    pinia = createPinia()
    setActivePinia(pinia)
    dam = createFakeDam(endPoints)
    installConsumerImageApi(cmsConfiguration, installConsumerProfile(cmsConfiguration, dam.client))
    // What the DAM answers its configuration with: what the profile had written into the store, which is emptied.
    const store = useDamConfigStore(pinia)
    const extSystemConfig = store.damConfigExtSystem.get(extSystem)!
    const elements = store.damConfigAssetCustomFormElements.get(extSystem)!
    const settings = store.damPrvConfig.settings
    store.reset()
    dam.reply((request) => {
      if (request.method !== 'GET') return undefined
      const [path] = request.url.split('?')
      if (path === `/adm/v1/asset-licence/${licence}`) {
        return { status: 200, data: { id: licence, name: 'cms', extSystem } }
      }
      if (path === `/adm/v1/configuration/ext-system/${extSystem}`) return { status: 200, data: extSystemConfig }
      if (path === '/adm/v1/configuration') {
        return {
          status: 200,
          data: { settings, colorSet: {}, assetExternalProviders: {}, distributionServices: {} },
        }
      }
      const form = path!.match(/^\/adm\/v1\/asset-custom-form\/ext-system\/(\d+)\/type\/(\w+)\/element$/)
      if (form) {
        const found = elements[form[2] as keyof typeof elements] ?? []
        return { status: 200, data: { data: found, totalCount: found.length } }
      }
      return undefined
    })
    waits = holdLongWaits()
    forgetAlerts()
  })
  afterEach(() => {
    wrapper?.unmount()
    wrapper = undefined
    waits.restore()
    useDamNotificationsEventBus().reset()
    signOutOfDam()
  })

  const mountOuter = async (props: Record<string, unknown> = {}) => {
    wrapper = mount(AImageWidget, {
      attachTo: document.body,
      props: { modelValue: null, queueKey: QUEUE, uploadLicence: licence, selectLicences: [licence], ...props },
      global: { plugins: [pinia], stubs: Object.fromEntries(ALWAYS_STAND_INS.map((name) => [name, true])) },
    })
    await flushPromises()
    await vi.waitFor(() => expect(wrapper!.find('.v-progress-circular').exists()).toBe(false))
    await flushPromises()
  }
  const asked = () =>
    [...new Set(dam.requests.map((request) => `${request.method} ${request.url.split('?')[0]}`))].sort()
  const offersToChangeTheImage = () => ({
    dropzone: wrapper!.find('.a-file-dropzone').exists(),
    menu: wrapper!.find(`button[aria-label="${damText('image.button.options')}"]`).exists(),
  })
  const licenceAndExtSystem = [
    `GET /adm/v1/asset-licence/${licence}`,
    `GET /adm/v1/configuration`,
    `GET /adm/v1/configuration/ext-system/${extSystem}`,
  ]

  it('loads the licence, the ext system, the settings and the custom forms from /adm/v1, and offers the upload to a user of the ext system', async () => {
    signInToDam(extSystem)

    await mountOuter()

    expect(asked()).toEqual(
      [
        ...licenceAndExtSystem,
        ...['audio', 'document', 'image', 'video'].map(
          (type) => `GET /adm/v1/asset-custom-form/ext-system/${extSystem}/type/${type}/element`
        ),
      ].sort()
    )
    expect(dam.unanswered).toEqual([])
    expect(offersToChangeTheImage()).toEqual({ dropzone: true, menu: true })
    expect(wrapper!.text()).not.toContain(damText('error.loadingConfig'))
    expect(useDamConfigStore(pinia).initialized.damPrvConfig).toBe(true)
  })

  it.each([
    ['a user of the DAM who is of another ext system and has no licence', () => signInToDam(extSystem + 1)],
    ['no user of the DAM at all', () => undefined],
  ])('shows the image read-only to %s, and does not load the custom forms', async (_who, signIn) => {
    signIn()

    await mountOuter()

    expect(asked()).toEqual(licenceAndExtSystem)
    expect(offersToChangeTheImage()).toEqual({ dropzone: false, menu: false })
    expect(wrapper!.findComponent(ImageWidgetInner).props('readonly')).toBe(true)
    expect(wrapper!.text()).not.toContain(damText('error.loadingConfig'))
  })

  it('says the configuration could not be loaded, and draws no widget, when the DAM does not answer for the licence', async () => {
    signInToDam(extSystem)

    await mountOuter({ uploadLicence: 404404, selectLicences: [404404] })

    expect(asked()).toEqual(['GET /adm/v1/asset-licence/404404'])
    expect(wrapper!.text()).toContain(damText('error.loadingConfig'))
    expect(wrapper!.findComponent(ImageWidgetInner).exists()).toBe(false)
  })
})

// The authors of the DAM in the dialog of the image of a widget of one image: whose they are, and what "edit asset" of
// that dialog makes of them. An asset picked in the library that has no author is offered them in place of a source.
// The dialog drew them over whatever asset the store of the asset detail held, and that store is one for the page: the
// asset picker, the asset detail and every other widget write there, while the widget only remembered that it had
// offered them once. So the dialog of one image offered, and saved, the authors of the asset of another, and after
// "edit asset" (the detail empties that store) the pick was gone, and authors saved in the detail never reached the
// source of the image. The widget holds the asset it read for its image itself, and reads it again when the detail
// "edit asset" opened has closed. Both widgets of one image under each application; admin-ugc has no authors of the
// DAM, so its dialog never offers them. The real widgets with their real dialog of the image and the real dialog of
// the asset detail, of which only what it frames is not drawn; the asset picker and the upload dialog are stand-ins
// that answer as the real ones do, but for the cases of a pick made in the real picker, with its real tiles.
const UploadStandIn = defineComponent({
  name: 'UploadQueueDialogSingle',
  emits: ['apply'],
  setup: () => () => h('div'),
})
const MEDIA = /^\/adm\/v1\/cms\/asset\//

describe.each(consumerProfiles)('the authors of the DAM in the dialog of an image under the $name', (profile) => {
  const { endPoints, extSystem, licence } = profile
  const isCms = profile === cmsConfiguration
  const OTHER = 300003
  const OTHER_EXT_SYSTEM = 7

  let widgets: VueWrapper[] = []
  let detailForm: VueWrapper | undefined
  /** What a widget mounted with the real picker failed to draw: collected, where it would be thrown into the page. */
  let failedToDraw: unknown[] = []

  beforeEach(() => {
    pinia = createPinia()
    setActivePinia(pinia)
    dam = createFakeDam(endPoints)
    imageApi = installConsumerImageApi(profile, installConsumerProfile(profile, dam.client))
    answerDamNames(dam)
    // What the image and media widget asks about a picked asset first: here, it is no media.
    dam.reply((request) =>
      request.method === 'GET' && MEDIA.test(request.url) ? { status: 200, data: {} } : undefined
    )
    // The other licence is of another ext system, configured as the one of the page.
    const config = useDamConfigStore(pinia)
    config.damConfigLicenceExtSystem.set(OTHER, { name: '', extSystem: OTHER_EXT_SYSTEM })
    config.damConfigExtSystem.set(OTHER_EXT_SYSTEM, config.damConfigExtSystem.get(extSystem)!)
    waits = holdLongWaits()
    forgetAlerts()
    if (isCms) signInToDam(extSystem)
  })
  afterEach(async () => {
    detailForm?.unmount()
    detailForm = undefined
    widgets.forEach((widget) => widget.unmount())
    widgets = []
    failedToDraw = []
    useUploadQueueDialog().uploadQueueDialog.value = null
    useSidebar().closeSidebarRight()
    await damNamesAsked()
    waits.restore()
    useDamNotificationsEventBus().reset()
    signOutOfDam()
  })

  const uploadConfig = () => ({
    licence,
    extSystem,
    licenceName: 'own',
    extSystemConfig: useDamConfigStore(pinia).damConfigExtSystem.get(extSystem)!,
  })
  const detail = () => useAssetDetailStore(pinia)
  /** What the DAM has for an asset: `file-of-<id>`, described, in the licence of the widget unless another is named. */
  const inTheDam = (id: string, authors: string[] = [], of: IntegerId = licence) =>
    dam.assets.set(
      id,
      damAssetWithFile(id, `file-of-${id}`, AssetFileProcessStatus.Processed, {
        licence: of,
        authors,
        metadata: {
          customData: { description: `of ${id}`, author: 'B. Blogger' },
          authorSuggestions: {},
          keywordSuggestions: {},
        },
      })
    )
  /** An asset as the list of the picker has it. */
  const listed = (id: string, of: IntegerId = licence) => ({
    id,
    licence: of,
    mainFile: { id: `file-of-${id}` },
    mainFileInternal: false,
    attributes: { assetType: DamAssetType.Image },
    podcasts: [],
  })
  /** An image the entity already has, of a file of its own. */
  const stored = (id: number, file = `file-${id}`, source = `source ${id}`): ImageAware => ({
    id,
    texts: { description: `image ${id}`, source },
    dam: { damId: file, licenceId: licence, regionPosition: 0, internal: false },
    flags: { showSource: true, internal: false, overrideInternal: false },
    position: 1,
  })
  // The dialog of the image is drawn into the body.
  const imageDialog = () =>
    Array.from(document.body.querySelectorAll<HTMLElement>('.v-overlay--active .v-card')).find((card) =>
      card.textContent?.includes(damText('image.meta.edit'))
    )
  // A growing text field has a hidden twin that measures it.
  const fieldsIn = (root: Element) =>
    Array.from(root.querySelectorAll<HTMLTextAreaElement>('textarea')).filter(
      (field) => field.getAttribute('aria-hidden') !== 'true'
    )
  /** The texts the dialog of the image shows: the description, and the source where it has that field. */
  const texts = () => fieldsIn(imageDialog()!).map((field) => field.value)
  const typeSource = async (text: string) => {
    const source = fieldsIn(imageDialog()!)[1]!
    source.value = text
    source.dispatchEvent(new Event('input', { bubbles: true }))
    await flushPromises()
  }
  const buttonOfDialog = (text: string) =>
    Array.from(imageDialog()!.querySelectorAll<HTMLButtonElement>('button')).find(
      (button) => button.textContent?.trim() === text
    )!
  const confirmButton = () => buttonOfDialog(uiText('common.button.confirm'))
  /** What each save of metadata wrote into the DAM: the asset and its authors. */
  const authorsWritten = () =>
    dam
      .sentTo('PATCH', dam.routes.bulkMetadata)
      .map((request) =>
        (dam.body(request) as Array<{ id: DocId; authors?: DocId[] }>).map((one) => [one.id, one.authors])
      )
  /** The reads of an asset by its id: what a pick reads, and what the widget reads again once a detail has closed. */
  const readsOf = (asset: DocId) =>
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
  const imagesWritten = () => imageApi.calls.filter(([call]) => call === 'createImage' || call === 'updateImage')

  describe.each<[string, Component]>([
    ['the image widget', ImageWidgetInner],
    ['the image and media widget', ImageMediaWidgetInner],
  ])('of %s', (_name, component) => {
    const isImageWidget = component === ImageWidgetInner
    /**
     * The widget with its buttons in a row, as it is in a form; `image`: the id of the image the entity has. Its
     * picker is a stand-in, or the real one with its real tiles, of which the pictures are not drawn.
     */
    const mountWidget = async (
      image: number | null = null,
      key = QUEUE,
      more: Record<string, unknown> = {},
      picker: 'stand-in' | 'real' = 'stand-in'
    ) => {
      const mounted: VueWrapper = mount(component, {
        attachTo: document.body,
        props: {
          queueKey: key,
          uploadLicence: licence,
          selectLicences: [licence],
          expandOptions: true,
          ...(isImageWidget
            ? {
                modelValue: image,
                'onUpdate:modelValue': (value: number | null) => mounted.setProps({ modelValue: value }),
                // admin-ugc has no user of the DAM, and says so; admin-cms has one.
                skipCurrentUserCheck: !isCms,
              }
            : {
                image,
                media: null,
                'onUpdate:image': (value: number | null) => mounted.setProps({ image: value }),
                'onUpdate:media': (value: unknown) => mounted.setProps({ media: value }),
              }),
          ...more,
        } as never,
        global: {
          plugins: [pinia],
          provide: { [ImageWidgetUploadConfigKey as symbol]: shallowRef(uploadConfig()) },
          // A component that fails as it is set up is left out of the page, as in an application: thrown here, the
          // failure would take the cases after this one with it.
          ...(picker === 'real' ? { config: { errorHandler: (error: unknown) => failedToDraw.push(error) } } : {}),
          stubs: {
            ...(picker === 'stand-in'
              ? { AAssetSelect: PickerStandIn, AAssetSelectMedia: PickerStandIn }
              : Object.fromEntries(
                  ['AssetImagePreview', 'AssetSelectListTable', 'AssetMetadata', ...FILTER_INPUTS].map((name) => [
                    name,
                    true,
                  ])
                )),
            UploadQueueDialogSingle: UploadStandIn,
            AssetDetailDialogFrame: true,
            VImg: true,
            AImageWidgetSimple: true,
            AFormRemoteAutocompleteWithCached: true,
          },
        },
      })
      widgets.push(mounted)
      await flushPromises()
      // As the picker leaves it once it has been opened.
      useAssetSelectStore(pinia).setSelectConfig([uploadConfig()])
      return mounted
    }
    /** The user confirms the asset in the picker of the widget; nothing is to be copied. */
    const pickInLibrary = async (widget: VueWrapper, asset: string, of: IntegerId = licence) => {
      widget.findComponent(PickerStandIn).vm.$emit('confirm', { type: 'asset', value: [listed(asset, of)] })
      await vi.waitFor(() =>
        expect(useImageMediaWidgetStore(pinia).detail).toMatchObject({ dam: { damId: `file-of-${asset}` } })
      )
      await vi.waitFor(() => expect(confirmButton().disabled).toBe(false))
      await flushPromises()
    }
    /** "Edit image" of the widget: the dialog of the image it has. */
    const editImage = async (widget: VueWrapper) => {
      const button = () =>
        widget.findAll('.a-image-widget__options button').find((one) => one.text() === damText('image.meta.edit'))
      await vi.waitFor(() => expect(button()).toBeDefined())
      await button()!.trigger('click')
      await vi.waitFor(() => expect(imageDialog()).toBeDefined())
      await flushPromises()
    }
    const closeImageDialog = async () => {
      imageDialog()!.querySelector<HTMLButtonElement>('[data-cy="button-close"]')!.click()
      await vi.waitFor(() => expect(imageDialog()).toBeUndefined())
    }
    /** "Confirm" of the dialog, until the widget has saved its image. */
    const confirmImage = async (widget: VueWrapper) => {
      const saved = widget.emitted('afterMetadataSaveSuccess')?.length ?? 0
      confirmButton().click()
      await vi.waitFor(() => expect(widget.emitted('afterMetadataSaveSuccess')).toHaveLength(saved + 1))
      await flushPromises()
    }
    const authorsInput = (widget: VueWrapper) => widget.findComponent(AuthorRemoteAutocompleteWithCached)
    /** What the dialog offers: the authors picked in it so far, or `null` where it shows the source. */
    const offered = (widget: VueWrapper) =>
      authorsInput(widget).exists() ? (authorsInput(widget).props('modelValue') as DocId[]) : null
    const pickAuthors = async (widget: VueWrapper, authors: DocId[]) => {
      authorsInput(widget).vm.$emit('update:modelValue', authors)
      await flushPromises()
    }
    /** "Edit asset" of the dialog of the image is pressed. */
    const pressEditAsset = () => buttonOfDialog(useCommonAdminCoreDamOptions().editAssetLabel).click()
    /** The same, and the detail shows the asset. */
    const editAsset = async (asset: DocId) => {
      pressEditAsset()
      await vi.waitFor(() => expect(detail().asset?.id).toBe(asset))
      await flushPromises()
    }
    /** The form of the detail is not drawn here: this is what its save sends, with the authors the user picks in it. */
    const saveInDetail = async (authors: DocId[]) => {
      const { damClient, endPointAsset } = useCommonAdminCoreDamOptions()
      detail().asset!.authors = authors
      await updateAssetMetadata(damClient, endPointAsset, detail().asset!, extSystem, detail().mainFileSingleUse)
      await flushPromises()
    }
    /** The detail is closed with its own button: the real dialog, of which only what it frames is not drawn. */
    const closeDetail = async (widget: VueWrapper) => {
      widget.findComponent({ name: 'AssetDetailDialogFrame' }).vm.$emit('close')
      await flushPromises()
    }
    /** The asset is picked, and the dialog of its image offers the authors of the DAM. */
    const pickedWithoutAuthors = async (asset = 'asset-9', image: number | null = null) => {
      inTheDam(asset)
      if (!isNull(image)) imageApi.has(stored(image))
      const widget = await mountWidget(image)
      await pickInLibrary(widget, asset)
      expect(offered(widget)).toEqual([])
      return widget
    }
    /** As above; then "edit asset" of the dialog, authors saved in the detail, and the detail still open. */
    const authorsSavedInDetail = async (authors: DocId[]) => {
      const widget = await pickedWithoutAuthors()
      damKeepsAuthors()
      await editAsset('asset-9')
      await saveInDetail(authors)
      return widget
    }
    /** The reads of an asset by its id wait; `answer` lets them answer with what the DAM has by then. */
    const holdReadsOf = (asset: DocId) => {
      const held = dam.hold('GET', new RegExp(`^${endPoints.asset}/${asset}$`))
      return {
        waiting: held.waiting,
        answer: (given?: FakeDamAnswer) =>
          held.release(given ?? { status: 200, data: structuredClone(dam.assets.get(asset)) }),
      }
    }

    if (isCms) {
      describe('are those of the asset the widget read for that image', () => {
        // The pick of asset-9 was closed without a save: the widget still has its image 7, of another file. The
        // dialog of that image used to offer the authors of asset-9 all the same, and "confirm" wrote them into it
        // and named them as the source of image 7.
        it('are not offered with the image the widget has, once the dialog of a picked asset was closed without a save', async () => {
          const widget = await pickedWithoutAuthors('asset-9', 7)
          await closeImageDialog()

          await editImage(widget)

          expect(offered(widget)).toBeNull()
          expect(texts()).toEqual(['image 7', 'source 7'])
          // As every image that has its source: admin-cms requires it.
          await typeSource('')
          confirmButton().click()
          await flushPromises()
          expect(shownAlerts()).toEqual([['error', alertText('common.alert.fixValidationErrors')]])
          expect(imagesWritten()).toEqual([])

          await typeSource('typed by hand')
          await confirmImage(widget)

          expect(imagesWritten()).toEqual([
            ['updateImage', 7, { ...stored(7), texts: { description: 'image 7', source: 'typed by hand' } }],
          ])
          expect(authorsWritten()).toEqual([])
        })

        // Two widgets of one page. The authors picked for the image of the second stayed in the store of the page,
        // and the dialog of the first showed them: confirmed without a change, the first image took their names as
        // its source, and they were written into the asset of the second once more.
        it('are never those picked in another widget of the page', async () => {
          inTheDam('asset-1')
          inTheDam('asset-2')
          const first = await mountWidget(null, 'lead-image')
          const second = await mountWidget(null, 'social-image')
          await pickInLibrary(first, 'asset-1')
          await confirmImage(first)
          await pickInLibrary(second, 'asset-2')
          await pickAuthors(second, ['author-5'])
          await confirmImage(second)
          expect(authorsWritten()).toEqual([[['asset-2', ['author-5']]]])
          expect(imagesWritten().map(([, image]) => (image as ImageAware).texts.source)).toEqual([
            '',
            'Name of author-5',
          ])

          await editImage(first)

          expect(offered(first)).toEqual([])
          expect(offered(second)).toBeNull()
          await confirmImage(first)
          expect(authorsWritten()).toEqual([[['asset-2', ['author-5']]]])
          expect(imagesWritten().at(-1)).toMatchObject([
            'updateImage',
            501,
            { texts: { source: '' }, dam: { damId: 'file-of-asset-1' } },
          ])
        })

        // What another part of the page leaves in the store of the detail, or takes from it, is nothing to the dialog.
        it('are not those of an asset left in the store of the asset detail, and stay when that store is emptied', async () => {
          const widget = await pickedWithoutAuthors()
          inTheDam('asset-of-the-page', ['author-3'])

          detail().setAsset(structuredClone(dam.assets.get('asset-of-the-page')!))
          await flushPromises()
          expect(offered(widget)).toEqual([])
          await confirmImage(widget)
          expect(authorsWritten()).toEqual([])
          expect(imagesWritten()).toMatchObject([['createImage', { texts: { source: '' } }]])

          await editImage(widget)
          detail().setAsset(null)
          await flushPromises()
          expect(offered(widget)).toEqual([])
          await pickAuthors(widget, ['author-5'])
          await confirmImage(widget)
          expect(authorsWritten()).toEqual([[['asset-9', ['author-5']]]])
          expect(imagesWritten().at(-1)).toMatchObject(['updateImage', 501, { texts: { source: 'Name of author-5' } }])
        })

        // Unchanged: an image saved without an author is offered the authors of its asset again, and those picked then
        // are saved into that asset.
        it('are offered again for the image saved without an author, and those picked then are saved into its asset', async () => {
          const widget = await pickedWithoutAuthors()
          await confirmImage(widget)
          expect(imagesWritten()).toMatchObject([['createImage', { texts: { source: '' } }]])
          expect(authorsWritten()).toEqual([])

          await editImage(widget)
          expect(offered(widget)).toEqual([])
          expect(texts()).toEqual(['of asset-9'])
          await pickAuthors(widget, ['author-5'])
          expect(offered(widget)).toEqual(['author-5'])
          await confirmImage(widget)

          expect(authorsWritten()).toEqual([[['asset-9', ['author-5']]]])
          expect(dam.body(dam.sentTo('PATCH', dam.routes.bulkMetadata)[0]!)).toEqual([
            { id: 'asset-9', authors: ['author-5'], described: true },
          ])
          expect(imagesWritten().at(-1)).toMatchObject(['updateImage', 501, { texts: { source: 'Name of author-5' } }])
          // Saved into the asset, they are offered no more: the image has its source.
          await editImage(widget)
          expect(offered(widget)).toBeNull()
          expect(texts()).toEqual(['of asset-9', 'Name of author-5'])
        })

        // The upload dialog hands the widget the image of its file, with the source its "save and apply" made. Here
        // the file is the one of the asset picked before, as a duplicate of it is.
        it('are not offered with the image of an upload, used after the pick of an asset without authors', async () => {
          const widget = await pickedWithoutAuthors()
          await closeImageDialog()

          useUploadQueueDialog().uploadQueueDialog.value = QUEUE
          await flushPromises()
          widget.findComponent(UploadStandIn).vm.$emit('apply', [
            {
              texts: { description: 'uploaded', source: 'Name of author-1' },
              dam: { damId: 'file-of-asset-9', licenceId: licence, regionPosition: 0, internal: false },
              flags: { showSource: true, internal: false, overrideInternal: false },
              position: 1,
              authorIds: ['author-1'],
              assetId: 'asset-9',
            },
          ])
          useUploadQueueDialog().uploadQueueDialog.value = null
          await vi.waitFor(() => expect(imageDialog()).toBeDefined())
          await flushPromises()

          expect(offered(widget)).toBeNull()
          expect(texts()).toEqual(['uploaded', 'Name of author-1'])
          await confirmImage(widget)
          expect(authorsWritten()).toEqual([])
          expect(imagesWritten()).toMatchObject([['createImage', { texts: { source: 'Name of author-1' } }]])
        })

        it('are those of the asset picked last: one picked with its authors shows its source', async () => {
          const widget = await pickedWithoutAuthors()
          await pickAuthors(widget, ['author-5'])
          inTheDam('asset-10', ['author-3'])

          await pickInLibrary(widget, 'asset-10')

          expect(offered(widget)).toBeNull()
          expect(texts()).toEqual(['of asset-10', 'Name of author-3'])
          await confirmImage(widget)
          expect(authorsWritten()).toEqual([])
          expect(imagesWritten()).toMatchObject([
            ['createImage', { texts: { source: 'Name of author-3' }, dam: { damId: 'file-of-asset-10' } }],
          ])
        })

        // With `expandMetadata` the form of the image is drawn in the page, not in a dialog, and stays there once the
        // image is saved: the host of the widget confirms it.
        it('are offered in the form drawn in the page as well, and again once its image is saved without an author', async () => {
          inTheDam('asset-9')
          const widget = await mountWidget(null, QUEUE, { expandMetadata: true })
          const confirmByHost = async () => {
            const saved = widget.emitted('afterMetadataSaveSuccess')?.length ?? 0
            ;(widget.vm as unknown as { metadataConfirm: () => void }).metadataConfirm()
            await vi.waitFor(() => expect(widget.emitted('afterMetadataSaveSuccess')).toHaveLength(saved + 1))
            await flushPromises()
          }
          widget.findComponent(PickerStandIn).vm.$emit('confirm', { type: 'asset', value: [listed('asset-9')] })
          await vi.waitFor(() => expect(offered(widget)).toEqual([]))
          await flushPromises()

          await confirmByHost()
          expect(imagesWritten()).toMatchObject([['createImage', { texts: { source: '' } }]])
          expect(offered(widget)).toEqual([])

          await pickAuthors(widget, ['author-5'])
          await confirmByHost()
          expect(authorsWritten()).toEqual([[['asset-9', ['author-5']]]])
          expect(imagesWritten().at(-1)).toMatchObject(['updateImage', 501, { texts: { source: 'Name of author-5' } }])
          expect(offered(widget)).toBeNull()
        })

        // The input of the authors asks for names under the ext system of the page, which a click on a tile of the
        // picker sets: once its read of the asset had answered. A pick confirmed before that gives the read up, so on
        // a page just loaded the dialog of the picked image had no ext system to offer the authors under: neither the
        // authors nor the source were drawn, and the image was saved without a source.
        const picker = () => document.body.querySelector<HTMLElement>('.subject-select__card')
        const tiles = () => Array.from(document.body.querySelectorAll<HTMLElement>('.asset-list-tiles__item'))
        /** The real picker of the widget, open over one asset without authors, on a page just loaded. */
        const pickerOpenedOnAFreshPage = async () => {
          // No upload, no asset detail and no gallery has said yet which ext system the page is of.
          useExtSystemIdForCached().cachedExtSystemId.value = 0
          inTheDam('asset-9')
          dam.reply((request) =>
            request.method === 'GET' && request.url.startsWith(`${endPoints.asset}/licence/${licence}/search?`)
              ? { status: 200, data: { data: [structuredClone(dam.assets.get('asset-9'))], totalCount: 1 } }
              : undefined
          )
          const widget = await mountWidget(null, QUEUE, {}, 'real')
          await widget
            .findAll('.a-image-widget__options button')
            .find((button) => button.text() === useCommonAdminCoreDamOptions().addFromDamLabel)!
            .trigger('click')
          await vi.waitFor(() => expect(tiles()).toHaveLength(1))
          return widget
        }

        it('are offered under the ext system of the picker, also when the pick is confirmed before the read of the clicked tile answers', async () => {
          const widget = await pickerOpenedOnAFreshPage()
          const reads = holdReadsOf('asset-9')

          tiles()[0]!.click()
          await vi.waitFor(() => expect(reads.waiting).toHaveLength(1))
          const readOfTheClick = reads.waiting[0]!
          Array.from(picker()!.querySelectorAll<HTMLButtonElement>('button'))
            .find((button) => button.textContent?.trim() === uiText('common.button.confirm'))!
            .click()
          // The widget reads the picked asset itself, and is answered; the read of the click is still on its way.
          await vi.waitFor(() => expect(reads.waiting).toHaveLength(2))
          reads.waiting[1]!.release({ status: 200, data: structuredClone(dam.assets.get('asset-9')) })
          await vi.waitFor(() => expect(imageDialog()).toBeDefined())
          await vi.waitFor(() => expect(confirmButton().disabled).toBe(false))
          await flushPromises()

          await vi.waitFor(() => expect(picker()).toBeNull())
          expect(failedToDraw).toEqual([])
          expect(offered(widget)).toEqual([])
          expect(authorsInput(widget).props('extSystem')).toBe(extSystem)
          expect(useExtSystemIdForCached().cachedExtSystemId.value).toBe(extSystem)
          expect(texts()).toEqual(['of asset-9'])
          expect(shownAlerts()).toEqual([])
          // The read that was given up is still given up: its answer is shown nowhere.
          readOfTheClick.release({ status: 200, data: structuredClone(dam.assets.get('asset-9')) })
          await waits.settle()
          expect(detail().asset).toBeNull()

          await pickAuthors(widget, ['author-5'])
          // "Confirm" reads the asset again before it writes the authors: a read held as the others.
          confirmButton().click()
          await vi.waitFor(() => expect(reads.waiting).toHaveLength(1))
          reads.answer()
          await vi.waitFor(() => expect(widget.emitted('afterMetadataSaveSuccess')).toHaveLength(1))
          await flushPromises()
          expect(authorsWritten()).toEqual([[['asset-9', ['author-5']]]])
          expect(imagesWritten()).toMatchObject([['createImage', { texts: { source: 'Name of author-5' } }]])
        })

        // The ext system of the page is one value, and another widget of the page writes its own there when an upload
        // or a copy of its own ends. The answer of the read of the clicked tile says once more which ext system the
        // names of that asset are of, as it did when the click itself said nothing.
        it('are of the ext system of the picker again once the read of the clicked tile answers, whatever another widget wrote since the click', async () => {
          await pickerOpenedOnAFreshPage()
          const reads = holdReadsOf('asset-9')
          tiles()[0]!.click()
          await vi.waitFor(() => expect(reads.waiting).toHaveLength(1))
          expect(useExtSystemIdForCached().cachedExtSystemId.value).toBe(extSystem)

          // As another widget of the page does, of another ext system, when its copy into its licence is answered.
          useExtSystemIdForCached().cachedExtSystemId.value = OTHER_EXT_SYSTEM
          reads.answer()
          await vi.waitFor(() => expect(detail().asset?.id).toBe('asset-9'))

          expect(useExtSystemIdForCached().cachedExtSystemId.value).toBe(extSystem)
          expect(shownAlerts()).toEqual([])
        })

        // What the widget holds of an asset is what it read at that pick: a pick of the same asset reads it anew.
        it('are not offered for an asset picked again once it has authors: its image has them as its source', async () => {
          const widget = await pickedWithoutAuthors()
          await closeImageDialog()
          dam.assets.get('asset-9')!.authors = ['author-3']

          await pickInLibrary(widget, 'asset-9')

          expect(offered(widget)).toBeNull()
          expect(texts()).toEqual(['of asset-9', 'Name of author-3'])
        })
      })

      // The detail empties the store of the page as it opens, and the dialog lost its pick with it: it showed an
      // empty source that was not required, and the image went out without one though its asset had authors by then.
      describe('once the detail "edit asset" of that dialog opened has closed', () => {
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

        it('are offered no more when the asset has authors by then: the image takes their names as its source, which is required', async () => {
          const widget = await authorsSavedInDetail(['author-9', 'author-8'])
          // Until the detail closes the dialog is as it was.
          expect(offered(widget)).toEqual([])

          await closeDetail(widget)
          await vi.waitFor(() => expect(offered(widget)).toBeNull())
          await flushPromises()

          // The asset is read once more, by its id, and the names of its authors once.
          expect(detail().dialog).toBeNull()
          expect(readsOf('asset-9')).toHaveLength(2)
          expect(namesAskedOf('author-9,author-8')).toEqual([extSystem])
          expect(texts()).toEqual(['of asset-9', 'Name of author-9, Name of author-8'])
          expect(shownAlerts()).toEqual([])
          // The source is the image's own from here on, required as any.
          await typeSource('')
          confirmButton().click()
          await flushPromises()
          expect(shownAlerts()).toEqual([['error', alertText('common.alert.fixValidationErrors')]])
          expect(imagesWritten()).toEqual([])

          await typeSource('Name of author-9')
          await confirmImage(widget)
          // Only the save of the detail has written into the asset.
          expect(authorsWritten()).toEqual([[['asset-9', ['author-9', 'author-8']]]])
          expect(imagesWritten()).toMatchObject([
            ['createImage', { texts: { source: 'Name of author-9' }, dam: { damId: 'file-of-asset-9' } }],
          ])
        })

        // What the user picked in the dialog before the detail was for an asset without authors.
        it('give way to the authors of the detail: those picked in the dialog before are written nowhere', async () => {
          const widget = await pickedWithoutAuthors()
          damKeepsAuthors()
          await pickAuthors(widget, ['author-7'])
          await editAsset('asset-9')
          await saveInDetail(['author-9'])

          await closeDetail(widget)
          await vi.waitFor(() => expect(offered(widget)).toBeNull())
          await confirmImage(widget)

          expect(authorsWritten()).toEqual([[['asset-9', ['author-9']]]])
          expect(dam.assets.get('asset-9')!.authors).toEqual(['author-9'])
          expect(imagesWritten()).toMatchObject([['createImage', { texts: { source: 'Name of author-9' } }]])
        })

        // The detail saved something else, or nothing: the asset has no authors, and the dialog goes on offering them.
        it('are offered on while the asset has none, with those picked before, which "confirm" saves into it', async () => {
          const widget = await pickedWithoutAuthors()
          damKeepsAuthors()
          await pickAuthors(widget, ['author-7'])
          await editAsset('asset-9')
          await saveInDetail([])

          await closeDetail(widget)
          await vi.waitFor(() => expect(readsOf('asset-9')).toHaveLength(2))
          await waits.settle()

          expect(offered(widget)).toEqual(['author-7'])
          expect(texts()).toEqual(['of asset-9'])
          expect(shownAlerts()).toEqual([])
          await confirmImage(widget)
          expect(authorsWritten()).toEqual([[['asset-9', []]], [['asset-9', ['author-7']]]])
          expect(imagesWritten()).toMatchObject([['createImage', { texts: { source: 'Name of author-7' } }]])
        })

        // The form of the detail is not locked while its save runs, and the detail can be closed before the DAM answers
        // it: read at once, the asset would be as it was before that save.
        it('are read once the DAM has answered a save of the detail that is on its way when it closes', async () => {
          const widget = await pickedWithoutAuthors()
          await editAsset('asset-9')
          await mountDetailForm()
          const saves = dam.hold('PATCH', dam.routes.bulkMetadata)
          // An author is picked in the detail, "save" is pressed, and the detail closed at once.
          detail().asset!.authors = ['author-9']
          document.body.querySelector<HTMLButtonElement>('[data-cy="button-save"]')!.click()
          await vi.waitFor(() => expect(saves.waiting).toHaveLength(1))
          detailForm!.unmount()
          detailForm = undefined
          await closeDetail(widget)
          await waits.settle()

          expect(readsOf('asset-9')).toHaveLength(1)
          expect(offered(widget)).toEqual([])

          saves.waiting.forEach(({ request }) => keepAuthorsOf(request))
          saves.release()
          await vi.waitFor(() => expect(offered(widget)).toBeNull())

          expect(readsOf('asset-9')).toHaveLength(2)
          expect(texts()).toEqual(['of asset-9', 'Name of author-9'])
        })

        // The licence of an asset need not be the one the widget uploads into: the names are those of the ext system
        // of the licence the asset is in, whatever ext system the page asks for names under by then.
        it('are named under the ext system of the licence of the asset', async () => {
          inTheDam('asset-9', [], OTHER)
          const widget = await mountWidget()
          await pickInLibrary(widget, 'asset-9', OTHER)
          expect(offered(widget)).toEqual([])
          damKeepsAuthors()
          await editAsset('asset-9')
          await saveInDetail(['author-9'])
          // Another widget of the page has set it meanwhile.
          useExtSystemIdForCached().cachedExtSystemId.value = extSystem

          await closeDetail(widget)
          await vi.waitFor(() => expect(offered(widget)).toBeNull())

          expect(namesAskedOf('author-9')).toEqual([OTHER_EXT_SYSTEM])
          expect(texts()).toEqual(['of asset-9', 'Name of author-9'])
        })

        // What the widget holds may be stale by then: the dialog shows the source in place of the pick, till it shows
        // the image anew. It kept offering the pick.
        it.each<[string, () => unknown]>([
          [
            'the asset cannot be read',
            () =>
              dam.reply((request) =>
                request.method === 'GET' && request.url === `${endPoints.asset}/asset-9` ? { status: 500 } : undefined
              ),
          ],
          [
            'the names of its authors cannot be read',
            () =>
              dam.reply((request) =>
                DAM_NAMES.test(request.url) && request.url.includes('author-9') ? { status: 500 } : undefined
              ),
          ],
        ])('give way to the source, and the failure is said once, when %s', async (_what, refuse) => {
          const widget = await pickedWithoutAuthors()
          damKeepsAuthors()
          await pickAuthors(widget, ['author-7'])
          await editAsset('asset-9')
          await saveInDetail(['author-9'])
          refuse()

          await closeDetail(widget)
          await vi.waitFor(() => expect(shownAlerts()).toEqual([['error', alertText('common.alert.unknownError')]]))
          await waits.settle()

          expect(offered(widget)).toBeNull()
          expect(texts()).toEqual(['of asset-9', ''])
          expect(shownAlerts()).toEqual([['error', alertText('common.alert.unknownError')]])
        })

        // The read takes a moment, and the dialog offers its pick until it lands: a "confirm" in that moment waits for
        // it, or it would write what is picked in the dialog over the authors of the detail.
        it('hold "confirm" until the asset is read: the image is saved with the source that read gave it', async () => {
          const widget = await pickedWithoutAuthors()
          damKeepsAuthors()
          await pickAuthors(widget, ['author-7'])
          await editAsset('asset-9')
          await saveInDetail(['author-9'])
          const held = holdReadsOf('asset-9')

          await closeDetail(widget)
          await vi.waitFor(() => expect(held.waiting).toHaveLength(1))
          confirmButton().click()
          await waits.settle()
          expect(confirmButton().classList.contains('v-btn--loading')).toBe(true)
          expect(authorsWritten()).toEqual([[['asset-9', ['author-9']]]])
          expect(imagesWritten()).toEqual([])
          // Pressed again while it waits, it is taken once.
          confirmButton().click()

          held.answer()
          await vi.waitFor(() => expect(widget.emitted('afterMetadataSaveSuccess')).toHaveLength(1))
          await waits.settle()

          expect(authorsWritten()).toEqual([[['asset-9', ['author-9']]]])
          expect(dam.assets.get('asset-9')!.authors).toEqual(['author-9'])
          expect(imagesWritten()).toMatchObject([['createImage', { texts: { source: 'Name of author-9' } }]])
          expect(widget.emitted('afterMetadataSaveSuccess')).toHaveLength(1)
        })

        // The DAM names none of the authors: the source the read gave the image is empty, and the form asks for it.
        it('hold "confirm" until the asset is read: the form then asks for a source that read left empty', async () => {
          const widget = await authorsSavedInDetail(['author-9'])
          dam.reply((request) =>
            DAM_NAMES.test(request.url) && request.url.includes('author-9')
              ? { status: 200, data: { data: [], totalCount: 0 } }
              : undefined
          )
          const held = holdReadsOf('asset-9')

          await closeDetail(widget)
          await vi.waitFor(() => expect(held.waiting).toHaveLength(1))
          confirmButton().click()
          await waits.settle()
          expect(shownAlerts()).toEqual([])

          held.answer()
          await vi.waitFor(() =>
            expect(shownAlerts()).toEqual([['error', alertText('common.alert.fixValidationErrors')]])
          )

          expect(offered(widget)).toBeNull()
          expect(texts()).toEqual(['of asset-9', ''])
          expect(confirmButton().classList.contains('v-btn--loading')).toBe(false)
          expect(imagesWritten()).toEqual([])
        })

        /**
         * An image saved without an author, whose dialog offers the authors again; authors saved in the detail of its
         * asset, the detail closed and "confirm" pressed while the asset is read again, so it waits. Then the dialog is
         * closed, and opened again for the same image before the read answers. Returns the widget and the held read.
         */
        const confirmWaitedAndDialogOpenedAgain = async () => {
          const widget = await pickedWithoutAuthors()
          await confirmImage(widget)
          damKeepsAuthors()
          await editImage(widget)
          await editAsset('asset-9')
          await saveInDetail(['author-9'])
          const held = holdReadsOf('asset-9')
          await closeDetail(widget)
          await vi.waitFor(() => expect(held.waiting).toHaveLength(1))
          confirmButton().click()
          await waits.settle()
          expect(confirmButton().classList.contains('v-btn--loading')).toBe(true)

          await closeImageDialog()
          await editImage(widget)
          return { widget, held }
        }

        // The dialog can be closed while its confirm waits. The wait was not the dialog's: it ended in whatever dialog
        // was open by then, and the one opened again was confirmed, and its image saved, without a press.
        it('drop a "confirm" that waits when the dialog closes: opened again before the asset is read, it is not confirmed without a press', async () => {
          const { widget, held } = await confirmWaitedAndDialogOpenedAgain()
          // The confirm that waited went with the dialog it was pressed in.
          expect(confirmButton().classList.contains('v-btn--loading')).toBe(false)

          // The dialog opened again loads till the read of the detail, still on its way, has answered.
          held.answer()
          await vi.waitFor(() => expect(confirmButton().disabled).toBe(false))
          // The read of the detail serves the dialog opened again: the asset is not read a second time.
          expect(held.waiting).toEqual([])
          await damNamesAsked()
          await waits.settle()
          expect(offered(widget)).toBeNull()

          expect(imageDialog()).toBeDefined()
          expect(imagesWritten()).toHaveLength(1)
          expect(widget.emitted('afterMetadataSaveSuccess')).toHaveLength(1)
          // The read was for this image and its asset, whichever opening of the dialog shows it: it has its source.
          expect(texts()).toEqual(['of asset-9', 'Name of author-9'])

          await confirmImage(widget)
          expect(imagesWritten().at(-1)).toMatchObject(['updateImage', 501, { texts: { source: 'Name of author-9' } }])
          expect(authorsWritten()).toEqual([[['asset-9', ['author-9']]]])
        })

        // The dialog opened again loads till the read of the detail has answered: a press is taken only once it shows
        // the image.
        it('take a "confirm" pressed anew in the dialog opened again once it has read the asset anew: the image is saved once', async () => {
          const { widget, held } = await confirmWaitedAndDialogOpenedAgain()

          expect(confirmButton().disabled).toBe(true)
          confirmButton().click()
          await waits.settle()
          expect(imagesWritten()).toHaveLength(1)
          held.answer()
          await vi.waitFor(() => expect(confirmButton().disabled).toBe(false))
          // The read of the detail serves the dialog opened again: the asset is not read a second time.
          expect(held.waiting).toEqual([])
          await damNamesAsked()
          expect(imagesWritten()).toHaveLength(1)
          confirmButton().click()
          await vi.waitFor(() => expect(widget.emitted('afterMetadataSaveSuccess')).toHaveLength(2))
          await waits.settle()

          expect(imagesWritten()).toHaveLength(2)
          expect(imagesWritten().at(-1)).toMatchObject(['updateImage', 501, { texts: { source: 'Name of author-9' } }])
          expect(widget.emitted('afterMetadataSaveSuccess')).toHaveLength(2)
          expect(authorsWritten()).toEqual([[['asset-9', ['author-9']]]])
        })

        // With `expandMetadata` the form is in the page and never closes: its host confirms it, and a pick made while
        // that confirm waits puts the image of another asset into it.
        it('drop a "confirm" of the host that waits when another asset is picked into the form drawn in the page', async () => {
          inTheDam('asset-9')
          inTheDam('asset-10')
          const widget = await mountWidget(null, QUEUE, { expandMetadata: true })
          const pickIntoTheForm = async (asset: string) => {
            widget.findComponent(PickerStandIn).vm.$emit('confirm', { type: 'asset', value: [listed(asset)] })
            await vi.waitFor(() =>
              expect(useImageMediaWidgetStore(pinia).detail).toMatchObject({ dam: { damId: `file-of-${asset}` } })
            )
            await vi.waitFor(() => expect(offered(widget)).toEqual([]))
            await flushPromises()
          }
          await pickIntoTheForm('asset-9')
          damKeepsAuthors()
          await widget
            .findAll('button')
            .find((button) => button.text() === useCommonAdminCoreDamOptions().editAssetLabel)!
            .trigger('click')
          await vi.waitFor(() => expect(detail().asset?.id).toBe('asset-9'))
          await flushPromises()
          await saveInDetail(['author-9'])
          const held = holdReadsOf('asset-9')
          await closeDetail(widget)
          await vi.waitFor(() => expect(held.waiting).toHaveLength(1))
          ;(widget.vm as unknown as { metadataConfirm: () => void }).metadataConfirm()
          await waits.settle()
          expect(imagesWritten()).toEqual([])

          await pickIntoTheForm('asset-10')
          held.answer()
          await damNamesAsked()
          await waits.settle()

          expect(imagesWritten()).toEqual([])
          expect(widget.emitted('afterMetadataSaveSuccess')).toBeUndefined()
          expect(offered(widget)).toEqual([])
          expect(useImageMediaWidgetStore(pinia).detail).toMatchObject({
            texts: { source: '' },
            dam: { damId: 'file-of-asset-10' },
          })
        })

        // The save of the dialog runs: its write of the authors is on its way. "Edit asset" is pressed meanwhile, the
        // detail closed, and "confirm" pressed again while the asset is read once more: no second save comes of it.
        it('take no second "confirm" while a save of the dialog runs and the asset is read again', async () => {
          const widget = await pickedWithoutAuthors()
          await pickAuthors(widget, ['author-7'])
          const saves = dam.hold('PATCH', dam.routes.bulkMetadata)
          confirmButton().click()
          await vi.waitFor(() => expect(saves.waiting).toHaveLength(1))
          await editAsset('asset-9')
          const held = holdReadsOf('asset-9')
          await closeDetail(widget)
          await vi.waitFor(() => expect(held.waiting).toHaveLength(1))

          confirmButton().click()
          held.answer()
          await damNamesAsked()
          await waits.settle()
          expect(saves.waiting).toHaveLength(1)
          saves.release()
          await vi.waitFor(() => expect(widget.emitted('afterMetadataSaveSuccess')).toHaveLength(1))
          await waits.settle()

          expect(authorsWritten()).toEqual([[['asset-9', ['author-7']]]])
          expect(imagesWritten()).toMatchObject([['createImage', { texts: { source: 'Name of author-7' } }]])
          expect(shownAlerts().filter(([colour]) => colour === 'error')).toEqual([])
        })

        // The image was saved without an author, and its dialog offers them again. Closed before the read answers,
        // the dialog is given nothing, and neither is the image the widget has. The widget holds the asset on: opened
        // again, the dialog reads it anew and gives the empty source their names. It dropped the asset, and the source
        // was typed by hand.
        it('are written nowhere when the dialog of the image was closed before the asset is read, and named in the source once it is opened again', async () => {
          const widget = await pickedWithoutAuthors()
          await confirmImage(widget)
          damKeepsAuthors()
          await editImage(widget)
          await editAsset('asset-9')
          await saveInDetail(['author-9'])
          const held = holdReadsOf('asset-9')

          await closeDetail(widget)
          await vi.waitFor(() => expect(held.waiting).toHaveLength(1))
          await closeImageDialog()
          held.answer()
          await damNamesAsked()
          await waits.settle()

          expect(useImageMediaWidgetStore(pinia).detail).toBeNull()
          expect(imagesWritten()).toHaveLength(1)
          expect(shownAlerts()).toEqual([])
          await editImage(widget)
          await waits.settle()
          held.answer()
          await vi.waitFor(() => expect(texts()).toEqual(['of asset-9', 'Name of author-9']))
          expect(offered(widget)).toBeNull()
          expect(imagesWritten()).toHaveLength(1)
        })

        // The dialog shows the image the widget has, of another file, by the time the read answers.
        it('are written nowhere when the dialog shows the image the widget has by the time the asset is read', async () => {
          const widget = await pickedWithoutAuthors('asset-9', 7)
          damKeepsAuthors()
          await editAsset('asset-9')
          await saveInDetail(['author-9'])
          const held = holdReadsOf('asset-9')

          await closeDetail(widget)
          await vi.waitFor(() => expect(held.waiting).toHaveLength(1))
          await closeImageDialog()
          await editImage(widget)
          held.answer()
          await damNamesAsked()
          await waits.settle()

          expect(offered(widget)).toBeNull()
          expect(texts()).toEqual(['image 7', 'source 7'])
          expect(shownAlerts()).toEqual([])
        })

        // The widget still holds the asset of a pick that was closed without a save, and "edit asset" is pressed in
        // the dialog of the image it has: that dialog offers no authors, so nothing is read when its detail closes.
        it('are not read after "edit asset" of the image the widget has, whose dialog shows its source', async () => {
          inTheDam('asset-9')
          inTheDam('asset-7')
          imageApi.has(stored(7, 'file-of-asset-7'))
          const widget = await mountWidget(7)
          await pickInLibrary(widget, 'asset-9')
          expect(offered(widget)).toEqual([])
          await closeImageDialog()
          await editImage(widget)
          damKeepsAuthors()

          await editAsset('asset-7')
          await saveInDetail(['author-9'])
          await closeDetail(widget)
          await waits.settle()

          expect(readsOf('asset-9')).toHaveLength(1)
          expect(readsOf('asset-7')).toEqual([])
          expect(namesAskedOf('author-9')).toEqual([])
          expect(offered(widget)).toBeNull()
          expect(texts()).toEqual(['image 7', 'source 7'])
        })

        // Another asset is picked before the read answers: the dialog shows its image, which is not the one read for.
        it('are written nowhere when the dialog shows the image of another pick by the time the asset is read', async () => {
          const widget = await authorsSavedInDetail(['author-9'])
          inTheDam('asset-10')
          const held = holdReadsOf('asset-9')

          await closeDetail(widget)
          await vi.waitFor(() => expect(held.waiting).toHaveLength(1))
          await pickInLibrary(widget, 'asset-10')
          await pickAuthors(widget, ['author-7'])
          held.answer()
          await damNamesAsked()
          await waits.settle()

          expect(offered(widget)).toEqual(['author-7'])
          expect(texts()).toEqual(['of asset-10'])
          expect(useImageMediaWidgetStore(pinia).detail).toMatchObject({
            texts: { source: '' },
            dam: { damId: 'file-of-asset-10' },
          })
          await confirmImage(widget)
          expect(authorsWritten()).toEqual([[['asset-9', ['author-9']]], [['asset-10', ['author-7']]]])
          expect(imagesWritten()).toMatchObject([['createImage', { texts: { source: 'Name of author-7' } }]])
        })

        it.each<[string, FakeDamAnswer | undefined]>([
          ['answers', undefined],
          ['fails', { status: 500 }],
        ])(
          'are written nowhere, and nothing is said, when the widget is gone by the time the read %s',
          async (_how, answer) => {
            const widget = await authorsSavedInDetail(['author-9'])
            const held = holdReadsOf('asset-9')
            await closeDetail(widget)
            await vi.waitFor(() => expect(held.waiting).toHaveLength(1))
            const image = JSON.stringify(useImageMediaWidgetStore(pinia).detail)

            widget.unmount()
            widgets = []
            held.answer(answer)
            await damNamesAsked()
            await waits.settle()

            expect(JSON.stringify(useImageMediaWidgetStore(pinia).detail)).toBe(image)
            expect(shownAlerts()).toEqual([])
          }
        )

        // The form in the page (`expandMetadata`) keeps the pick when the widget turns read-only: the names of the
        // authors the detail gave the asset do not go into it. (A dialog closes as its cancel does, and its image
        // goes with it.)
        it('are written nowhere when the widget has turned read-only by the time the asset is read', async () => {
          inTheDam('asset-9')
          const widget = await mountWidget(null, QUEUE, { expandMetadata: true })
          widget
            .findComponent(PickerStandIn)
            .vm.$emit('confirm', { type: 'asset', value: [listed('asset-9', licence)] })
          await vi.waitFor(() =>
            expect(useImageMediaWidgetStore(pinia).detail).toMatchObject({ dam: { damId: 'file-of-asset-9' } })
          )
          await vi.waitFor(() => expect(offered(widget)).toEqual([]))
          damKeepsAuthors()
          await widget
            .findAll('button')
            .find((button) => button.text() === useCommonAdminCoreDamOptions().editAssetLabel)!
            .trigger('click')
          await vi.waitFor(() => expect(detail().asset?.id).toBe('asset-9'))
          await flushPromises()
          await saveInDetail(['author-9'])
          const held = holdReadsOf('asset-9')
          await closeDetail(widget)
          await vi.waitFor(() => expect(held.waiting).toHaveLength(1))

          await widget.setProps({ readonly: true })
          held.answer()
          await damNamesAsked()
          await waits.settle()

          expect(useImageMediaWidgetStore(pinia).detail).toMatchObject({
            dam: { damId: 'file-of-asset-9' },
            texts: { source: '' },
          })
          expect(shownAlerts()).toEqual([])
        })

        // Nothing was saved in a detail that showed no asset. The dialog keeps the pick of the asset the widget holds:
        // it used to lose it as the detail opened.
        it('are offered as before after a detail closed from its loader: nothing is read', async () => {
          const widget = await pickedWithoutAuthors()
          await pickAuthors(widget, ['author-7'])
          const held = dam.hold('GET', dam.routes.byFile)
          pressEditAsset()
          await vi.waitFor(() => expect(held.waiting).toHaveLength(1))

          await closeDetail(widget)
          held.release()
          await waits.settle()

          expect([detail().dialog, detail().asset]).toEqual([null, null])
          expect(readsOf('asset-9')).toHaveLength(1)
          expect(offered(widget)).toEqual(['author-7'])
          expect(shownAlerts()).toEqual([])
          await confirmImage(widget)
          expect(authorsWritten()).toEqual([[['asset-9', ['author-7']]]])
        })

        it('are offered as before after a detail whose asset could not be read: it closes by itself, and nothing more is read', async () => {
          const widget = await pickedWithoutAuthors()
          await pickAuthors(widget, ['author-7'])
          dam.reply((request) =>
            request.method === 'GET' && dam.routes.byFile.test(request.url) ? { status: 404 } : undefined
          )

          pressEditAsset()
          await vi.waitFor(() => expect(shownAlerts()).toHaveLength(1))
          await waits.settle()

          expect([detail().dialog, detail().asset]).toEqual([null, null])
          expect(readsOf('asset-9')).toHaveLength(1)
          expect(offered(widget)).toEqual(['author-7'])
          expect(shownAlerts()).toEqual([['error', alertText('common.alert.unknownError')]])
        })
      })
    }

    // "Confirm" of the dialog, pressed again while the save the first press began is on its way. The button of the
    // dialog spins but still takes Enter, and the button of a host that draws the form in its own dialog (the embed
    // dialogs of the two applications, through `metadataConfirm`) is not disabled while the image is saved: every
    // press went on to save, a new image was created twice, and the host put it into its text twice.
    describe('whose "confirm" is pressed again while the image is being saved', () => {
      const SOURCE = isCms ? ['author-3'] : []
      /** An asset picked into the dialog, which shows its source: its save writes nothing into the DAM. */
      const pickedWithSource = async (image: number | null = null) => {
        inTheDam('asset-9', SOURCE)
        if (!isNull(image)) imageApi.has(stored(image))
        const widget = await mountWidget(image)
        await pickInLibrary(widget, 'asset-9')
        expect(offered(widget)).toBeNull()
        return widget
      }
      /** As a host confirms the form: by the method the widget exposes. */
      const confirmAsHost = (widget: VueWrapper) =>
        (widget.vm as unknown as { metadataConfirm: () => void }).metadataConfirm()
      const spins = () => confirmButton().classList.contains('v-btn--loading')

      it.each<[string, number | null, string]>([
        ['creates the new image', null, 'createImage'],
        ['updates the image the widget has', 7, 'updateImage'],
      ])('%s once', async (_what, image, call) => {
        const widget = await pickedWithSource(image)
        const saves = imageApi.holdSaves()

        confirmButton().click()
        await vi.waitFor(() => expect(saves.waiting).toHaveLength(1))
        expect(spins()).toBe(true)
        // By the button of the dialog, and as a host does.
        confirmButton().click()
        confirmAsHost(widget)
        await waits.settle()
        expect(imagesWritten()).toHaveLength(1)

        saves.release()
        await vi.waitFor(() => expect(widget.emitted('afterMetadataSaveSuccess')).toHaveLength(1))
        await waits.settle()

        expect(imagesWritten().map(([name]) => name)).toEqual([call])
        expect(widget.emitted('afterMetadataSaveSuccess')).toHaveLength(1)
        expect(imageDialog()).toBeUndefined()
        expect(shownAlerts().filter(([colour]) => colour === 'error')).toEqual([])
      })

      // The form is in the page of the host and never closes: two presses of its button are two calls in a row.
      it('saves once for a host that confirms the form drawn in its page twice', async () => {
        inTheDam('asset-9', SOURCE)
        const widget = await mountWidget(null, QUEUE, { expandMetadata: true })
        widget.findComponent(PickerStandIn).vm.$emit('confirm', { type: 'asset', value: [listed('asset-9')] })
        await vi.waitFor(() =>
          expect(useImageMediaWidgetStore(pinia).detail).toMatchObject({ dam: { damId: 'file-of-asset-9' } })
        )
        await flushPromises()
        const saves = imageApi.holdSaves()

        confirmAsHost(widget)
        await vi.waitFor(() => expect(saves.waiting).toHaveLength(1))
        confirmAsHost(widget)
        confirmAsHost(widget)
        await waits.settle()
        expect(imagesWritten()).toHaveLength(1)

        saves.release()
        await vi.waitFor(() => expect(widget.emitted('afterMetadataSaveSuccess')).toHaveLength(1))
        await waits.settle()

        expect(imagesWritten().map(([name]) => name)).toEqual(['createImage'])
        expect(widget.emitted('afterMetadataSaveSuccess')).toHaveLength(1)
      })

      it('is taken again once that save has failed: the dialog stays, and the next press saves the image', async () => {
        const widget = await pickedWithSource()
        const saves = imageApi.holdSaves()
        confirmButton().click()
        await vi.waitFor(() => expect(saves.waiting).toHaveLength(1))

        saves.release('failed')
        await vi.waitFor(() => expect(spins()).toBe(false))
        await waits.settle()
        expect(widget.emitted('afterMetadataSaveSuccess')).toBeUndefined()
        expect(imageDialog()).toBeDefined()

        confirmButton().click()
        await vi.waitFor(() => expect(saves.waiting).toHaveLength(1))
        saves.release()
        await vi.waitFor(() => expect(widget.emitted('afterMetadataSaveSuccess')).toHaveLength(1))

        expect(imagesWritten().map(([name]) => name)).toEqual(['createImage', 'createImage'])
        expect(imageDialog()).toBeUndefined()
      })

      if (isCms) {
        // The save begins with the authors picked in the dialog: a second press asked for their names and wrote them
        // into the asset a second time, and saved a second image after them.
        it('writes the authors picked in the dialog into their asset once, and saves one image', async () => {
          const widget = await pickedWithoutAuthors()
          await pickAuthors(widget, ['author-7'])
          const writes = dam.hold('PATCH', dam.routes.bulkMetadata)

          confirmButton().click()
          await vi.waitFor(() => expect(writes.waiting).toHaveLength(1))
          confirmButton().click()
          confirmAsHost(widget)
          await waits.settle()
          expect(authorsWritten()).toHaveLength(1)

          writes.release()
          await vi.waitFor(() => expect(widget.emitted('afterMetadataSaveSuccess')).toHaveLength(1))
          await waits.settle()

          expect(authorsWritten()).toEqual([[['asset-9', ['author-7']]]])
          expect(imagesWritten()).toMatchObject([['createImage', { texts: { source: 'Name of author-7' } }]])
          expect(widget.emitted('afterMetadataSaveSuccess')).toHaveLength(1)
        })

        const NAMES_OF_AUTHOR_7 = /^\/adm\/v1\/author\/ext-system\/\d+\/search\?.*author-7/
        const author7Named = {
          status: 200,
          data: {
            data: [{ id: 'author-7', name: 'Name of author-7', identifier: '', flags: { reviewed: true } }],
            totalCount: 1,
          },
        }

        // The dialog closed while the names of the picked authors are read, and not opened again: the user has left it,
        // and nothing more comes of its confirm. The names used to be written into the image right after their read,
        // which ended the confirm there; kept aside, they let it go on, and the authors were written into the asset.
        it('ends when its dialog was closed while the names of the picked authors were read: nothing is written or said, and the next "confirm" is taken', async () => {
          const widget = await pickedWithoutAuthors('asset-9', 7)
          await pickAuthors(widget, ['author-7'])
          // What the caches ask of the picked author is asked by now: the read held next is the one of "confirm".
          await damNamesAsked()
          const names = dam.hold('GET', NAMES_OF_AUTHOR_7)
          confirmButton().click()
          await vi.waitFor(() => expect(names.waiting).toHaveLength(1))

          await closeImageDialog()
          names.release(author7Named)
          await damNamesAsked()
          await waits.settle()

          expect(authorsWritten()).toEqual([])
          expect(imagesWritten()).toEqual([])
          expect(widget.emitted('afterMetadataSaveSuccess')).toBeUndefined()
          expect(shownAlerts()).toEqual([])

          await editImage(widget)
          expect(spins()).toBe(false)
          await confirmImage(widget)
          expect(imagesWritten()).toMatchObject([['updateImage', 7, { texts: { source: 'source 7' } }]])
          expect(authorsWritten()).toEqual([])
        })

        // A confirm is for the image it was pressed on. The dialog can be closed while the names of the picked authors
        // are read or the authors written, and opened again for the image the widget has: the confirm ends there. It
        // went on with the image the dialog showed by then, which was saved without a press, and its dialog closed.
        it.each<[string, boolean]>([
          ['the names of the authors of another are read', true],
          ['the DAM has taken the authors of another', false],
        ])(
          'saves nothing of the image the widget has and leaves its dialog open, when that dialog is the one open by the time %s',
          async (_when, atTheNames) => {
            const widget = await pickedWithoutAuthors('asset-9', 7)
            await pickAuthors(widget, ['author-7'])
            // What the caches ask of the picked author is asked by now: the read held next is the one of "confirm".
            await damNamesAsked()
            const held = atTheNames ? dam.hold('GET', NAMES_OF_AUTHOR_7) : dam.hold('PATCH', dam.routes.bulkMetadata)
            confirmButton().click()
            await vi.waitFor(() => expect(held.waiting).toHaveLength(1))

            await closeImageDialog()
            await editImage(widget)
            expect(texts()).toEqual(['image 7', 'source 7'])
            expect(spins()).toBe(true)
            held.release(atTheNames ? author7Named : undefined)
            await vi.waitFor(() => expect(spins()).toBe(false))
            await damNamesAsked()
            await waits.settle()

            // The authors are sent only by a confirm whose dialog still showed its image once their names were read.
            expect(authorsWritten()).toEqual(atTheNames ? [] : [[['asset-9', ['author-7']]]])
            expect(imagesWritten()).toEqual([])
            expect(widget.emitted('afterMetadataSaveSuccess')).toBeUndefined()
            expect(texts()).toEqual(['image 7', 'source 7'])
            expect(offered(widget)).toBeNull()
            expect(shownAlerts()).toEqual([])

            // The dialog that is open takes a confirm of its own.
            await confirmImage(widget)
            expect(imagesWritten()).toMatchObject([
              ['updateImage', 7, { texts: { description: 'image 7', source: 'source 7' }, dam: { damId: 'file-7' } }],
            ])
            expect(imageDialog()).toBeUndefined()
            expect(JSON.stringify(imagesWritten())).not.toContain('Name of author-7')
          }
        )
      }
    })

    // That text is the user's, whatever authors the asset gets. admin-ugc has no authors of the DAM, so its dialog
    // always shows the source; in admin-cms the dialog of an asset picked with its authors does.
    it('are not read after "edit asset" of a dialog that shows the source of its image, which stays as it is', async () => {
      inTheDam('asset-9', isCms ? ['author-3'] : [])
      const widget = await mountWidget()
      await pickInLibrary(widget, 'asset-9')
      const source = isCms ? 'Name of author-3' : 'B. Blogger'
      expect(offered(widget)).toBeNull()
      expect(texts()).toEqual(['of asset-9', source])
      damKeepsAuthors()

      await editAsset('asset-9')
      await saveInDetail(['author-9'])
      await closeDetail(widget)
      await waits.settle()

      expect(detail().dialog).toBeNull()
      expect(readsOf('asset-9')).toHaveLength(1)
      expect(namesAskedOf('author-9')).toEqual([])
      expect(offered(widget)).toBeNull()
      expect(texts()).toEqual(['of asset-9', source])
      expect(shownAlerts()).toEqual([])
    })
  })
})
