import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, type Pinia, setActivePinia } from 'pinia'
import ACustomDataForm from '@/domains/customDataForm/components/ACustomDataForm.vue'
import ACustomDataFormElement from '@/domains/customDataForm/components/ACustomDataFormElement.vue'
import ACustomDataFormHiddenPart from '@/domains/customDataForm/components/ACustomDataFormHiddenPart.vue'
import { useCustomDataForm } from '@/domains/customDataForm/composables/useCustomDataForm'
import type { CustomDataFormElement } from '@/domains/customDataForm/types/CustomDataForm'
import { CustomDataFormElementType } from '@/domains/customDataForm/types/CustomDataFormElementTypes'
import AssetCustomMetadataForm from '@/domains/dam/assetDetail/components/AssetCustomMetadataForm.vue'
import { useDamConfigStore } from '@/domains/dam/config/store/damConfigStore'
import { DamAssetType } from '@/domains/dam/types/Asset'
import type { DamExtSystemConfig } from '@/domains/dam/types/DamConfig'

// The custom fields of an asset: the first few are always shown ("pinned"), the rest sits behind "show all". How
// many are pinned is a setting of the DAM, per ext system and asset type.

const EXT_SYSTEM = 1
const FIELDS = ['title', 'description', 'headline', 'source']

const element = (property: string, position: number): CustomDataFormElement => ({
  id: `element-${property}`,
  property,
  name: property,
  position,
  attributes: {
    type: CustomDataFormElementType.String,
    minValue: null,
    maxValue: 255,
    minCount: null,
    maxCount: null,
    required: false,
    searchable: false,
    readonly: false,
  },
})

let pinia: Pinia
let wrapper: VueWrapper | undefined
beforeEach(() => {
  pinia = createPinia()
  setActivePinia(pinia)
})
afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  useCustomDataForm().showAll.value = false
})

/** The form of an image, in an ext system whose image settings are the given ones. */
const mountForm = async (image: Record<string, unknown> | undefined) => {
  const store = useDamConfigStore()
  store.damConfigExtSystem.set(EXT_SYSTEM, (image ? { image } : {}) as unknown as DamExtSystemConfig)
  store.damConfigAssetCustomFormElements.set(EXT_SYSTEM, {
    [DamAssetType.Image]: FIELDS.map((property, index) => element(property, index + 1)),
    [DamAssetType.Audio]: [],
    [DamAssetType.Video]: [],
    [DamAssetType.Document]: [],
  })
  wrapper = mount(AssetCustomMetadataForm, {
    attachTo: document.body,
    props: { assetType: DamAssetType.Image, extSystem: EXT_SYSTEM, modelValue: {}, validationScope: false },
    global: { plugins: [pinia] },
  })
  await flushPromises()
  const behindShowAll = wrapper
    .findComponent(ACustomDataFormHiddenPart)
    .findAllComponents(ACustomDataFormElement)
    .map((field) => field.props('config').property)
  const all = wrapper.findAllComponents(ACustomDataFormElement).map((field) => field.props('config').property)
  return {
    pinned: all.filter((property) => !behindShowAll.includes(property)),
    behindShowAll,
    hasToggle: wrapper.find('button').exists(),
  }
}

describe('the pinned custom fields of an asset', () => {
  it.each([
    [1, ['title'], ['description', 'headline', 'source'], true],
    [3, ['title', 'description', 'headline'], ['source'], true],
    [4, FIELDS, [], false],
    [5, FIELDS, [], false],
  ])('are as many as the DAM is configured with (%s)', async (amount, pinned, behindShowAll, hasToggle) => {
    expect(await mountForm({ customMetadataPinnedAmount: amount })).toEqual({ pinned, behindShowAll, hasToggle })
  })

  // No field pinned is a setting like any other: every field is behind "show all" then.
  it('are none when the DAM is configured with 0', async () => {
    expect(await mountForm({ customMetadataPinnedAmount: 0 })).toEqual({
      pinned: [],
      behindShowAll: FIELDS,
      hasToggle: true,
    })
    expect(wrapper!.findComponent(ACustomDataForm).props('pinnedCount')).toBe(0)
  })

  it.each([
    ['the setting is missing', {}],
    ['the ext system has no settings for images', undefined],
  ])('are the first two when %s', async (_why, image) => {
    expect(await mountForm(image)).toEqual({
      pinned: ['title', 'description'],
      behindShowAll: ['headline', 'source'],
      hasToggle: true,
    })
  })
})
