<script lang="ts" setup>
import { useI18n } from 'vue-i18n'
import { computed, inject } from 'vue'
import {
  FilterConfigKey,
  FilterDataKey,
  FilterSelectedKey,
  FilterSubmitResetCounterKey,
} from '@/labs/filters/filterInjectionKeys.ts'
import { isNull, isUndefined } from '@/utils/common.ts'

const props = withDefaults(
  defineProps<{
    name: string
    dataCyTrue?: string
    dataCyFalse?: string
  }>(),
  {
    dataCyTrue: 'filter-true',
    dataCyFalse: 'filter-false',
  }
)
const emit = defineEmits<{
  (e: 'change'): void
}>()

const submitResetCounter = inject(FilterSubmitResetCounterKey)
const filterSelected = inject(FilterSelectedKey)
const filterConfig = inject(FilterConfigKey)
const filterData = inject(FilterDataKey)

if (
  isUndefined(submitResetCounter) ||
  isUndefined(filterSelected) ||
  isUndefined(filterConfig) ||
  // eslint-disable-next-line vue/no-setup-props-reactivity-loss
  isUndefined(filterConfig.fields[props.name]) ||
  isUndefined(filterData) ||
  // eslint-disable-next-line vue/no-setup-props-reactivity-loss
  isUndefined(filterData[props.name])
) {
  throw new Error('Incorrect provide/inject config.')
}

const modelValue = computed({
  get() {
    return filterData[props.name]
  },
  set(newValue) {
    filterData[props.name] = newValue
    updateSelected()
    filterConfig.touched = true
    emit('change')
  },
})

const filterConfigCurrent = computed(() => filterConfig.fields[props.name])

const { t } = useI18n()

const label = computed(() => {
  return filterConfigCurrent.value.titleT ? t(filterConfigCurrent.value.titleT) : undefined
})

const updateSelected = () => {
  if (isNull(modelValue.value)) {
    filterSelected.value.delete(props.name)
    return
  }
  filterSelected.value.set(props.name, modelValue.value)
}
</script>

<template>
  <div class="a-filter-boolean-group d-flex flex-column align-left justify-center mb-2">
    <VLabel class="pr-1">
      <span>{{ label }}</span>
    </VLabel>
    <VBtnToggle v-model="modelValue">
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
