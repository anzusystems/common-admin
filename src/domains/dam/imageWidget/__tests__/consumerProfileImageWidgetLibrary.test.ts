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
import { answerDamNames, damNameLookups, damNamesAsked } from '@/domains/dam/__tests__/support/damNames'
import {
  createFakeDam,
  damAssetWithFile,
  type FakeDam,
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
import { useAssetDetailStore } from '@/domains/dam/assetDetail/store/assetDetailStore'
import AAssetSelect from '@/domains/dam/assetSelect/components/AAssetSelect.vue'
import AAssetSelectMedia from '@/domains/dam/assetSelect/components/AAssetSelectMedia.vue'
import { useAssetSelectStore } from '@/domains/dam/assetSelect/store/assetSelectStore'
import AuthorRemoteAutocompleteWithCached from '@/domains/dam/author/components/AuthorRemoteAutocompleteWithCached.vue'
import {
  initCommonAdminCoreDamOptions,
  useCommonAdminCoreDamOptions,
} from '@/domains/dam/composables/commonAdminCoreDamOptions'
import { useDamNotificationsEventBus } from '@/domains/dam/composables/damNotificationsEventBus'
import { useDamConfigStore } from '@/domains/dam/config/store/damConfigStore'
import AImageWidget from '@/domains/dam/imageWidget/components/AImageWidget.vue'
import ImageWidgetInner from '@/domains/dam/imageWidget/components/ImageWidgetInner.vue'
import { useImageMediaWidgetStore } from '@/domains/dam/imageWidget/store/imageMediaWidgetStore'
import { ImageWidgetUploadConfigKey } from '@/domains/dam/imageWidget/utils/imageWidgetInkectionKeys'
import type { AssetSelectMetadataToImageMapFn } from '@/domains/dam/imageWidget/utils/metadataToImageMap'
import { DamAssetType, type DamImageCopyToLicenceResponseItem } from '@/domains/dam/types/Asset'
import { AssetFileProcessStatus } from '@/domains/dam/types/AssetFile'
import type { ImageAware } from '@/domains/dam/types/ImageAware'
import { UploadQueueItemStatus, UploadQueueItemType } from '@/domains/dam/types/UploadQueue'
import { useUploadQueueDialog } from '@/domains/dam/uploadQueue/composables/useUploadQueueDialog'
import { useUploadQueuesStore } from '@/domains/dam/uploadQueue/store/uploadQueuesStore'
import type { IntegerId } from '@/shared/types/common'
import { isUndefined } from '@/shared/utils/common'

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
    const mountPicker = async (component: Component, props: Record<string, unknown> = {}) => {
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
          stubs: Object.fromEntries(ALWAYS_STAND_INS.map((name) => [name, true])),
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
        expect(useAssetDetailStore(pinia).asset?.id).toBe('asset-9')

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
