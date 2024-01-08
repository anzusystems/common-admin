<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'

// eslint-disable-next-line vue/no-setup-props-reactivity-loss
const modelValue = defineModel<{ hours: number, minutes: number }>('modelValue', {
  required: true,
})

// eslint-disable-next-line vue/no-setup-props-reactivity-loss
const hours = ref<string | undefined>(String(modelValue.value.hours).padStart(2, '0'))
// eslint-disable-next-line vue/no-setup-props-reactivity-loss
const minutes = ref<string | undefined>(String(modelValue.value.minutes).padStart(2, '0'))

const selectContent = async (event: FocusEvent) => {
  const target = event.target as HTMLInputElement | null
  await nextTick()
  target?.select()
}

const onBlurHours = () => {
  const parsedHours = parseInt(hours.value || '0')
  hours.value = (parsedHours >= 0 && parsedHours <= 23) ? String(parsedHours).padStart(2, '0') : '00'
}

const onBlurMinutes = () => {
  const parsedMinutes = parseInt(minutes.value || '0')
  minutes.value = (parsedMinutes >= 0 && parsedMinutes <= 59) ? String(parsedMinutes).padStart(2, '0') : '00'
}

const increaseHours = () => {
  const parsedHours = parseInt(hours.value || '0', 10)
  const newHours = isNaN(parsedHours) ? 1 : (parsedHours + 1) % 24
  hours.value = String(newHours).padStart(2, '0')
}

const decreaseHours = () => {
  const parsedHours = parseInt(hours.value || '0', 10)
  const newHours = isNaN(parsedHours) ? 23 : (parsedHours - 1 + 24) % 24
  hours.value = String(newHours).padStart(2, '0')
}

const increaseMinutes = () => {
  const parsedMinutes = parseInt(minutes.value || '0', 10)
  const newMinutes = isNaN(parsedMinutes) ? 1 : (parsedMinutes + 1) % 60
  minutes.value = String(newMinutes).padStart(2, '0')
}

const decreaseMinutes = () => {
  const parsedMinutes = parseInt(minutes.value || '0', 10)
  const newMinutes = isNaN(parsedMinutes) ? 59 : (parsedMinutes - 1 + 60) % 60
  minutes.value = String(newMinutes).padStart(2, '0')
}

watch(
  [hours, minutes],
  ([newHours, newMinutes], [oldHours, oldMinutes]) => {
    if (newHours === oldHours && newMinutes === oldMinutes) return
    const hoursInt = parseInt(newHours ?? modelValue.value.hours.toString())
    const minutesInt = parseInt(newMinutes ?? modelValue.value.minutes.toString())
    if (hoursInt >= 0 && hoursInt <= 23 && minutesInt >= 0 && minutesInt <= 59) {
      modelValue.value = { hours: hoursInt, minutes: minutesInt }
    }
  },
  { immediate: true }
)
</script>

<template>
  <div class="a-datetime-picker-time">
    <div class="a-datetime-picker-time__item a-datetime-picker-time__item">
      <input
        v-model="hours"
        class="a-datetime-picker-time__input a-datetime-picker-time__input--hours"
        type="number"
        aria-label="Hour"
        tabindex="-1"
        step="1"
        min="0"
        max="23"
        maxlength="2"
        @focus="selectContent"
        @blur="onBlurHours"
      >
      <div class="a-datetime-picker-time__arrows">
        <VIcon
          icon="mdi-chevron-up"
          class="a-datetime-picker-time__arrow-up"
          @click="increaseHours"
        />
        <VIcon
          icon="mdi-chevron-down"
          class="a-datetime-picker-time__arrow-down"
          @click="decreaseHours"
        />
      </div>
    </div>
    <span class="a-datetime-picker-time__separator">:</span>
    <div class="a-datetime-picker-time__item">
      <input
        v-model="minutes"
        class="a-datetime-picker-time__input a-datetime-picker-time__input--minutes"
        type="number"
        aria-label="Minute"
        tabindex="-1"
        step="1"
        min="0"
        max="59"
        maxlength="2"
        @focus="selectContent"
        @blur="onBlurMinutes"
      >
      <div class="a-datetime-picker-time__arrows">
        <VIcon
          icon="mdi-chevron-up"
          class="a-datetime-picker-time__arrow-up"
          @click="increaseMinutes"
        />
        <VIcon
          icon="mdi-chevron-down"
          class="a-datetime-picker-time__arrow-down"
          @click="decreaseMinutes"
        />
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
$hover-bg-color: rgba(0 0 0 / 5%);

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
    font-family: "Roboto", sans-serif;
    min-height: 40px;
    padding: 0 5px;
    display: flex;
    align-items: center; /* Vertical alignment */
  }

  &__arrows {
    display:flex;
    flex-direction: column;
    visibility: hidden;

    .a-datetime-picker-time__item:hover & {
      visibility: visible;
    }

    .v-icon {
      cursor: pointer;

      &:hover {
        background-color: $hover-bg-color
      }
    }
  }

  &__input {
    width: 100%;
    height: 100%;
    display: inline-block;
    background: transparent;
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
    -webkit-box-sizing: border-box;
    box-sizing: border-box;
    -webkit-appearance: textfield;
    -moz-appearance: textfield;
    appearance: textfield;
    outline: none;

    &--hours {
      font-weight: bold;
    }
  }

  &__input::-webkit-inner-spin-button,
  &__input::-webkit-outer-spin-button {
    -webkit-appearance: none;
    margin: 0;
  }
}
</style>
