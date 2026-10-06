import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import useVuelidate from '@vuelidate/core'
import { defineComponent, h, reactive } from 'vue'
import type { CustomDataFormElement } from '@/domains/customDataForm/types/CustomDataForm'
import { CustomDataFormElementType } from '@/domains/customDataForm/types/CustomDataFormElementTypes'
import { useDamConfigStore } from '@/domains/dam/config/store/damConfigStore'
import { DamAssetType } from '@/domains/dam/types/Asset'
import type { DamExtSystemConfig } from '@/domains/dam/types/DamConfig'
import { UploadQueueItemStatus, UploadQueueItemType } from '@/domains/dam/types/UploadQueue'
import AssetCustomMetadataForm from '@/domains/dam/assetDetail/components/AssetCustomMetadataForm.vue'
import { ADamAssetMetadataValidationScopeSymbol } from '@/domains/dam/composables/uploadValidations'
import UploadQueueItemEditable from '@/domains/dam/uploadQueue/components/UploadQueueItemEditable.vue'
import { useUploadQueueItemFactory } from '@/domains/dam/uploadQueue/factory/UploadQueueItemFactory'

vi.mock('@/domains/dam/composables/commonAdminCoreDamOptions', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useCommonAdminCoreDamOptions: () => ({ damClient: () => ({}) }),
}))

const EXT_SYSTEM = 1

const requiredText: CustomDataFormElement = {
  id: 'title',
  property: 'title',
  name: 'Title',
  position: 1,
  attributes: {
    type: CustomDataFormElementType.String,
    minValue: null,
    maxValue: null,
    minCount: null,
    maxCount: null,
    required: true,
    searchable: false,
    readonly: false,
  },
}

// A required custom field and required keywords: two fields of the row, both empty.
const extSystemConfig = {
  image: { keywords: { enabled: true, required: true }, customMetadataPinnedAmount: 2 },
} as unknown as DamExtSystemConfig

let wrapper: VueWrapper | undefined
let forget: () => void = () => {}
afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  forget()
})

describe('a row of the upload queue', () => {
  // The dialog saves the items whose metadata can be edited and skips the rest (`hasMetadataToSave`): a failed
  // upload, or one still waiting for its metadata. Their fields are disabled, so nothing could be put right.
  it('is validated by the dialog only while its metadata can be edited', async () => {
    const item = reactive(
      useUploadQueueItemFactory().createDefault(
        'row',
        UploadQueueItemType.File,
        UploadQueueItemStatus.Processing,
        DamAssetType.Image,
        1,
        1
      )
    )
    item.assetId = 'asset-1'
    let failing!: () => number
    const Dialog = defineComponent({
      setup() {
        // The configuration the row reads, in the pinia the components use.
        const store = useDamConfigStore()
        store.damConfigExtSystem.set(EXT_SYSTEM, extSystemConfig)
        store.damConfigAssetCustomFormElements.set(EXT_SYSTEM, {
          [DamAssetType.Image]: [requiredText],
          [DamAssetType.Audio]: [],
          [DamAssetType.Video]: [],
          [DamAssetType.Document]: [],
        })
        forget = () => {
          store.damConfigExtSystem.delete(EXT_SYSTEM)
          store.damConfigAssetCustomFormElements.delete(EXT_SYSTEM)
        }
        // As `UploadQueueDialog` validates: everything below it.
        const v$ = useVuelidate({ $stopPropagation: true })
        failing = () => {
          v$.value.$touch()
          return v$.value.$errors.length
        }
        return () =>
          h(UploadQueueItemEditable, {
            index: 0,
            queueKey: 'queue',
            extSystem: EXT_SYSTEM,
            customData: item.customData,
            keywords: item.keywords,
            authors: item.authors,
            item,
            refreshDisabled: false,
            mainFileSingleUse: item.mainFileSingleUse,
          })
      },
    })
    wrapper = mount(Dialog, {
      attachTo: document.body,
      // The scope is read by the keyword input itself; what it renders asks the API for its items.
      global: { stubs: { AFormRemoteAutocompleteWithCached: true } },
    })
    await flushPromises()
    expect(wrapper.find('textarea, input').exists()).toBe(true)
    expect(failing()).toBe(0)

    // Its metadata arrived: from now on the save sends the item.
    item.canEditMetadata = true
    await flushPromises()
    expect(failing()).toBe(2)

    // And it failed after all.
    item.canEditMetadata = false
    await flushPromises()
    expect(failing()).toBe(0)
  })
})

describe('the custom metadata form of an asset', () => {
  // The asset detail and the single upload dialog save through a collector of the asset metadata scope and give
  // the form no scope of their own.
  it('is in the asset metadata scope when it is given none', async () => {
    let invalid!: () => boolean
    const Sidebar = defineComponent({
      setup() {
        const store = useDamConfigStore()
        store.damConfigExtSystem.set(EXT_SYSTEM, extSystemConfig)
        store.damConfigAssetCustomFormElements.set(EXT_SYSTEM, {
          [DamAssetType.Image]: [requiredText],
          [DamAssetType.Audio]: [],
          [DamAssetType.Video]: [],
          [DamAssetType.Document]: [],
        })
        forget = () => {
          store.damConfigExtSystem.delete(EXT_SYSTEM)
          store.damConfigAssetCustomFormElements.delete(EXT_SYSTEM)
        }
        const v$ = useVuelidate({ $scope: ADamAssetMetadataValidationScopeSymbol })
        invalid = () => {
          v$.value.$touch()
          return v$.value.$invalid
        }
        return () =>
          h(AssetCustomMetadataForm, { assetType: DamAssetType.Image, extSystem: EXT_SYSTEM, modelValue: {} })
      },
    })
    wrapper = mount(Sidebar, { attachTo: document.body })
    await flushPromises()
    expect(invalid()).toBe(true)
  })
})
