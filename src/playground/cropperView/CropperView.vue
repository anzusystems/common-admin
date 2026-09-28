<script setup lang="ts">
import { computed, ref, shallowRef, watch } from 'vue'
import ActionbarWrapper from '@/playground/system/ActionbarWrapper.vue'
import ACropper from '@/domains/dam/cropper/components/ACropper.vue'
import type { CropRect } from '@/domains/dam/cropper/utils/cropperTypes'

/**
 * The cropper on cropper.js v2 (`ACropper`), with its crop data shown live in source pixels.
 */

const SOURCES = [
  { title: 'Landscape 800x600', value: '/playground/cropper-landscape.png', width: 800, height: 600 },
  { title: 'Portrait 600x800', value: '/playground/cropper-portrait.png', width: 600, height: 800 },
  { title: 'Small 240x180', value: '/playground/cropper-small.png', width: 240, height: 180 },
  { title: 'Wide 1200x400', value: '/playground/cropper-wide.png', width: 1200, height: 400 },
]

// Keyed by name rather than by number: `NaN` is the value that stands for a free-form crop, and a
// select cannot hold it — nothing equals `NaN`, so picking it would never register as a change.
const RATIOS: Record<string, number> = {
  '16:9': 16 / 9,
  '4:3': 4 / 3,
  Square: 1,
  '3:4': 0.75,
  Free: NaN,
}
const RATIO_NAMES = Object.keys(RATIOS)

const src = ref(SOURCES[0]!.value)
const ratioName = ref('16:9')
const background = ref(false)
const containerWidth = ref(520)
const shadeColor = ref('rgba(0, 0, 0, 0.5)')

const aspectRatio = computed(() => RATIOS[ratioName.value] ?? NaN)

interface Pixels {
  x: number
  y: number
  width: number
  height: number
}

/** The component speaks fractions of the picture; shown in source pixels. */
const data = shallowRef<Pixels | null>(null)
const crop = ref<CropRect | null>(null)

// Remounts the cropper whenever an option changes, which is what a real host does too
// (`DamAssetImageRoiSelect` keys its cropper on the image's `manipulatedAt`).
const remountKey = computed(() => `${src.value}|${aspectRatio.value}|${background.value}`)

const containerStyle = computed(() => ({ overflow: 'hidden', maxHeight: '70vh' }))

const source = computed(() => SOURCES.find((item) => item.value === src.value))

const read = () => {
  const current = crop.value
  const size = source.value
  data.value =
    current && size
      ? {
          x: current.x * size.width,
          y: current.y * size.height,
          width: current.width * size.width,
          height: current.height * size.height,
        }
      : null
}

const format = (value: Pixels | null) =>
  value
    ? `x ${Math.round(value.x)} · y ${Math.round(value.y)} · ${Math.round(value.width)} × ${Math.round(value.height)}`
    : '—'

const apply = (value: Pixels) => {
  const size = source.value
  if (!size) return
  crop.value = {
    x: value.x / size.width,
    y: value.y / size.height,
    width: value.width / size.width,
    height: value.height / size.height,
  }
  window.setTimeout(read, 80)
}

watch(remountKey, () => {
  data.value = null
})
</script>

<template>
  <ActionbarWrapper />
  <VCard>
    <VCardTitle>Cropper</VCardTitle>
    <VCardText>
      <VRow density="compact">
        <VCol
          cols="12"
          md="3"
        >
          <VSelect
            v-model="src"
            :items="SOURCES"
            label="Source image"
            density="compact"
          />
        </VCol>
        <VCol
          cols="12"
          md="2"
        >
          <VSelect
            v-model="ratioName"
            :items="RATIO_NAMES"
            label="Aspect ratio"
            density="compact"
          />
        </VCol>
        <VCol
          cols="12"
          md="2"
        >
          <VTextField
            v-model.number="containerWidth"
            label="Container width (px)"
            type="number"
            density="compact"
          />
        </VCol>
        <VCol
          cols="12"
          md="2"
        >
          <VTextField
            v-model="shadeColor"
            label="Shade colour"
            density="compact"
          />
        </VCol>
        <VCol
          cols="12"
          md="3"
        >
          <VSwitch
            v-model="background"
            label="background"
            density="compact"
            hide-details
          />
        </VCol>
      </VRow>

      <VRow density="compact">
        <VCol
          cols="12"
          class="d-flex align-center ga-2 flex-wrap"
        >
          <ABtnPrimary @click="read">Read data</ABtnPrimary>
          <ABtnSecondary @click="apply({ x: 0, y: 0, width: 320, height: 180 })">setData top-left</ABtnSecondary>
          <ABtnSecondary @click="apply({ x: -200, y: -200, width: 640, height: 360 })">
            setData out of bounds
          </ABtnSecondary>
          <ABtnSecondary @click="apply({ x: -500, y: -500, width: 4000, height: 2250 })">
            setData oversized
          </ABtnSecondary>
        </VCol>
      </VRow>

      <div class="text-body-small mb-2">{{ format(data) }}</div>
      <div :style="{ width: `${containerWidth}px`, maxWidth: '100%' }">
        <ACropper
          :key="remountKey"
          v-model="crop"
          :aspect-ratio="aspectRatio"
          :background="background"
          :check-cross-origin="false"
          :container-style="containerStyle"
          :shade-color="shadeColor"
          :src="src"
          @commit="read"
          @ready="read"
        />
      </div>

      <div class="text-body-small mt-2">
        <strong>setData oversized</strong>: asked for a crop larger than the image, the cropper keeps the requested
        position and clamps it. Nothing in the admin asks for an oversized crop.
      </div>
    </VCardText>
  </VCard>
</template>
