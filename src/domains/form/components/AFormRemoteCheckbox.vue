<script lang="ts" setup>
import type { AFormFieldValidation } from '@/shared/types/Validation'
import { computed, inject, onMounted, ref, useId, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { SubjectScopeKey, SystemScopeKey } from '@/shared/injectionKeys'
import { isUndefined } from '@/shared/utils/common'
import { stringSplitOnFirstOccurrence } from '@/shared/utils/string'

const props = withDefaults(
  defineProps<{
    modelValue: boolean
    callbackToTrue: () => Promise<boolean> // return true if successfully changed, otherwise return false
    callbackToFalse: () => Promise<boolean> // return true if successfully changed, otherwise return false
    label?: string | undefined
    hideDetails?: boolean | undefined
    hideLabel?: boolean | undefined
    v?: AFormFieldValidation | null
  }>(),
  {
    label: undefined,
    hideDetails: undefined,
    hideLabel: undefined,
    v: null,
  }
)
const emit = defineEmits<{
  (e: 'update:modelValue', data: boolean): void
}>()

const { t } = useI18n()

const system = inject<string | undefined>(SystemScopeKey, undefined)
const subject = inject<string | undefined>(SubjectScopeKey, undefined)

const labelComputed = computed(() => {
  if (!isUndefined(props.label)) return props.label
  if (isUndefined(system) || isUndefined(subject) || isUndefined(props.v?.$path)) return ''
  const { end: path } = stringSplitOnFirstOccurrence(props.v?.$path, '.')
  return t(system + '.' + subject + '.model.' + path)
})

const loading = ref(false)
const hasError = ref(false)
const uniqueId = ref('')
const useIdValue = useId()

const modelValueComputed = computed(() => {
  return props.modelValue
})

// eslint-disable-next-line vue/no-setup-props-reactivity-loss
const internalModelValue = ref(props.modelValue)

const onClick = async () => {
  if (loading.value) return
  loading.value = true
  hasError.value = false
  const toFalse = internalModelValue.value === true
  let success = false
  // No catch: a throwing callback still reaches the app's error handler; `finally` puts the control back.
  try {
    success = toFalse ? await props.callbackToFalse() : await props.callbackToTrue()
  } finally {
    const value = toFalse ? !success : success
    emit('update:modelValue', value)
    internalModelValue.value = value
    if (!success) hasError.value = true
    loading.value = false
  }
}

watch(modelValueComputed, (newValue, oldValue) => {
  if (newValue !== oldValue) {
    internalModelValue.value = newValue
    hasError.value = false
  }
})

onMounted(() => {
  uniqueId.value = 'remote-switch-' + useIdValue
})
</script>

<template>
  <div class="d-flex">
    <VCheckboxBtn
      :id="uniqueId"
      v-model="internalModelValue"
      :disabled="loading"
      @click.stop="onClick"
    />
    <label
      v-if="!hideLabel"
      :for="uniqueId"
      class="v-label v-label--clickable"
    >
      {{ labelComputed }}
    </label>
  </div>
</template>
