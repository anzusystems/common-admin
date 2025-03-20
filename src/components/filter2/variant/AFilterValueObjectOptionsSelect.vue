<script lang="ts" setup generic="T extends FilterField">
import type { ValueObjectOption } from '@/types/ValueObject.ts'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { type AllowedDefault, type FilterField, useFilterHelpers } from '@/composables/filter/filterFactory.ts'

const props = withDefaults(
  defineProps<{
    config: T
    items: ValueObjectOption<string | number>[]
  }>(),
  {}
)
const emit = defineEmits<{
  (e: 'change'): void
}>()

const modelValue = defineModel<AllowedDefault>({ required: true })

const { t } = useI18n()

const label = computed(() => {
  return props.config.titleT ? t(props.config.titleT) : undefined
})

const { clearOne } = useFilterHelpers()

const clearField = () => {
  clearOne(modelValue, props.config)
}
</script>

<template>
  <VAutocomplete
    v-model="modelValue"
    :items="items"
    :chips="config.multiple"
    :label="label"
    :multiple="config.multiple"
    :clearable="!config.mandatory"
    data-cy="filter-value"
    @click:clear.stop="clearField"
    @change="emit('change')"
  />
</template>
