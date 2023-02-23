<script lang="ts" setup>
import { computed, inject } from 'vue'
import { splitOnFirstOccurrence } from '@/utils/string'
import { isUndefined } from '@/utils/common'
import { SubjectScopeSymbol, SystemScopeSymbol } from '@/components/injectionKeys'
import type { VuetifyIconValue } from '@/types/Vuetify'
import type { ErrorObject } from '@vuelidate/core'
import { useI18n } from 'vue-i18n'

const props = withDefaults(
  defineProps<{
    modelValue: string
    label?: string
    errorMessage?: string
    required?: boolean
    v?: any
    prependIcon?: VuetifyIconValue
    appendIcon?: VuetifyIconValue
    dataCy?: string
    hideLabel?: boolean
    type?: string
    step?: number
  }>(),
  {
    label: undefined,
    errorMessage: undefined,
    required: undefined,
    v: null,
    prependIcon: undefined,
    appendIcon: undefined,
    dataCy: undefined,
    hideLabel: false,
    type: 'text',
    step: undefined,
  }
)
const emit = defineEmits<{
  (e: 'update:modelValue', data: string): void
  (e: 'click:append', data: string | number | null): void
  (e: 'blur', data: string | number | null): void
}>()

const { t } = useI18n()

const system = inject<string | undefined>(SystemScopeSymbol, undefined)
const subject = inject<string | undefined>(SubjectScopeSymbol, undefined)

const onUpdate = (newValue: string) => {
  emit('update:modelValue', newValue)
}
const onBlur = () => {
  emit('blur', props.modelValue)
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
  const { end: path } = splitOnFirstOccurrence(props.v?.$path, '.')
  return t(system + '.' + subject + '.model.' + path)
})

const requiredComputed = computed(() => {
  if (!isUndefined(props.required)) return props.required
  if (props.v?.required && props.v?.required.$params.type === 'required') return true
  return false
})
</script>

<template>
  <VTextField
    :prepend-icon="prependIcon"
    :data-cy="dataCy"
    :error-messages="errorMessageComputed"
    :model-value="modelValue"
    :required="requiredComputed"
    :type="type"
    :step="step"
    :append-icon="appendIcon"
    trim
    @click:append="(event) => emit('click:append', event)"
    @blur="onBlur"
    @update:model-value="onUpdate($event)"
  >
    <template v-if="!hideLabel" #label> {{ labelComputed }}<span v-if="requiredComputed" class="required" /></template>
  </VTextField>
</template>
