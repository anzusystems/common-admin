<script setup lang="ts">
import { ref, watch, withModifiers } from 'vue'
import { isBoolean, isUndefined } from '@/utils/common'
import AFileDropzone from '@/components/file/AFileDropzone.vue'
import type { InputFileChangeEvent } from '@/types/ChangeEvent'
import { useFormatAndSizeCheck } from '@/components/file/composables/formatAndSizeCheck'

/**
 * For accept and maxSizes check docs {@see useFormatAndSizeCheck}
 */
const props = withDefaults(
  defineProps<{
    fileInputKey?: number | undefined
    accept?: string | undefined
    maxSizes?: Record<string, number> | undefined
    multiple?: boolean
    useDropzone?: boolean
    dropzoneVariant?: 'fill' | 'default' | 'fullscreen'
    onDropzoneClickCallback?: (() => void) | undefined | false // false for disable, undefined for browse files, otherwise custom callback is used
  }>(),
  {
    fileInputKey: undefined,
    accept: undefined,
    maxSizes: undefined,
    multiple: true,
    useDropzone: false,
    dropzoneVariant: 'default',
    onDropzoneClickCallback: undefined,
  }
)

const emit = defineEmits<{
  (e: 'change', event: InputFileChangeEvent): void
  (e: 'filesInput', files: File[]): void
}>()

const BLOCK_DOUBLE_CLICK_MS = 200

const inputRef = ref<undefined | HTMLInputElement>(undefined)
// eslint-disable-next-line vue/no-setup-props-reactivity-loss
const fileInputKeyLocal = ref(props.fileInputKey || 0)
const blockDoubleClick = ref(false)

const clickInput = () => {
  if (blockDoubleClick.value === true) {
    return
  }
  blockDoubleClick.value = true
  inputRef.value?.click()
  setTimeout(() => {
    blockDoubleClick.value = false
  }, BLOCK_DOUBLE_CLICK_MS)
}

// eslint-disable-next-line vue/no-setup-props-reactivity-loss
const { checkFormatsAndSizes } = useFormatAndSizeCheck(props.accept, props.maxSizes)

const validateData = (files: File[]) => {
  if (props.multiple && files.length > 1) {
    emit('filesInput', checkFormatsAndSizes([files[0]]))
    return
  }
  emit('filesInput', checkFormatsAndSizes(files))
}

const onDropzoneDrop = (files: File[]) => {
  validateData(files)
}

const onInputFileChange = (payload: Event) => {
  const event = payload as InputFileChangeEvent
  emit('change', event)
  validateData(Array.from(event.target?.files ?? []))
}

const onFileDropzoneClick = () => {
  if (isBoolean(props.onDropzoneClickCallback)) {
    return
  }
  if (isUndefined(props.onDropzoneClickCallback)) {
    clickInput()
    return
  }
  props.onDropzoneClickCallback()
}

watch(
  () => props.fileInputKey,
  (newValue, oldValue) => {
    if (newValue === oldValue || isUndefined(newValue)) {
      return
    }
    fileInputKeyLocal.value = newValue
  }
)
</script>

<template>
  <AFileDropzone
    v-if="useDropzone"
    :variant="dropzoneVariant"
    @on-click="onFileDropzoneClick"
    @on-drop="onDropzoneDrop"
  />
  <slot
    v-else
    name="activator"
    :props="{ onClick: withModifiers(() => clickInput(), ['stop']) }"
  />
  <input
    ref="inputRef"
    :key="fileInputKeyLocal"
    :accept="accept"
    :multiple="multiple"
    hidden
    tabindex="-1"
    type="file"
    @change="onInputFileChange"
  >
</template>
