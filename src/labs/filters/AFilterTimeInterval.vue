<script setup lang="ts">
import { computed, inject, nextTick, ref, watch } from 'vue'
import {
  FilterConfigKey,
  FilterDataKey,
  FilterSelectedKey,
  FilterSubmitResetCounterKey,
} from '@/labs/filters/filterInjectionKeys'
import { isArray, isBoolean, isNull, isUndefined } from '@/utils/common'
import { useI18n } from 'vue-i18n'
import { type AllowedFilterValues, useFilterClearHelpers } from '@/labs/filters/filterFactory'
import {
  TimeIntervalSpecialOptions,
  type TimeIntervalToolsValue,
  useFilterTimeIntervalValidators,
  useTimeIntervalOptions,
} from '@/labs/filters/filterTimeIntervalTools'
import ADialogToolbar from '@/components/ADialogToolbar.vue'
import AFormDatetimePicker from '@/components/form/AFormDatetimePicker.vue'
import type { DatetimeUTCNullable } from '@/types/common'
import ARow from '@/components/ARow.vue'
import { dateTimeNow, dateTimePretty, isDatetimeUTC } from '@/utils/datetime'
import { useAlerts } from '@/composables/system/alerts'
import type { ValueObjectOption } from '@/types/ValueObject'

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
  },
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

const modelValue = computed({
  get() {
    return filterData[props.nameFrom]
  },
  set(newValue) {
    filterData[props.nameFrom] = newValue
    updateSelected(newValue)
    filterConfig.touched = true
    nextTick(() => {
      emit('change')
    })
  },
})

// eslint-disable-next-line vue/no-setup-props-reactivity-loss
const { timeIntervalOptions, getTimeIntervalOption } = useTimeIntervalOptions(props.allowed)
const modelInternal = ref<TimeIntervalToolsValue>(null)
const dialogCustom = ref(false)
const dialogData = ref<{ from: DatetimeUTCNullable; until: DatetimeUTCNullable }>({
  from: null,
  until: dateTimeNow(),
})
const displayFromTo = ref(false)

const { v$ } = useFilterTimeIntervalValidators(dialogData)

const filterConfigCurrent = computed(() => filterConfig.fields[props.nameFrom])

const { t } = useI18n()

const label = computed(() => {
  return filterConfigCurrent.value.titleT ? t(filterConfigCurrent.value.titleT) : undefined
})

const { clearOne } = useFilterClearHelpers()
const { showValidationError } = useAlerts()

const onClear = () => {
  clearField()
  // Clearing means "back to the default", which is not always "everything" - a pair with an
  // absolute default keeps its window. Since the value then does not change, neither watcher runs,
  // so the display and the chip are re-derived here. Showing "everything" while the query still
  // carries the old window would make the control lie about what the list contains.
  syncDisplayToValue(filterData[props.nameFrom])
  updateSelected(filterData[props.nameFrom])
}

const onDialogConfirm = () => {
  v$.value.$touch()
  if (v$.value.$invalid) {
    showValidationError()
    return
  }
  displayFromTo.value = true
  dialogCustom.value = false
  filterData[props.nameUntil] = dialogData.value.until
  modelValue.value = dialogData.value.from
}

defineExpose({ onClear })

const onDialogClose = () => {
  dialogCustom.value = false
  modelInternal.value = null
}

const clearField = () => {
  clearOne(props.nameFrom, filterData, filterConfig)
  clearOne(props.nameUntil, filterData, filterConfig)
  filterSelected.value.delete(props.nameFrom)
}

const updateSelected = (fromValue: AllowedFilterValues) => {
  if (isArray(fromValue) || isBoolean(fromValue)) return
  if (isNull(fromValue) || isUndefined(fromValue)) {
    filterSelected.value.delete(props.nameFrom)
    return
  }
  const found = getTimeIntervalOption(fromValue as TimeIntervalToolsValue)
  if (!found && isDatetimeUTC(fromValue)) {
    const customOption = getTimeIntervalOption(TimeIntervalSpecialOptions.Custom)!
    filterSelected.value.set(props.nameFrom, [
      {
        title:
          customOption.title +
          ': ' +
          dateTimePretty(dialogData.value.from) +
          ' - ' +
          dateTimePretty(dialogData.value.until),
        value: fromValue,
      },
    ])
    return
  }
  if (!found) return
  filterSelected.value.set(props.nameFrom, [{ title: found.title, value: fromValue }])
}

const onEditInterval = (clear = false) => {
  v$.value.$reset()
  if (clear) {
    dialogData.value.from = null
    dialogData.value.until = dateTimeNow()
  }
  dialogCustom.value = true
}

/** What the control shows is derived from the value, never assumed. */
const syncDisplayToValue = (newValue: AllowedFilterValues) => {
  if (isArray(newValue) || isBoolean(newValue)) return
  displayFromTo.value = false
  if (isUndefined(newValue) || isNull(newValue)) {
    modelInternal.value = null
    return
  }
  const found = getTimeIntervalOption(newValue as TimeIntervalToolsValue)
  const filterDataUntil = filterData[props.nameUntil]
  if (!found && isDatetimeUTC(newValue) && isDatetimeUTC(filterDataUntil)) {
    modelInternal.value = TimeIntervalSpecialOptions.Custom
    dialogData.value.from = newValue
    dialogData.value.until = filterDataUntil
    displayFromTo.value = true
  }
  if (found) {
    modelInternal.value = found.value
  }
}

watch(modelValue, syncDisplayToValue, { immediate: true })

// Reset clears every field back to its default and wipes the chips. For a pair whose default is
// null that is the whole story, but an absolute default survives the reset - the value does not
// change, so no watcher runs, and the control would keep showing a range with no chip beside it.
// The wrapper bumps this counter after clearing, which is the one signal that a reset happened.
watch(submitResetCounter, () => {
  syncDisplayToValue(filterData[props.nameFrom])
  updateSelected(filterData[props.nameFrom])
})

watch(
  [() => filterData[props.nameFrom], () => filterData[props.nameUntil]],
  ([fromNewValue, untilNewValue], [fromOldValue, untilOldValue]) => {
    if (fromNewValue === fromOldValue && untilNewValue === untilOldValue) return
    updateSelected(fromNewValue)
  },
  { immediate: true },
)

const onInternalItemChange = (item: ValueObjectOption<TimeIntervalToolsValue>) => {
  if (item.value === TimeIntervalSpecialOptions.Custom) {
    onEditInterval(true)
    return
  }
  filterData[props.nameUntil] = null
  modelValue.value = item.value
}
</script>

<template>
  <VTextarea
    v-if="displayFromTo"
    :label="label"
    :model-value="dateTimePretty(dialogData.from) + ' - ' + dateTimePretty(dialogData.until)"
    readonly
    rows="1"
    auto-grow
    hide-details
    append-inner-icon="mdi-menu-down"
    clearable
    class="cursor-pointer"
    @click:clear.stop="onClear"
    @click.stop="onEditInterval()"
  />
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
    autocomplete="off"
    @click:clear.stop="onClear"
  >
    <template #item="{ props: itemProps, internalItem }">
      <VListItem
        v-bind="itemProps"
        @click="onInternalItemChange(internalItem)"
      />
    </template>
  </VSelect>
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
            :v="v$.dialogData.from"
            :label="t('common.filter.timeInterval.from')"
            required
          />
        </ARow>
        <ARow>
          <AFormDatetimePicker
            v-model="dialogData.until"
            :v="v$.dialogData.until"
            :label="t('common.filter.timeInterval.until')"
            required
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

<style lang="scss" scoped>
.v-text-field.cursor-pointer {
  ::v-deep(.v-field),
  ::v-deep(.v-field__input) {
    cursor: pointer;
  }
}
</style>
