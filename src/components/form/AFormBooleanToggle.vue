<script lang="ts" setup>
import { computed, inject } from 'vue'
import { isUndefined } from '@/utils/common'
import { splitOnFirstOccurrence } from '@/utils/string'
import { SubjectScopeSymbol, SystemScopeSymbol } from '@/components/injectionKeys'
import { useI18n } from '@/plugins/translate'

const props = withDefaults(
  defineProps<{
    modelValue?: any
    required?: boolean
    label?: string
    dataCy?: string
    v?: any
  }>(),
  {
    modelValue: null,
    required: undefined,
    label: undefined,
    dataCy: undefined,
    v: null,
  }
)
const emit = defineEmits<{
  (e: 'update:modelValue', data: boolean | null): void
}>()

const system = inject<string | undefined>(SystemScopeSymbol, undefined)
const subject = inject<string | undefined>(SubjectScopeSymbol, undefined)

const value = computed({
  get() {
    return props.modelValue
  },
  set(newValue: boolean | null) {
    emit('update:modelValue', newValue)
  },
})

const { t } = useI18n()

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
  <VLabel v-if="label" class="pr-1">{{ labelComputed }}<span v-if="requiredComputed" class="required" /></VLabel>
  <VBtnToggle v-model="value" :mandatory="requiredComputed">
    <VBtn :value="true" data-cy="toggle-true">{{ t('common.boolean.true') }}</VBtn>
    <VBtn :value="false" data-cy="toggle-false">{{ t('common.boolean.false') }}</VBtn>
  </VBtnToggle>
</template>
