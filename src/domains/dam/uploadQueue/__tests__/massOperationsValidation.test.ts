import { afterEach, describe, expect, it } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import useVuelidate from '@vuelidate/core'
import { defineComponent, h } from 'vue'
import type { CustomDataFormElement } from '@/domains/customDataForm/types/CustomDataForm'
import { CustomDataFormElementType } from '@/domains/customDataForm/types/CustomDataFormElementTypes'
import { useDamConfigStore } from '@/domains/dam/config/store/damConfigStore'
import { DamAssetType } from '@/domains/dam/types/Asset'
import AssetCustomMetadataFormMassOperations from '@/domains/dam/uploadQueue/components/AssetCustomMetadataFormMassOperations.vue'

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

let wrapper: VueWrapper | undefined
let forget: () => void = () => {}
afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  forget()
})

describe('the mass operations form of the upload dialog', () => {
  // A scratch form: its values are copied into the selected items, it is not what the dialog saves. Its
  // keyword and author inputs are kept out of the dialog's validation, and so are its custom fields.
  it('does not block the save of the queue with a required custom field left empty', async () => {
    let touchAndRead!: () => boolean
    const Dialog = defineComponent({
      setup() {
        // The configuration the form reads its elements from, in the pinia the components use.
        const config = useDamConfigStore().damConfigAssetCustomFormElements
        config.set(EXT_SYSTEM, {
          [DamAssetType.Image]: [requiredText],
          [DamAssetType.Audio]: [],
          [DamAssetType.Video]: [],
          [DamAssetType.Document]: [],
        })
        forget = () => config.delete(EXT_SYSTEM)
        // As `UploadQueueDialog` validates: everything below it.
        const v$ = useVuelidate({ $stopPropagation: true })
        touchAndRead = () => {
          v$.value.$touch()
          return v$.value.$invalid
        }
        return () =>
          h(AssetCustomMetadataFormMassOperations, {
            assetType: DamAssetType.Image,
            extSystem: EXT_SYSTEM,
            modelValue: {},
          })
      },
    })
    wrapper = mount(Dialog, { attachTo: document.body })
    await flushPromises()
    expect(wrapper.find('textarea, input').exists()).toBe(true)
    expect(touchAndRead()).toBe(false)
  })
})
