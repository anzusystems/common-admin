<script lang="ts" setup>
import { inject, provide, ref } from 'vue'
import {
  FilterConfigKey,
  FilterDataKey,
  FilterSelectedKey,
  FilterSubmitResetCounterKey,
} from '@/labs/filters/filterInjectionKeys'
import type { ValueObjectOption } from '@/types/ValueObject'
import { isUndefined } from '@/utils/common'

withDefaults(
  defineProps<{
    formName?: string
  }>(),
  {
    formName: 'search',
  },
)
const emit = defineEmits<{
  (e: 'submit'): void
}>()

const filterConfig = inject(FilterConfigKey)
const filterData = inject(FilterDataKey)
if (isUndefined(filterConfig) || isUndefined(filterData)) {
  throw new Error('Incorrect provide/inject config.')
}

provide(FilterSubmitResetCounterKey, ref(0))
provide(FilterSelectedKey, ref<Map<string, ValueObjectOption<string | number>[]>>(new Map()))

const submitFilter = () => {
  emit('submit')
}
</script>

<template>
  <VForm
    :name="formName"
    @submit.prevent="submitFilter"
  >
    <slot />
  </VForm>
</template>
