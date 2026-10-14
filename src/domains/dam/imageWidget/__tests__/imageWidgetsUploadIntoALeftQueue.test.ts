import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, type Pinia, setActivePinia } from 'pinia'
import { type Component, defineComponent, h, shallowRef } from 'vue'
import { installConsumerImageApi } from '@/domains/dam/__tests__/support/consumerImageApi'
import { cmsConfiguration, installConsumerProfile } from '@/domains/dam/__tests__/support/consumerProfiles'
import { answerDamNames, damNamesAsked } from '@/domains/dam/__tests__/support/damNames'
import { type DamSocket, stubDamSocket } from '@/domains/dam/__tests__/support/damSocket'
import { createFakeDam, type FakeDam } from '@/domains/dam/__tests__/support/fakeDam'
import { holdLongWaits, type LongWaits } from '@/domains/dam/__tests__/support/longWaits'
import { damText, forgetAlerts, signInToDam, signOutOfDam } from '@/domains/dam/__tests__/support/uploadUi'
import { useAssetDetailStore } from '@/domains/dam/assetDetail/store/assetDetailStore'
import { destroyDamNotifications } from '@/domains/dam/composables/damNotifications'
import { useDamNotificationsEventBus } from '@/domains/dam/composables/damNotificationsEventBus'
import { useDamConfigStore } from '@/domains/dam/config/store/damConfigStore'
import ImageMediaWidgetInner from '@/domains/dam/imageWidget/components/ImageMediaWidgetInner.vue'
import ImageWidgetInner from '@/domains/dam/imageWidget/components/ImageWidgetInner.vue'
import ImageWidgetMultipleInner from '@/domains/dam/imageWidget/components/ImageWidgetMultipleInner.vue'
import { useImageMediaWidgetStore } from '@/domains/dam/imageWidget/store/imageMediaWidgetStore'
import { ImageWidgetUploadConfigKey } from '@/domains/dam/imageWidget/utils/imageWidgetInkectionKeys'
import { AssetFileProcessStatus } from '@/domains/dam/types/AssetFile'
import { UploadQueueItemStatus } from '@/domains/dam/types/UploadQueue'
import { useUploadQueueDialog } from '@/domains/dam/uploadQueue/composables/useUploadQueueDialog'
import { useUploadQueuesStore } from '@/domains/dam/uploadQueue/store/uploadQueuesStore'

// An upload dialog goes away with its widget while it is open (in admin-cms the editor sent out of the article during
// an upload), and its rows stay in the queue, which the app keeps. The next widget of the same queue key (the same
// field of another article) added its file to those rows: its dialog showed the first of them, the old file, and "save
// and apply" handed the widget that one, while the new upload was stopped with the queue. A widget that adds files to a
// queue no dialog names stops it first. Under admin-cms: the real widgets with their real upload dialogs over the real
// queue; the DAM and the backend of the images are clients that record their requests, and only the long waits are
// taken out of real time.

const profile = cmsConfiguration
const { endPoints, extSystem, licence } = profile
const { Processing, Uploaded, Uploading } = UploadQueueItemStatus

let pinia: Pinia
let dam: FakeDam
let waits: LongWaits
let socket: DamSocket
let mounted: VueWrapper[] = []

const photo = (name: string) => new File([new Uint8Array(3000)], name, { type: 'image/jpeg' })
const carrying = (files: File[]) => {
  const dataTransfer = new DataTransfer()
  files.forEach((file) => dataTransfer.items.add(file))
  return dataTransfer
}
const Picker = defineComponent({ name: 'AAssetSelect', emits: ['confirm'], setup: () => () => h('div') })
const Editor = defineComponent({
  name: 'ASortableListEditor',
  setup: (_, { slots, expose }) => {
    expose({ commit: () => undefined, cancelReorderMode: () => undefined })
    return () => h('div', slots['view-body']?.())
  },
})
const described = (description: string) => ({
  metadata: { customData: { description }, authorSuggestions: {}, keywordSuggestions: {} },
  authors: ['author-1'],
})

beforeEach(() => {
  pinia = createPinia()
  setActivePinia(pinia)
  dam = createFakeDam(endPoints)
  installConsumerImageApi(profile, installConsumerProfile(profile, dam.client))
  answerDamNames(dam)
  waits = holdLongWaits()
  socket = stubDamSocket()
  forgetAlerts()
  signInToDam(extSystem)
})
afterEach(() => {
  mounted.forEach((wrapper) => wrapper.unmount())
  mounted = []
  useUploadQueuesStore(pinia).stopUpload('lead-image')
  useUploadQueuesStore(pinia).stopUpload('gallery')
  useUploadQueueDialog().uploadQueueDialog.value = null
  destroyDamNotifications()
  waits.restore()
  socket.restore()
  useDamNotificationsEventBus().reset()
  signOutOfDam()
})

const queue = () => useUploadQueuesStore(pinia)
const titlesIn = (key: string) =>
  queue()
    .getQueueItems(key)
    .map((item) => item.displayTitle)
const statusOf = (key: string, title: string) =>
  queue()
    .getQueueItems(key)
    .find((item) => item.displayTitle === title)?.status
const uploadConfig = () => ({
  licence,
  extSystem,
  licenceName: '',
  extSystemConfig: useDamConfigStore(pinia).damConfigExtSystem.get(extSystem)!,
})
/** The file of an asset is processed by the DAM, and the queue has learnt of it. */
const processed = async (key: string, title: string, asset: string) => {
  await vi.waitFor(() => expect(statusOf(key, title)).toBe(Processing))
  dam.fileBecomes(asset, AssetFileProcessStatus.Processed, described(title))
  await waits.elapse()
  await vi.waitFor(() => expect(statusOf(key, title)).toBe(Uploaded))
  await damNamesAsked()
  await flushPromises()
}
const goes = (widget: VueWrapper) => {
  mounted.splice(mounted.indexOf(widget), 1)
  widget.unmount()
}

describe.each<[string, Component]>([
  ['ImageWidgetInner', ImageWidgetInner],
  ['ImageMediaWidgetInner', ImageMediaWidgetInner],
])('an upload into %s after the upload dialog of its queue went away with another widget', (_name, component) => {
  const QUEUE = 'lead-image'
  const isImageWidget = component === ImageWidgetInner
  const mountWidget = async () => {
    const widget: VueWrapper = mount(component, {
      attachTo: document.body,
      props: {
        queueKey: QUEUE,
        uploadLicence: licence,
        selectLicences: [licence],
        ...(isImageWidget
          ? {
              modelValue: null,
              'onUpdate:modelValue': (value: number | null) => widget.setProps({ modelValue: value }),
            }
          : {
              image: null,
              media: null,
              'onUpdate:image': (value: number | null) => widget.setProps({ image: value }),
              'onUpdate:media': (value: unknown) => widget.setProps({ media: value }),
            }),
      } as never,
      global: {
        plugins: [pinia],
        provide: { [ImageWidgetUploadConfigKey as symbol]: shallowRef(uploadConfig()) },
        stubs: {
          AAssetSelect: Picker,
          AAssetSelectMedia: Picker,
          AssetDetailDialog: true,
          VImg: true,
          AssetImage: true,
          AImageWidgetSimple: true,
          DamAssetImageRoiSelectLazy: true,
          AssetDetailSidebarROI: true,
          AFormRemoteAutocompleteWithCached: true,
        },
      },
    })
    mounted.push(widget)
    await flushPromises()
    return widget
  }
  const openMenuItem = () =>
    Array.from(document.body.querySelectorAll<HTMLElement>('.v-menu.v-overlay--active .v-list-item'))
  const fileInputOfDialog = () =>
    document.body.querySelector<HTMLInputElement>('[data-cy="create-panel"] input[type="file"]')
  /** The user picks a file with "Upload image" of the widget's menu. */
  const pickThroughMenu = async (widget: VueWrapper, name: string) => {
    await widget.find(`button[aria-label="${damText('image.button.options')}"]`).trigger('click')
    await vi.waitFor(() => expect(openMenuItem().length).toBeGreaterThan(0))
    openMenuItem()
      .find((entry) => entry.textContent?.trim() === damText('image.button.upload'))!
      .click()
    await vi.waitFor(() => expect(fileInputOfDialog()).not.toBeNull())
    const input = fileInputOfDialog()!
    input.files = carrying([photo(name)]).files
    input.dispatchEvent(new Event('change', { bubbles: true }))
    await flushPromises()
  }
  const inUploadDialog = (selector: string) => document.body.querySelector<HTMLElement>(`.dam-image-detail ${selector}`)

  it('shows and applies the new file: the row of the old one, uploaded, is stopped first', async () => {
    const first = await mountWidget()
    await pickThroughMenu(first, 'old.jpg')
    await processed(QUEUE, 'old.jpg', 'asset-1')
    goes(first)
    await flushPromises()
    expect([titlesIn(QUEUE), useUploadQueueDialog().uploadQueueDialog.value]).toEqual([['old.jpg'], null])

    const next = await mountWidget()
    await pickThroughMenu(next, 'new.jpg')
    expect(titlesIn(QUEUE)).toEqual(['new.jpg'])
    await processed(QUEUE, 'new.jpg', 'asset-2')
    await vi.waitFor(() => expect(useAssetDetailStore(pinia).asset?.id).toBe('asset-2'))
    await flushPromises()
    inUploadDialog('[data-cy="button-save-and-apply"]')!.click()
    await vi.waitFor(() => expect(useImageMediaWidgetStore(pinia).detail).not.toBeNull())

    expect(useImageMediaWidgetStore(pinia).detail).toMatchObject({
      texts: { description: 'new.jpg' },
      dam: { damId: 'file-2' },
    })
  })

  it('stops the upload of the old row still on its way, and keeps the new one going', async () => {
    const chunks = dam.hold('POST', dam.routes.chunk)
    const first = await mountWidget()
    await pickThroughMenu(first, 'old.jpg')
    await vi.waitFor(() => expect(chunks.waiting).toHaveLength(1))
    const signal = chunks.waiting[0]!.request.config.signal as AbortSignal
    goes(first)
    await flushPromises()
    expect([signal.aborted, statusOf(QUEUE, 'old.jpg')]).toEqual([false, Uploading])

    const next = await mountWidget()
    await pickThroughMenu(next, 'new.jpg')

    expect(signal.aborted).toBe(true)
    expect(titlesIn(QUEUE)).toEqual(['new.jpg'])
    expect(useUploadQueueDialog().uploadQueueDialog.value).toBe(QUEUE)
    chunks.release()
  })
})

describe('an upload into the widget of several images after its queue dialog went away with another widget', () => {
  const QUEUE = 'gallery'
  const mountWidget = async () => {
    const widget: VueWrapper = mount(ImageWidgetMultipleInner, {
      attachTo: document.body,
      props: {
        modelValue: [],
        queueKey: QUEUE,
        uploadLicence: licence,
        selectLicences: [licence],
        'onUpdate:modelValue': (value: number[]) => widget.setProps({ modelValue: value }),
      } as never,
      global: {
        plugins: [pinia],
        provide: { [ImageWidgetUploadConfigKey as symbol]: shallowRef(uploadConfig()) },
        stubs: {
          ASortableListEditor: Editor,
          AAssetSelect: Picker,
          AssetDetailDialogFrame: true,
          AImageWidgetSimple: true,
          AssetImage: true,
          AssetQueueSelectedSidebar: true,
          AFileDropzone: true,
          AFormRemoteAutocompleteWithCached: true,
        },
      },
    })
    mounted.push(widget)
    await flushPromises()
    return widget
  }
  /** The user picks files with the upload button of the widget. */
  const pick = async (widget: VueWrapper, name: string) => {
    const input = (widget.element as Element).querySelector<HTMLInputElement>('input[type="file"]')!
    input.files = carrying([photo(name)]).files
    input.dispatchEvent(new Event('change', { bubbles: true }))
    await flushPromises()
  }

  it('forgets the dialog that went, and queues the new file alone: the old row is stopped first', async () => {
    const first = await mountWidget()
    await pick(first, 'old.jpg')
    await processed(QUEUE, 'old.jpg', 'asset-1')
    expect(useUploadQueueDialog().uploadQueueDialog.value).toBe(QUEUE)
    goes(first)
    await flushPromises()
    expect([titlesIn(QUEUE), useUploadQueueDialog().uploadQueueDialog.value]).toEqual([['old.jpg'], null])

    const next = await mountWidget()
    await pick(next, 'new.jpg')

    expect(titlesIn(QUEUE)).toEqual(['new.jpg'])
    expect(useUploadQueueDialog().uploadQueueDialog.value).toBe(QUEUE)
  })
})
