<script lang="ts" setup>
import { computed } from 'vue'
import type { DamAssetType } from '@/types/coreDam/Asset'
import { useDamConfigState } from '@/components/damImage/uploadQueue/composables/damConfigState'
import ACustomDataForm from '@/components/customDataForm/ACustomDataForm.vue'
import { ADamAssetMetadataValidationScopeSymbol } from '@/components/damImage/uploadQueue/composables/uploadValidations'

const props = withDefaults(
  defineProps<{
    assetType: DamAssetType
    modelValue: { [key: string]: any }
    dataCy?: string
  }>(),
  {
    dataCy: undefined,
  }
)
const emit = defineEmits<{
  (e: 'update:modelValue', data: any): void
  (e: 'anyChange'): void
}>()

const { damConfigAssetCustomFormElements } = useDamConfigState()

const elements = computed(() => {
  return damConfigAssetCustomFormElements.value[props.assetType]
})

const { damConfigExtSystem } = useDamConfigState()

const pinnedCount = computed(() => {
  return damConfigExtSystem.value[props.assetType].customMetadataPinnedAmount
})
</script>

<template>
  <ACustomDataForm
    :model-value="modelValue"
    :pinned-count="pinnedCount"
    :elements="elements"
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
