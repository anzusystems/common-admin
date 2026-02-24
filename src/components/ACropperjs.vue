<script setup lang="ts">
import Cropper, { CropperCanvas, CropperHandle, CropperImage, CropperSelection } from 'cropperjs'
import { nextTick, onMounted, onUnmounted, ref } from 'vue'
import { isNull } from '@/utils/common'

type SetDataOptions = {
  x: number
  y: number
  width: number
  height: number
  rotate?: number
  scaleX?: number
  scaleY?: number
}

const props = withDefaults(
  defineProps<{
    // Library props
    src?: string
    alt?: string
    containerStyle?: { [key: string]: string } | undefined
    imgStyle?: { [key: string]: string } | undefined
    // CropperJS props
    aspectRatio?: number
    autoCrop?: boolean
    autoCropArea?: number
    background?: boolean
    center?: boolean
    /** @deprecated */
    checkCrossOrigin?: boolean
    /** @deprecated */
    checkOrientation?: boolean
    cropBoxMovable?: boolean
    cropBoxResizable?: boolean
    data?: Partial<SetDataOptions> | null
    dragMode?: 'crop' | 'move' | 'none'
    guides?: boolean
    highlight?: boolean
    initialAspectRatio?: number
    modal?: boolean
    movable?: boolean
    preview?: HTMLElement | HTMLElement[] | NodeListOf<HTMLElement> | string
    /** @deprecated */
    responsive?: boolean
    /** @deprecated */
    restore?: boolean
    rotatable?: boolean
    scalable?: boolean
    toggleDragModeOnDblclick?: boolean
    viewMode?: 0 | 1 | 2 | 3
    wheelZoomRatio?: number
    /** @deprecated */
    zoomOnTouch?: boolean
    /** @deprecated */
    zoomOnWheel?: boolean
    /** @deprecated */
    zoomable?: boolean
    // Size limitation
    minCanvasWidth?: number
    minCanvasHeight?: number
    /** @deprecated */
    minContainerWidth?: number
    /** @deprecated */
    minContainerHeight?: number
    minCropBoxWidth?: number
    minCropBoxHeight?: number
    // Callbacks
    ready?: null | (() => void)
    crop?: null | ((event: Event) => void)
    cropend?: null | ((event: Event) => void)
    cropmove?: null | ((event: Event) => void)
    cropstart?: null | ((event: Event) => void)
    zoom?: null | ((event: Event) => void)
  }>(),
  {
    containerStyle: undefined,
    src: '',
    alt: '',
    imgStyle: undefined,
    aspectRatio: NaN,
    autoCrop: true,
    autoCropArea: 0.8,
    background: true,
    center: true,
    checkCrossOrigin: true,
    checkOrientation: true,
    cropBoxMovable: true,
    cropBoxResizable: true,
    data: null,
    dragMode: 'crop',
    guides: true,
    highlight: true,
    initialAspectRatio: NaN,
    modal: true,
    movable: true,
    preview: '',
    responsive: true,
    restore: true,
    rotatable: true,
    scalable: true,
    toggleDragModeOnDblclick: true,
    viewMode: 0,
    wheelZoomRatio: 0.1,
    zoomOnTouch: true,
    zoomOnWheel: true,
    zoomable: true,
    minCanvasWidth: 0,
    minCanvasHeight: 0,
    minContainerWidth: 200,
    minContainerHeight: 100,
    minCropBoxWidth: 0,
    minCropBoxHeight: 0,
    ready: null,
    crop: null,
    cropend: null,
    cropmove: null,
    cropstart: null,
    zoom: null,
  },
)

const cropperInstance = ref<InstanceType<typeof Cropper> | null>(null)
const imgEl = ref<HTMLImageElement | null>(null)
const loading = ref(true)

let canvas: CropperCanvas | null = null
let selection: CropperSelection | null = null
let cropperImage: CropperImage | null = null

const enable = () => {
  if (canvas) canvas.disabled = false
}

const disable = () => {
  if (canvas) canvas.disabled = true
}

const destroy = () => {
  cropperInstance.value?.destroy()
}

const getImageData = () => {
  if (!cropperImage) return undefined
  return {
    naturalWidth: cropperImage.$image.naturalWidth,
    naturalHeight: cropperImage.$image.naturalHeight,
  }
}

const getData = () => {
  if (!selection || !cropperImage) return undefined
  const [a, b, c, d] = cropperImage.$getTransform()
  const rotate = Math.atan2(b, a) * (180 / Math.PI)
  const scaleX = Math.sqrt(a * a + b * b)
  const scaleY = Math.sqrt(c * c + d * d)
  return {
    x: selection.x,
    y: selection.y,
    width: selection.width,
    height: selection.height,
    rotate,
    scaleX,
    scaleY,
  }
}

const setData = (data: SetDataOptions) => {
  if (selection) selection.$change(data.x, data.y, data.width, data.height)
  if (cropperImage) {
    if (data.rotate !== undefined) {
      cropperImage.$resetTransform()
      cropperImage.$rotate(data.rotate * (Math.PI / 180))
    }
    if (data.scaleX !== undefined || data.scaleY !== undefined) {
      cropperImage.$scale(data.scaleX ?? 1, data.scaleY ?? 1)
    }
  }
}

defineExpose({
  enable,
  disable,
  destroy,
  getImageData,
  getData,
  setData,
})

onMounted(() => {
  nextTick(() => {
    if (!isNull(imgEl.value)) {
      const cropper = new Cropper(imgEl.value!)
      cropperInstance.value = cropper

      canvas = cropper.getCropperCanvas()
      selection = cropper.getCropperSelection()
      cropperImage = cropper.getCropperImage()

      if (canvas) {
        // Background
        canvas.background = props.background

        // Zoom control (zoomOnWheel and zoomable are deprecated in v2 but still controllable via scaleStep)
        if (!props.zoomOnWheel || !props.zoomable) {
          canvas.scaleStep = 0
        } else {
          canvas.scaleStep = props.wheelZoomRatio
        }

        // Min canvas size
        if (props.minCanvasWidth) canvas.style.minWidth = `${props.minCanvasWidth}px`
        if (props.minCanvasHeight) canvas.style.minHeight = `${props.minCanvasHeight}px`

        // Drag mode — set action on the top-level canvas handle
        const dragHandle = canvas.querySelector(':scope > cropper-handle') as CropperHandle | null
        if (dragHandle && props.dragMode) {
          const actionMap: Record<string, string> = { crop: 'select', move: 'move', none: 'none' }
          dragHandle.action = actionMap[props.dragMode] ?? 'select'
        }

        // Toggle drag mode on double click
        if (props.toggleDragModeOnDblclick && dragHandle) {
          dragHandle.addEventListener('dblclick', () => {
            dragHandle.action = dragHandle.action === 'select' ? 'move' : 'select'
          })
        }

        // Modal (shade overlay outside crop box)
        const shade = canvas.querySelector('cropper-shade') as HTMLElement | null
        if (shade) shade.hidden = !props.modal

        // Guides (grid lines inside crop box)
        const grid = canvas.querySelector('cropper-grid') as HTMLElement | null
        if (grid) grid.hidden = !props.guides

        // Center crosshair
        const crosshair = canvas.querySelector('cropper-crosshair') as HTMLElement | null
        if (crosshair) crosshair.hidden = !props.center

        // Highlight (action area on crop box)
        const actionEl = canvas.querySelector('cropper-action') as HTMLElement | null
        if (actionEl) actionEl.hidden = !props.highlight

        // Event callbacks
        if (props.cropend) canvas.addEventListener('actionend', props.cropend)
        if (props.cropmove) canvas.addEventListener('actionmove', props.cropmove)
        if (props.cropstart) canvas.addEventListener('actionstart', props.cropstart)
        if (props.crop) canvas.addEventListener('action', props.crop)
        if (props.zoom) canvas.addEventListener('action', props.zoom)
      }

      if (selection) {
        if (!isNaN(props.aspectRatio)) selection.aspectRatio = props.aspectRatio
        if (!isNaN(props.initialAspectRatio)) selection.initialAspectRatio = props.initialAspectRatio
        selection.movable = props.cropBoxMovable
        selection.resizable = props.cropBoxResizable
        // autoCrop=false → initialCoverage=0 (no initial selection); autoCrop=true → use autoCropArea ratio
        selection.initialCoverage = props.autoCrop ? props.autoCropArea : 0

        // Min crop box size
        if (props.minCropBoxWidth) selection.style.minWidth = `${props.minCropBoxWidth}px`
        if (props.minCropBoxHeight) selection.style.minHeight = `${props.minCropBoxHeight}px`
      }

      if (cropperImage) {
        cropperImage.translatable = props.movable
        cropperImage.rotatable = props.rotatable
        cropperImage.scalable = props.scalable
      }

      if (props.ready) {
        cropperImage?.$ready().then(props.ready)
      }

      if (props.data) {
        const initialData = props.data
        cropperImage?.$ready().then(() => {
          setData(initialData as SetDataOptions)
        })
      }

      cropperImage?.$ready().then(() => {
        setTimeout(() => {
          loading.value = false
        }, 500)
      })
    }
  })
})

onUnmounted(() => {
  destroy()
})
</script>

<template>
  <div class="d-flex flex-column">
    <div
      v-if="loading"
      class="d-flex w-100 align-center justify-center"
    >
      <VProgressCircular
        class="position-absolute"
        indeterminate
      />
    </div>

    <div :style="containerStyle">
      <img
        ref="imgEl"
        :style="[{ 'max-width': '100%', opacity: loading ? 0 : 1 }, imgStyle]"
        :alt="alt"
        :src="src"
      >
    </div>
  </div>
</template>
