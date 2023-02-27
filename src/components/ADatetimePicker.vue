<script lang="ts" setup>
import { computed, onMounted, ref, unref } from 'vue'
import FlatPickr from 'vue-flatpickr-component'
// @ts-ignore
import ShortcutButtonsPlugin from 'shortcut-buttons-flatpickr'
import FlatpickrLanguages from 'flatpickr/dist/l10n'
import 'flatpickr/dist/flatpickr.css'
import { dateToUtc, newDateNow } from '@/utils/datetime'
import type flatpickr from 'flatpickr'
import { isNull, isUndefined } from '@/utils/common'
import type { ErrorObject } from '@vuelidate/core'
import useVuelidate from '@vuelidate/core'
import type { DatetimeUTCNullable } from '@/types/common'
import { useValidateRequiredIf } from '@/validators/vuelidate/useValidateRequiredIf'
import { useI18n } from 'vue-i18n'
import { DateLimit, DateOption } from 'flatpickr/dist/types/options'

type FlatpickrRef = null | { fp: undefined | flatpickr.Instance }
type TextFieldRef = null | { $el: HTMLElement }

// todo test form and filter version, fix types

const props = withDefaults(
  defineProps<{
    modelValue: DatetimeUTCNullable
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
    enable?: DateLimit<DateOption>[]
    weekNumbers?: false
    dataCy?: string
    defaultValue?: null | DatetimeUTCNullable
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
    enable: undefined,
    weekNumbers: false,
    dataCy: '',
    defaultValue: null,
    errorMessages: undefined,
  }
)
const emit = defineEmits<{
  (e: 'change'): void
  (e: 'blur'): void
  (e: 'update:modelValue', data: string | null): void
  (e: 'onOpen'): void
  (e: 'onClose'): void
}>()

const flatickrRefIsInitialized = (
  ref: FlatpickrRef
): ref is { fp: flatpickr.Instance; fpInput: () => { value: string; focus: () => void } } => {
  return ref !== null && typeof ref.fp !== 'undefined'
}

const flatickrRef = ref<FlatpickrRef>(null)
const textFieldRef = ref<TextFieldRef>(null)
const isOpened = ref(false)
const lang = ref('sk')
const textFieldValue = ref('')
const flatpickrValue = ref<string | null>(null)

const { t } = useI18n()

const fixFormat = (value: string) => {
  return value.replace('Z', '000Z')
}

const onFlatpickrUpdate = (value: any) => {
  if (value === null) {
    emit('update:modelValue', null)
    emit('change')
    return
  }
  if (value && value.date) {
    emit('update:modelValue', fixFormat(value.date + '')) // check if needed
    emit('change')
    return
  }
  emit('update:modelValue', fixFormat(value + ''))
  emit('change')
}

const onFlatpickrOpen = () => {
  onTextFieldBlur()
  isOpened.value = true
  emit('onOpen')
}

const onFlatpickrClose = () => {
  isOpened.value = false
  emit('onClose')
}

const onFlatpickrChange = () => {
  if (!flatickrRefIsInitialized(flatickrRef.value)) return
  textFieldValue.value = flatickrRef.value.fpInput().value
}

const onTextFieldBlur = () => {
  if (!flatickrRefIsInitialized(flatickrRef.value)) return
  const filtered = textFieldValue.value.replace(/[^\s\d.:]/g, '')
  const date = flatickrRef.value.fp.parseDate(filtered, altFormat.value)
  if (isUndefined(date)) {
    if (isNull(props.defaultValue)) {
      flatickrRef.value?.fp.clear(true)
    } else {
      flatickrRef.value?.fp.setDate(props.defaultValue, true)
    }
    v$.value.textFieldValue.$touch()
    emit('blur')
    return
  }
  flatickrRef.value?.fp.setDate(date, true)
  v$.value.textFieldValue.$touch()
  emit('blur')
}

const onClear = () => {
  flatpickrValue.value = props.defaultValue
  emit('update:modelValue', unref(props.defaultValue))
}

const altFormat = computed(() => {
  return props.type === 'datetime' ? 'd.m.Y H:i' : 'd.m.Y'
})

const placeholderComputed = computed(() => {
  return props.type === 'datetime' ? 'dd.mm.yyyy hh:mm' : 'dd.mm.yyyy'
})

const enableComputed = computed(() => {
  if (props.enable && props.enable.length > 0) {
    return props.enable
  }
  return [
    {
      from: new Date(1901, 1),
      to: new Date(2099, 12),
    },
  ]
})

const defaultValueComputed = computed(() => {
  return isNull(props.defaultValue) ? undefined : props.defaultValue
})

const pluginsComputed = computed(() => {
  if (props.hideSetToNow) {
    return []
  }
  return [
    ShortcutButtonsPlugin({
      button: [
        {
          label: t('common.button.now'),
        },
      ],
      onClick: (index: number, fp: flatpickr.Instance) => {
        const now = newDateNow()
        fp.setDate(now, true)
        onFlatpickrUpdate(dateToUtc(now))
      },
    }),
  ]
})

const flatpickrConfig = computed(() => {
  const positionElement = textFieldRef.value?.$el.querySelector('.v-input__control')
  return {
    enableTime: props.type !== 'date',
    wrap: true,
    time_24hr: true,
    altFormat: altFormat.value,
    defaultDate: defaultValueComputed.value,
    allowInput: true,
    altInput: true,
    altInputClass: 'd-sr-only',
    positionElement: positionElement ?? undefined,
    // dateFormat: 'Y-m-dTH:i:S.000000\\Z', problem with timezone
    dateFormat: 'Z',
    disableMobile: true,
    clickOpens: false,
    position: 'auto right' as const,
    // @ts-ignore
    locale: { ...FlatpickrLanguages[lang.value] },
    enable: enableComputed.value,
    weekNumbers: props.weekNumbers,
    // @ts-ignore
    minDate: props.minNow ? new Date().fp_incr(-1) : false,
    plugins: pluginsComputed.value,
  }
})

const onCalendarClick = () => {
  setTimeout(() => {
    if (!flatickrRefIsInitialized(flatickrRef.value)) return
    if (isOpened.value) {
      flatickrRef.value.fp.close()
      return
    }
    onTextFieldBlur()
    flatickrRef.value.fp.open()
    flatickrRef.value.fpInput().focus()
  }, 0)
}

onMounted(() => {
  if (isNull(props.modelValue) && !isNull(props.defaultValue)) {
    flatpickrValue.value = props.defaultValue
    return
  }
  flatpickrValue.value = props.modelValue
})

const requiredIf = useValidateRequiredIf(t)

const rules = computed(() => {
  return {
    textFieldValue: {
      required: requiredIf(props.required),
    },
  }
})

const v$ = useVuelidate(rules, { textFieldValue })

const errorMessageComputed = computed(() => {
  if (!isUndefined(props.errorMessages)) return props.errorMessages
  if (v$.value.textFieldValue.$errors.length)
    return [v$.value.textFieldValue.$errors.map((item: ErrorObject) => item.$message).join(' ')]
  return []
})
</script>

<template>
  <VTextField
    ref="textFieldRef"
    v-model="textFieldValue"
    :error-messages="errorMessageComputed"
    :persistent-placeholder="true"
    :placeholder="placeholderComputed"
    class="a-datetime-picker"
    @blur="onTextFieldBlur"
    @keyup.enter="onTextFieldBlur"
  >
    <template #append-inner>
      <VIcon
        v-if="clearable && defaultValue !== modelValue"
        class="a-datetime-picker__clearable"
        icon="mdi-close-circle"
        @click.stop="onClear"
      />
      <div>
        <FlatPickr
          ref="flatickrRef"
          :config="flatpickrConfig"
          :disabled="disabled"
          :model-value="flatpickrValue"
          @update:model-value="onFlatpickrUpdate"
          @on-close="onFlatpickrClose"
          @on-open="onFlatpickrOpen"
          @on-change="onFlatpickrChange"
        />
        <VIcon class="a-datetime-picker__calendar" icon="mdi-calendar" @click.stop="onCalendarClick" />
      </div>
    </template>
    <template v-if="!hideLabel" #label> {{ label }}<span v-if="required" class="required" /></template>
  </VTextField>
</template>

<style lang="scss" scoped>
.a-datetime-picker {
  :deep(.v-field__append-inner .v-icon) {
    cursor: pointer;
  }

  &__calendar {
    opacity: 0.6 !important;
  }

  &__clearable {
    opacity: 0 !important;
  }

  &:hover {
    .a-datetime-picker__clearable {
      opacity: 0.6 !important;
    }
  }
}
</style>
