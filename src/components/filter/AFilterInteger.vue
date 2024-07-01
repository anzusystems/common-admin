<script lang="ts" setup>
import type { Filter } from '@/types/Filter'
import { useFilterHelpers } from '@/composables/filter/filterHelpers'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { stringToInt } from '@/utils/string'
import { isNull } from '@/utils/common'

const props = withDefaults(
  defineProps<{
    modelValue: Filter
    dataCy?: string
  }>(),
  {
    dataCy: 'filter-integer',
  }
)
const emit = defineEmits<{
  (e: 'update:modelValue', data: Filter): void
}>()

const value = computed({
  get() {
    return props.modelValue.model
  },
  set(newValue) {
    emit('update:modelValue', {
      ...props.modelValue,
      ...{ model: isNull(newValue) ? null : stringToInt(newValue + '') },
    })
  },
})

const { clearOne } = useFilterHelpers()

const { t } = useI18n()

const label = computed(() => {
  return props.modelValue.titleT ? t(props.modelValue.titleT) : undefined
})
</script>

<template>
  <VTextField
    v-model="value"
    :label="label"
    :clearable="!modelValue.mandatory"
    :data-cy="dataCy"
    @click:clear.stop="clearOne(modelValue)"
  />
</template>
