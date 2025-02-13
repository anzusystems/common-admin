<script lang="ts" setup>
import { useI18n } from 'vue-i18n'
import { computed } from 'vue'
import { isNull } from '@/utils/common'

const props = withDefaults(
  defineProps<{
    modelValue: boolean | null
    dataCy?: string
    label?: string | undefined
    allT?: string
    trueT?: string
    falseT?: string
  }>(),
  {
    dataCy: 'optional-boolean',
    label: undefined,
    allT: 'common.model.all',
    trueT: 'common.model.boolean.true',
    falseT: 'common.model.boolean.false',
  }
)
const emit = defineEmits<{
  (e: 'update:modelValue', data: boolean | null): void
}>()

const value = computed({
  get() {
    if (isNull(props.modelValue)) return -1
    return props.modelValue ? 1 : 0
  },
  set(newValue) {
    let returnValue: null | boolean = null
    if (newValue === 1) returnValue = true
    if (newValue === 0) returnValue = false
    emit('update:modelValue', returnValue)
  },
})

const { t } = useI18n()

const items = computed(() => {
  return [
    { value: -1, title: t(props.allT) },
    { value: 1, title: t(props.trueT) },
    { value: 0, title: t(props.falseT) },
  ]
})
</script>

<template>
  <VSelect
    v-model="value"
    :data-cy="dataCy"
    :label="label"
    :items="items"
  />
</template>
