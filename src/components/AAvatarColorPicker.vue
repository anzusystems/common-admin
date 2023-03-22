<script lang="ts" setup>
import { computed, ref, watch } from 'vue'

const props = withDefaults(
  defineProps<{
    modelValue: string
    label?: string
    loading?: boolean
    readonly?: boolean
    required?: boolean
    randomColor?: boolean
    hideLabel?: boolean
  }>(),
  {
    label: '',
    loading: false,
    readonly: false,
    required: false,
    randomColor: false,
    hideLabel: false,
  }
)
const emit = defineEmits<{
  (e: 'update:modelValue', data: string): void
}>()

const swatches = [
  ['#F44336', '#E91E63', '#9C27B0', '#673AB7'],
  ['#2196F3', '#03A9F4', '#00BCD4', '#009688'],
  ['#4CAF50', '#8BC34A', '#CDDC39', '#F9A825'],
  ['#FF6F00', '#FF5722', '#795548', '#607D8B'],
  ['#757575', '#000000', '#3F51B5'],
]
const generatedColor = ref('')

const generateRandomColor = () => {
  const randomRow = Math.floor(Math.random() * swatches.length)
  generatedColor.value = swatches[randomRow][Math.floor(Math.random() * swatches[randomRow].length)]
  return generatedColor.value
}

const variantComputed = computed(() => {
  return props.modelValue.length > 0 ? 'flat' : 'tonal'
})

const buttonColorComputed = computed(() => {
  return props.modelValue.length > 0 ? props.modelValue : undefined
})

const onColorPickerChange = (newColor: string) => {
  emit('update:modelValue', newColor)
}

watch(
  () => props.modelValue,
  (newValue, oldValue) => {
    if (newValue === oldValue) return
    if (newValue.length === 7) return
    if (newValue.length !== 7 && props.randomColor) {
      if (generatedColor.value === '') {
        emit('update:modelValue', generateRandomColor())
        return
      }
      emit('update:modelValue', generatedColor.value)
    }
  },
  { immediate: true }
)
</script>

<template>
  <div>
    <label
      v-if="!hideLabel"
      class="v-label mr-2"
    >
      {{ label }}
      <span
        v-if="required"
        class="required"
      />
    </label>
    <VBtn
      :variant="variantComputed"
      icon
      :color="buttonColorComputed"
    >
      <VMenu
        v-if="!readonly"
        activator="parent"
      >
        <VCard>
          <VColorPicker
            :model-value="buttonColorComputed"
            :swatches="swatches"
            class="a-color-picker--hide-controls"
            elevation="0"
            hide-canvas
            hide-inputs
            show-swatches
            @update:model-value="onColorPickerChange"
          />
        </VCard>
      </VMenu>
    </VBtn>
  </div>
</template>

<style lang="scss">
.a-color-picker--hide-controls .v-color-picker__controls {
  display: none;
}
</style>
