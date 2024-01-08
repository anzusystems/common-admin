<script setup lang="ts">

</script>

<template>
  <div class="a-datetime-picker-time">
    <div class="a-datetime-picker-time__item a-datetime-picker-time__item">
      <input
        class="a-datetime-picker-time__input a-datetime-picker-time__input--hours"
        type="number"
        aria-label="Hour"
        tabindex="-1"
        step="1"
        min="0"
        max="23"
        maxlength="2"
      >
      <div class="a-datetime-picker-time__arrows">
        <VIcon
          icon="mdi-chevron-up"
          class="a-datetime-picker-time__arrow-up"
        />
        <VIcon
          icon="mdi-chevron-down"
          class="a-datetime-picker-time__arrow-down"
        />
      </div>
    </div>
    <span class="a-datetime-picker-time__separator">:</span>
    <div class="a-datetime-picker-time__item">
      <input
        class="a-datetime-picker-time__input a-datetime-picker-time__input--minutes"
        type="number"
        aria-label="Minute"
        tabindex="-1"
        step="1"
        min="0"
        max="59"
        maxlength="2"
      >
      <div class="a-datetime-picker-time__arrows">
        <VIcon
          icon="mdi-chevron-up"
          class="a-datetime-picker-time__arrow-up"
        />
        <VIcon
          icon="mdi-chevron-down"
          class="a-datetime-picker-time__arrow-down"
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
    display: inline-block;
    background: transparent;
    -webkit-box-shadow: none;
    box-shadow: none;
    border: 0;
    border-radius: 0;
    text-align: center;
    margin: 0;
    padding: 0;
    height: inherit;
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
