import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, type Pinia, setActivePinia } from 'pinia'
import { type Component, defineComponent, h, shallowRef } from 'vue'
import { type ConsumerImageApi, installConsumerImageApi } from '@/domains/dam/__tests__/support/consumerImageApi'
import {
  cmsConfiguration,
  type ConsumerProfile,
  installConsumerProfile,
  ugcConfiguration,
} from '@/domains/dam/__tests__/support/consumerProfiles'
import { answerDamNames, damNamesAsked } from '@/domains/dam/__tests__/support/damNames'
import { type DamSocket, stubDamSocket } from '@/domains/dam/__tests__/support/damSocket'
import { createFakeDam, damAssetWithFile, type FakeDam } from '@/domains/dam/__tests__/support/fakeDam'
import { holdLongWaits, type LongWaits } from '@/domains/dam/__tests__/support/longWaits'
import { damText, forgetAlerts, signInToDam, signOutOfDam, uiText } from '@/domains/dam/__tests__/support/uploadUi'
import { useAssetDetailStore } from '@/domains/dam/assetDetail/store/assetDetailStore'
import { useDamCachedUsers } from '@/domains/dam/author/composables/cachedUsers'
import { useCommonAdminCoreDamOptions } from '@/domains/dam/composables/commonAdminCoreDamOptions'
import { destroyDamNotifications, initDamNotifications } from '@/domains/dam/composables/damNotifications'
import { useDamNotificationsEventBus } from '@/domains/dam/composables/damNotificationsEventBus'
import { useDamConfigStore } from '@/domains/dam/config/store/damConfigStore'
import ImageMediaWidgetInner from '@/domains/dam/imageWidget/components/ImageMediaWidgetInner.vue'
import ImageWidgetInner from '@/domains/dam/imageWidget/components/ImageWidgetInner.vue'
import ImageWidgetMultipleInner from '@/domains/dam/imageWidget/components/ImageWidgetMultipleInner.vue'
import ImageWidgetMultipleItem from '@/domains/dam/imageWidget/components/ImageWidgetMultipleItem.vue'
import { useImageStore } from '@/domains/dam/imageWidget/store/imageStore'
import { ImageWidgetUploadConfigKey } from '@/domains/dam/imageWidget/utils/imageWidgetInkectionKeys'
import { AssetFileProcessStatus } from '@/domains/dam/types/AssetFile'
import type { ImageAware } from '@/domains/dam/types/ImageAware'
import { UploadQueueItemStatus } from '@/domains/dam/types/UploadQueue'
import { useUploadQueueDialog } from '@/domains/dam/uploadQueue/composables/useUploadQueueDialog'
import { useUploadQueuesStore } from '@/domains/dam/uploadQueue/store/uploadQueuesStore'
import type { DocId, IntegerId } from '@/shared/types/common'

// The panel "file" of the detail of an asset shows who created the asset and who changed it last, by the chips of the
// users of its configuration. A click into an asset picker put those two users into the cache for the asset clicked,
// and nothing else did: the detail opened by "edit asset" of a widget, or of a row of the queue, for an asset not
// clicked in a picker on the page showed two chips that spun for good. The real hosts with the real dialog of the
// detail; the DAM and the backend of the images are clients that record their requests, and only the long waits are
// taken out of real time. Not mounted for real: the sortable list around the rows of the gallery, the asset pickers,
// the pictures, the editor of the region of interest, the dropzones and the inputs that ask the DAM for names to offer.

const QUEUE = 'detail-users'
const USERS = /^\/adm\/v1\/user\?/
const { Processing, Uploaded } = UploadQueueItemStatus

let pinia: Pinia
let dam: FakeDam
let imageApi: ConsumerImageApi
let waits: LongWaits
let socket: DamSocket | undefined
let page: VueWrapper | undefined

const Picker = defineComponent({ name: 'AAssetSelect', emits: ['confirm'], setup: () => () => h('div') })
const Editor = defineComponent({
  name: 'ASortableListEditor',
  setup: (_, { slots, expose }) => {
    expose({ commit: () => undefined, cancelReorderMode: () => undefined })
    return () => h('div', slots['view-body']?.())
  },
})
const STAND_INS = {
  ASortableListEditor: Editor,
  AAssetSelect: Picker,
  AAssetSelectMedia: Picker,
  AImageWidgetSimple: true,
  AssetImage: true,
  VImg: true,
  DamAssetImageRoiSelectLazy: true,
  AssetDetailSidebarROI: true,
  AssetQueueSelectedSidebar: true,
  AFileDropzone: true,
  AFormRemoteAutocompleteWithCached: true,
}

const buttonOf = (root: ParentNode, text: string) =>
  Array.from(root.querySelectorAll<HTMLButtonElement>('button')).find((button) => button.textContent?.trim() === text)
const press = async (button: HTMLButtonElement) => {
  button.click()
  await flushPromises()
}
const card = () => document.body.querySelector<HTMLElement>('.dam-image-detail')
const filePanel = () =>
  Array.from(card()?.querySelectorAll<HTMLElement>('.v-expansion-panel') ?? []).find(
    (panel) =>
      panel.querySelector('.v-expansion-panel-title')?.textContent?.trim() ===
      uiText('common.damImage.asset.detail.info.file')
  )
/** The chips of the users of the panel "file": the name each shows beside its avatar, or "spins" while it waits. */
const userChips = () =>
  Array.from(filePanel()?.querySelectorAll<HTMLElement>('.v-chip') ?? []).map((chip) => {
    if (chip.querySelector('.v-progress-circular')) return 'spins'
    const avatar = chip.querySelector('.v-avatar')?.textContent ?? ''
    return (chip.textContent ?? '').replace(avatar, '').trim()
  })
const usersAsked = () =>
  dam.requests
    .filter((request) => USERS.test(request.url))
    .map((request) => decodeURIComponent(request.url).match(/filter_in\[id\]=([\d,]+)/)?.[1] ?? '')

/** The DAM knows every user asked for: `User <id>`. */
const answerUsers = () =>
  dam.reply((request) => {
    if (request.method !== 'GET' || !USERS.test(request.url)) return undefined
    const ids = (decodeURIComponent(request.url).match(/filter_in\[id\]=([\d,]+)/)?.[1] ?? '').split(',')
    const users = ids.map((id) => ({
      id: Number(id),
      email: `user${id}@dam.test`,
      avatar: { color: '', text: '' },
      person: { firstName: 'User', lastName: id, fullName: `User ${id}` },
    }))
    return { status: 200, data: { data: users, totalCount: users.length } }
  })

const setUp = (profile: ConsumerProfile) => {
  pinia = createPinia()
  setActivePinia(pinia)
  dam = createFakeDam(profile.endPoints)
  imageApi = installConsumerImageApi(profile, installConsumerProfile(profile, dam.client))
  answerDamNames(dam)
  answerUsers()
  const escaped = profile.endPoints.asset.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  // The search of the DAM for assets by their files, which the gallery asks before it reads the assets.
  const search = new RegExp(`^${escaped}/licence/(\\d+)/search\\?assetAndMainFileIds=([^&]*)`)
  dam.reply((request) => {
    const match = request.method === 'GET' ? request.url.match(search) : null
    if (!match) return undefined
    const files = match[2]!.split(',')
    const found = [...dam.assets.values()].filter((asset) => asset.mainFile && files.includes(asset.mainFile.id))
    return { status: 200, data: { data: found, totalCount: found.length } }
  })
  // The users the cache of the page has from before are not this case's.
  useDamCachedUsers('default').cachedUsers.value.clear()
  waits = holdLongWaits()
  forgetAlerts()
  if (profile.notifications) {
    socket = stubDamSocket()
    initDamNotifications().openConnection()
    socket.accept()
    signInToDam(profile.extSystem)
  }
}
afterEach(() => {
  page?.unmount()
  page = undefined
  useUploadQueuesStore(pinia).stopUpload(QUEUE)
  useUploadQueueDialog().uploadQueueDialog.value = null
  destroyDamNotifications()
  waits.restore()
  socket?.restore()
  socket = undefined
  useDamNotificationsEventBus().reset()
  signOutOfDam()
})

const mountPage = async (profile: ConsumerProfile, component: Component, props: Record<string, unknown>) => {
  page = mount(component, {
    attachTo: document.body,
    props: {
      queueKey: QUEUE,
      uploadLicence: profile.licence,
      selectLicences: [profile.licence],
      ...props,
    } as never,
    global: {
      plugins: [pinia],
      provide: {
        [ImageWidgetUploadConfigKey as symbol]: shallowRef({
          licence: profile.licence,
          extSystem: profile.extSystem,
          licenceName: '',
          extSystemConfig: useDamConfigStore(pinia).damConfigExtSystem.get(profile.extSystem)!,
        }),
      },
      stubs: STAND_INS,
    },
  })
  await flushPromises()
}
/** An image the entity has, `file-12` of `asset-12`, created by the user `createdBy`, changed by `modifiedBy`. */
const imageInTheDam = (profile: ConsumerProfile, createdBy: IntegerId, modifiedBy: IntegerId) => {
  const stored: ImageAware = {
    id: 12,
    texts: { description: 'image 12', source: 'source 12' },
    dam: { damId: 'file-12', licenceId: profile.licence, regionPosition: 0, internal: false },
    flags: { showSource: true, internal: false, overrideInternal: false },
    position: 1,
  }
  imageApi.has(stored)
  dam.assets.set(
    'asset-12',
    damAssetWithFile('asset-12', 'file-12', AssetFileProcessStatus.Processed, {
      licence: profile.licence,
      texts: { displayTitle: 'Harbour at dawn' },
      createdBy,
      modifiedBy,
    })
  )
}
const imageDialog = () =>
  Array.from(document.body.querySelectorAll<HTMLElement>('.v-overlay--active .v-card')).find((one) =>
    one.textContent?.includes(damText('image.meta.edit'))
  )
/** A widget of one image that has an image, with the dialog of that image open. */
const mountWithImageDialog = async (profile: ConsumerProfile, component: Component, props: Record<string, unknown>) => {
  await mountPage(profile, component, { expandOptions: true, ...props })
  const editImage = () => page!.findAll('button').find((button) => button.text() === damText('image.meta.edit'))
  await vi.waitFor(() => expect(editImage()).toBeDefined())
  await editImage()!.trigger('click')
  await vi.waitFor(() => expect(imageDialog()).toBeDefined())
  await flushPromises()
}
const editAssetOfImageDialog = () => buttonOf(imageDialog()!, useCommonAdminCoreDamOptions('default').editAssetLabel)!
const queueStatuses = () =>
  useUploadQueuesStore(pinia)
    .getQueueItems(QUEUE)
    .map((item) => item.status)
/** The gallery of an entity without images, with a file uploaded through it and processed by the DAM as `asset-1`. */
const mountGalleryWithUpload = async (createdBy: IntegerId, modifiedBy: IntegerId) => {
  await mountPage(cmsConfiguration, ImageWidgetMultipleInner, { modelValue: [], skipCurrentUserCheck: false })
  await damNamesAsked()
  const input = (page!.element as Element).querySelector<HTMLInputElement>('input[type="file"]')!
  const picked = new DataTransfer()
  picked.items.add(new File([new Uint8Array(3000)], 'a.jpg', { type: 'image/jpeg' }))
  input.files = picked.files
  input.dispatchEvent(new Event('change', { bubbles: true }))
  await vi.waitFor(() => expect(queueStatuses()).toEqual([Processing]))
  dam.fileBecomes('asset-1', AssetFileProcessStatus.Processed, {
    texts: { displayTitle: 'Harbour at dawn' },
    metadata: { customData: { description: 'uploaded' }, authorSuggestions: {}, keywordSuggestions: {} },
    createdBy,
    modifiedBy,
  })
  await waits.elapse()
  await vi.waitFor(() => expect(queueStatuses()).toEqual([Uploaded]))
  await damNamesAsked()
  await flushPromises()
}

interface Host {
  name: string
  /** The page when the user can press "edit asset", its asset created by `createdBy`, changed by `modifiedBy`. */
  mount: (createdBy: IntegerId, modifiedBy: IntegerId) => Promise<void>
  /** The asset whose detail "edit asset" opens. */
  asset: DocId
  editAsset: () => HTMLButtonElement
}

const hosts: Host[] = [
  {
    name: 'the dialog of the image of the image widget',
    mount: async (createdBy, modifiedBy) => {
      imageInTheDam(cmsConfiguration, createdBy, modifiedBy)
      await mountWithImageDialog(cmsConfiguration, ImageWidgetInner, { modelValue: 12, skipCurrentUserCheck: false })
    },
    asset: 'asset-12',
    editAsset: editAssetOfImageDialog,
  },
  {
    name: 'the dialog of the image of the image and media widget',
    mount: async (createdBy, modifiedBy) => {
      imageInTheDam(cmsConfiguration, createdBy, modifiedBy)
      await mountWithImageDialog(cmsConfiguration, ImageMediaWidgetInner, { image: 12, media: null })
    },
    asset: 'asset-12',
    editAsset: editAssetOfImageDialog,
  },
  {
    name: 'a row of the gallery',
    mount: async (createdBy, modifiedBy) => {
      imageInTheDam(cmsConfiguration, createdBy, modifiedBy)
      await mountPage(cmsConfiguration, ImageWidgetMultipleInner, { modelValue: [12], skipCurrentUserCheck: false })
      await vi.waitFor(() => expect(useImageStore(pinia).images).toHaveLength(1))
      await damNamesAsked()
      await flushPromises()
    },
    asset: 'asset-12',
    editAsset: () =>
      buttonOf(
        page!.findAllComponents(ImageWidgetMultipleItem)[0]!.element,
        useCommonAdminCoreDamOptions('default').editAssetLabel
      )!,
  },
  {
    // The row of the file uploaded through the gallery, whose detail the gallery draws.
    name: 'a row of the queue dialog',
    mount: mountGalleryWithUpload,
    asset: 'asset-1',
    editAsset: () =>
      buttonOf(
        document.body.querySelector<HTMLElement>('.overlay--sidebar .dam-upload-queue__item')!,
        damText('image.button.editAsset')
      )!,
  },
]

describe.each(hosts.map((host, index) => ({ ...host, createdBy: 31 + 2 * index, modifiedBy: 32 + 2 * index })))(
  'the detail opened by "edit asset" of $name, under the CMS configuration',
  (host) => {
    it('shows who created and who changed its asset by their names, asked of the DAM in one request', async () => {
      setUp(cmsConfiguration)
      await host.mount(host.createdBy, host.modifiedBy)

      await press(host.editAsset())
      await vi.waitFor(() => expect(useAssetDetailStore(pinia).asset?.id).toBe(host.asset))
      await vi.waitFor(() => expect(userChips()).toEqual([`User ${host.createdBy}`, `User ${host.modifiedBy}`]), {
        timeout: 5000,
        interval: 50,
      })

      expect(usersAsked()).toEqual([`${host.createdBy},${host.modifiedBy}`])
    })
  }
)

// admin-ugc switches the panel off: the detail asks for no user.
describe('the detail opened by "edit asset" under the UGC configuration', () => {
  it('asks for no user: it shows no panel "file"', async () => {
    setUp(ugcConfiguration)
    imageInTheDam(ugcConfiguration, 51, 52)
    await mountWithImageDialog(ugcConfiguration, ImageWidgetInner, { modelValue: 12, skipCurrentUserCheck: true })

    await press(editAssetOfImageDialog())
    await vi.waitFor(() => expect(useAssetDetailStore(pinia).asset?.id).toBe('asset-12'))
    // Longer than the cache waits before it asks.
    await waits.settle(1800)

    expect([filePanel(), usersAsked()]).toEqual([undefined, []])
  })
})
