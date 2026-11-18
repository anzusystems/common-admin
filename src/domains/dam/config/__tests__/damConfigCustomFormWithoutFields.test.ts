import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, type Pinia, setActivePinia } from 'pinia'
import { cmsConfiguration, installConsumerProfile } from '@/domains/dam/__tests__/support/consumerProfiles'
import { createFakeDam, type FakeDam } from '@/domains/dam/__tests__/support/fakeDam'
import { damText, forgetAlerts, signInToDam, signOutOfDam } from '@/domains/dam/__tests__/support/uploadUi'
import { useDamConfigState } from '@/domains/dam/config/composables/damConfigState'
import { useDamConfigStore } from '@/domains/dam/config/store/damConfigStore'
import AImageWidget from '@/domains/dam/imageWidget/components/AImageWidget.vue'
import ImageWidgetInner from '@/domains/dam/imageWidget/components/ImageWidgetInner.vue'

// The custom field configuration of an ext system is read by four requests, one per asset type.
// A read that answered with no fields was counted as failed. An ext system with no custom fields then had
// nothing written, the read rejected, and waiting code reported that the DAM configuration failed to load.
// A read that answers is the configuration, also when empty.
// Only when none of the four answers is there nothing to use.

const { endPoints, extSystem, licence } = cmsConfiguration
const CUSTOM_FORM = /^\/adm\/v1\/asset-custom-form\/ext-system\/(\d+)\/type\/(\w+)\/element\?/
const title = {
  id: 'element-title',
  property: 'title',
  name: 'title',
  position: 1,
  attributes: {
    type: 'string',
    minValue: null,
    maxValue: 255,
    minCount: null,
    maxCount: null,
    required: false,
    searchable: false,
    readonly: false,
  },
}

let pinia: Pinia
let dam: FakeDam
let wrapper: VueWrapper | undefined

describe('the configuration of the custom fields of an ext system', () => {
  beforeEach(() => {
    pinia = createPinia()
    setActivePinia(pinia)
    dam = createFakeDam(endPoints)
    installConsumerProfile(cmsConfiguration, dam.client)
    useDamConfigStore(pinia).damConfigAssetCustomFormElements.delete(extSystem)
    forgetAlerts()
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
  })
  afterEach(() => {
    wrapper?.unmount()
    wrapper = undefined
    vi.restoreAllMocks()
    signOutOfDam()
  })

  const configurationIsRead = (answer: (type: string) => { status: number; data?: unknown }) =>
    dam.reply((request) => {
      const read = request.method === 'GET' ? request.url.match(CUSTOM_FORM) : null
      return read ? answer(read[2]!) : undefined
    })
  const withoutFields = { status: 200, data: { data: [], totalCount: 0 } }
  const load = () => useDamConfigState(dam.client).loadDamConfigAssetCustomFormElements(extSystem)
  const loaded = () => useDamConfigStore(pinia).damConfigAssetCustomFormElements.get(extSystem)

  it('is loaded, with no field for any type, when each of its four reads answers with none', async () => {
    configurationIsRead(() => withoutFields)

    await expect(load()).resolves.toBe(true)

    expect(loaded()).toEqual({ image: [], audio: [], video: [], document: [] })
  })

  it('is loaded with what answered when a read of it fails, the type of that read without a field', async () => {
    configurationIsRead((type) =>
      type === 'image'
        ? { status: 200, data: { data: [title], totalCount: 1 } }
        : type === 'video'
          ? { status: 500 }
          : withoutFields
    )

    await expect(load()).resolves.toBe(true)

    expect(loaded()).toEqual({ image: [title], audio: [], video: [], document: [] })
  })

  // The failed type may be the only one with fields, so the form would be drawn without them.
  it('is not loaded when a read of it fails and the others answer with no field', async () => {
    configurationIsRead((type) => (type === 'image' ? { status: 500 } : withoutFields))

    await expect(load()).rejects.toBe(false)

    expect(loaded()).toBeUndefined()
  })

  it('is not loaded when none of its four reads answers: the read rejects, and nothing is written', async () => {
    configurationIsRead(() => ({ status: 500 }))

    await expect(load()).rejects.toBe(false)

    expect(loaded()).toBeUndefined()
  })

  // The outer widgets wait for this configuration before drawing.
  // Over an ext system without custom fields, the image widget reported
  // that the DAM configuration could not be loaded and drew nothing.
  it('lets the image widget be drawn over an ext system that has no custom field', async () => {
    configurationIsRead(() => withoutFields)
    signInToDam(extSystem)

    wrapper = mount(AImageWidget, {
      attachTo: document.body,
      props: { modelValue: null, queueKey: 'lead-image', uploadLicence: licence, selectLicences: [licence] },
      global: {
        plugins: [pinia],
        stubs: { VImg: true, AAssetSelect: true, AssetDetailDialog: true, UploadQueueDialogSingle: true },
      },
    })
    await vi.waitFor(() => expect(wrapper!.find('.v-progress-circular').exists()).toBe(false))
    await flushPromises()

    expect(wrapper.findComponent(ImageWidgetInner).exists()).toBe(true)
    expect(wrapper.text()).not.toContain(damText('error.loadingConfig'))
    expect(loaded()).toEqual({ image: [], audio: [], video: [], document: [] })
  })
})
