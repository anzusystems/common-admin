<script lang="ts" setup>
import { computed } from 'vue'
import { cloneDeep } from '@/utils/common'
import { useDamExternalProviderAssetType } from '@/components/dam/user/DamExternalProviderAssetType'
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

// eslint-disable-next-line vue/no-setup-props-reactivity-loss
const { allExternalProviderAssetTypeOptions } = useDamExternalProviderAssetType(props.client)
</script>

<template>
  <VSelect
    v-model="modelValueComputed"
    :items="allExternalProviderAssetTypeOptions"
    item-title="title"
    item-value="value"
    :label="label"
    :multiple="multiple"
    clearable
    chips
    no-filter
    :data-cy="dataCy"
    @blur="onBlur"
  />
</template>
