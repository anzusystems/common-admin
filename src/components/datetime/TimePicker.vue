<script setup lang="ts">
import { nextTick, ref, useTemplateRef, watch, computed } from 'vue'

const emit = defineEmits<{
  (e: 'onEnterKeyup'): void
  (e: 'focusConfirm'): void
}>()

const modelValue = defineModel<null | { hours: number; minutes: number }>('modelValue', {
  required: true,
})

const hours = ref<string | undefined>(
  // eslint-disable-next-line vue/no-ref-object-reactivity-loss
  modelValue.value ? String(modelValue.value.hours).padStart(2, '0') : '12'
)
const minutes = ref<string | undefined>(
  // eslint-disable-next-line vue/no-ref-object-reactivity-loss
  modelValue.value ? String(modelValue.value.minutes).padStart(2, '0') : '00'
)

const hoursRefInput = useTemplateRef<HTMLInputElement>('hoursRefInput')
const minutesRefInput = useTemplateRef<HTMLInputElement>('minutesRefInput')

const hoursComputed = computed({
  get: () => hours.value,
  set: (value: string | number) => {
    let cleanValue = String(value).replace(/[^0-9]/g, '')

    if (cleanValue && parseInt(cleanValue) > 23) {
      hours.value = '23'
      nextTick(() => minutesRefInput.value?.focus())
      return
    }

    if (cleanValue.length > 2) {
      cleanValue = cleanValue.slice(0, 2)
    }

    hours.value = cleanValue

    if (cleanValue.length === 2) {
      nextTick(() => minutesRefInput.value?.focus())
    }
  },
})

const minutesComputed = computed({
  get: () => minutes.value,
  set: (value: string | number) => {
    let cleanValue = String(value).replace(/[^0-9]/g, '')

    if (cleanValue && parseInt(cleanValue) > 59) {
      minutes.value = '59'
      emit('focusConfirm')
      return
    }

    if (cleanValue.length > 2) {
      cleanValue = cleanValue.slice(0, 2)
    }

    minutes.value = cleanValue

    if (cleanValue.length === 2) {
      emit('focusConfirm')
    }
  },
})

const selectContent = async (event: FocusEvent) => {
  const target = event.target as HTMLInputElement | null
  await nextTick()
  target?.select()
}

const onBlurHours = () => {
  const parsedHours = parseInt(hours.value || '0')
  hours.value = parsedHours >= 0 && parsedHours <= 23 ? String(parsedHours).padStart(2, '0') : '00'
}

const onBlurMinutes = () => {
  const parsedMinutes = parseInt(minutes.value || '0')
  minutes.value = parsedMinutes >= 0 && parsedMinutes <= 59 ? String(parsedMinutes).padStart(2, '0') : '00'
}

const onEnterHoursKeyup = () => {
  onBlurHours()
  emit('onEnterKeyup')
}

const onEnterMinutesKeyup = () => {
  onBlurMinutes()
  emit('onEnterKeyup')
}

const increaseHours = () => {
  const parsedHours = parseInt(hours.value || '0')
  const newHours = isNaN(parsedHours) ? 1 : (parsedHours + 1) % 24
  hours.value = String(newHours).padStart(2, '0')
}

const decreaseHours = () => {
  const parsedHours = parseInt(hours.value || '0')
  const newHours = isNaN(parsedHours) ? 23 : (parsedHours - 1 + 24) % 24
  hours.value = String(newHours).padStart(2, '0')
}

const increaseMinutes = () => {
  const parsedMinutes = parseInt(minutes.value || '0')
  const parsedHours = parseInt(hours.value || '0')

  if (isNaN(parsedMinutes)) {
    minutes.value = '01'
    return
  }

  if (parsedMinutes === 59) {
    minutes.value = '00'
    const newHours = isNaN(parsedHours) ? 1 : (parsedHours + 1) % 24
    hours.value = String(newHours).padStart(2, '0')
  } else {
    const newMinutes = parsedMinutes + 1
    minutes.value = String(newMinutes).padStart(2, '0')
  }
}

const decreaseMinutes = () => {
  const parsedMinutes = parseInt(minutes.value || '0')
  const parsedHours = parseInt(hours.value || '0')

  if (isNaN(parsedMinutes)) {
    minutes.value = '59'
    return
  }

  if (parsedMinutes === 0) {
    minutes.value = '59'
    const newHours = isNaN(parsedHours) ? 23 : (parsedHours - 1 + 24) % 24
    hours.value = String(newHours).padStart(2, '0')
  } else {
    const newMinutes = parsedMinutes - 1
    minutes.value = String(newMinutes).padStart(2, '0')
  }
}

const focusHour = () => {
  hoursRefInput.value?.focus()
}

watch([hours, minutes], ([newHours, newMinutes], [oldHours, oldMinutes]) => {
  if (newHours === oldHours && newMinutes === oldMinutes) return
  const hoursInt = parseInt(newHours ?? (modelValue.value ? modelValue.value.hours.toString() : '12'))
  const minutesInt = parseInt(newMinutes ?? (modelValue.value ? modelValue.value.minutes.toString() : '0'))
  if (hoursInt >= 0 && hoursInt <= 23 && minutesInt >= 0 && minutesInt <= 59) {
    modelValue.value = { hours: hoursInt, minutes: minutesInt }
  }
})

defineExpose({
  focusHour,
})
</script>

<template>
  <div class="a-datetime-picker-time">
    <div class="a-datetime-picker-time__item a-datetime-picker-time__item">
      <input
        ref="hoursRefInput"
        v-model="hoursComputed"
        class="a-datetime-picker-time__input a-datetime-picker-time__input--hours"
        type="text"
        aria-label="Hour"
        tabindex="1"
        min="0"
        max="23"
        @focus="selectContent"
        @blur="onBlurHours"
        @keyup.enter="onEnterHoursKeyup"
      >
      <div class="a-datetime-picker-time__arrows">
        <VBtn
          tabindex="-1"
          variant="text"
          class="a-datetime-picker-time__arrow-up"
          @click="increaseHours"
        >
          <VIcon icon="mdi-chevron-up" />
        </VBtn>
        <VBtn
          tabindex="-1"
          variant="text"
          class="a-datetime-picker-time__arrow-down"
          @click="decreaseHours"
        >
          <VIcon icon="mdi-chevron-down" />
        </VBtn>
      </div>
    </div>
    <span class="a-datetime-picker-time__separator">:</span>
    <div class="a-datetime-picker-time__item">
      <input
        ref="minutesRefInput"
        v-model="minutesComputed"
        class="a-datetime-picker-time__input a-datetime-picker-time__input--minutes"
        type="text"
        aria-label="Minute"
        tabindex="2"
        min="0"
        max="59"
        @focus="selectContent"
        @blur="onBlurMinutes"
        @keyup.enter="onEnterMinutesKeyup"
      >
      <div class="a-datetime-picker-time__arrows">
        <VBtn
          tabindex="-1"
          variant="text"
          class="a-datetime-picker-time__arrow-up"
          @click="increaseMinutes"
        >
          <VIcon icon="mdi-chevron-up" />
        </VBtn>
        <VBtn
          tabindex="-1"
          variant="text"
          class="a-datetime-picker-time__arrow-down"
          @click="decreaseMinutes"
        >
          <VIcon icon="mdi-chevron-down" />
        </VBtn>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
$hover-bg-color: rgb(0 0 0 / 5%);

.a-datetime-picker-time {
  display: flex;

  &__item {
    flex-grow: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 40px;

    &:hover {
      background-color: $hover-bg-color;
    }
  }

  &__separator {
    font-weight: bold;
    font-size: 1.2rem;
    text-align: center;
    font-family: Roboto, sans-serif;
    min-height: 40px;
    padding: 0 5px;
    display: flex;
    align-items: center;
  }

  &__arrows {
    display: flex;
    flex-direction: column;
    opacity: 0;

    .v-btn {
      padding: 0 !important;
      min-width: 28px !important;
      width: 28px !important;
      height: 28px !important;
    }

    .a-datetime-picker-time__item:hover &,
    .a-datetime-picker-time__input:focus + &,
    &:focus-within {
      opacity: 1;
    }
  }

  &__input {
    width: 100%;
    max-width: 128px;
    height: 100%;
    display: inline-block;
    background: transparent;
    /* stylelint-disable-next-line */
    -webkit-box-shadow: none;
    box-shadow: none;
    border: 0;
    border-radius: 0;
    text-align: center;
    margin: 0;
    padding: 0;
    line-height: inherit;
    font-size: 1rem;
    position: relative;
    /* stylelint-disable-next-line */
    -webkit-box-sizing: border-box;
    box-sizing: border-box;
    /* stylelint-disable-next-line */
    -webkit-appearance: textfield;
    /* stylelint-disable-next-line */
    -moz-appearance: textfield;
    appearance: textfield;
    outline: none;

    &--hours {
      font-weight: bold;
    }
  }

  &__input::-webkit-inner-spin-button,
  &__input::-webkit-outer-spin-button {
    /* stylelint-disable-next-line */
    -webkit-appearance: none;
    margin: 0;
  }
}
</style>
