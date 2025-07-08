<script lang="ts" setup>
import type { DatetimeUTC } from '@/types/common'
import { computed, nextTick, ref, toRaw, watch } from 'vue'
import { isDefined, isNull, isUndefined } from '@/utils/common'
import useVuelidate, { type ErrorObject } from '@vuelidate/core'
import { useValidate } from '@/validators/vuelidate/useValidate'
import TimePicker from '@/components/datetime/TimePicker.vue'
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import { SUFFIX } from '@/utils/datetime'
import customParseFormat from 'dayjs/plugin/customParseFormat'
import { useI18n } from 'vue-i18n'

const props = withDefaults(
  defineProps<{
    modelValue: DatetimeUTC | null | undefined
    type?: 'datetime'
    label?: string
    hideLabel?: boolean
    clearable?: boolean
    disabled?: boolean
    hideDetails?: boolean
    required?: boolean
    hideSetToNow?: boolean
    placeholder?: string
    dataCy?: string
    defaultValue?: DatetimeUTC | null | undefined
    errorMessages?: string[]
  }>(),
  {
    type: 'datetime',
    label: '',
    hideLabel: false,
    clearable: false,
    disabled: false,
    hideDetails: false,
    required: false,
    hideSetToNow: false,
    placeholder: '',
    dataCy: '',
    defaultValue: null,
    errorMessages: undefined,
  }
)

const emit = defineEmits<{
  (e: 'blur'): void
  (e: 'focus'): void
  (e: 'update:modelValue', data: DatetimeUTC | null | undefined): void
  (e: 'onOpen'): void
  (e: 'onClose'): void
  (e: 'afterClear'): void
}>()

dayjs.extend(utc)
dayjs.extend(customParseFormat)

type TextFieldRef = null | { $el: HTMLElement }

const pickerOpened = ref(false)
const pickerKey = ref(0)
const timeKey = ref(0)
const textFieldRef = ref<TextFieldRef>(null)
const textFieldValue = ref('')

const datePickerValue = ref<null | Date>(null)
const timePickerValue = ref<null | { hours: number; minutes: number }>(null)
const datetimeInternal = ref<null | dayjs.Dayjs>(null)

const { t } = useI18n()

const placeholderComputed = computed(() => {
  return props.type === 'datetime' ? 'dd.mm.yyyy hh:mm' : 'dd.mm.yyyy'
})

const { requiredIf } = useValidate()
const rules = computed(() => {
  return {
    textFieldValue: {
      required: requiredIf(props.required),
    },
  }
})
const v$ = useVuelidate(rules, { textFieldValue })

const displayFormat = computed(() => {
  return props.type === 'datetime' ? 'DD.MM.YYYY HH:mm' : 'DD.MM.YYYY'
})

const tryEmitNewValue = (newValue: DatetimeUTC | null | undefined) => {
  if (newValue === props.modelValue) return
  emit('update:modelValue', newValue)
}

const updateDateAndTimePickerOnlyWhenChanged = (newValue: dayjs.Dayjs | null) => {
  if (isNull(newValue)) return
  if (
    isNull(timePickerValue.value) ||
    newValue.hour() !== timePickerValue.value.hours ||
    newValue.minute() !== timePickerValue.value.minutes
  ) {
    timePickerValue.value = { hours: newValue.hour(), minutes: newValue.minute() }
  }
  if (
    isNull(datePickerValue.value) ||
    newValue.year() !== datePickerValue.value.getFullYear() ||
    newValue.month() !== datePickerValue.value.getMonth() ||
    newValue.date() !== datePickerValue.value.getDate()
  ) {
    datePickerValue.value = newValue.toDate()
  }
}

watch(
  () => props.modelValue,
  (newValue, oldValue) => {
    if (newValue === oldValue) return
    if (isNull(newValue) || isUndefined(newValue)) {
      datetimeInternal.value = null
      return
    }
    datetimeInternal.value = dayjs(newValue, 'YYYY-MM-DDTHH:mm:ss.SSSSSSZ').millisecond(0)
  },
  { immediate: true }
)

const watchDatePicker = (newValue: null | Date, internal: dayjs.Dayjs) => {
  if (isNull(newValue)) return internal
  return internal.set('date', newValue.getDate()).set('month', newValue.getMonth()).set('year', newValue.getFullYear())
}

const watchTimePicker = (newValue: null | { hours: number; minutes: number }, internal: dayjs.Dayjs) => {
  if (isNull(newValue)) return internal
  return internal.set('hour', newValue.hours).set('minute', newValue.minutes)
}

watch([timePickerValue, datePickerValue], ([newTimePickerValue, newDatePickerValue]) => {
  let newDate: dayjs.Dayjs | null = null

  if (!isNull(datetimeInternal.value)) {
    newDate = datetimeInternal.value
  } else if (!isNull(props.modelValue)) {
    newDate = dayjs(props.modelValue, 'YYYY-MM-DDTHH:mm:ss.SSSSSSZ')
  } else {
    newDate = dayjs().hour(0).minute(0).second(0).millisecond(0)
  }

  newDate = watchTimePicker(newTimePickerValue, newDate!)
  newDate = watchDatePicker(newDatePickerValue, newDate!)
  if (newDate.isSame(toRaw(datetimeInternal.value))) return
  datetimeInternal.value = newDate
})

watch(
  datetimeInternal,
  (newValue) => {
    if (isNull(newValue)) {
      textFieldValue.value = ''
      tryEmitNewValue(null)
      return
    }
    const newUtcValue = newValue.utc().format('YYYY-MM-DDTHH:mm:ss') + SUFFIX
    textFieldValue.value = newValue.format(displayFormat.value)
    updateDateAndTimePickerOnlyWhenChanged(newValue)
    tryEmitNewValue(newUtcValue)
  },
  { immediate: true }
)

watch(pickerOpened, (newValue) => {
  if (newValue) {
    onTextFieldBlur()
    nextTick(() => {
      pickerKey.value++
    })
    emit('onOpen')
    return
  }
  emit('onClose')
})

const errorMessageComputed = computed(() => {
  if (isDefined(props.errorMessages)) return props.errorMessages
  if (v$.value.textFieldValue.$errors.length)
    return [v$.value.textFieldValue.$errors.map((item: ErrorObject) => item.$message).join(' ')]
  return []
})

const onTextFieldBlur = () => {
  const filtered = textFieldValue.value.replace(/[^\s\d.:]/g, '').trim()
  if (filtered.length === 0 && !props.required) {
    datetimeInternal.value = null
    emit('blur')
    return
  }
  const parsed = dayjs(filtered, ['DD.MM.YYYY HH:mm', 'DD.MM.YYYY'])
  if (parsed.isValid()) {
    // keep seconds from original model
    let seconds = 0
    if (!isNull(props.modelValue)) {
      const modelDate = dayjs(props.modelValue, 'YYYY-MM-DDTHH:mm:ss.SSSSSSZ')
      if (modelDate.isValid()) seconds = modelDate.second()
    }
    datetimeInternal.value = parsed.second(seconds)
    v$.value.textFieldValue.$touch()
    emit('blur')
    return
  }
  if (!isNull(datetimeInternal.value)) {
    textFieldValue.value = datetimeInternal.value.format(displayFormat.value)
  }
  v$.value.textFieldValue.$touch()
  emit('blur')
}

const onClear = () => {
  if (isNull(props.defaultValue) || isUndefined(props.defaultValue)) {
    datetimeInternal.value = null
    datePickerValue.value = null
    timePickerValue.value = null
    emit('afterClear')
    return
  }
  datetimeInternal.value = dayjs(props.defaultValue, 'YYYY-MM-DDTHH:mm:ss.SSSSSSZ')
  emit('afterClear')
}

const onTextFieldFocus = () => {
  emit('focus')
}

const now = () => {
  datetimeInternal.value = dayjs().second(0).millisecond(0)
  nextTick(() => {
    pickerKey.value++
    timeKey.value++
  })
}
</script>

<template>
  <VTextField
    ref="textFieldRef"
    v-model="textFieldValue"
    :error-messages="errorMessageComputed"
    :persistent-placeholder="true"
    :placeholder="placeholderComputed"
    class="a-datetime-picker"
    hide-details="auto"
    :disabled="disabled"
    autocomplete="off"
    @blur="onTextFieldBlur"
    @focus="onTextFieldFocus"
    @keyup.enter="onTextFieldBlur"
  >
    <template #append-inner>
      <VIcon
        v-if="clearable && defaultValue !== modelValue"
        class="a-datetime-picker__clearable-icon"
        icon="mdi-close-circle"
        @click.stop="onClear"
      />
      <VMenu
        v-if="!disabled"
        location="bottom end"
        origin="top end"
        :close-on-content-click="false"
        @update:model-value="(value: boolean) => (pickerOpened = value)"
      >
        <template #activator="{ props: menuProps }">
          <VIcon
            class="a-datetime-picker__calendar-icon"
            icon="mdi-calendar"
            size="small"
            v-bind="menuProps"
          />
        </template>

        <VCard v-if="pickerOpened">
          <VDatePicker
            :key="pickerKey"
            v-model="datePickerValue"
            class="a-datetime-picker-calendar"
            color="primary"
            show-adjacent-months
            v-bind="$attrs"
          />
          <TimePicker
            :key="timeKey"
            v-model="timePickerValue"
          />
          <button
            type="button"
            class="a-datetime-picker__now-button"
            tabindex="-1"
            @click="now"
          >
            {{ t('common.time.now') }}
          </button>
        </VCard>
      </VMenu>

      <div class="ml-1">
        <slot name="append-inner" />
      </div>
    </template>
    <template
      v-if="!hideLabel"
      #label
    >
      {{ label
      }}<span
        v-if="required"
        class="required"
      />
    </template>
  </VTextField>
</template>

<style lang="scss" scoped>
.a-datetime-picker {
  :deep(.v-field__append-inner .v-icon) {
    cursor: pointer;
  }

  &__calendar-icon {
    margin-top: 2px;
    opacity: 0.6 !important;
  }

  &__clearable-icon {
    opacity: 0 !important;
  }

  &:hover {
    .a-datetime-picker__clearable-icon {
      opacity: 0.6 !important;
    }
  }

  &__now-button {
    width: 100%;
    text-align: center;
    font-size: 0.86rem;
    font-family: Roboto, sans-serif;
    font-weight: bold;
    line-height: 1.8;
    padding: 6px 0;

    &:hover {
      background-color: rgb(0 0 0 / 5%);
    }
  }
}

.a-datetime-picker-calendar {
  :deep(.v-picker-title) {
    display: none;
  }

  :deep(.v-date-picker-header) {
    padding-top: 12px;
  }

  :deep(.v-date-picker-month) {
    padding-bottom: 2px;
  }
}
</style>
