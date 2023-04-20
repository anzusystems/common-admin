<script lang="ts" setup>
import { useI18n } from 'vue-i18n'
import { computed } from 'vue'

import type { Filter } from '@/types/Filter'

const props = withDefaults(
  defineProps<{
    modelValue: Filter
    dataCyTrue?: string
    dataCyFalse?: string
  }>(),
  {
    dataCyTrue: 'filter-true',
    dataCyFalse: 'filter-false',
  }
)
const emit = defineEmits<{
  (e: 'update:modelValue', data: any): void
}>()

const value = computed({
  get() {
    return props.modelValue.model
  },
  set(newValue) {
    emit('update:modelValue', { ...props.modelValue, ...{ model: newValue } })
  },
})

const { t } = useI18n()

const label = computed(() => {
  return props.modelValue.titleT ? t(props.modelValue.titleT) : undefined
})
</script>

<template>
  <div class="a-filter-boolean-group d-flex flex-column align-left justify-center mb-2">
    <VLabel class="pr-1">
      <span>{{ label }}</span>
    </VLabel>
    <VBtnToggle v-model="value">
      <VBtn
        size="small"
        :value="true"
        :data-cy="dataCyTrue"
        :color="value === true ? 'secondary' : ''"
      >
        {{ t('common.model.boolean.true') }}
      </VBtn>
      <VBtn
        size="small"
        :value="false"
        :data-cy="dataCyFalse"
        :color="value === false ? 'secondary' : ''"
      >
        {{ t('common.model.boolean.false') }}
      </VBtn>
    </VBtnToggle>
  </div>
</template>

<style lang="scss" scoped>
.a-filter-boolean-group {
  position: relative;

  .v-label {
    position: absolute;
    top: -4px;
    left: 0;
    z-index: 2;
  }

  .v-btn-group {
    position: relative;
    margin-top: 20px;

    .v-btn {
      height: 33px !important;
    }
  }
}
</style>
