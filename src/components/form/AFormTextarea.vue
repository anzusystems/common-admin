<script lang="ts" setup>
import { computed, inject } from 'vue'
import { stringSplitOnFirstOccurrence } from '@/utils/string'
import { isUndefined } from '@/utils/common'
import { SubjectScopeSymbol, SystemScopeSymbol } from '@/components/injectionKeys'
import type { VuetifyIconValue } from '@/types/Vuetify'
import type { ErrorObject } from '@vuelidate/core'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const props = withDefaults(
  defineProps<{
    modelValue: string | null // todo check number and null
    label?: string
    errorMessage?: string
    required?: boolean
    v?: any
    prependIcon?: VuetifyIconValue
    appendIcon?: VuetifyIconValue
    dataCy?: string
    hideLabel?: boolean
    rows?: number
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
    rows: 1,
  }
)
const emit = defineEmits<{
  (e: 'update:modelValue', data: string | null): void
  (e: 'click:append', data: string | null): void
  (e: 'blur', data: string | null): void
}>()

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
  <VTextarea
    :prepend-icon="prependIcon"
    :data-cy="dataCy"
    :error-messages="errorMessageComputed"
    :model-value="modelValue"
    :required="requiredComputed"
    :rows="rows"
    auto-grow
    :append-icon="appendIcon"
    trim
    @click:append="(event) => emit('click:append', event)"
    @blur="onBlur"
    @update:model-value="onUpdate($event)"
  >
    <template
      v-if="!hideLabel"
      #label
    >
      {{ labelComputed
      }}<span
        v-if="requiredComputed"
        class="required"
      />
    </template>
  </VTextarea>
</template>
