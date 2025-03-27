<script setup lang="ts">
import { computed, inject, ref, watch } from 'vue'
import {
  FilterConfigKey,
  FilterDataKey,
  FilterSelectedKey,
  FilterSubmitResetCounterKey,
  FilterTouchedKey,
} from '@/components/filter2/filterInjectionKeys.ts'
import { isNull, isString, isUndefined } from '@/utils/common.ts'
import { useI18n } from 'vue-i18n'
import { useFilterHelpers } from '@/composables/filter/filterFactory.ts'
import {
  TimeIntervalSpecialOptions,
  type TimeIntervalToolsValue,
  useTimeIntervalOptions,
} from '@/components/filter2/variant/filterTimeIntervalTools.ts'
import ADialogToolbar from '@/components/ADialogToolbar.vue'
import AFormDatetimePicker from '@/components/form/AFormDatetimePicker.vue'
import type { DatetimeUTCNullable } from '@/types/common.ts'
import ARow from '@/components/ARow.vue'
import ADatetime from '@/components/datetime/ADatetime.vue'

const props = withDefaults(
  defineProps<{
    nameFrom: string
    nameUntil: string
    allowed?: TimeIntervalToolsValue[]
    placeholder?: string | undefined
    dataCy?: string
  }>(),
  {
    allowed: undefined,
    placeholder: undefined,
    dataCy: 'filter-time-interval',
  }
)
const emit = defineEmits<{
  (e: 'change'): void
}>()

const submitResetCounter = inject(FilterSubmitResetCounterKey)
const touched = inject(FilterTouchedKey)
const filterSelected = inject(FilterSelectedKey)
const filterConfig = inject(FilterConfigKey)
const filterData = inject(FilterDataKey)

if (
  isUndefined(submitResetCounter) ||
  isUndefined(touched) ||
  isUndefined(filterSelected) ||
  isUndefined(filterConfig) ||
  // eslint-disable-next-line vue/no-setup-props-reactivity-loss
  isUndefined(filterConfig.fields[props.nameFrom]) ||
  // eslint-disable-next-line vue/no-setup-props-reactivity-loss
  isUndefined(filterConfig.fields[props.nameUntil]) ||
  isUndefined(filterData) ||
  // eslint-disable-next-line vue/no-setup-props-reactivity-loss
  isUndefined(filterData[props.nameFrom]) ||
  // eslint-disable-next-line vue/no-setup-props-reactivity-loss
  isUndefined(filterData[props.nameUntil])
) {
  throw new Error('Incorrect provide/inject config.')
}

// eslint-disable-next-line vue/no-setup-props-reactivity-loss
const { timeIntervalOptions } = useTimeIntervalOptions(props.allowed)
const modelInternal = ref<TimeIntervalToolsValue>(null)
const dialogCustom = ref(false)
const dialogData = ref<{ from: DatetimeUTCNullable; until: DatetimeUTCNullable }>({
  from: null,
  until: null,
})
const displayFromTo = ref(false)

const modelValue = computed({
  get() {
    return filterData[props.nameFrom]
  },
  set(newValue) {
    filterData[props.nameFrom] = newValue
    touched.value = true
    emit('change')
  },
})

const filterConfigCurrent = computed(() => filterConfig.fields[props.nameFrom])

const { t } = useI18n()

const label = computed(() => {
  return filterConfigCurrent.value.titleT ? t(filterConfigCurrent.value.titleT) : undefined
})

const { clearOne } = useFilterHelpers()

const onClear = () => {
  console.log('onClear')
  displayFromTo.value = false
  modelInternal.value = null
  clearField()
}

const onDialogConfirm = () => {
  displayFromTo.value = true
  dialogCustom.value = false
  console.log('onDialogConfirm')
}

const onDialogClose = () => {
  dialogCustom.value = false
  modelInternal.value = null
}

const clearField = () => {
  clearOne(props.nameFrom, filterData, filterConfig)
  filterSelected.value.delete(props.nameFrom)
}

const updateSelected = () => {
  if (!isString(modelValue.value) || (isString(modelValue.value) && modelValue.value.length === 0)) return
  filterSelected.value.set(props.nameFrom, [{ title: modelValue.value, value: modelValue.value }])
}

watch(
  modelInternal,
  (newValue) => {
    console.log('modelInternal', newValue)
    if (newValue === TimeIntervalSpecialOptions.Custom) {
      dialogData.value = { from: null, until: null }
      dialogCustom.value = true
      return
    }
  },
  { immediate: true }
)

watch(submitResetCounter, () => {
  updateSelected()
})
</script>

<template>
  <div
    v-if="displayFromTo"
    class="d-flex align-center justify-space-between"
  >
    <div class="text-caption">
      <span class="text-medium-emphasis">{{ label }}</span><br>
      <ADatetime :date-time="dialogData.from" /> - <ADatetime :date-time="dialogData.until" />
    </div>
    <div>
      <VIcon
        class="mr-1"
        icon="mdi-pencil-circle opacity-50"
        @click.stop="onClear"
      />
      <VIcon
        icon="mdi-close-circle opacity-50"
        @click.stop="onClear"
      />
    </div>
  </div>
  <VSelect
    v-else
    v-model="modelInternal"
    item-title="title"
    item-value="value"
    :label="label"
    :clearable="!isNull(modelInternal)"
    no-filter
    :data-cy="dataCy"
    :items="timeIntervalOptions"
    hide-details
    @click:clear.stop="onClear"
  />
  <VDialog
    v-if="dialogCustom"
    :model-value="true"
    width="auto"
    :min-width="360"
  >
    <VCard>
      <ADialogToolbar @on-cancel="onDialogClose">
        <slot name="title">
          {{ label }}
        </slot>
      </ADialogToolbar>
      <VCardText>
        <ARow>
          <AFormDatetimePicker
            v-model="dialogData.from"
            label="From"
          />
        </ARow>
        <ARow>
          <AFormDatetimePicker
            v-model="dialogData.until"
            label="Until"
          />
        </ARow>
      </VCardText>
      <VCardActions>
        <VSpacer />
        <ABtnTertiary
          data-cy="button-cancel"
          @click.stop="onDialogClose"
        >
          {{ t('common.button.cancel') }}
        </ABtnTertiary>
        <ABtnPrimary
          data-cy="button-confirm"
          @click.stop="onDialogConfirm"
        >
          {{ t('common.button.confirm') }}
        </ABtnPrimary>
      </VCardActions>
    </VCard>
  </VDialog>
</template>
