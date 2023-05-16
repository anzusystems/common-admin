<script lang="ts" setup>
import { computed, inject, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import ADatetimePicker from '@/components/ADatetimePicker.vue'
import { SubjectScopeSymbol, SystemScopeSymbol } from '@/components/injectionKeys'
import { isFunction, isNull, isUndefined } from '@/utils/common'
import type { ErrorObject } from '@vuelidate/core'
import { stringSplitOnFirstOccurrence } from '@/utils/string'
import type { DatetimeUTCNullable } from '@/types/common'
import { dateTimeNow } from '@/utils/datetime'

const props = withDefaults(
  defineProps<{
    modelValue: DatetimeUTCNullable | undefined
    label?: string
    errorMessage?: string
    v?: any
    dataCy?: string
    clearable?: boolean
    defaultActivationValue?: DatetimeUTCNullable | 'now' | (() => DatetimeUTCNullable)
  }>(),
  {
    label: undefined,
    errorMessage: undefined,
    v: null,
    dataCy: undefined,
    clearable: false,
    defaultActivationValue: 'now',
  }
)
const emit = defineEmits<{
  (e: 'update:modelValue', data: DatetimeUTCNullable | undefined): void
  (e: 'click:append', data: string | number | null): void
  (e: 'blur', data: string | number | null): void
}>()

const { t } = useI18n()

const system = inject<string | undefined>(SystemScopeSymbol, undefined)
const subject = inject<string | undefined>(SubjectScopeSymbol, undefined)

const checkboxModel = ref(false)

const modelValueComputed = computed({
  get() {
    return props.modelValue
  },
  set(newValue: DatetimeUTCNullable | undefined) {
    emit('update:modelValue', newValue)
  },
})

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

watch(
  modelValueComputed,
  (newValue, oldValue) => {
    if (newValue === oldValue) return
    if (isNull(newValue) || isUndefined(newValue)) {
      checkboxModel.value = false
      return
    }
    checkboxModel.value = true
  },
  { immediate: true }
)

const onCheckboxClick = (value: boolean) => {
  if (value) {
    modelValueComputed.value = null
    return
  }
  if (props.defaultActivationValue === 'now') {
    modelValueComputed.value = dateTimeNow()
    return
  }
  if (isFunction(props.defaultActivationValue)) {
    modelValueComputed.value = props.defaultActivationValue()
    return
  }
  modelValueComputed.value = props.defaultActivationValue
}
</script>

<template>
  <VCheckboxBtn
    v-model="checkboxModel"
    :label="labelComputed"
    @click.stop="onCheckboxClick(checkboxModel)"
  />
  <VExpandTransition>
    <div v-show="checkboxModel">
      <ADatetimePicker
        v-model="modelValueComputed"
        :data-cy="dataCy"
        :error-messages="errorMessageComputed"
        :clearable="clearable"
        @blur="onBlur"
      />
    </div>
  </VExpandTransition>
</template>
