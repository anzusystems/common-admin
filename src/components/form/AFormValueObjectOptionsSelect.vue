<script lang="ts" setup>
import { computed, inject } from 'vue'
import { stringSplitOnFirstOccurrence } from '@/utils/string'
import type { ErrorObject } from '@vuelidate/core'
import { isUndefined, cloneDeep } from '@/utils/common'
import { SubjectScopeSymbol, SystemScopeSymbol } from '@/components/injectionKeys'
import { useI18n } from 'vue-i18n'

const props = withDefaults(
  defineProps<{
    modelValue: any
    items: any[]
    label?: string
    errorMessage?: string
    required?: boolean
    v?: any
    hideLabel?: boolean
    multiple?: boolean
    hideDetails?: boolean
    clearable?: boolean
    dataCy?: string
  }>(),
  {
    label: undefined,
    errorMessage: undefined,
    required: undefined,
    v: null,
    hideLabel: false,
    multiple: false,
    hideDetails: false,
    clearable: false,
    dataCy: '',
  }
)
const emit = defineEmits<{
  (e: 'update:modelValue', data: any): void
  (e: 'blur', data: any): void
}>()

const modelValue = computed({
  get() {
    return props.modelValue
  },
  set(newValue) {
    emit('update:modelValue', cloneDeep<any>(newValue))
  },
})

const system = inject<string | undefined>(SystemScopeSymbol, undefined)
const subject = inject<string | undefined>(SubjectScopeSymbol, undefined)

const { t } = useI18n()

const onBlur = () => {
  emit('blur', props.modelValue)
  props.v?.$touch()
}

const errorMessageComputed = computed(() => {
  if (!isUndefined(props.errorMessage)) return [props.errorMessage]
  if (props.v?.$errors?.length) return props.v.$errors.map((item: ErrorObject) => item.$message)
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

const multipleComputedVuetifyTypeFix = computed(() => {
  if (props.multiple === false) return false
  return true as unknown as undefined
})
</script>

<template>
  <VAutocomplete
    v-model="modelValue"
    :items="items"
    item-title="title"
    item-value="value"
    :multiple="multipleComputedVuetifyTypeFix"
    :clearable="clearable"
    :error-messages="errorMessageComputed"
    :data-cy="dataCy"
    @blur="onBlur"
  >
    <template #label>
      <span v-if="!hideLabel">{{ labelComputed }}<span
        v-if="requiredComputed"
        class="required"
      /></span>
    </template>
  </VAutocomplete>
</template>
