import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, type Pinia, setActivePinia } from 'pinia'
import { type Component, defineComponent, h, shallowRef } from 'vue'
import { type ConsumerImageApi, installConsumerImageApi } from '@/domains/dam/__tests__/support/consumerImageApi'
import { cmsConfiguration, installConsumerProfile } from '@/domains/dam/__tests__/support/consumerProfiles'
import { answerDamNames, damNamesAsked } from '@/domains/dam/__tests__/support/damNames'
import { createFakeDam, damAssetWithFile, type FakeDam } from '@/domains/dam/__tests__/support/fakeDam'
import { holdLongWaits, type LongWaits } from '@/domains/dam/__tests__/support/longWaits'
import { forgetAlerts, shownAlerts, signInToDam, signOutOfDam } from '@/domains/dam/__tests__/support/uploadUi'
import { useAssetSelectStore } from '@/domains/dam/assetSelect/store/assetSelectStore'
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
import { isNull } from '@/shared/utils/common'

// Guards a regression: the reads of a widget that has gone away must not write into the store.
// The embed dialogs draw the image form from the store of the image dialog, which is one for the page.
// A cancelled host takes its widget away, and the next opened widget has its own image in that store.
// Late answers of the first widget put its image or pick there, and the second form showed it.
// admin-cms only. The DAM and the image backend are request-recording clients; the asset picker is a stand-in.

const profile = cmsConfiguration
const { endPoints, extSystem, licence } = profile
const MEDIA = /^\/adm\/v1\/cms\/asset\/(.+)$/
const VIDEO = {
  title: 'A video',
  description: '',
  seriesName: '',
  authorNames: [],
  publishedAt: null,
  duration: 10,
  mediaUrl: '',
  playable: true,
  episodeName: '',
  episodeNumber: null,
}
const PickerStandIn = defineComponent({ name: 'AAssetSelect', emits: ['confirm'], setup: () => () => h('div') })

let pinia: Pinia
let dam: FakeDam
let imageApi: ConsumerImageApi
let waits: LongWaits
let widgets: VueWrapper[] = []

describe.each<[string, Component]>([
  ['the image widget', ImageWidgetInner],
  ['the image and media widget', ImageMediaWidgetInner],
])('%s that has gone away, and the widget mounted next, whose form is drawn in the page', (_name, component) => {
  const isImageWidget = component === ImageWidgetInner

  beforeEach(() => {
    pinia = createPinia()
    setActivePinia(pinia)
    dam = createFakeDam(endPoints)
    imageApi = installConsumerImageApi(profile, installConsumerProfile(profile, dam.client))
    answerDamNames(dam)
    dam.reply((request) => {
      const media = request.method === 'GET' ? request.url.match(MEDIA) : null
      return media ? { status: 200, data: media[1]!.startsWith('video') ? VIDEO : {} } : undefined
    })
    waits = holdLongWaits()
    forgetAlerts()
    signInToDam(extSystem)
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
  const shown = () => useImageMediaWidgetStore(pinia).detail
  const stored = (id: number): ImageAware => ({
    id,
    texts: { description: `image ${id}`, source: `source ${id}` },
    dam: { damId: `file-${id}`, licenceId: licence, regionPosition: 0, internal: false },
    flags: { showSource: true, internal: false, overrideInternal: false },
    position: 1,
  })
  const mountWidget = async (image: number | null, key: string) => {
    if (!isNull(image)) imageApi.has(stored(image))
    const mounted: VueWrapper = mount(component, {
      attachTo: document.body,
      props: {
        queueKey: key,
        uploadLicence: licence,
        selectLicences: [licence],
        expandOptions: true,
        expandMetadata: true,
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
      } as never,
      global: {
        plugins: [pinia],
        provide: { [ImageWidgetUploadConfigKey as symbol]: shallowRef(uploadConfig()) },
        stubs: {
          AAssetSelect: PickerStandIn,
          AAssetSelectMedia: PickerStandIn,
          UploadQueueDialogSingle: true,
          AssetDetailDialog: true,
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
  const takeAway = (widget: VueWrapper) => {
    widget.unmount()
    widgets = widgets.filter((one) => one !== widget)
  }
  const nextEmbed = async () => {
    const next = await mountWidget(8, 'another-embed')
    return next
  }
  // A growing text field has a hidden twin that measures it.
  const formOf = (widget: VueWrapper) =>
    Array.from((widget.element as Element).parentElement!.querySelectorAll<HTMLTextAreaElement>('textarea'))
      .filter((field) => field.getAttribute('aria-hidden') !== 'true')
      .map((field) => field.value)
  const showsItsOwnImage = (widget: VueWrapper) => {
    expect(shown()).toMatchObject({ id: 8, texts: { description: 'image 8' }, dam: { damId: 'file-8' } })
    expect(formOf(widget)).toEqual(['image 8', 'source 8'])
  }

  it('leaves that form its image when the read of its own image answers', async () => {
    const reads = imageApi.holdReads()
    const first = await mountWidget(7, 'embed')
    await vi.waitFor(() => expect(reads.waiting).toHaveLength(1))

    takeAway(first)
    const second = await nextEmbed()
    await vi.waitFor(() => expect(reads.waiting).toHaveLength(2))
    reads.waiting[1]!()
    await vi.waitFor(() => expect(shown()).toMatchObject({ id: 8 }))
    await flushPromises()
    showsItsOwnImage(second)

    reads.waiting[0]!()
    await waits.settle()

    showsItsOwnImage(second)
    expect(shownAlerts()).toEqual([])
  })

  it('leaves that form its image when the asset it picked in the library has been read', async () => {
    dam.assets.set(
      'asset-9',
      damAssetWithFile('asset-9', 'file-of-asset-9', AssetFileProcessStatus.Processed, {
        licence,
        authors: ['author-3'],
        metadata: { customData: { description: 'of asset-9' }, authorSuggestions: {}, keywordSuggestions: {} },
      })
    )
    const first = await mountWidget(null, 'embed')
    const read = dam.hold('GET', new RegExp(`^${endPoints.asset}/asset-9$`))
    first.findComponent(PickerStandIn).vm.$emit('confirm', {
      type: 'asset',
      value: [
        {
          id: 'asset-9',
          licence,
          mainFile: { id: 'file-of-asset-9' },
          mainFileInternal: false,
          attributes: { assetType: DamAssetType.Image },
          podcasts: [],
        },
      ],
    })
    await vi.waitFor(() => expect(read.waiting).toHaveLength(1))

    takeAway(first)
    const second = await nextEmbed()
    await vi.waitFor(() => expect(shown()).toMatchObject({ id: 8 }))
    await flushPromises()
    read.release()
    await damNamesAsked()
    await waits.settle()

    showsItsOwnImage(second)
    expect(shownAlerts()).toEqual([])
  })

  if (!isImageWidget) {
    it('leaves that form its image when the DAM has answered for a video it picked in the library', async () => {
      const first = await mountWidget(null, 'embed')
      const read = dam.hold('GET', /^\/adm\/v1\/cms\/asset\/video-1$/)
      first.findComponent(PickerStandIn).vm.$emit('confirm', {
        type: 'asset',
        value: [
          {
            id: 'video-1',
            licence,
            mainFile: { id: 'file-of-video-1', _resourceName: 'videoFile', imagePreview: null },
            mainFileInternal: false,
            attributes: { assetType: DamAssetType.Video },
            podcasts: [],
          },
        ],
      })
      await vi.waitFor(() => expect(read.waiting).toHaveLength(1))

      takeAway(first)
      const second = await nextEmbed()
      await vi.waitFor(() => expect(shown()).toMatchObject({ id: 8 }))
      await flushPromises()
      read.release({ status: 200, data: VIDEO })
      await waits.settle()

      showsItsOwnImage(second)
      expect(shownAlerts()).toEqual([])
    })
  }
})
