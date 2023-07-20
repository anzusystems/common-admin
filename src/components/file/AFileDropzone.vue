<script setup lang="ts">
import { useDropZone } from '@vueuse/core'
import { ref } from 'vue'
import { useDropzoneGlobalDragState } from '@/components/file/composables/dropzone'
import { isNull } from '@/utils/common'
import { useFormatAndSizeCheck } from '@/components/file/composables/formatAndSizeCheck'

/**
 * For accept and maxSizes check docs {@see useFormatAndSizeCheck}
 */
const props = withDefaults(
  defineProps<{
    variant?: 'fill' | 'default' | 'fullscreen'
    accept?: string | undefined
    maxSizes?: Record<string, number> | undefined
    disabled?: boolean
    transparent?: boolean
    size?: | 'small' | 'default' | 'large'
  }>(),
  {
    variant: 'default',
    accept: undefined,
    maxSizes: undefined,
    disabled: false,
    transparent: false,
    size: 'default',
  }
)
const emit = defineEmits<{
  (e: 'onDrop', files: File[]): void
  (e: 'onClick'): void
}>()

const dropZoneRef = ref<HTMLDivElement>()

const { checkFormatsAndSizes } = useFormatAndSizeCheck(props.accept, props.maxSizes)

function onDrop(files: File[] | null) {
  if (props.disabled) return
  if (isNull(files) || files.length === 0) return
  emit('onDrop', checkFormatsAndSizes(files))
}

const { isOverDropZone } = useDropZone(dropZoneRef, onDrop)

const { isDraggingFile } = useDropzoneGlobalDragState()
</script>

<template>
  <div
    ref="dropZoneRef"
    class="a-file-dropzone"
    :class="{
      'a-file-dropzone--bg': !transparent,
      'a-file-dropzone--over': isOverDropZone && isDraggingFile,
      'a-file-dropzone--possibility': isDraggingFile,
      [`a-file-dropzone--${variant}`]: true,
      [`a-file-dropzone--${size}`]: true,
    }"
    @click.stop="emit('onClick')"
  >
    <div
      v-if="disabled"
      class="text"
    />
    <div
      v-else-if="isDraggingFile"
      class="text"
    >
      Drop files here
    </div>
    <div
      v-else
      class="text"
    >
      You can drop files here
    </div>
  </div>
</template>

<style lang="scss">
$class-name-root: 'a-file-dropzone';

.#{$class-name-root} {
  outline-offset: -4px;
  position: relative;
  text-align: center;
  display: flex;
  align-items: center;
  justify-content: center;

  .text {
    padding: 6px;
    pointer-events: none;
    user-select: none;
    text-align: center;
    border-radius: 5px;
  }

  &--fill {
    position: absolute !important;
    inset: 0;
  }

  &--bg {
    width: 100%;
  }

  &--fullscreen {
    inset: 0;
    position: fixed;
    z-index: 9999;
  }

  &--small {
    min-height: 70px;
  }

  &--default {
    min-height: 140px;
  }

  &--large {
    min-height: 210px;
  }
}

.v-theme--light {
  .#{$class-name-root} {
    .text {
      background-color: rgba(212 212 212 / 50%)
    }

    &--bg {
      background-color: #D4D4D4;
    }

    &--over:not(&--disabled) {
      background-color: #dcedc8;
      outline: 2px dashed #7cb342;
    }

    &--possibility:not(&--disabled) {
      background-color: #e5edf1;
      outline: 2px dashed #bacfd4;
    }
  }
}

.v-theme--dark {
  .#{$class-name-root} {
    .text {
      background-color: rgba(57 57 57 / 50%)
    }

    &--bg {
      background-color: #393939;
    }

    &--over:not(&--disabled) {
      background-color: #283121;
      outline: 2px dashed #333e28;
    }

    &--possibility:not(&--disabled) {
      background-color: #212531;
      outline: 2px dashed #01579b;
    }
  }
}
</style>
