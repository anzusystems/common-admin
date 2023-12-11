<script setup lang="ts" generic="T extends EventTarget = EventTarget">
import Cropper from 'cropperjs'
import { nextTick, onMounted, onUnmounted, ref } from 'vue'
import { isNull } from '@/utils/common'
import 'cropperjs/dist/cropper.css'

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
    checkCrossOrigin?: boolean
    checkOrientation?: boolean
    cropBoxMovable?: boolean
    cropBoxResizable?: boolean
    data?: Cropper.SetDataOptions | null
    dragMode?: Cropper.DragMode
    guides?: boolean
    highlight?: boolean
    initialAspectRatio?: number
    modal?: boolean
    movable?: boolean
    preview?: HTMLElement | HTMLElement[] | NodeListOf<HTMLElement> | string
    responsive?: boolean
    restore?: boolean
    rotatable?: boolean
    scalable?: boolean
    toggleDragModeOnDblclick?: boolean
    viewMode?: Cropper.ViewMode
    wheelZoomRatio?: number
    zoomOnTouch?: boolean
    zoomOnWheel?: boolean
    zoomable?: boolean
    // Size limitation
    minCanvasWidth?: number
    minCanvasHeight?: number
    minContainerWidth?: number
    minContainerHeight?: number
    minCropBoxWidth?: number
    minCropBoxHeight?: number
    // callbacks
    ready?: null | ((event: Cropper.ReadyEvent<T>) => void)
    crop?: null | ((event: Cropper.CropEvent<T>) => void)
    cropend?: null | ((event: Cropper.CropEndEvent<T>) => void)
    cropmove?: null | ((event: Cropper.CropMoveEvent<T>) => void)
    cropstart?: null | ((event: Cropper.CropStartEvent<T>) => void)
    zoom?: null | ((event: Cropper.ZoomEvent<T>) => void)
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
  }
)

const cropperInstance = ref<InstanceType<typeof Cropper> | null>(null)
const imgEl = ref<HTMLImageElement | HTMLCanvasElement | null>(null)
const loading = ref(true)

const enable = () => {
  cropperInstance.value?.enable()
}

const disable = () => {
  cropperInstance.value?.disable()
}

const destroy = () => {
  cropperInstance.value?.destroy()
}

const getImageData = () => {
  return cropperInstance.value?.getImageData()
}

const getData = () => {
  return cropperInstance.value?.getData()
}

const setData = (data: Cropper.SetDataOptions) => {
  return cropperInstance.value?.setData(data)
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
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { containerStyle, src, alt, imgStyle, ...data } = props
  const propsOptions = data as Record<string, any>
  const options: Record<string, any> = {}
  for (const key in data) {
    if (Object.prototype.hasOwnProperty.call(propsOptions, key) && propsOptions[key] !== undefined) {
      options[key] = propsOptions[key]
    }
  }
  nextTick(() => {
    if (!isNull(imgEl.value)) {
      console.log(imgEl.value)
      cropperInstance.value = new Cropper(imgEl.value as any, options)
      setTimeout(() => {
        loading.value = false
      }, 1000)
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
      <VProgressCircular indeterminate />
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
