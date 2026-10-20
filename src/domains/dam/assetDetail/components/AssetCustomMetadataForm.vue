<script lang="ts" setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { DamAssetTypeType } from '@/domains/dam/types/Asset'
import { useDamConfigState } from '@/domains/dam/config/composables/damConfigState'
import ACustomDataForm from '@/domains/customDataForm/components/ACustomDataForm.vue'
import { ADamAssetMetadataValidationScopeSymbol } from '@/domains/dam/composables/uploadValidations'
import type { IntegerId } from '@/shared/types/common'
import type { ValidationScope } from '@/shared/types/Validation'
import { isUndefined } from '@/shared/utils/common'
import { useDamConfigName } from '@/domains/dam/composables/damConfigName'

const props = withDefaults(
  defineProps<{
    assetType: DamAssetTypeType
    extSystem: IntegerId
    modelValue: { [key: string]: any }
    dataCy?: string
    readonly?: boolean
    validationScope?: ValidationScope
    /** The DAM configuration whose forms it shows; inherited when not given. */
    configName?: string
  }>(),
  {
    dataCy: undefined,
    readonly: false,
    validationScope: ADamAssetMetadataValidationScopeSymbol,
    configName: undefined,
  }
)
const emit = defineEmits<{
  (e: 'update:modelValue', data: any): void
  (e: 'anyChange'): void
}>()

// eslint-disable-next-line vue/no-setup-props-reactivity-loss
const damConfigName = useDamConfigName(props.configName)
const { getDamConfigAssetCustomFormElements, getDamConfigExtSystem } = useDamConfigState(undefined, damConfigName)
// eslint-disable-next-line vue/no-setup-props-reactivity-loss
const configAssetCustomFormElements = getDamConfigAssetCustomFormElements(props.extSystem)
if (isUndefined(configAssetCustomFormElements)) {
  throw new Error('Custom form elements must be initialised.')
}
// A type whose read failed beside reads that answered is not loaded: the form says so in place of its fields and draws
// the rest, its slots too. Thrown, it took the inputs its host puts into the slots with it.
const typeNotLoaded = computed(() => isUndefined(getDamConfigAssetCustomFormElements(props.extSystem, props.assetType)))

const { t } = useI18n()

const elements = computed(() => {
  return configAssetCustomFormElements[props.assetType]
})

// eslint-disable-next-line vue/no-setup-props-reactivity-loss
const configExtSystem = getDamConfigExtSystem(props.extSystem)

if (isUndefined(configExtSystem)) {
  throw new Error('AssetCustomMetadataForm: Ext system must be initialised.')
}

// The number the DAM is configured with, 0 too: no field is pinned then.
const pinnedCount = computed(() => {
  return configExtSystem[props.assetType]?.customMetadataPinnedAmount ?? 2
})
</script>

<template>
  <ACustomDataForm
    :model-value="modelValue"
    :pinned-count="pinnedCount"
    :elements="elements"
    :readonly="readonly"
    :validation-scope="validationScope"
    @any-change="emit('anyChange')"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <template #after-pinned>
      <slot name="after-pinned" />
    </template>
    <template #before-pinned>
      <slot name="before-pinned" />
      <div
        v-if="typeNotLoaded"
        class="text-error my-2"
      >
        {{ t('common.damImage.error.loadingConfig') }}
      </div>
    </template>
  </ACustomDataForm>
</template>
