<script lang="ts" setup>
import { computed, isProxy, ref, toRaw } from 'vue'
import type { ErrorObject } from '@vuelidate/core'
import { useVuelidate } from '@vuelidate/core'
import type { CustomDataFormElement } from '@/components/customDataForm/CustomDataForm'
import type { ValidationScope } from '@/types/Validation'
import { CustomDataFormElementType } from '@/components/customDataForm/CustomDataFormElementTypes'
import { isEmptyObject } from '@/utils/common'
import { useValidate } from '@/validators/vuelidate/useValidate'
import ABooleanSelect from '@/components/ABooleanSelect.vue'

const props = withDefaults(
  defineProps<{
    modelValue: any
    config: CustomDataFormElement
    validationScope?: ValidationScope
  }>(),
  {
    validationScope: undefined,
  }
)
const emit = defineEmits<{
  (e: 'update:modelValue', data: { property: string; value: any }): void
  (e: 'blur', data: any): void
}>()

const fixValue = (value: any) => {
  if (props.config.attributes.type === CustomDataFormElementType.Integer) {
    return parseInt(value)
  }
  return value
}

const updateModelValue = (value: any) => {
  emit('update:modelValue', { property: props.config.property, value: fixValue(value) })
}

const modelValueComputed = computed(() => {
  const value = isProxy(props.modelValue) ? toRaw(props.modelValue) : props.modelValue
  if (props.config.attributes.type === CustomDataFormElementType.StringArray && isEmptyObject(value)) return []
  return value
})

const { maxLength, minLength, requiredIf, minValue, maxValue, stringArrayItemLength } = useValidate()

const rules = computed(() => {
  const dynamicRules: Record<string, any> = {
    modelValueComputed: {
      required: requiredIf(props.config.attributes.required),
    },
  }
  switch (props.config.attributes.type) {
    case CustomDataFormElementType.String:
      dynamicRules.modelValueComputed.minLength = minLength(
        props.config.attributes.minValue ? props.config.attributes.minValue : 0
      )
      dynamicRules.modelValueComputed.maxLength = maxLength(
        props.config.attributes.maxValue ? props.config.attributes.maxValue : 256
      )
      break
    case CustomDataFormElementType.Integer:
      dynamicRules.modelValueComputed.minValue = minValue(
        props.config.attributes.minValue ? props.config.attributes.minValue : 0
      )
      dynamicRules.modelValueComputed.maxValue = maxValue(
        props.config.attributes.maxValue ? props.config.attributes.maxValue : 9999
      )
      break
    case CustomDataFormElementType.StringArray:
      dynamicRules.modelValueComputed.minLength = minLength(
        props.config.attributes.minCount ? props.config.attributes.minCount : 0
      )
      dynamicRules.modelValueComputed.maxLength = maxLength(
        props.config.attributes.maxCount ? props.config.attributes.maxCount : 32
      )
      dynamicRules.modelValueComputed.stringArrayItemLength = stringArrayItemLength(
        props.config.attributes.minValue ? props.config.attributes.minValue : 0,
        props.config.attributes.maxValue ? props.config.attributes.maxValue : 256
      )
      break
  }

  return dynamicRules
})

// eslint-disable-next-line vue/no-setup-props-reactivity-loss
const v$ = useVuelidate(rules, { modelValueComputed }, { $scope: props.validationScope })

const errorMessageComputed = computed(() => {
  if (v$.value.$errors.length) return [v$.value.$errors.map((item: ErrorObject) => item.$message).join(' ')]
  return []
})

const counter = ref<number | undefined>(undefined)
counter.value = props.config.attributes.maxValue ?? undefined

const onBlur = () => {
  emit('blur', props.modelValue)
  v$.value.$touch()
}
</script>

<template>
  <VTextarea
    v-if="config.attributes.type === CustomDataFormElementType.String"
    :model-value="modelValue"
    auto-grow
    :rows="1"
    :label="config.name"
    :error-messages="errorMessageComputed"
    :counter="counter"
    :readonly="config.attributes.readonly"
    :data-cy="'custom-field-' + config.property"
    @update:model-value="updateModelValue"
    @blur="onBlur"
  >
    <template #label>
      {{ config.name
      }}<span
        v-if="config.attributes.required"
        class="required"
      />
    </template>
  </VTextarea>
  <VTextField
    v-else-if="config.attributes.type === CustomDataFormElementType.Integer"
    :model-value="modelValueComputed"
    type="number"
    :label="config.name"
    :error-messages="errorMessageComputed"
    :readonly="config.attributes.readonly"
    :data-cy="'custom-field-' + config.property"
    @update:model-value="updateModelValue"
    @blur="onBlur"
  >
    <template #label>
      {{ config.name
      }}<span
        v-if="config.attributes.required"
        class="required"
      />
    </template>
  </VTextField>
  <VCombobox
    v-else-if="config.attributes.type === CustomDataFormElementType.StringArray"
    :model-value="modelValueComputed"
    :label="config.name"
    multiple
    chips
    :readonly="config.attributes.readonly"
    :error-messages="errorMessageComputed"
    :data-cy="'custom-field-' + config.property"
    @update:model-value="updateModelValue"
    @blur="onBlur"
  >
    <template #label>
      {{ config.name
      }}<span
        v-if="config.attributes.required"
        class="required"
      />
    </template>
  </VCombobox>
  <VSwitch
    v-if="config.attributes.type === CustomDataFormElementType.Boolean && config.attributes.required === true"
    :label="config.name"
    :model-value="modelValueComputed"
    :readonly="config.attributes.readonly"
    :data-cy="'custom-field-' + config.property"
    @update:model-value="updateModelValue"
  />
  <ABooleanSelect
    v-if="config.attributes.type === CustomDataFormElementType.Boolean && config.attributes.required === false"
    :model-value="modelValueComputed"
    :label="config.name"
    :data-cy="'custom-field-' + config.property"
    :readonly="config.attributes.readonly"
    @update:model-value="updateModelValue"
  />
</template>
