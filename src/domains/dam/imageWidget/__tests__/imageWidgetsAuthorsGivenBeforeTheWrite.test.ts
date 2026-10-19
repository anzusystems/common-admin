import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, type Pinia, setActivePinia } from 'pinia'
import { type Component, defineComponent, h, shallowRef } from 'vue'
import { type ConsumerImageApi, installConsumerImageApi } from '@/domains/dam/__tests__/support/consumerImageApi'
import { cmsConfiguration, installConsumerProfile } from '@/domains/dam/__tests__/support/consumerProfiles'
import { answerDamNames, damNamesAsked } from '@/domains/dam/__tests__/support/damNames'
import {
  createFakeDam,
  damAssetWithFile,
  type FakeDam,
  type FakeDamAnswer,
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
import { useAssetSelectStore } from '@/domains/dam/assetSelect/store/assetSelectStore'
import AuthorRemoteAutocompleteWithCached from '@/domains/dam/author/components/AuthorRemoteAutocompleteWithCached.vue'
import { useDamNotificationsEventBus } from '@/domains/dam/composables/damNotificationsEventBus'
import { useDamConfigStore } from '@/domains/dam/config/store/damConfigStore'
import ImageMediaWidgetInner from '@/domains/dam/imageWidget/components/ImageMediaWidgetInner.vue'
import ImageWidgetInner from '@/domains/dam/imageWidget/components/ImageWidgetInner.vue'
import { useImageMediaWidgetStore } from '@/domains/dam/imageWidget/store/imageMediaWidgetStore'
import { ImageWidgetUploadConfigKey } from '@/domains/dam/imageWidget/utils/imageWidgetInkectionKeys'
import { DamAssetType } from '@/domains/dam/types/Asset'
import { AssetFileProcessStatus } from '@/domains/dam/types/AssetFile'
import type { ImageAware } from '@/domains/dam/types/ImageAware'
import { useUploadQueueDialog } from '@/domains/dam/uploadQueue/composables/useUploadQueueDialog'
import { useAlertsQueue } from '@/domains/system/composables/alertsQueue'
import type { DocId } from '@/shared/types/common'
import { isNull } from '@/shared/utils/common'

// The lock of the field in a room with other editors: what the widget asks for and gives back, for the cases that
// give the widget a room. The others give it none, and it asks for no lock.
const lock = vi.hoisted(() => ({ acquired: [] as unknown[], released: [] as unknown[] }))
vi.mock('@/domains/collab/composables/commonAdminCollabOptions', async () => {
  const { ref } = await import('vue')
  return { useCommonAdminCollabOptions: () => ({ collabOptions: ref({ enabled: true }) }) }
})
vi.mock('@/domains/collab/composables/collabField', async () => {
  const { ref } = await import('vue')
  return {
    useCollabField: () => ({
      releaseCollabFieldLock: (value: unknown) => lock.released.push(value),
      acquireCollabFieldLock: () => lock.acquired.push(true),
      changeCollabFieldData: () => undefined,
      addCollabFieldLockStatusListener: () => undefined,
      lockedByUser: ref<number | null>(null),
    }),
  }
})

// "Confirm" of the dialog of the image of a widget of one image, with authors of the DAM picked in it: the authors of
// an asset picked in the library without authors. The DAM replaces the authors of the asset with what the widget
// sends, and the widget read the asset at its pick: authors the asset was given elsewhere since (in the DAM, by
// another editor, by another widget of the page) were written over. The asset is read again right before the write;
// once it has authors nothing is written, the dialog shows their names as the source of the image, and says so. The
// same for the form `expandMetadata` draws in the page, which its host confirms. admin-cms only: admin-ugc has no
// authors of the DAM. The real widgets with their real dialog of the image; the DAM and the backend of the images are
// clients that record their requests; the asset picker is a stand-in that answers as the real one does.

const QUEUE = 'lead-image'
const PickerStandIn = defineComponent({ name: 'AAssetSelect', emits: ['confirm'], setup: () => () => h('div') })
const MEDIA = /^\/adm\/v1\/cms\/asset\//

const profile = cmsConfiguration
const { endPoints, extSystem, licence } = profile

let pinia: Pinia
let dam: FakeDam
let imageApi: ConsumerImageApi
let waits: LongWaits
let widgets: VueWrapper[] = []

beforeEach(() => {
  pinia = createPinia()
  setActivePinia(pinia)
  dam = createFakeDam(endPoints)
  imageApi = installConsumerImageApi(profile, installConsumerProfile(profile, dam.client))
  answerDamNames(dam)
  // What the image and media widget asks about a picked asset first: here, it is no media.
  dam.reply((request) => (request.method === 'GET' && MEDIA.test(request.url) ? { status: 200, data: {} } : undefined))
  waits = holdLongWaits()
  forgetAlerts()
  signInToDam(extSystem)
  lock.acquired = []
  lock.released = []
})
afterEach(async () => {
  widgets.forEach((widget) => widget.unmount())
  widgets = []
  useUploadQueueDialog().uploadQueueDialog.value = null
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
/** What the DAM has for an asset: `file-of-<id>`, described, in the licence of the widget, without authors. */
const inTheDam = (id: string) =>
  dam.assets.set(
    id,
    damAssetWithFile(id, `file-of-${id}`, AssetFileProcessStatus.Processed, {
      licence,
      authors: [],
      metadata: { customData: { description: `of ${id}` }, authorSuggestions: {}, keywordSuggestions: {} },
    })
  )
/** The asset is given authors elsewhere: in the DAM, by another editor or another widget of the page. */
const givenAuthorsElsewhere = (id: string, authors: DocId[]) => {
  dam.assets.get(id)!.authors = authors
}
/** An asset as the list of the picker has it. */
const listed = (id: string) => ({
  id,
  licence,
  mainFile: { id: `file-of-${id}` },
  mainFileInternal: false,
  attributes: { assetType: DamAssetType.Image },
  podcasts: [],
})
/** An image the entity already has, of a file of its own. */
const stored = (id: number): ImageAware => ({
  id,
  texts: { description: `image ${id}`, source: `source ${id}` },
  dam: { damId: `file-${id}`, licenceId: licence, regionPosition: 0, internal: false },
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
const typeDescription = async (text: string) => {
  const description = fieldsIn(imageDialog()!)[0]!
  description.value = text
  description.dispatchEvent(new Event('input', { bubbles: true }))
  await flushPromises()
}
const confirmButton = () =>
  Array.from(imageDialog()!.querySelectorAll<HTMLButtonElement>('button')).find(
    (button) => button.textContent?.trim() === uiText('common.button.confirm')
  )!
const spins = () => confirmButton().classList.contains('v-btn--loading')
/** What each save of metadata wrote into the DAM: the asset and its authors. */
const authorsWritten = () =>
  dam
    .sentTo('PATCH', dam.routes.bulkMetadata)
    .map((request) =>
      (dam.body(request) as Array<{ id: DocId; authors?: DocId[] }>).map((one) => [one.id, one.authors])
    )
/** The reads of an asset by its id: what a pick reads, and what "confirm" reads again. */
const readsOf = (asset: DocId) =>
  dam.sentTo('GET', dam.routes.one).filter((request) => request.url === `${endPoints.asset}/${asset}`)
const imagesWritten = () => imageApi.calls.filter(([call]) => call === 'createImage' || call === 'updateImage')
/** The reads of an asset by its id wait; `answer` lets them answer with what the DAM has by then. */
const holdReadsOf = (asset: DocId) => {
  const held = dam.hold('GET', new RegExp(`^${endPoints.asset}/${asset}$`))
  return {
    waiting: held.waiting,
    answer: (given?: FakeDamAnswer) =>
      held.release(given ?? { status: 200, data: structuredClone(dam.assets.get(asset)) }),
  }
}
const givenMeanwhileSaid = [['warning', alertText('common.damImage.image.meta.authorsGivenMeanwhile')]]

describe.each<[string, Component]>([
  ['the image widget', ImageWidgetInner],
  ['the image and media widget', ImageMediaWidgetInner],
])('"confirm" of %s, with authors of the DAM picked in its dialog', (_name, component) => {
  const isImageWidget = component === ImageWidgetInner
  /** The widget with its buttons in a row, as it is in a form; `image`: the id of the image the entity has. */
  const mountWidget = async (image: number | null = null, more: Record<string, unknown> = {}) => {
    const mounted: VueWrapper = mount(component, {
      attachTo: document.body,
      props: {
        queueKey: QUEUE,
        uploadLicence: licence,
        selectLicences: [licence],
        expandOptions: true,
        ...(isImageWidget
          ? {
              modelValue: image,
              'onUpdate:modelValue': (value: number | null) => mounted.setProps({ modelValue: value }),
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
        stubs: {
          AAssetSelect: PickerStandIn,
          AAssetSelectMedia: PickerStandIn,
          UploadQueueDialogSingle: true,
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
  const pickInLibrary = (widget: VueWrapper) =>
    widget.findComponent(PickerStandIn).vm.$emit('confirm', { type: 'asset', value: [listed('asset-9')] })
  /** "Edit image" of the widget, once the dialog shows the image. */
  const editImage = async (widget: VueWrapper) => {
    const button = () =>
      widget.findAll('.a-image-widget__options button').find((one) => one.text() === damText('image.meta.edit'))
    await vi.waitFor(() => expect(button()).toBeDefined())
    await button()!.trigger('click')
    await vi.waitFor(() => expect(imageDialog()).toBeDefined())
    await vi.waitFor(() => expect(confirmButton().disabled).toBe(false))
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
  /** As a host confirms the form: by the method the widget exposes. */
  const confirmAsHost = (widget: VueWrapper) =>
    (widget.vm as unknown as { metadataConfirm: () => void }).metadataConfirm()
  const authorsInput = (widget: VueWrapper) => widget.findComponent(AuthorRemoteAutocompleteWithCached)
  /** What the dialog offers: the authors picked in it so far, or `null` where it shows the source. */
  const offered = (widget: VueWrapper) =>
    authorsInput(widget).exists() ? (authorsInput(widget).props('modelValue') as DocId[]) : null
  const pickAuthors = async (widget: VueWrapper, authors: DocId[]) => {
    authorsInput(widget).vm.$emit('update:modelValue', authors)
    await flushPromises()
  }
  /** The asset is picked in the library, and the dialog of its image offers the authors of the DAM. */
  const pickedWithoutAuthors = async (image: number | null = null) => {
    inTheDam('asset-9')
    if (!isNull(image)) imageApi.has(stored(image))
    const widget = await mountWidget(image)
    pickInLibrary(widget)
    await vi.waitFor(() =>
      expect(useImageMediaWidgetStore(pinia).detail).toMatchObject({ dam: { damId: 'file-of-asset-9' } })
    )
    await vi.waitFor(() => expect(confirmButton().disabled).toBe(false))
    await flushPromises()
    expect(offered(widget)).toEqual([])
    return widget
  }

  it('writes no authors over those the asset was given since: the dialog stays, with their names as the source, and its next "confirm" saves the image', async () => {
    const widget = await pickedWithoutAuthors()
    await confirmImage(widget)
    await editImage(widget)
    await typeDescription('typed')
    await pickAuthors(widget, ['author-5'])
    givenAuthorsElsewhere('asset-9', ['author-3'])

    confirmButton().click()
    await vi.waitFor(() => expect(shownAlerts()).toEqual(givenMeanwhileSaid))
    await flushPromises()

    // It stays till the user closes it.
    expect(useAlertsQueue().value.at(-1)!.timeout).toBe(-1)
    expect(uiText('common.damImage.image.meta.authorsGivenMeanwhile')).toBe(
      'The asset has been given authors in the Media Library in the meantime. If the image had no source of its own, ' +
        'it now has their names; the authors you picked were not saved. Check and confirm again.'
    )
    expect(readsOf('asset-9')).toHaveLength(3)
    expect(authorsWritten()).toEqual([])
    expect(imagesWritten()).toHaveLength(1)
    expect(imageDialog()).toBeDefined()
    expect(spins()).toBe(false)
    expect(offered(widget)).toBeNull()
    expect(texts()).toEqual(['typed', 'Name of author-3'])

    await confirmImage(widget)
    expect(authorsWritten()).toEqual([])
    expect(imagesWritten().at(-1)).toMatchObject([
      'updateImage',
      501,
      { texts: { description: 'typed', source: 'Name of author-3' } },
    ])
    expect(imageDialog()).toBeUndefined()
    expect(dam.assets.get('asset-9')!.authors).toEqual(['author-3'])
  })

  it('writes no authors over those the asset was given since, from the form drawn in the page that its host confirms', async () => {
    inTheDam('asset-9')
    const widget = await mountWidget(null, { expandMetadata: true })
    const confirmByHost = async () => {
      const saved = widget.emitted('afterMetadataSaveSuccess')?.length ?? 0
      confirmAsHost(widget)
      await vi.waitFor(() => expect(widget.emitted('afterMetadataSaveSuccess')).toHaveLength(saved + 1))
      await flushPromises()
    }
    pickInLibrary(widget)
    await vi.waitFor(() => expect(offered(widget)).toEqual([]))
    await flushPromises()
    await pickAuthors(widget, ['author-5'])
    givenAuthorsElsewhere('asset-9', ['author-3'])

    confirmAsHost(widget)
    await vi.waitFor(() => expect(shownAlerts()).toEqual(givenMeanwhileSaid))
    await flushPromises()

    expect(authorsWritten()).toEqual([])
    expect(imagesWritten()).toEqual([])
    expect(widget.emitted('afterMetadataSaveSuccess')).toBeUndefined()
    expect(offered(widget)).toBeNull()
    expect(useImageMediaWidgetStore(pinia).detail).toMatchObject({ texts: { source: 'Name of author-3' } })

    await confirmByHost()
    expect(imagesWritten()).toMatchObject([['createImage', { texts: { source: 'Name of author-3' } }]])
    expect(authorsWritten()).toEqual([])
  })

  it('saves nothing when the asset cannot be read again: that is said once, and the next "confirm" writes the pick', async () => {
    const widget = await pickedWithoutAuthors()
    await pickAuthors(widget, ['author-5'])
    const answerAgain = dam.reply((request) =>
      request.method === 'GET' && request.url === `${endPoints.asset}/asset-9` ? { status: 500 } : undefined
    )

    confirmButton().click()
    await vi.waitFor(() => expect(shownAlerts()).toEqual([['error', alertText('common.alert.unknownError')]]))
    await waits.settle()

    expect(authorsWritten()).toEqual([])
    expect(imagesWritten()).toEqual([])
    expect(imageDialog()).toBeDefined()
    expect(spins()).toBe(false)
    expect(offered(widget)).toEqual(['author-5'])

    answerAgain()
    await confirmImage(widget)
    expect(authorsWritten()).toEqual([[['asset-9', ['author-5']]]])
    expect(imagesWritten()).toMatchObject([['createImage', { texts: { source: 'Name of author-5' } }]])
    expect(shownAlerts()).toHaveLength(1)
  })

  it('reads the asset once for a "confirm" pressed again while it is read, and saves once', async () => {
    const widget = await pickedWithoutAuthors()
    await pickAuthors(widget, ['author-5'])
    const reads = holdReadsOf('asset-9')

    confirmButton().click()
    await vi.waitFor(() => expect(reads.waiting).toHaveLength(1))
    expect(spins()).toBe(true)
    confirmButton().click()
    confirmAsHost(widget)
    await waits.settle()
    expect(reads.waiting).toHaveLength(1)
    expect(authorsWritten()).toEqual([])

    reads.answer()
    await vi.waitFor(() => expect(widget.emitted('afterMetadataSaveSuccess')).toHaveLength(1))
    await waits.settle()

    expect(readsOf('asset-9')).toHaveLength(2)
    expect(authorsWritten()).toEqual([[['asset-9', ['author-5']]]])
    expect(imagesWritten()).toMatchObject([['createImage', { texts: { source: 'Name of author-5' } }]])
    expect(widget.emitted('afterMetadataSaveSuccess')).toHaveLength(1)
  })

  it.each<[string, FakeDamAnswer | undefined]>([
    ['finds authors', undefined],
    ['fails', { status: 500 }],
  ])(
    'writes nothing and says nothing when the dialog was closed before the read %s: the image the widget has is as it was',
    async (_what, answer) => {
      const widget = await pickedWithoutAuthors(7)
      await pickAuthors(widget, ['author-5'])
      givenAuthorsElsewhere('asset-9', ['author-3'])
      const reads = holdReadsOf('asset-9')
      confirmButton().click()
      await vi.waitFor(() => expect(reads.waiting).toHaveLength(1))

      await closeImageDialog()
      reads.answer(answer)
      await damNamesAsked()
      await waits.settle()

      expect(shownAlerts()).toEqual([])
      expect(authorsWritten()).toEqual([])
      expect(imagesWritten()).toEqual([])
      expect(widget.emitted('afterMetadataSaveSuccess')).toBeUndefined()
      await editImage(widget)
      expect(texts()).toEqual(['image 7', 'source 7'])
      expect(spins()).toBe(false)
    }
  )

  it.each<[string, 'read-only' | 'gone', boolean]>([
    ['turned read-only, and the read finds no authors', 'read-only', false],
    ['turned read-only, and the read finds authors', 'read-only', true],
    ['is gone, and the read finds no authors', 'gone', false],
    ['is gone, and the read finds authors', 'gone', true],
  ])('writes nothing and says nothing when the widget %s', async (_what, how, given) => {
    const widget = await pickedWithoutAuthors()
    await pickAuthors(widget, ['author-5'])
    if (given) givenAuthorsElsewhere('asset-9', ['author-3'])
    const reads = holdReadsOf('asset-9')
    confirmButton().click()
    await vi.waitFor(() => expect(reads.waiting).toHaveLength(1))

    if (how === 'gone') {
      widget.unmount()
      widgets = []
    } else {
      await widget.setProps({ readonly: true })
    }
    reads.answer()
    await damNamesAsked()
    await waits.settle()

    expect(authorsWritten()).toEqual([])
    expect(imagesWritten()).toEqual([])
    expect(widget.emitted('afterMetadataSaveSuccess')).toBeUndefined()
    expect(shownAlerts()).toEqual([])
  })

  // In a room with other editors the dialog holds the lock of the field: it stays with it while it stays open.
  it('keeps the lock of the field with the dialog that stays, and gives it back with the image its next "confirm" saves', async () => {
    inTheDam('asset-9')
    const widget = await mountWidget(null, {
      collab: { room: 'article:1', field: 'listingImage', cachedUsers: new Map() },
      collabStatus: 'active',
    })
    pickInLibrary(widget)
    await vi.waitFor(() => expect(confirmButton().disabled).toBe(false))
    await flushPromises()
    await pickAuthors(widget, ['author-5'])
    givenAuthorsElsewhere('asset-9', ['author-3'])
    expect(lock.acquired).toHaveLength(1)

    confirmButton().click()
    await vi.waitFor(() => expect(shownAlerts()).toEqual(givenMeanwhileSaid))
    await waits.settle()

    expect(imageDialog()).toBeDefined()
    expect(lock.released).toEqual([])

    await confirmImage(widget)
    expect(authorsWritten()).toEqual([])
    expect(lock.acquired).toHaveLength(1)
    expect(lock.released).toEqual([isImageWidget ? 501 : { image: 501, media: null }])
  })
})
