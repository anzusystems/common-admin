<script lang="ts" setup>
import { computed, inject } from 'vue'
import { useI18n } from 'vue-i18n'
import ADatetimePicker from '@/components/ADatetimePicker.vue'
import { SubjectScopeSymbol, SystemScopeSymbol } from '@/components/injectionKeys'
import { isUndefined } from '@/utils/common'
import type { ErrorObject } from '@vuelidate/core'
import { stringSplitOnFirstOccurrence } from '@/utils/string'
import type { DatetimeUTCNullable } from '@/types/common'

const props = withDefaults(
  defineProps<{
    modelValue: DatetimeUTCNullable | undefined
    label?: string
    errorMessage?: string
    required?: boolean
    v?: any
    dataCy?: string
    clearable?: boolean
  }>(),
  {
    label: undefined,
    errorMessage: undefined,
    required: undefined,
    v: null,
    dataCy: undefined,
    clearable: false,
  }
)
const emit = defineEmits<{
  (e: 'update:modelValue', data: string | null): void
  (e: 'click:append', data: string | number | null): void
  (e: 'blur', data: string | number | null): void
}>()

const { t } = useI18n()

const system = inject<string | undefined>(SystemScopeSymbol, undefined)
const subject = inject<string | undefined>(SubjectScopeSymbol, undefined)

const onUpdate = (newValue: string | null) => {
  emit('update:modelValue', newValue)
}
const onBlur = () => {
  emit('blur', isUndefined(props.modelValue) ? null : props.modelValue)
  props.v?.$touch()
}

const errorMessageComputed = computed(() => {
  if (!isUndefined(props.errorMessage)) return [props.errorMessage]
  if (props.v?.$errors?.length) return [props.v.$errors.map((item: ErrorObject) => item.$message).join(' ')]
  return []
})

const labelComputed = computed(() => {
  if (!isUndefined(props.label)) return props.label
  if (isUndefined(system) || isUndefined(subject) || isUndefined(props.v?.$path)) return ''
  const { end: path } = stringSplitOnFirstOccurrence(props.v?.$path, '.')
  return t(system + '.' + subject + '.model.' + path)
})

const requiredComputed = computed(() => {
  if (!isUndefined(props.required)) return props.required
  if (props.v?.required && props.v?.required.$params.type === 'required') return true
  return false
})
</script>

<template>
  <ADatetimePicker
    :model-value="modelValue"
    :data-cy="dataCy"
    :error-messages="errorMessageComputed"
    :required="requiredComputed"
    :label="labelComputed"
    :clearable="clearable"
    @blur="onBlur"
    @update:model-value="onUpdate($event)"
  />
</template>
