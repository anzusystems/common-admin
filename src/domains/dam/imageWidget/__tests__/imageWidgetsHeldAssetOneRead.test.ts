import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, type Pinia, setActivePinia } from 'pinia'
import { type Component, defineComponent, h, shallowRef } from 'vue'
import { installConsumerImageApi } from '@/domains/dam/__tests__/support/consumerImageApi'
import { cmsConfiguration, installConsumerProfile } from '@/domains/dam/__tests__/support/consumerProfiles'
import { answerDamNames, damNamesAsked } from '@/domains/dam/__tests__/support/damNames'
import { createFakeDam, damAssetWithFile, type FakeDam } from '@/domains/dam/__tests__/support/fakeDam'
import { holdLongWaits, type LongWaits } from '@/domains/dam/__tests__/support/longWaits'
import { damText, forgetAlerts, signInToDam, signOutOfDam, uiText } from '@/domains/dam/__tests__/support/uploadUi'
import { useAssetDetailStore } from '@/domains/dam/assetDetail/store/assetDetailStore'
import { useAssetSelectStore } from '@/domains/dam/assetSelect/store/assetSelectStore'
import AuthorRemoteAutocompleteWithCached from '@/domains/dam/author/components/AuthorRemoteAutocompleteWithCached.vue'
import { useCommonAdminCoreDamOptions } from '@/domains/dam/composables/commonAdminCoreDamOptions'
import { useDamNotificationsEventBus } from '@/domains/dam/composables/damNotificationsEventBus'
import { useDamConfigStore } from '@/domains/dam/config/store/damConfigStore'
import ImageMediaWidgetInner from '@/domains/dam/imageWidget/components/ImageMediaWidgetInner.vue'
import ImageWidgetInner from '@/domains/dam/imageWidget/components/ImageWidgetInner.vue'
import { useImageMediaWidgetStore } from '@/domains/dam/imageWidget/store/imageMediaWidgetStore'
import { ImageWidgetUploadConfigKey } from '@/domains/dam/imageWidget/utils/imageWidgetInkectionKeys'
import { DamAssetType } from '@/domains/dam/types/Asset'
import { AssetFileProcessStatus } from '@/domains/dam/types/AssetFile'
import { useUploadQueueDialog } from '@/domains/dam/uploadQueue/composables/useUploadQueueDialog'
import type { DocId } from '@/shared/types/common'
import { isNull } from '@/shared/utils/common'

// "Edit image" of a widget of one image that holds the asset of its file, picked without authors, pressed while the
// asset is read after its detail "edit asset" has closed: that read serves the dialog too, as the newer answer. The
// asset was read twice in a row, the second time as soon as the first had answered. admin-cms only.

const QUEUE = 'held-one-read'
const PickerStandIn = defineComponent({ name: 'AAssetSelect', emits: ['confirm'], setup: () => () => h('div') })
const MEDIA = /^\/adm\/v1\/cms\/asset\//
const profile = cmsConfiguration
const { endPoints, extSystem, licence } = profile

let pinia: Pinia
let dam: FakeDam
let waits: LongWaits
let widgets: VueWrapper[] = []

beforeEach(() => {
  pinia = createPinia()
  setActivePinia(pinia)
  dam = createFakeDam(endPoints)
  installConsumerImageApi(profile, installConsumerProfile(profile, dam.client))
  answerDamNames(dam)
  dam.reply((request) => (request.method === 'GET' && MEDIA.test(request.url) ? { status: 200, data: {} } : undefined))
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
const imageDialog = () =>
  Array.from(document.body.querySelectorAll<HTMLElement>('.v-overlay--active .v-card')).find((card) =>
    card.textContent?.includes(damText('image.meta.edit'))
  )
const fieldsIn = (root: Element) =>
  Array.from(root.querySelectorAll<HTMLTextAreaElement>('textarea')).filter(
    (field) => field.getAttribute('aria-hidden') !== 'true'
  )
const texts = () => fieldsIn(imageDialog()!).map((field) => field.value)
const loading = () => !isNull(imageDialog()!.querySelector('.v-progress-circular'))
const buttonOfDialog = (text: string) =>
  Array.from(imageDialog()!.querySelectorAll<HTMLButtonElement>('button')).find(
    (button) => button.textContent?.trim() === text
  )!
const readsOf = (asset: DocId) =>
  dam.sentTo('GET', dam.routes.one).filter((request) => request.url === `${endPoints.asset}/${asset}`)

describe.each<[string, Component]>([
  ['the image widget', ImageWidgetInner],
  ['the image and media widget', ImageMediaWidgetInner],
])('"edit image" of %s while the asset it holds is read after its detail closed', (_name, component) => {
  const isImageWidget = component === ImageWidgetInner
  const mountWidget = async () => {
    const mounted: VueWrapper = mount(component, {
      attachTo: document.body,
      props: {
        queueKey: QUEUE,
        uploadLicence: licence,
        selectLicences: [licence],
        expandOptions: true,
        ...(isImageWidget
          ? {
              modelValue: null,
              'onUpdate:modelValue': (value: number | null) => mounted.setProps({ modelValue: value }),
            }
          : {
              image: null,
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
          AssetDetailDialogFrame: true,
          VImg: true,
          AImageWidgetSimple: true,
          AFormRemoteAutocompleteWithCached: true,
        },
      },
    })
    widgets.push(mounted)
    await flushPromises()
    useAssetSelectStore(pinia).setSelectConfig([uploadConfig()])
    return mounted
  }
  const editImage = async (widget: VueWrapper) => {
    const button = () =>
      widget.findAll('.a-image-widget__options button').find((one) => one.text() === damText('image.meta.edit'))
    await vi.waitFor(() => expect(button()).toBeDefined())
    await button()!.trigger('click')
    await vi.waitFor(() => expect(imageDialog()).toBeDefined())
  }
  const offered = (widget: VueWrapper) => {
    const input = widget.findComponent(AuthorRemoteAutocompleteWithCached)
    return input.exists() ? (input.props('modelValue') as DocId[]) : null
  }

  /**
   * Asset 9, without authors, picked and saved with its image: the widget holds it. Its dialog opened again, the detail
   * "edit asset" of it opened and closed, and the read of the asset after that close held: `reads`.
   */
  const detailClosedReadHeld = async (givenInTheDetail: DocId[] = []) => {
    dam.assets.set(
      'asset-9',
      damAssetWithFile('asset-9', 'file-of-asset-9', AssetFileProcessStatus.Processed, {
        licence,
        authors: [],
        metadata: { customData: { description: 'of asset-9' }, authorSuggestions: {}, keywordSuggestions: {} },
      })
    )
    const widget = await mountWidget()
    widget.findComponent(PickerStandIn).vm.$emit('confirm', {
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
    await vi.waitFor(() =>
      expect(useImageMediaWidgetStore(pinia).detail).toMatchObject({ dam: { damId: 'file-of-asset-9' } })
    )
    await vi.waitFor(() => expect(buttonOfDialog(uiText('common.button.confirm')).disabled).toBe(false))
    buttonOfDialog(uiText('common.button.confirm')).click()
    await vi.waitFor(() => expect(widget.emitted('afterMetadataSaveSuccess')).toHaveLength(1))
    await flushPromises()
    await editImage(widget)
    await vi.waitFor(() => expect(loading()).toBe(false))
    await flushPromises()
    buttonOfDialog(useCommonAdminCoreDamOptions('default').editAssetLabel).click()
    await vi.waitFor(() => expect(useAssetDetailStore(pinia).asset?.id).toBe('asset-9'))
    await flushPromises()
    dam.assets.get('asset-9')!.authors = givenInTheDetail
    const held = dam.hold('GET', new RegExp(`^${endPoints.asset}/asset-9$`))
    widget.findComponent({ name: 'AssetDetailDialogFrame' }).vm.$emit('close')
    await vi.waitFor(() => expect(held.waiting).toHaveLength(1))
    imageDialog()!.querySelector<HTMLButtonElement>('[data-cy="button-close"]')!.click()
    await vi.waitFor(() => expect(imageDialog()).toBeUndefined())
    return { widget, reads: held }
  }

  it('reads the asset no more: the read after the close serves the dialog', async () => {
    const { widget, reads } = await detailClosedReadHeld()
    const before = readsOf('asset-9').length

    await editImage(widget)
    expect(loading()).toBe(true)
    reads.release()
    await flushPromises()
    // A read made anew would be held too: it is let answer, and counted.
    reads.release()
    reads.stop()
    await vi.waitFor(() => expect(loading()).toBe(false))
    await flushPromises()

    expect(readsOf('asset-9')).toHaveLength(before)
    expect(offered(widget)).toEqual([])
  })

  it('shows what that read found: the names of the authors the detail gave the asset as the source', async () => {
    const { widget, reads } = await detailClosedReadHeld(['author-3'])

    await editImage(widget)
    reads.release()
    await flushPromises()
    reads.release()
    reads.stop()
    await vi.waitFor(() => expect(loading()).toBe(false))
    await damNamesAsked()
    await flushPromises()

    expect(offered(widget)).toBeNull()
    expect(texts()).toEqual(['of asset-9', 'Name of author-3'])
  })
})
