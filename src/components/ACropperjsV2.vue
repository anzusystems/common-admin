<!-- <script setup lang="ts">
WIP version, still many issues to solve, not ready for use yet.
import { CropperCanvas, CropperImage, CropperSelection, CropperGrid, CropperHandle, CropperShade } from 'cropperjs'
import { useResizeObserver } from '@vueuse/core'
import { nextTick, onMounted, useTemplateRef } from 'vue'

type SetDataOptions = {
  x: number
  y: number
  width: number
  height: number
}

withDefaults(
  defineProps<{
    src?: string
    alt?: string
    containerStyle?: { [key: string]: string } | undefined
    aspectRatio?: number
  }>(),
  {
    src: '',
    alt: '',
    containerStyle: undefined,
    aspectRatio: 1,
  },
)

const emit = defineEmits<{
  (e: 'ready'): void
  (e: 'onActionEnd'): void
}>()

const canvasRef = useTemplateRef<CropperCanvas>('canvasRef')
const selectionRef = useTemplateRef<CropperSelection>('selectionRef')
const cropperImageRef = useTemplateRef<CropperImage>('cropperImageRef')

const inSelection = (
  sel: { x: number; y: number; width: number; height: number },
  max: { x: number; y: number; width: number; height: number },
) => {
  return (
    sel.x >= max.x &&
    sel.y >= max.y &&
    sel.x + sel.width <= max.x + max.width &&
    sel.y + sel.height <= max.y + max.height
  )
}

const onSelectionChange = (event: Event) => {
  console.log('selection change', event)
  if (!canvasRef.value || !cropperImageRef.value) return
  const canvasRect = canvasRef.value.getBoundingClientRect()
  const imageRect = cropperImageRef.value.getBoundingClientRect()
  const sel = (event as CustomEvent).detail as { x: number; y: number; width: number; height: number }
  const maxSel = {
    x: imageRect.left - canvasRect.left,
    y: imageRect.top - canvasRect.top,
    width: imageRect.width,
    height: imageRect.height,
  }
  if (!inSelection(sel, maxSel)) {
    event.preventDefault()
  }
}

const onActionEnd = () => emit('onActionEnd')

const enable = () => {
  if (canvasRef.value) canvasRef.value.disabled = false
}

const disable = () => {
  if (canvasRef.value) canvasRef.value.disabled = true
}

const getImageData = () => {
  if (!cropperImageRef.value) return undefined
  return {
    naturalWidth: cropperImageRef.value.$image.naturalWidth,
    naturalHeight: cropperImageRef.value.$image.naturalHeight,
  }
}

const getData = () => {
  if (!selectionRef.value || !cropperImageRef.value) return undefined
  const [a, b, c, d] = cropperImageRef.value.$getTransform()
  const rotate = Math.atan2(b, a) * (180 / Math.PI)
  const scaleX = Math.sqrt(a * a + b * b)
  const scaleY = Math.sqrt(c * c + d * d)
  return {
    x: selectionRef.value.x,
    y: selectionRef.value.y,
    width: selectionRef.value.width,
    height: selectionRef.value.height,
    rotate,
    scaleX,
    scaleY,
  }
}

const setData = (data: SetDataOptions) => {
  if (selectionRef.value) selectionRef.value.$change(data.x, data.y, data.width, data.height)
}

defineExpose({
  enable,
  disable,
  getImageData,
  getData,
  setData,
})

onMounted(async () => {
  console.log('Cropper mounted, waiting for next tick and image ready...')
  await nextTick()
  await cropperImageRef.value?.$ready()
  if (cropperImageRef.value) {
    cropperImageRef.value.scalable = false
    cropperImageRef.value.translatable = false
  }
  const { stop } = useResizeObserver(canvasRef, () => {
    if (cropperImageRef.value) {
      cropperImageRef.value.scalable = true
      cropperImageRef.value.translatable = true
      cropperImageRef.value.$center('contain')
      cropperImageRef.value.scalable = false
      cropperImageRef.value.translatable = false
    }
    stop()
  })
  emit('ready')
})
</script>

<template>
  <div :style="containerStyle">
    <cropper-canvas
      ref="canvasRef"
      background
      :scale-step="0.1"
      @actionend="onActionEnd"
    >
      <cropper-image
        ref="cropperImageRef"
        :src="src"
        :alt="alt"
        initial-center-size="contain"
        scalable
        translatable
      />
      <cropper-shade />
      <cropper-handle
        action="select"
        plain
      />
      <cropper-selection
        ref="selectionRef"
        movable
        resizable
        outlined
        :aspect-ratio="aspectRatio"
        :initial-aspect-ratio="aspectRatio"
        @change="onSelectionChange"
      >
        <cropper-grid
          role="grid"
          rows="3"
          columns="3"
          bordered
          covered
        />
        <cropper-handle
          action="move"
          theme-color="rgba(255, 255, 255, 0.35)"
        />
        <cropper-handle action="n-resize" />
        <cropper-handle action="e-resize" />
        <cropper-handle action="s-resize" />
        <cropper-handle action="w-resize" />
        <cropper-handle action="ne-resize" />
        <cropper-handle action="nw-resize" />
        <cropper-handle action="se-resize" />
        <cropper-handle action="sw-resize" />
      </cropper-selection>
    </cropper-canvas>
  </div>
</template>

<style lang="scss">
cropper-canvas {
  height: 100%;
}
</style> -->
