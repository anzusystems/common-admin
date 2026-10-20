import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, type Pinia, setActivePinia } from 'pinia'
import { type Component, defineComponent, h, shallowRef } from 'vue'
import { type ConsumerImageApi, installConsumerImageApi } from '@/domains/dam/__tests__/support/consumerImageApi'
import { cmsConfiguration, installConsumerProfile } from '@/domains/dam/__tests__/support/consumerProfiles'
import { answerDamNames, damNamesAsked } from '@/domains/dam/__tests__/support/damNames'
import { createFakeDam, damAssetWithFile, type FakeDam } from '@/domains/dam/__tests__/support/fakeDam'
import { holdLongWaits, type LongWaits } from '@/domains/dam/__tests__/support/longWaits'
import { damText, forgetAlerts, signInToDam, signOutOfDam, uiText } from '@/domains/dam/__tests__/support/uploadUi'
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

// A widget of one image turned read-only (the form around it, another editor) draws none of its dialogs and menus:
// those open close as their cancel does, nothing is saved, and the lock of the field goes back to the room. The dialog
// stayed open unseen: it kept the lock for the other editors, and came back by itself once the widget could be edited
// again. A save on its way ends as it does, and gives the lock back then.

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

const QUEUE = 'readonly-image'
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
const stored: ImageAware = {
  id: 12,
  texts: { description: 'image 12', source: 'source 12' },
  dam: { damId: 'file-12', licenceId: licence, regionPosition: 0, internal: false },
  flags: { showSource: true, internal: false, overrideInternal: false },
  position: 1,
}
const imageDialog = () =>
  Array.from(document.body.querySelectorAll<HTMLElement>('.v-overlay--active .v-card')).find((card) =>
    card.textContent?.includes(damText('image.meta.edit'))
  )
const imagesWritten = () => imageApi.calls.filter(([call]) => call === 'createImage' || call === 'updateImage')

describe.each<[string, Component]>([
  ['the image widget', ImageWidgetInner],
  ['the image and media widget', ImageMediaWidgetInner],
])('%s turned read-only', (_name, component) => {
  const isImageWidget = component === ImageWidgetInner
  /** What the widget gives the lock back with: its image (and, of the image and media widget, no media). */
  const valueOf = (image: number | null) => (isImageWidget ? image : { image, media: null })
  const mountWidget = async (image: number | null, more: Record<string, unknown> = {}) => {
    const mounted: VueWrapper = mount(component, {
      attachTo: document.body,
      props: {
        queueKey: QUEUE,
        uploadLicence: licence,
        selectLicences: [licence],
        expandOptions: true,
        collab: { room: 'article:1', field: 'listingImage', cachedUsers: new Map() },
        collabStatus: 'active',
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
    useAssetSelectStore(pinia).setSelectConfig([uploadConfig()])
    return mounted
  }
  /** The widget of image 12, its dialog open: "edit image". */
  const editingImage = async () => {
    imageApi.has(structuredClone(stored))
    const widget = await mountWidget(12)
    const edit = () =>
      widget.findAll('.a-image-widget__options button').find((one) => one.text() === damText('image.meta.edit'))
    await vi.waitFor(() => expect(edit()).toBeDefined())
    await edit()!.trigger('click')
    await vi.waitFor(() => expect(imageDialog()).toBeDefined())
    await flushPromises()
    expect(lock.acquired).toHaveLength(1)
    return widget
  }
  const turnReadonly = async (widget: VueWrapper, readonly = true) => {
    await widget.setProps({ readonly })
    await flushPromises()
  }

  it('gives the lock of the field back, its dialog closed and nothing saved', async () => {
    const widget = await editingImage()

    await turnReadonly(widget)

    expect(imageDialog()).toBeUndefined()
    expect(lock.released).toEqual([valueOf(12)])
    expect(imagesWritten()).toEqual([])
  })

  it('opens no dialog by itself once it can be edited again', async () => {
    const widget = await editingImage()
    await turnReadonly(widget)

    await turnReadonly(widget, false)
    await waits.settle()

    expect(imageDialog()).toBeUndefined()
    expect(lock.acquired).toHaveLength(1)
  })

  // The dialog loads for a pick whose asset is being read: it closes, as the cancel of a loading dialog, and the
  // lock goes back once the read of the pick is over, whose answer puts nothing into the dialog.
  it('gives the lock back while its dialog loads for a pick, and the answer opens nothing', async () => {
    dam.assets.set(
      'asset-9',
      damAssetWithFile('asset-9', 'file-of-asset-9', AssetFileProcessStatus.Processed, { licence })
    )
    const reads = dam.hold('GET', new RegExp(`^${endPoints.asset}/asset-9$`))
    const widget = await mountWidget(null)
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
    await vi.waitFor(() => expect(reads.waiting).toHaveLength(1))
    await flushPromises()
    expect(lock.acquired).toHaveLength(1)

    await turnReadonly(widget)
    expect(imageDialog()).toBeUndefined()
    // The pick on its way holds the lock till its read is over.
    expect(lock.released).toEqual([])
    reads.release()
    reads.stop()
    await flushPromises()

    expect(lock.released).toEqual([valueOf(null)])
    expect(imageDialog()).toBeUndefined()
    expect(imagesWritten()).toEqual([])
  })

  // Without `expandOptions` the menu of the options holds the lock while open.
  it('gives the lock back with its menu of options closed', async () => {
    imageApi.has(structuredClone(stored))
    const widget = await mountWidget(12, { expandOptions: false })
    await widget.find('.a-image-widget__options button').trigger('click')
    await flushPromises()
    expect(lock.acquired).toHaveLength(1)

    await turnReadonly(widget)

    expect(lock.released).toEqual([valueOf(12)])
  })

  it('ends a save on its way as it does, and gives the lock back then, with the image saved', async () => {
    const widget = await editingImage()
    const saves = imageApi.holdSaves()
    Array.from(imageDialog()!.querySelectorAll<HTMLButtonElement>('button'))
      .find((button) => button.textContent?.trim() === uiText('common.button.confirm'))!
      .click()
    await vi.waitFor(() => expect(saves.waiting).toHaveLength(1))

    await turnReadonly(widget)
    expect(lock.released).toEqual([])
    saves.release()
    await flushPromises()

    expect(imagesWritten()).toHaveLength(1)
    expect(lock.released).toEqual([valueOf(12)])
  })

  // The save fails while the widget is read-only: its dialog, which the save left open, closes then, and the lock goes
  // back; it does not come back once the widget can be edited again.
  it('closes the dialog of a save that fails meanwhile, and gives the lock back then', async () => {
    const widget = await editingImage()
    const saves = imageApi.holdSaves()
    Array.from(imageDialog()!.querySelectorAll<HTMLButtonElement>('button'))
      .find((button) => button.textContent?.trim() === uiText('common.button.confirm'))!
      .click()
    await vi.waitFor(() => expect(saves.waiting).toHaveLength(1))

    await turnReadonly(widget)
    saves.release('failed')
    await flushPromises()
    expect(lock.released).toEqual([valueOf(12)])

    await turnReadonly(widget, false)
    await waits.settle()
    expect(imageDialog()).toBeUndefined()
  })

  // With `expandMetadata` the form is in the page: there is no dialog to close. The form of a pick not yet confirmed
  // stays as it is, and its host saves it once the widget can be edited again. It was emptied, while the widget went on
  // showing the pick, and the confirm of the host saved nothing.
  it('keeps the form of a pick drawn in the page, which its host saves once the widget can be edited again', async () => {
    dam.assets.set(
      'asset-9',
      damAssetWithFile('asset-9', 'file-of-asset-9', AssetFileProcessStatus.Processed, {
        licence,
        authors: ['author-1'],
      })
    )
    const widget = await mountWidget(null, { expandMetadata: true })
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
    await damNamesAsked()
    await flushPromises()

    await turnReadonly(widget)
    await turnReadonly(widget, false)
    ;(widget.vm as unknown as { metadataConfirm: () => void }).metadataConfirm()
    await vi.waitFor(() => expect(widget.emitted('afterMetadataSaveSuccess')).toHaveLength(1))

    expect(imagesWritten()).toHaveLength(1)
  })
})
