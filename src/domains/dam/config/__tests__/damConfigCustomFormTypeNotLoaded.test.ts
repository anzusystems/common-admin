import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, type Pinia, setActivePinia } from 'pinia'
import { type Component, h } from 'vue'
import { cmsConfiguration, installConsumerProfile } from '@/domains/dam/__tests__/support/consumerProfiles'
import { createFakeDam, type FakeDam } from '@/domains/dam/__tests__/support/fakeDam'
import { holdLongWaits, type LongWaits } from '@/domains/dam/__tests__/support/longWaits'
import { damText, forgetAlerts, signInToDam, signOutOfDam } from '@/domains/dam/__tests__/support/uploadUi'
import AAssetSelect from '@/domains/dam/assetSelect/components/AAssetSelect.vue'
import AAssetSelectMedia from '@/domains/dam/assetSelect/components/AAssetSelectMedia.vue'
import AssetCustomMetadataForm from '@/domains/dam/assetDetail/components/AssetCustomMetadataForm.vue'
import AssetMetadata from '@/domains/dam/assetDetail/components/AssetMetadata.vue'
import { useAssetDetailStore } from '@/domains/dam/assetDetail/store/assetDetailStore'
import AssetCustomMetadataFormMassOperations from '@/domains/dam/uploadQueue/components/AssetCustomMetadataFormMassOperations.vue'
import { damAsset } from '@/domains/dam/__tests__/support/fakeDam'
import { useSidebar } from '@/domains/dam/assetSelect/composables/assetSelectFilterSidebar'
import { useDamConfigState } from '@/domains/dam/config/composables/damConfigState'
import { useDamConfigStore } from '@/domains/dam/config/store/damConfigStore'
import AImageWidget from '@/domains/dam/imageWidget/components/AImageWidget.vue'
import ImageWidgetInner from '@/domains/dam/imageWidget/components/ImageWidgetInner.vue'
import { DamAssetType, type DamAssetTypeType } from '@/domains/dam/types/Asset'

// The custom fields of an ext system are read by four requests, one per asset type.
// When some failed beside one that brought fields, the failed types kept the initial `[]` and the configuration counted
// as loaded. Nothing requested those types again, and their forms were drawn without fields until a page reload.
// Now a type whose read failed is not loaded, and whatever needs it reads that type again, alone.
// The test uses the real loader, widget and picker. The DAM is a client that
// records requests, and only the long waits are taken out of real time.

const { endPoints, extSystem, licence } = cmsConfiguration
const CUSTOM_FORM = /^\/adm\/v1\/asset-custom-form\/ext-system\/(\d+)\/type\/(\w+)\/element\?/
const field = (property: string) => ({
  id: `element-${property}`,
  property,
  name: property,
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
})
const withFields = (property: string) => ({ status: 200, data: { data: [field(property)], totalCount: 1 } })
const withoutFields = { status: 200, data: { data: [], totalCount: 0 } }
const failed = { status: 500 }

let pinia: Pinia
let dam: FakeDam
let waits: LongWaits
let wrapper: VueWrapper | undefined
let answers: Record<DamAssetTypeType, { status: number; data?: unknown }>

beforeEach(() => {
  pinia = createPinia()
  setActivePinia(pinia)
  dam = createFakeDam(endPoints)
  installConsumerProfile(cmsConfiguration, dam.client)
  useDamConfigStore(pinia).damConfigAssetCustomFormElements.delete(extSystem)
  answers = { image: withFields('title'), audio: withFields('album'), video: withoutFields, document: withoutFields }
  dam.reply((request) => {
    const read = request.method === 'GET' ? request.url.match(CUSTOM_FORM) : null
    return read ? answers[read[2] as DamAssetTypeType] : undefined
  })
  dam.reply((request) =>
    request.method === 'GET' && request.url.startsWith(`${endPoints.asset}/licence/${licence}/search?`)
      ? { status: 200, data: { data: [], totalCount: 0 } }
      : undefined
  )
  waits = holdLongWaits()
  forgetAlerts()
  signInToDam(extSystem)
  vi.spyOn(console, 'error').mockImplementation(() => undefined)
})
afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  useSidebar().closeSidebarRight()
  waits.restore()
  vi.restoreAllMocks()
  signOutOfDam()
})

const state = () => useDamConfigState(dam.client)
const formReads = (from = 0) =>
  dam.requests
    .slice(from)
    .map((request) => request.url.match(CUSTOM_FORM)?.[2])
    .filter((type) => type !== undefined)
const fieldsOf = (type: DamAssetTypeType) =>
  state()
    .getDamConfigAssetCustomFormElements(extSystem, type)
    ?.[type].map((one) => one.property)

describe('the custom fields of a type whose read failed beside a read that brought fields', () => {
  it('are not loaded, and the other types are: the image type failed', async () => {
    answers.image = failed

    await expect(state().loadDamConfigAssetCustomFormElements(extSystem)).resolves.toBe(true)

    expect([fieldsOf(DamAssetType.Image), fieldsOf(DamAssetType.Audio), fieldsOf(DamAssetType.Video)]).toEqual([
      undefined,
      ['album'],
      [],
    ])
    // Callers that read the store without a type still get `[]`, as before.
    expect(state().getDamConfigAssetCustomFormElements(extSystem)?.image).toEqual([])
  })

  it('are not loaded, and the other types are: the audio type failed', async () => {
    answers.audio = failed

    await expect(state().loadDamConfigAssetCustomFormElements(extSystem)).resolves.toBe(true)

    expect([fieldsOf(DamAssetType.Image), fieldsOf(DamAssetType.Audio)]).toEqual([['title'], undefined])
  })

  it('are loaded once read again alone, and the types loaded keep their fields', async () => {
    answers.image = failed
    await state().loadDamConfigAssetCustomFormElements(extSystem)
    expect(fieldsOf(DamAssetType.Image)).toBeUndefined()
    answers.image = withFields('headline')
    const from = dam.requests.length

    await expect(state().loadDamConfigAssetCustomFormElements(extSystem, [DamAssetType.Image])).resolves.toBe(true)

    expect(formReads(from)).toEqual(['image'])
    expect([fieldsOf(DamAssetType.Image), fieldsOf(DamAssetType.Audio)]).toEqual([['headline'], ['album']])
  })

  it('stay not loaded when read again alone and failing again, and the types loaded keep their fields', async () => {
    answers.image = failed
    await state().loadDamConfigAssetCustomFormElements(extSystem)
    expect(fieldsOf(DamAssetType.Image)).toBeUndefined()

    await expect(state().loadDamConfigAssetCustomFormElements(extSystem, [DamAssetType.Image])).rejects.toBe(false)

    expect([fieldsOf(DamAssetType.Image), fieldsOf(DamAssetType.Audio)]).toEqual([undefined, ['album']])
  })

  // Two widgets on a page read at once. The read that failed answered
  // last and marked the type the other read had loaded as not loaded.
  it('stay loaded when another read loaded them meanwhile and a read of them that failed answers last', async () => {
    const images = dam.hold('GET', /\/type\/image\/element\?/)
    const first = state().loadDamConfigAssetCustomFormElements(extSystem)
    const second = state().loadDamConfigAssetCustomFormElements(extSystem)
    await vi.waitFor(() => expect(images.waiting).toHaveLength(2))

    images.waiting[0]!.release(withFields('title'))
    await expect(first).resolves.toBe(true)
    images.waiting[0]!.release(failed)
    await expect(second).resolves.toBe(true)

    expect([fieldsOf(DamAssetType.Image), fieldsOf(DamAssetType.Audio)]).toEqual([['title'], ['album']])
  })
})

describe('the image widget over an ext system whose custom fields are read as it mounts', () => {
  const mountWidget = async () => {
    wrapper?.unmount()
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
  }
  const drawn = () => wrapper!.findComponent(ImageWidgetInner).exists()
  const saysItFailed = () => wrapper!.text().includes(damText('error.loadingConfig'))

  // Before the fix, the upload offered the image form without its fields.
  it('says its configuration failed when the image type failed; mounted again, it reads that type alone and is drawn', async () => {
    answers.image = failed

    await mountWidget()

    expect(formReads()).toEqual(['image', 'audio', 'video', 'document'])
    expect([drawn(), saysItFailed()]).toEqual([false, true])

    answers.image = withFields('title')
    const from = dam.requests.length
    await mountWidget()

    expect(formReads(from)).toEqual(['image'])
    expect([drawn(), saysItFailed()]).toEqual([true, false])
    expect(fieldsOf(DamAssetType.Image)).toEqual(['title'])
  })

  it('is drawn as before when the audio type failed, and does not read it again when mounted again', async () => {
    answers.audio = failed

    await mountWidget()
    expect([drawn(), saysItFailed()]).toEqual([true, false])
    const from = dam.requests.length
    await mountWidget()

    expect(formReads(from)).toEqual([])
    expect([drawn(), saysItFailed()]).toEqual([true, false])
  })
})

describe('an asset picker over an ext system whose audio type failed beside the image type', () => {
  const openPicker = async (component: Component, props: Record<string, unknown>) => {
    answers.audio = failed
    await state().loadDamConfigAssetCustomFormElements(extSystem)
    answers.audio = withFields('album')
    const from = dam.requests.length
    wrapper = mount(component, {
      attachTo: document.body,
      props: {
        modelValue: false,
        'onUpdate:modelValue': (value: boolean) => wrapper!.setProps({ modelValue: value }),
        minCount: 1,
        maxCount: 1,
        selectLicences: [licence],
        uploadLicence: licence,
        returnType: 'asset',
        ...props,
      } as never,
      global: { plugins: [pinia], stubs: { VImg: true, AssetImagePreview: true, AssetMetadata: true } },
    })
    await flushPromises()
    await wrapper.setProps({ modelValue: true })
    await waits.settle()
    return from
  }
  const saysItFailed = () =>
    document.body.querySelector('.subject-select__card')!.textContent!.includes(damText('error.loadingConfig'))

  it('of audio reads the custom fields of audio alone, and its side panel does not say the configuration failed', async () => {
    const from = await openPicker(AAssetSelect, { assetType: DamAssetType.Audio })
    await vi.waitFor(() => expect(formReads(from)).toEqual(['audio']))
    await waits.settle()

    expect([fieldsOf(DamAssetType.Audio), saysItFailed(), formReads(from)]).toEqual([['album'], false, ['audio']])
  })

  // The widget used to look at the custom fields only when its ext system was set, not when its list type changed.
  it('of the image and media widget reads them alone once its list is switched to audio', async () => {
    const from = await openPicker(AAssetSelectMedia, {})
    expect(formReads(from)).toEqual([])

    document.body.querySelector<HTMLButtonElement>('[data-cy="button-in-podcast-types"]')!.click()
    await vi.waitFor(() => expect(formReads(from)).toEqual(['audio']))
    await waits.settle()

    expect([fieldsOf(DamAssetType.Audio), saysItFailed(), formReads(from)]).toEqual([['album'], false, ['audio']])
  })
})

// admin-dam reads the custom fields once at start and draws these forms with nothing in front that reads a type again.
// When the form threw for a type that was not loaded, it also took down what its host
// draws into or beside it: keywords, authors and the switches of the metadata panel.
describe('the forms of the custom fields of a type whose read failed beside a read that brought fields', () => {
  let thrown: unknown[]
  beforeEach(async () => {
    thrown = []
    answers.image = failed
    await state().loadDamConfigAssetCustomFormElements(extSystem)
  })
  const mountForm = (
    component: Component,
    props: Record<string, unknown>,
    slots: Record<string, () => unknown> = {}
  ) => {
    wrapper = mount(component, {
      attachTo: document.body,
      props: props as never,
      slots: slots as never,
      global: {
        plugins: [pinia],
        stubs: { KeywordRemoteAutocompleteWithCached: true, AuthorRemoteAutocompleteWithCached: true },
        config: { errorHandler: (error) => thrown.push(error) },
      },
    })
  }
  const saysItFailed = () => wrapper!.text().includes(damText('error.loadingConfig'))

  it('of the asset detail say the configuration could not be loaded in place of the fields, and draw the rest', async () => {
    useAssetDetailStore(pinia).setAsset(damAsset('asset-1', { licence }))
    mountForm(AssetMetadata, { extSystem })
    await flushPromises()

    expect(thrown).toEqual([])
    expect(saysItFailed()).toBe(true)
    expect(wrapper!.find('[data-cy="custom-field-title"]').exists()).toBe(false)
    expect([
      wrapper!.findComponent({ name: 'KeywordRemoteAutocompleteWithCached' }).exists(),
      wrapper!.findComponent({ name: 'AuthorRemoteAutocompleteWithCached' }).exists(),
    ]).toEqual([true, true])
  })

  it('draw what their host puts into them, as admin-dam does, beside the text', async () => {
    mountForm(
      AssetCustomMetadataForm,
      { assetType: DamAssetType.Image, extSystem, modelValue: {} },
      { 'after-pinned': () => h('div', { 'data-cy': 'of-the-host' }, 'keywords of the host') }
    )
    await flushPromises()

    expect(thrown).toEqual([])
    expect([saysItFailed(), wrapper!.find('[data-cy="of-the-host"]').exists()]).toEqual([true, true])
  })

  it('of the mass operations of the queue say so in place of the fields', async () => {
    mountForm(AssetCustomMetadataFormMassOperations, { assetType: DamAssetType.Image, extSystem, modelValue: {} })
    await flushPromises()

    expect(thrown).toEqual([])
    expect(saysItFailed()).toBe(true)
  })

  it('of a type that is loaded show its fields and say nothing of the configuration', async () => {
    mountForm(AssetCustomMetadataForm, { assetType: DamAssetType.Audio, extSystem, modelValue: {} })
    await flushPromises()

    expect(thrown).toEqual([])
    expect([saysItFailed(), wrapper!.find('[data-cy="custom-field-album"]').exists()]).toEqual([false, true])
  })
})
