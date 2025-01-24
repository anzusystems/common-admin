<script lang="ts" setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { DamAssetTypeType } from '@/types/coreDam/Asset'
import { useDamConfigState } from '@/components/damImage/uploadQueue/composables/damConfigState'
import ACustomDataFormElement from '@/components/customDataForm/ACustomDataFormElement.vue'
import { isUndefined } from '@/utils/common'
import type { IntegerId } from '@/types/common'

const props = withDefaults(
  defineProps<{
    assetType: DamAssetTypeType
    extSystem: IntegerId
    modelValue: { [key: string]: any }
  }>(),
  {}
)

const emit = defineEmits<{
  (e: 'update:modelValue', data: any): void
  (e: 'fillEmptyField', data: { assetType: DamAssetTypeType; elementProperty: string; value: any }): void
  (e: 'replaceField', data: { assetType: DamAssetTypeType; elementProperty: string; value: any }): void
}>()

const { t } = useI18n()

const updateModelValue = (data: { property: string; value: any }) => {
  const updated = {} as { [key: string]: any }
  updated[data.property] = data.value
  emit('update:modelValue', { ...props.modelValue, ...updated })
}

const fillEmptyField = (elementProperty: string, value: any) => {
  emit('fillEmptyField', { assetType: props.assetType, elementProperty, value })
}
const replaceField = (elementProperty: string, value: any) => {
  emit('replaceField', { assetType: props.assetType, elementProperty, value })
}

const { getDamConfigAssetCustomFormElements } = useDamConfigState()
// eslint-disable-next-line vue/no-setup-props-reactivity-loss
const configAssetCustomFormElements = getDamConfigAssetCustomFormElements(props.extSystem)
if (isUndefined(configAssetCustomFormElements)) {
  throw new Error('Custom form elements must be initialised.')
}

const elements = computed(() => {
  return configAssetCustomFormElements[props.assetType]
})
</script>

<template>
  <div class="w-100">
    <VRow
      v-for="element in elements"
      :key="element.id"
      dense
      class="mt-1"
    >
      <VCol>
        <div v-if="element.attributes.readonly" />
        <div
          v-else
          class="d-flex"
        >
          <ACustomDataFormElement
            :config="element"
            :model-value="modelValue[element.property]"
            @update:model-value="updateModelValue"
          />
          <VBtn
            icon
            size="small"
            variant="text"
            class="mr-1"
            @click.stop="fillEmptyField(element.property, modelValue[element.property])"
          >
            <VIcon icon="mdi-file-arrow-left-right-outline" />
            <VTooltip
              activator="parent"
              location="bottom"
            >
              {{ t('common.damImage.asset.massOperations.fillOneEmpty') }}
            </VTooltip>
          </VBtn>
          <VBtn
            icon
            size="small"
            variant="text"
            @click.stop="replaceField(element.property, modelValue[element.property])"
          >
            <VIcon icon="mdi-file-replace-outline" />
            <VTooltip
              activator="parent"
              location="bottom"
            >
              {{ t('common.damImage.asset.massOperations.replaceOne') }}
            </VTooltip>
          </VBtn>
        </div>
      </VCol>
    </VRow>
  </div>
</template>
