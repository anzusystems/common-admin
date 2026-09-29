<script lang="ts" setup>
import { computed } from 'vue'
import type { DamAssetTypeType } from '@/domains/dam/types/Asset'
import { useDamConfigState } from '@/domains/dam/config/composables/damConfigState'
import ACustomDataForm from '@/domains/customDataForm/components/ACustomDataForm.vue'
import { ADamAssetMetadataValidationScopeSymbol } from '@/domains/dam/composables/uploadValidations'
import type { IntegerId } from '@/shared/types/common'
import { isUndefined } from '@/shared/utils/common'

const props = withDefaults(
  defineProps<{
    assetType: DamAssetTypeType
    extSystem: IntegerId
    modelValue: { [key: string]: any }
    dataCy?: string
    readonly?: boolean
  }>(),
  {
    dataCy: undefined,
    readonly: false,
  }
)
const emit = defineEmits<{
  (e: 'update:modelValue', data: any): void
  (e: 'anyChange'): void
}>()

const { getDamConfigAssetCustomFormElements, getDamConfigExtSystem } = useDamConfigState()
// eslint-disable-next-line vue/no-setup-props-reactivity-loss
const configAssetCustomFormElements = getDamConfigAssetCustomFormElements(props.extSystem)
if (isUndefined(configAssetCustomFormElements)) {
  throw new Error('Custom form elements must be initialised.')
}

const elements = computed(() => {
  return configAssetCustomFormElements[props.assetType]
})

// eslint-disable-next-line vue/no-setup-props-reactivity-loss
const configExtSystem = getDamConfigExtSystem(props.extSystem)

if (isUndefined(configExtSystem)) {
  throw new Error('AssetCustomMetadataForm: Ext system must be initialised.')
}

const pinnedCount = computed(() => {
  return configExtSystem[props.assetType]?.customMetadataPinnedAmount || 2
})
</script>

<template>
  <ACustomDataForm
    :model-value="modelValue"
    :pinned-count="pinnedCount"
    :elements="elements"
    :readonly="readonly"
    :validation-scope="ADamAssetMetadataValidationScopeSymbol"
    @any-change="emit('anyChange')"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <template #after-pinned>
      <slot name="after-pinned" />
    </template>
    <template #before-pinned>
      <slot name="before-pinned" />
    </template>
  </ACustomDataForm>
</template>
