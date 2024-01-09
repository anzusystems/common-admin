<script lang="ts" setup>
import 'flatpickr/dist/flatpickr.css'
import type { DatetimeUTC } from '@/types/common'
import { computed, ref, watch } from 'vue'
import { isDefined, isNull, isUndefined } from '@/utils/common'
import useVuelidate, { type ErrorObject } from '@vuelidate/core'
import { useValidate } from '@/validators/vuelidate/useValidate'
import TimePicker from '@/components/datetime/TimePicker.vue'
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import { SUFFIX } from '@/utils/datetime'
import customParseFormat from 'dayjs/plugin/customParseFormat'

const props = withDefaults(
  defineProps<{
    modelValue: DatetimeUTC | null | undefined
    type?: 'datetime'
    label?: string
    hideLabel?: boolean
    clearable?: boolean
    disabled?: boolean
    hideDetails?: boolean
    minNow?: boolean
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
    minNow: false,
    required: false,
    hideSetToNow: false,
    placeholder: '',
    dataCy: '',
    defaultValue: null,
    errorMessages: undefined,
  }
)

const emit = defineEmits<{
  (e: 'change'): void
  (e: 'blur'): void
  (e: 'focus'): void
  (e: 'update:modelValue', data: DatetimeUTC | null | undefined): void
  (e: 'onOpen'): void
  (e: 'onClose'): void
}>()

dayjs.extend(utc)
dayjs.extend(customParseFormat)

type TextFieldRef = null | { $el: HTMLElement }

const textFieldRef = ref<TextFieldRef>(null)
const textFieldValue = ref('')

const datePickerValue = ref<null | Date>(null)
const timePickerValue = ref<null | { hours: number, minutes: number }>(null)
const datetimeInternal = ref<null | dayjs.Dayjs>(null)

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

watch(
  () => props.modelValue,
  (newValue, oldValue) => {
    if (newValue === oldValue) return
    console.log(newValue)
    if (isNull(newValue) || isUndefined(newValue)) {
      datetimeInternal.value = null
      return
    }

    datetimeInternal.value = dayjs(newValue)
  },
  { immediate: true }
)

watch(
  datePickerValue,
  (newValue, oldValue) => {
    if (isNull(newValue) || isNull(datetimeInternal.value)) return
    if (isNull(newValue) && isNull(oldValue)) return
    if (newValue.getTime() === oldValue?.getTime()) return
    datetimeInternal.value = dayjs(datetimeInternal.value).hour(newValue.getHours()).minute(newValue.getMinutes())
  }
)

watch(
  timePickerValue,
  (newValue, oldValue) => {
    console.log(newValue)
    if (isNull(newValue) || isNull(datetimeInternal.value)) return
    if (newValue.hours === oldValue?.hours && newValue.minutes === oldValue?.minutes) return
    datetimeInternal.value = datetimeInternal.value.hour(newValue.hours).minute(newValue.minutes)
  }
)

watch(
  datetimeInternal,
  (newValue, oldValue) => {
    console.log(newValue)
    if (isNull(newValue)) {
      textFieldValue.value = ''
      emit('update:modelValue', null)
      return
    }
    if (newValue.isSame(oldValue)) return
    textFieldValue.value = newValue.format(displayFormat.value)
    datePickerValue.value = newValue.toDate()
    timePickerValue.value = { hours: newValue.hour(), minutes: newValue.minute() }
    emit('update:modelValue', newValue.utc().format('YYYY-MM-DDTHH:mm:00') + SUFFIX)
  },
  { immediate: true }
)

const errorMessageComputed = computed(() => {
  if (isDefined(props.errorMessages)) return props.errorMessages
  if (v$.value.textFieldValue.$errors.length)
    return [v$.value.textFieldValue.$errors.map((item: ErrorObject) => item.$message).join(' ')]
  return []
})

const onTextFieldBlur = () => {
  const filtered = textFieldValue.value.replace(/[^\s\d.:]/g, '')
  datetimeInternal.value = dayjs(filtered, displayFormat.value)
  v$.value.textFieldValue.$touch()
  emit('blur')
}

const onClear = () => {
  if (isNull(props.defaultValue) || isUndefined(props.defaultValue)) {
    datetimeInternal.value = null
    return
  }
  datetimeInternal.value = dayjs()
}

const onTextFieldFocus = () => {
  emit('focus')
}

const now = () => {
  datetimeInternal.value = dayjs()
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
    :disabled="disabled"
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
      >
        <template #activator="{ props: menuProps }">
          <VIcon
            class="a-datetime-picker__calendar-icon"
            icon="mdi-calendar"
            size="small"
            v-bind="menuProps"
          />
        </template>

        <VCard>
          <VDatePicker
            v-model="datePickerValue"
            class="a-datetime-picker-calendar"
            color="primary"
            show-adjacent-months
          />
          <TimePicker v-model="timePickerValue" />
          <button
            type="button"
            class="a-datetime-picker__now-button"
            tabindex="-1"
            @click="now"
          >
            Teraz
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
      {{ label }}<span
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
    font-family: "Roboto", sans-serif;
    font-weight: bold;
    line-height: 1.8;
    padding: 6px 0;

    &:hover {
      background-color: rgba(0 0 0 / 5%);
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

  :deep(.v-date-picker-month__days) {
    row-gap: 1px;
  }

  :deep(.v-date-picker-month) {
    padding-bottom: 2px;
  }
}
</style>
