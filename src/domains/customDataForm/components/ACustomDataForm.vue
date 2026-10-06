<script lang="ts" setup>
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import useVuelidate from '@vuelidate/core'
import type { CustomDataFormElement } from '@/domains/customDataForm/types/CustomDataForm'
import type { ValidationScope } from '@/shared/types/Validation'
import { useCustomDataForm } from '@/domains/customDataForm/composables/useCustomDataForm'
import ACustomFormElement from '@/domains/customDataForm/components/ACustomDataFormElement.vue'
import ACustomDataFormHiddenPart from '@/domains/customDataForm/components/ACustomDataFormHiddenPart.vue'
import ARow from '@/domains/ui/components/ARow.vue'

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

// "Show all" and "hide" are one choice for every form on the page, as it has been.
const { showAll, hideRequests } = useCustomDataForm()

// What fails behind "show all" is shown whatever that choice is, in the form it fails in, and stays
// open once the user has fixed it (it would close under the cursor otherwise).
const hiddenError = ref(false)
const revealed = ref(false)
const onHiddenError = (isError: boolean) => {
  hiddenError.value = isError
  if (isError) revealed.value = true
}
const hiddenVisible = computed(() => showAll.value || revealed.value)
// Not while something in it fails: such a form stays open when another one hides, and cannot hide itself.
watch(hideRequests, () => {
  revealed.value = hiddenError.value
})
const hideDisabled = computed(() => hiddenVisible.value && hiddenError.value)
const toggleForm = () => {
  if (!hiddenVisible.value) {
    showAll.value = true
    return
  }
  showAll.value = false
  hideRequests.value++
}

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
  return hiddenVisible.value
    ? t('common.damImage.asset.detail.metadataToggle.hide')
    : t('common.damImage.asset.detail.metadataToggle.show')
})
const showHideButtonIcon = computed(() => {
  return hiddenVisible.value ? 'mdi-minus' : 'mdi-plus'
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
      density="compact"
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
  <ACustomDataFormHiddenPart
    :visible="hiddenVisible"
    :validation-scope="validationScope"
    @error="onHiddenError"
  >
    <VRow
      v-for="element in elementsOther"
      :key="element.id"
      density="compact"
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
  </ACustomDataFormHiddenPart>
  <VBtn
    v-if="enableShowHide"
    variant="text"
    size="small"
    class="my-2"
    :disabled="hideDisabled"
    @click="toggleForm"
  >
    <VIcon :icon="showHideButtonIcon" />
    {{ showHideButtonText }}
  </VBtn>
</template>
