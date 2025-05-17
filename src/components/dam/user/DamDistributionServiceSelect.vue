<script lang="ts" setup>
import { computed } from 'vue'
import { cloneDeep } from '@/utils/common'
import { useDamDistributionServiceType } from '@/components/dam/user/DamDistributionServiceType'
import type { AxiosInstance } from 'axios'

const props = withDefaults(
  defineProps<{
    modelValue: string[]
    client: () => AxiosInstance
    multiple?: boolean
    label?: string
    dataCy?: string
  }>(),
  {
    multiple: false,
    label: undefined,
    dataCy: '',
  }
)

const emit = defineEmits<{
  (e: 'update:modelValue', data: string[]): void
  (e: 'blur', data: string[]): void
}>()

const modelValueComputed = computed({
  get() {
    return props.modelValue
  },
  set(newValue: string[]) {
    emit('update:modelValue', cloneDeep<string[]>(newValue))
  },
})

const onBlur = () => {
  emit('blur', modelValueComputed.value)
}

const { allDistributionServiceTypeOptions } = useDamDistributionServiceType()
</script>

<template>
  <VSelect
    v-model="modelValueComputed"
    :items="allDistributionServiceTypeOptions"
    item-title="title"
    item-value="value"
    :label="label"
    :multiple="multiple"
    clearable
    no-filter
    chips
    :data-cy="dataCy"
    @blur="onBlur"
  />
</template>
