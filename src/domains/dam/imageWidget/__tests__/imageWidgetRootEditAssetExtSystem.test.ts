import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, type Pinia, setActivePinia } from 'pinia'
import { type Component, defineComponent, h } from 'vue'
import { type ConsumerImageApi, installConsumerImageApi } from '@/domains/dam/__tests__/support/consumerImageApi'
import { cmsConfiguration, installConsumerProfile } from '@/domains/dam/__tests__/support/consumerProfiles'
import { answerDamNames } from '@/domains/dam/__tests__/support/damNames'
import { type DamSocket, stubDamSocket } from '@/domains/dam/__tests__/support/damSocket'
import { createFakeDam, damAssetWithFile, type FakeDam } from '@/domains/dam/__tests__/support/fakeDam'
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
import { useCommonAdminCoreDamOptions } from '@/domains/dam/composables/commonAdminCoreDamOptions'
import { destroyDamNotifications, initDamNotifications } from '@/domains/dam/composables/damNotifications'
import { useDamNotificationsEventBus } from '@/domains/dam/composables/damNotificationsEventBus'
import { useExtSystemIdForCached } from '@/domains/dam/composables/extSystemIdForCached'
import { useDamConfigStore } from '@/domains/dam/config/store/damConfigStore'
import AImageMediaWidget from '@/domains/dam/imageWidget/components/AImageMediaWidget.vue'
import AImageWidget from '@/domains/dam/imageWidget/components/AImageWidget.vue'
import AImageWidgetMultiple from '@/domains/dam/imageWidget/components/AImageWidgetMultiple.vue'
import ImageWidgetMultipleItem from '@/domains/dam/imageWidget/components/ImageWidgetMultipleItem.vue'
import { useImageStore } from '@/domains/dam/imageWidget/store/imageStore'
import { AssetFileProcessStatus } from '@/domains/dam/types/AssetFile'
import type { ImageAware } from '@/domains/dam/types/ImageAware'
import { useUploadQueuesStore } from '@/domains/dam/uploadQueue/store/uploadQueuesStore'
import type { IntegerId } from '@/shared/types/common'

// "Edit asset" in the image dialog of a single-image widget as admin-cms mounts it. The detail reads
// the ext system configuration while drawing and threw "Ext system must be initialised." in two cases:
// opened under ext system 0 (the single-image root writes none) for an image whose licence the client cannot resolve,
// and opened under a resolved ext system whose configuration the store never loaded.

const QUEUE = 'root-edit-asset'
const { endPoints, extSystem, licence } = cmsConfiguration
// A licence the client cannot read (the DAM refuses it to the user): the client cannot resolve it.
const UNRESOLVED = 900009
const OTHER = 300003
const OTHER_EXT_SYSTEM = 7
const LICENCE_READ = new RegExp(`^/adm/v1/asset-licence/(\\d+)$`)
const OTHER_CONFIGURATION = `/adm/v1/configuration/ext-system/${OTHER_EXT_SYSTEM}`
const OTHER_FORMS = new RegExp(`^/adm/v1/asset-custom-form/ext-system/${OTHER_EXT_SYSTEM}/type/(\\w+)/element\\?`)
const USERS = /^\/adm\/v1\/user\?/

let pinia: Pinia
let dam: FakeDam
let imageApi: ConsumerImageApi
let waits: LongWaits
let socket: DamSocket
let page: VueWrapper | undefined
let thrown: unknown[]
let otherConfiguration: unknown

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
  AFileDropzone: true,
  AFormRemoteAutocompleteWithCached: true,
}

const buttonOf = (root: ParentNode, text: string) =>
  Array.from(root.querySelectorAll<HTMLButtonElement>('button')).find((button) => button.textContent?.trim() === text)
const detail = () => useAssetDetailStore(pinia)
const pageExtSystem = () => useExtSystemIdForCached().cachedExtSystemId
const card = () => document.body.querySelector<HTMLElement>('.dam-image-detail')
const assetDrawn = () => !!card()?.querySelector('.dam-image-detail__left')
const metadataDrawn = () => !!card()?.querySelector('[data-cy="custom-field-authors"]')
const loaderDrawn = () => !!card()?.querySelector('.v-progress-circular') && !assetDrawn()
const imageDialog = () =>
  Array.from(document.body.querySelectorAll<HTMLElement>('.v-overlay--active .v-card')).find((one) =>
    one.textContent?.includes(damText('image.meta.edit'))
  )
const editAsset = () => buttonOf(imageDialog()!, useCommonAdminCoreDamOptions('default').editAssetLabel)!
const press = async (button: HTMLButtonElement) => {
  button.click()
  await flushPromises()
}
const configurationAsked = (from = 0) =>
  dam.requests
    .slice(from)
    .filter((request) => request.url === OTHER_CONFIGURATION || OTHER_FORMS.test(request.url))
    .map((request) => request.url.replace(/\?.*$/, ''))
const failureSaid = [['error', alertText('common.alert.unknownError')]]

const answerDam = () => {
  const store = useDamConfigStore(pinia)
  otherConfiguration = structuredClone(store.damConfigExtSystem.get(extSystem)!)
  const forms = structuredClone(store.damConfigAssetCustomFormElements.get(extSystem)!)
  dam.reply((request) => {
    if (request.method !== 'GET') return undefined
    const licenceRead = request.url.match(LICENCE_READ)
    if (licenceRead) {
      const id = Number(licenceRead[1])
      if (id !== OTHER) return { status: 403 }
      return { status: 200, data: { id, name: 'other', extSystem: OTHER_EXT_SYSTEM, extId: '' } }
    }
    if (request.url === OTHER_CONFIGURATION) return { status: 200, data: otherConfiguration }
    const form = request.url.match(OTHER_FORMS)
    if (form) {
      const elements = forms[form[1] as keyof typeof forms] ?? []
      return { status: 200, data: { data: elements, totalCount: elements.length } }
    }
    if (USERS.test(request.url)) {
      const ids = (decodeURIComponent(request.url).match(/filter_in\[id\]=([\d,]+)/)?.[1] ?? '').split(',')
      const users = ids.map((id) => ({
        id: Number(id),
        email: `user${id}@dam.test`,
        avatar: { color: '', text: '' },
        person: { firstName: 'User', lastName: id, fullName: `User ${id}` },
      }))
      return { status: 200, data: { data: users, totalCount: users.length } }
    }
    return undefined
  })
}

beforeEach(() => {
  pinia = createPinia()
  setActivePinia(pinia)
  dam = createFakeDam(endPoints)
  imageApi = installConsumerImageApi(cmsConfiguration, installConsumerProfile(cmsConfiguration, dam.client))
  answerDamNames(dam)
  answerDam()
  waits = holdLongWaits()
  socket = stubDamSocket()
  forgetAlerts()
  initDamNotifications().openConnection()
  socket.accept()
  signInToDam(extSystem)
  pageExtSystem().value = 0
  thrown = []
})
afterEach(() => {
  page?.unmount()
  page = undefined
  useUploadQueuesStore(pinia).stopUpload(QUEUE)
  destroyDamNotifications()
  waits.restore()
  socket.restore()
  useDamNotificationsEventBus().reset()
  signOutOfDam()
})

const stored: ImageAware = {
  id: 12,
  texts: { description: 'image 12', source: 'source 12' },
  dam: { damId: 'file-12', licenceId: licence, regionPosition: 0, internal: false },
  flags: { showSource: true, internal: false, overrideInternal: false },
  position: 1,
}
const imageOfLicence = (of: IntegerId) => {
  imageApi.has(stored)
  dam.assets.set(
    'asset-12',
    damAssetWithFile('asset-12', 'file-12', AssetFileProcessStatus.Processed, {
      licence: of,
      texts: { displayTitle: 'Harbour at dawn' },
    })
  )
}

describe.each<[string, Component, Record<string, unknown>]>([
  ['the image widget', AImageWidget, { modelValue: 12 }],
  ['the image and media widget', AImageMediaWidget, { image: 12, media: null }],
])('"edit asset" of %s', (_name, root, props) => {
  const mountWithImageDialog = async () => {
    page = mount(root, {
      attachTo: document.body,
      props: {
        queueKey: QUEUE,
        uploadLicence: licence,
        selectLicences: [licence],
        expandOptions: true,
        ...props,
      } as never,
      global: { plugins: [pinia], stubs: STAND_INS, config: { errorHandler: (error) => thrown.push(error) } },
    })
    const editImage = () => page!.findAll('button').find((button) => button.text() === damText('image.meta.edit'))
    await vi.waitFor(() => expect(editImage()).toBeDefined())
    await editImage()!.trigger('click')
    await vi.waitFor(() => expect(imageDialog()).toBeDefined())
    await flushPromises()
  }

  it('has the root write the ext system of its upload licence for its configuration as it mounts', async () => {
    imageOfLicence(licence)
    await mountWithImageDialog()

    expect(pageExtSystem().value).toBe(extSystem)
  })

  it("shows the detail of an image of a licence the client cannot resolve, under the widget's ext system", async () => {
    imageOfLicence(UNRESOLVED)
    await mountWithImageDialog()

    await press(editAsset())
    await vi.waitFor(() => expect(detail().asset?.id).toBe('asset-12'))
    await waits.settle()

    expect(thrown).toEqual([])
    expect([assetDrawn(), metadataDrawn()]).toEqual([true, true])
    expect(pageExtSystem().value).toBe(extSystem)
    expect(configurationAsked()).toEqual([])
    expect(shownAlerts()).toEqual([])
  })

  it('loads the configuration of an ext system the store never had before the detail shows the asset', async () => {
    imageOfLicence(OTHER)
    await mountWithImageDialog()

    await press(editAsset())
    await vi.waitFor(() => expect(detail().asset?.id).toBe('asset-12'))
    await waits.settle()

    expect(thrown).toEqual([])
    expect([assetDrawn(), metadataDrawn()]).toEqual([true, true])
    expect(pageExtSystem().value).toBe(OTHER_EXT_SYSTEM)
    expect(configurationAsked().sort()).toEqual(
      [
        OTHER_CONFIGURATION,
        ...['audio', 'document', 'image', 'video'].map(
          (type) => `/adm/v1/asset-custom-form/ext-system/${OTHER_EXT_SYSTEM}/type/${type}/element`
        ),
      ].sort()
    )
    expect(useDamConfigStore(pinia).damConfigExtSystem.has(OTHER_EXT_SYSTEM)).toBe(true)
    expect(shownAlerts()).toEqual([])
  })

  it('closes the detail and says so once when that configuration cannot be loaded; the page goes on', async () => {
    imageOfLicence(OTHER)
    await mountWithImageDialog()
    const refused = dam.reply((request) => (request.url === OTHER_CONFIGURATION ? { status: 500 } : undefined))

    await press(editAsset())
    await vi.waitFor(() => expect(shownAlerts()).toHaveLength(1))
    await waits.settle()

    expect(thrown).toEqual([])
    expect(shownAlerts()).toEqual(failureSaid)
    expect([detail().dialog, detail().asset, detail().loading]).toEqual([null, null, false])
    expect(card()).toBeNull()
    expect(pageExtSystem().value).toBe(extSystem)

    refused()
    await press(editAsset())
    await vi.waitFor(() => expect(detail().asset?.id).toBe('asset-12'))
    await waits.settle()
    expect(thrown).toEqual([])
    expect([assetDrawn(), metadataDrawn()]).toEqual([true, true])
    expect(shownAlerts()).toEqual(failureSaid)
  })

  // Guards a regression: when the image fields of an ext system failed
  // beside its audio fields, its custom fields counted as loaded.
  // The detail drew the image form without its fields, and nothing read them again.
  it('closes the detail when the image fields of that ext system fail beside its others; the next opening reads them alone', async () => {
    imageOfLicence(OTHER)
    await mountWithImageDialog()
    const fields = structuredClone(useDamConfigStore(pinia).damConfigAssetCustomFormElements.get(extSystem)!.image)
    const answered = { status: 200, data: { data: fields, totalCount: fields.length } }
    let imageFields: { status: number; data?: unknown } = { status: 500 }
    dam.reply((request) => {
      const form = request.method === 'GET' ? request.url.match(OTHER_FORMS) : null
      if (form?.[1] === 'image') return imageFields
      return form?.[1] === 'audio' ? answered : undefined
    })

    await press(editAsset())
    await vi.waitFor(() => expect(shownAlerts()).toHaveLength(1))
    await waits.settle()

    expect(thrown).toEqual([])
    expect(shownAlerts()).toEqual(failureSaid)
    expect([detail().dialog, detail().asset, card()]).toEqual([null, null, null])

    imageFields = answered
    const from = dam.requests.length
    await press(editAsset())
    await vi.waitFor(() => expect(detail().asset?.id).toBe('asset-12'))
    await waits.settle()

    expect(configurationAsked(from)).toEqual([
      `/adm/v1/asset-custom-form/ext-system/${OTHER_EXT_SYSTEM}/type/image/element`,
    ])
    expect(thrown).toEqual([])
    expect([assetDrawn(), metadataDrawn(), !!card()!.querySelector('[data-cy="custom-field-title"]')]).toEqual([
      true,
      true,
      true,
    ])
    expect(shownAlerts()).toEqual(failureSaid)
  })

  it('shows nothing of a configuration that answers after the detail was closed from its loader', async () => {
    imageOfLicence(OTHER)
    await mountWithImageDialog()
    const held = dam.hold('GET', new RegExp(`^${OTHER_CONFIGURATION}$`))

    await press(editAsset())
    await vi.waitFor(() => expect(held.waiting).toHaveLength(1))
    expect(loaderDrawn()).toBe(true)
    await press(card()!.querySelector<HTMLButtonElement>(`button[aria-label="${uiText('common.button.close')}"]`)!)
    held.waiting[0]!.release({ status: 200, data: otherConfiguration })
    await waits.settle()

    expect(thrown).toEqual([])
    expect([detail().dialog, detail().asset, detail().loading]).toEqual([null, null, false])
    expect(card()).toBeNull()
    expect(pageExtSystem().value).toBe(extSystem)
    expect(shownAlerts()).toEqual([])
  })
})

// Guards a regression: a gallery of admin-cms whose site group offers a licence of another
// ext system loads the configuration of that ext system, not the custom fields of its assets.
// The gallery still opened the detail of an image of that licence, and
// the metadata form threw "Custom form elements must be initialised.".
describe('"edit asset" of a row of the gallery', () => {
  it('loads the custom fields of the ext system of a select licence before the detail shows the asset', async () => {
    imageOfLicence(OTHER)
    dam.reply((request) => {
      const files = request.method === 'GET' ? request.url.match(/\/search\?assetAndMainFileIds=([^&]*)/) : null
      if (!files) return undefined
      const found = [...dam.assets.values()].filter(
        (one) => one.mainFile && files[1]!.split(',').includes(one.mainFile.id)
      )
      return { status: 200, data: { data: found, totalCount: found.length } }
    })
    page = mount(AImageWidgetMultiple, {
      attachTo: document.body,
      props: { modelValue: [12], queueKey: QUEUE, uploadLicence: licence, selectLicences: [licence, OTHER] } as never,
      global: { plugins: [pinia], stubs: STAND_INS, config: { errorHandler: (error) => thrown.push(error) } },
    })
    await vi.waitFor(() => expect(useImageStore(pinia).images).toHaveLength(1))
    await waits.settle()
    expect(useDamConfigStore(pinia).damConfigExtSystem.has(OTHER_EXT_SYSTEM)).toBe(true)
    const before = dam.requests.length

    await press(
      buttonOf(
        page.findAllComponents(ImageWidgetMultipleItem)[0]!.element,
        useCommonAdminCoreDamOptions('default').editAssetLabel
      )!
    )
    await vi.waitFor(() => expect(detail().asset?.id).toBe('asset-12'))
    await waits.settle()

    expect(thrown).toEqual([])
    expect([assetDrawn(), metadataDrawn()]).toEqual([true, true])
    expect(pageExtSystem().value).toBe(OTHER_EXT_SYSTEM)
    expect(configurationAsked(before).sort()).toEqual(
      ['audio', 'document', 'image', 'video'].map(
        (type) => `/adm/v1/asset-custom-form/ext-system/${OTHER_EXT_SYSTEM}/type/${type}/element`
      )
    )
    expect(shownAlerts()).toEqual([])
  })
})
