<script setup lang="ts">
import Cropper, { CropperCanvas, CropperImage, CropperSelection } from 'cropperjs'
import { nextTick, onMounted, onUnmounted, ref } from 'vue'
import { isNull } from '@/utils/common'

const props = withDefaults(
  defineProps<{
    src?: string
    alt?: string
    containerStyle?: { [key: string]: string } | undefined
    imgStyle?: { [key: string]: string } | undefined
    aspectRatio?: number
    background?: boolean
    zoomOnWheel?: boolean
    ready?: null | (() => void)
    cropend?: null | (() => void)
  }>(),
  {
    containerStyle: undefined,
    src: '',
    alt: '',
    imgStyle: undefined,
    aspectRatio: NaN,
    background: true,
    zoomOnWheel: true,
    ready: null,
    cropend: null,
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
  if (!selection) return undefined
  return {
    x: selection.x,
    y: selection.y,
    width: selection.width,
    height: selection.height,
    rotate: 0,
    scaleX: 1,
    scaleY: 1,
  }
}

const setData = (data: { x: number; y: number; width: number; height: number }) => {
  selection?.$change(data.x, data.y, data.width, data.height)
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
        canvas.background = props.background
        if (!props.zoomOnWheel) canvas.scaleStep = 0
        if (props.cropend) canvas.addEventListener('actionend', props.cropend)
      }

      if (selection && !isNaN(props.aspectRatio)) {
        selection.aspectRatio = props.aspectRatio
      }

      if (props.ready) {
        cropperImage?.$ready().then(props.ready)
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
