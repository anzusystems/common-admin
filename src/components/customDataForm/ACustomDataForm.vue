<script lang="ts" setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import useVuelidate from '@vuelidate/core'
import type { CustomDataFormElement } from '@/components/customDataForm/CustomDataForm'
import type { ValidationScope } from '@/types/Validation'
import { useCustomDataForm } from '@/components/customDataForm/useCustomDataForm'
import ACustomFormElement from '@/components/customDataForm/ACustomDataFormElement.vue'
import ARow from '@/components/ARow.vue'

const props = withDefaults(
  defineProps<{
    modelValue: { [key: string]: any }
    elements: CustomDataFormElement[]
    validationScope?: ValidationScope
    pinnedCount?: number
    readonly?: boolean
  }>(),
  {
    validationScope: undefined,
    pinnedCount: 1000,
    readonly: false,
  }
)

const emit = defineEmits<{
  (e: 'update:modelValue', data: any): void
  (e: 'anyChange'): void
}>()

const { t } = useI18n()

const { showAll, toggleForm } = useCustomDataForm()

const updateModelValue = (data: { property: string; value: any }) => {
  const updated = {} as { [key: string]: any }
  updated[data.property] = data.value
  emit('update:modelValue', { ...props.modelValue, ...updated })
  emit('anyChange')
}

const elementsPinned = computed(() => {
  return props.elements.slice(0, props.pinnedCount)
})

const elementsOther = computed(() => {
  return props.elements.slice(props.pinnedCount)
})

const showHideButtonText = computed(() => {
  return showAll.value ? t('coreDam.asset.detail.metadataToggle.show') : t('coreDam.asset.detail.metadataToggle.hide')
})
const showHideButtonIcon = computed(() => {
  return showAll.value ? 'mdi-minus' : 'mdi-plus'
})

const enableShowHide = computed(() => {
  return props.elements.length > props.pinnedCount
})

// eslint-disable-next-line vue/no-setup-props-reactivity-loss
const v$ = useVuelidate({ $scope: props.validationScope })

const validate = (): Promise<boolean> => {
  return v$.value.$validate()
}

defineExpose({
  validate,
})
</script>

<template>
  <div class="w-100">
    <slot name="before-pinned" />
    <VRow
      v-for="element in elementsPinned"
      :key="element.id"
      dense
      class="mt-1"
    >
      <VCol>
        <ARow
          v-if="readonly"
          :title="element.name"
        >
          {{ modelValue[element.property] }}
        </ARow>
        <ACustomFormElement
          v-else
          :config="element"
          :model-value="modelValue[element.property]"
          :validation-scope="validationScope"
          @update:model-value="updateModelValue"
        />
      </VCol>
    </VRow>
    <slot name="after-pinned" />
  </div>
  <div
    v-show="showAll"
    class="w-100"
  >
    <VRow
      v-for="element in elementsOther"
      :key="element.id"
      dense
      class="mt-1"
    >
      <VCol>
        <ARow
          v-if="readonly"
          :title="element.name"
        >
          {{ modelValue[element.property] }}
        </ARow>
        <ACustomFormElement
          v-else
          :config="element"
          :model-value="modelValue[element.property]"
          @update:model-value="updateModelValue"
        />
      </VCol>
    </VRow>
  </div>
  <VBtn
    v-if="enableShowHide"
    variant="text"
    size="small"
    class="my-2"
    @click="toggleForm"
  >
    <VIcon :icon="showHideButtonIcon" />
    {{ showHideButtonText }}
  </VBtn>
</template>
