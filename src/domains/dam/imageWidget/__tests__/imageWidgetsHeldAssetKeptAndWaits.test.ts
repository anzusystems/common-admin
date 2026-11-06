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
import AssetDetailSidebarActionsTeleportTarget from '@/domains/dam/assetDetail/components/AssetDetailSidebarActionsTeleportTarget.vue'
import AssetDetailSidebarMetadata from '@/domains/dam/assetDetail/components/AssetDetailSidebarMetadata.vue'
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

// Covers the asset a widget holds: an asset picked without authors,
// whose authors the image dialog offers instead of a source.
// Guards regressions:
// - After a failed asset read, the dialog kept offering the pick as read before.
// - A "confirm" waiting for such a read was retried after the
// failure on the source shown by then, without the picked authors.
// - An image saved with a typed source was shown with the pick again
// at the next "edit image", and its confirm replaced that source.
// - A confirm pressed while the asset was read after the detail closed waited forever for a read that did not answer.
// - Closing the detail of one asset waited for the save of another's detail.
// admin-cms only. The asset detail dialog is real, except its framing. The DAM and
// the image backend are request-recording clients; the asset picker is a stand-in.

const PickerStandIn = defineComponent({ name: 'AAssetSelect', emits: ['confirm'], setup: () => () => h('div') })
const MEDIA = /^\/adm\/v1\/cms\/asset\//

const profile = cmsConfiguration
const { endPoints, extSystem, licence } = profile

let pinia: Pinia
let dam: FakeDam
let imageApi: ConsumerImageApi
let waits: LongWaits
let widgets: VueWrapper[] = []
let detailForm: VueWrapper | undefined

beforeEach(() => {
  pinia = createPinia()
  setActivePinia(pinia)
  dam = createFakeDam(endPoints)
  imageApi = installConsumerImageApi(profile, installConsumerProfile(profile, dam.client))
  answerDamNames(dam)
  dam.reply((request) => (request.method === 'GET' && MEDIA.test(request.url) ? { status: 200, data: {} } : undefined))
  waits = holdLongWaits()
  forgetAlerts()
  signInToDam(extSystem)
})
afterEach(async () => {
  detailForm?.unmount()
  detailForm = undefined
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
const inTheDam = (id: string) =>
  dam.assets.set(
    id,
    damAssetWithFile(id, `file-of-${id}`, AssetFileProcessStatus.Processed, {
      licence,
      authors: [],
      metadata: { customData: { description: `of ${id}` }, authorSuggestions: {}, keywordSuggestions: {} },
    })
  )
const listed = (id: string) => ({
  id,
  licence,
  mainFile: { id: `file-of-${id}` },
  mainFileInternal: false,
  attributes: { assetType: DamAssetType.Image },
  podcasts: [],
})
// The dialog of the image is drawn into the body.
const imageDialog = () =>
  Array.from(document.body.querySelectorAll<HTMLElement>('.v-overlay--active .v-card')).find((card) =>
    card.textContent?.includes(damText('image.meta.edit'))
  )
const texts = () =>
  Array.from(imageDialog()!.querySelectorAll<HTMLTextAreaElement>('textarea'))
    .filter((field) => field.getAttribute('aria-hidden') !== 'true')
    .map((field) => field.value)
const loading = () => !isNull(imageDialog()!.querySelector('.v-progress-circular'))
const buttonOfDialog = (text: string) =>
  Array.from(imageDialog()!.querySelectorAll<HTMLButtonElement>('button')).find(
    (button) => button.textContent?.trim() === text
  )!
const confirmButton = () => buttonOfDialog(uiText('common.button.confirm'))
const spins = () => confirmButton().classList.contains('v-btn--loading')
const authorsWritten = () => dam.sentTo('PATCH', dam.routes.bulkMetadata).map((request) => dam.body(request))
const readsOf = (asset: DocId) =>
  dam.sentTo('GET', dam.routes.one).filter((request) => request.url === `${endPoints.asset}/${asset}`)
const imagesWritten = () => imageApi.calls.filter(([call]) => call === 'createImage' || call === 'updateImage')
const holdReadsOf = (asset: DocId) => {
  const held = dam.hold('GET', new RegExp(`^${endPoints.asset}/${asset}$`))
  return {
    waiting: held.waiting,
    answer: (given?: FakeDamAnswer) =>
      held.release(given ?? { status: 200, data: structuredClone(dam.assets.get(asset)) }),
  }
}
const refuseReadsOf = (asset: DocId) =>
  dam.reply((request) =>
    request.method === 'GET' && request.url === `${endPoints.asset}/${asset}` ? { status: 500 } : undefined
  )

describe.each<[string, Component]>([
  ['the image widget', ImageWidgetInner],
  ['the image and media widget', ImageMediaWidgetInner],
])('the asset %s holds for the dialog of its image', (_name, component) => {
  const isImageWidget = component === ImageWidgetInner
  const mountWidget = async (key = 'lead-image', image: number | null = null) => {
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
  const editImageShown = async (widget: VueWrapper) => {
    await editImage(widget)
    await vi.waitFor(() => expect(loading()).toBe(false))
    await flushPromises()
  }
  const closeImageDialog = async () => {
    imageDialog()!.querySelector<HTMLButtonElement>('[data-cy="button-close"]')!.click()
    await vi.waitFor(() => expect(imageDialog()).toBeUndefined())
  }
  const authorsInput = (widget: VueWrapper) => widget.findComponent(AuthorRemoteAutocompleteWithCached)
  const offered = (widget: VueWrapper) =>
    authorsInput(widget).exists() ? (authorsInput(widget).props('modelValue') as DocId[]) : null
  const pickAuthors = async (widget: VueWrapper, authors: DocId[]) => {
    authorsInput(widget).vm.$emit('update:modelValue', authors)
    await flushPromises()
  }
  const pickInto = async (widget: VueWrapper, asset: string) => {
    widget.findComponent(PickerStandIn).vm.$emit('confirm', { type: 'asset', value: [listed(asset)] })
    await vi.waitFor(() =>
      expect(useImageMediaWidgetStore(pinia).detail).toMatchObject({ dam: { damId: `file-of-${asset}` } })
    )
    await vi.waitFor(() => expect(confirmButton().disabled).toBe(false))
    await flushPromises()
    expect(offered(widget)).toEqual([])
  }
  const pickedWithoutAuthors = async () => {
    inTheDam('asset-9')
    const widget = await mountWidget()
    await pickInto(widget, 'asset-9')
    return widget
  }
  const savedWithoutAuthors = async () => {
    const widget = await pickedWithoutAuthors()
    await confirmImage(widget)
    return widget
  }
  const openDetail = async (asset: string) => {
    buttonOfDialog(useCommonAdminCoreDamOptions('default').editAssetLabel).click()
    await vi.waitFor(() => expect(useAssetDetailStore(pinia).asset?.id).toBe(asset))
    await flushPromises()
  }
  const closeDetail = async (widget: VueWrapper) => {
    widget.findComponent({ name: 'AssetDetailDialogFrame' }).vm.$emit('close')
    await flushPromises()
  }
  const detailSaveOnItsWay = async (key: string) => {
    const Form = defineComponent({
      setup: () => () =>
        h('div', [
          h(AssetDetailSidebarMetadata, { queueKey: key, isActive: true, assetType: DamAssetType.Image, extSystem }),
          h(AssetDetailSidebarActionsTeleportTarget, { queueKey: key }),
        ]),
    })
    detailForm = mount(Form, {
      attachTo: document.body,
      global: { plugins: [pinia], stubs: { AFormRemoteAutocompleteWithCached: true, ACachedUserChip: true } },
    })
    await flushPromises()
    await flushPromises()
    const detailSaves = dam.hold('PATCH', dam.routes.bulkMetadata)
    useAssetDetailStore(pinia).asset!.authors = ['author-9']
    document.body.querySelector<HTMLButtonElement>('[data-cy="button-save"]')!.click()
    await vi.waitFor(() => expect(detailSaves.waiting).toHaveLength(1))
    detailForm.unmount()
    detailForm = undefined
    return detailSaves
  }
  const typeSource = async (text: string) => {
    const fields = Array.from(imageDialog()!.querySelectorAll<HTMLTextAreaElement>('textarea')).filter(
      (field) => field.getAttribute('aria-hidden') !== 'true'
    )
    fields[1]!.value = text
    fields[1]!.dispatchEvent(new Event('input', { bubbles: true }))
    await flushPromises()
  }
  const confirmImage = async (widget: VueWrapper) => {
    const saved = widget.emitted('afterMetadataSaveSuccess')?.length ?? 0
    confirmButton().click()
    await vi.waitFor(() => expect(widget.emitted('afterMetadataSaveSuccess')).toHaveLength(saved + 1))
    await flushPromises()
  }

  it('shows the source in place of the pick once the asset cannot be read anew; opened again, reads it and offers the pick', async () => {
    const widget = await savedWithoutAuthors()
    const answerAgain = refuseReadsOf('asset-9')

    await editImageShown(widget)

    expect(shownAlerts()).toEqual([['error', alertText('common.alert.unknownError')]])
    expect(offered(widget)).toBeNull()
    expect(texts()).toEqual(['of asset-9', ''])
    await closeImageDialog()
    answerAgain()
    forgetAlerts()

    await editImageShown(widget)

    expect(offered(widget)).toEqual([])
    expect(shownAlerts()).toEqual([])
  })

  it('shows the source in place of the pick once the asset cannot be read after the detail "edit asset" opened closes', async () => {
    const widget = await pickedWithoutAuthors()
    await pickAuthors(widget, ['author-5'])
    await openDetail('asset-9')
    refuseReadsOf('asset-9')

    await closeDetail(widget)
    await vi.waitFor(() => expect(shownAlerts()).toHaveLength(1))
    await flushPromises()

    expect(offered(widget)).toBeNull()
    expect(texts()).toEqual(['of asset-9', ''])
    expect(authorsWritten()).toEqual([])
  })

  it('takes no press of "confirm" that waits for the read after the detail once the wait runs out, and says the request timed out', async () => {
    const widget = await pickedWithoutAuthors()
    await pickAuthors(widget, ['author-5'])
    await openDetail('asset-9')
    const reads = holdReadsOf('asset-9')
    await closeDetail(widget)
    await vi.waitFor(() => expect(reads.waiting).toHaveLength(1))
    confirmButton().click()
    await flushPromises()
    expect(spins()).toBe(true)

    expect(await waits.elapse()).toBe(true)

    expect(spins()).toBe(false)
    expect(shownAlerts()).toEqual([['error', alertText('error.apiTimedOut.message')]])
    reads.answer()
    await damNamesAsked()
    await waits.settle()
    expect(authorsWritten()).toEqual([])
    expect(imagesWritten()).toEqual([])
    expect(offered(widget)).toEqual(['author-5'])
  })

  // The detail form is not locked while its save runs, so the detail can be closed before the DAM answers.
  // The read after the close waits for that save. The read of another widget's asset does not.
  it('reads its asset once the detail closes, while the save of the detail of another asset is on its way', async () => {
    inTheDam('asset-9')
    inTheDam('asset-10')
    const first = await mountWidget('first-image')
    const second = await mountWidget('second-image')
    await pickInto(first, 'asset-9')
    await openDetail('asset-9')
    const detailSaves = await detailSaveOnItsWay('first-image')
    await closeDetail(first)
    await closeImageDialog()

    await pickInto(second, 'asset-10')
    await openDetail('asset-10')
    await closeDetail(second)
    await vi.waitFor(() => expect(readsOf('asset-10')).toHaveLength(2))

    expect(readsOf('asset-9')).toHaveLength(1)
    detailSaves.release()
    await vi.waitFor(() => expect(readsOf('asset-9')).toHaveLength(2))
  })

  it('reads the asset of its new pick once the detail closes, while the save of the detail of the asset it held before is on its way', async () => {
    inTheDam('asset-9')
    inTheDam('asset-10')
    const widget = await mountWidget()
    await pickInto(widget, 'asset-9')
    await openDetail('asset-9')
    const detailSaves = await detailSaveOnItsWay('lead-image')
    await closeDetail(widget)
    await closeImageDialog()

    await pickInto(widget, 'asset-10')
    await openDetail('asset-10')
    await closeDetail(widget)
    await vi.waitFor(() => expect(readsOf('asset-10')).toHaveLength(2))

    expect(readsOf('asset-9')).toHaveLength(1)
    detailSaves.release()
    await vi.waitFor(() => expect(readsOf('asset-9')).toHaveLength(2))
  })

  // Guards a regression: the source shown by then is one that a save of the image by another widget gave it.
  // If the press was taken again, it saved the image with that source
  // and silently dropped the authors picked when it was pressed.
  it('takes no press of "confirm" that waits for the read after the detail once that read fails: nothing is saved', async () => {
    const widget = await savedWithoutAuthors()
    const other = await mountWidget('other-image', 501)
    await editImageShown(other)
    await typeSource('typed elsewhere')
    await confirmImage(other)
    await editImageShown(widget)
    expect(offered(widget)).toEqual([])
    await pickAuthors(widget, ['author-5'])
    await openDetail('asset-9')
    const reads = holdReadsOf('asset-9')
    await closeDetail(widget)
    await vi.waitFor(() => expect(reads.waiting).toHaveLength(1))
    confirmButton().click()
    await flushPromises()
    expect(spins()).toBe(true)

    reads.answer({ status: 500 })
    await vi.waitFor(() => expect(imageDialog() === undefined || !spins()).toBe(true))
    await waits.settle()

    expect(imagesWritten()).toHaveLength(2)
    expect(imageDialog()).toBeDefined()
    expect(spins()).toBe(false)
    expect(authorsWritten()).toEqual([])
    expect(shownAlerts()).toEqual([['error', alertText('common.alert.unknownError')]])
    expect(offered(widget)).toBeNull()
    expect(texts()).toEqual(['of asset-9', 'typed elsewhere'])
  })

  it('lets the asset go once the image is saved with the source typed after a failed read: opened again, it shows that source', async () => {
    const widget = await savedWithoutAuthors()
    const answerAgain = refuseReadsOf('asset-9')
    await editImageShown(widget)
    expect(offered(widget)).toBeNull()
    await typeSource('typed')
    await confirmImage(widget)
    answerAgain()
    forgetAlerts()
    const reads = readsOf('asset-9').length

    await editImageShown(widget)

    expect(offered(widget)).toBeNull()
    expect(texts()).toEqual(['of asset-9', 'typed'])
    expect(readsOf('asset-9')).toHaveLength(reads)
    expect(shownAlerts()).toEqual([])
  })

  // The read is the rest of the detail save: the asset, its licence and its author names, one after another.
  // Each request gets the application's request time, and a slow but answering DAM ran one such time out.
  it('waits for the read after the detail the time of its four requests, one after another', async () => {
    const widget = await pickedWithoutAuthors()
    await pickAuthors(widget, ['author-5'])
    await openDetail('asset-9')
    const reads = holdReadsOf('asset-9')
    await closeDetail(widget)
    await vi.waitFor(() => expect(reads.waiting).toHaveLength(1))

    confirmButton().click()
    await flushPromises()

    expect(spins()).toBe(true)
    expect(waits.lengths()).toContain(4 * 30_000)
    expect(waits.lengths()).not.toContain(30_000)
  })
})
