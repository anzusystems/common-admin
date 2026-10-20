<script lang="ts" setup>
import { computed } from 'vue'
import { cloneDeep } from '@/shared/utils/common'
import { useDamDistributionServiceType } from '@/domains/dam/user/types/DamDistributionServiceType'
import type { AxiosInstance } from 'axios'
import { useDamConfigName } from '@/domains/dam/composables/damConfigName'

const props = withDefaults(
  defineProps<{
    modelValue: string[]
    client: () => AxiosInstance
    multiple?: boolean
    label?: string
    dataCy?: string
    /** The DAM configuration whose prv configuration lists the options; inherited when not given. */
    configName?: string
  }>(),
  {
    multiple: false,
    label: undefined,
    dataCy: '',
    configName: undefined,
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
const { allDistributionServiceTypeOptions } = useDamDistributionServiceType(useDamConfigName(props.configName))
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
