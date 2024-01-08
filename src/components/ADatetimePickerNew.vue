<script lang="ts" setup>
import 'flatpickr/dist/flatpickr.css'
import type { DatetimeUTC } from '@/types/common'
import { computed, ref, unref } from 'vue'
import { isDefined } from '@/utils/common'
import useVuelidate, { type ErrorObject } from '@vuelidate/core'
import { useValidate } from '@/validators/vuelidate/useValidate'

type TextFieldRef = null | { $el: HTMLElement }

const props = withDefaults(
  defineProps<{
    modelValue: DatetimeUTC | null | undefined
    type?: 'datetime' | 'date'
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

const textFieldRef = ref<TextFieldRef>(null)
const textFieldValue = ref('')

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

const errorMessageComputed = computed(() => {
  if (isDefined(props.errorMessages)) return props.errorMessages
  if (v$.value.textFieldValue.$errors.length)
    return [v$.value.textFieldValue.$errors.map((item: ErrorObject) => item.$message).join(' ')]
  return []
})

const onTextFieldBlur = () => {
  // if (!flatickrRefIsInitialized(flatickrRef.value)) return
  // const filtered = textFieldValue.value.replace(/[^\s\d.:]/g, '')
  // const date = flatickrRef.value.fp.parseDate(filtered, altFormat.value)
  // if (isUndefined(date)) {
  //   if (isNull(props.defaultValue)) {
  //     flatickrRef.value?.fp.clear(true)
  //   } else {
  //     flatickrRef.value?.fp.setDate(props.defaultValue, true)
  //   }
  //   v$.value.textFieldValue.$touch()
  //   emit('blur')
  //   return
  // }
  // flatickrRef.value?.fp.setDate(date, true)
  // v$.value.textFieldValue.$touch()
  emit('blur')
}

const onClear = () => {
  // flatpickrValue.value = props.defaultValue
  emit('update:modelValue', unref(props.defaultValue))
}

const onTextFieldFocus = () => {
  emit('focus')
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
          <VDatePicker color="primary" />
          <div class="a-datetime-picker__time">
            <div class="a-datetime-picker__hours">
              <input
                class="a-datetime-picker__time-input a-datetime-picker__time-input--hours"
                type="number"
                aria-label="Hour"
                tabindex="-1"
                step="1"
                min="0"
                max="23"
                maxlength="2"
              >
              <div class="a-datetime-picker__arrow a-datetime-picker__arrow-up" />
              <div class="a-datetime-picker__arrow a-datetime-picker__arrow-down" />
            </div>
            <span class="a-datetime-picker__time-separator">:</span>
            <div class="a-datetime-picker__mins">
              <input
                class="a-datetime-picker__time-input a-datetime-picker__time-input--minutes"
                type="number"
                aria-label="Minute"
                tabindex="-1"
                step="1"
                min="0"
                max="59"
                maxlength="2"
              >
              <div class="a-datetime-picker__arrow a-datetime-picker__arrow-up" />
              <div class="a-datetime-picker__arrow a-datetime-picker__arrow-down" />
            </div>
          </div>
          <button
            type="button"
            class="a-datetime-picker__now"
            tabindex="-1"
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
}
</style>
