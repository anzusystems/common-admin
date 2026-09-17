<script setup lang="ts">
import { computed, ref, shallowRef, useTemplateRef, watch } from 'vue'
import ActionbarWrapper from '@/playground/system/ActionbarWrapper.vue'
import ACropperjs from '@/components/ACropperjs.vue'
import ACropper from '@/components/damImage/uploadQueue/cropper/ACropper.vue'
import type { CropRect } from '@/components/damImage/uploadQueue/cropper/cropperTypes'

/**
 * Side-by-side comparison of the cropper built on cropper.js v1 (`ACropperjs`, deprecated) and its
 * replacement on v2 (`ACropper`, labs). Both get the same props and report their crop data live, so
 * a difference in behaviour or in looks is visible without switching tabs.
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
const zoomOnWheel = ref(false)
const responsive = ref(true)
const showLegacy = ref(true)
const containerWidth = ref(520)
const shadeColor = ref('rgba(0, 0, 0, 0.5)')

const aspectRatio = computed(() => RATIOS[ratioName.value] ?? NaN)

interface Pixels {
  x: number
  y: number
  width: number
  height: number
}

/** The old component reports source pixels; the new one fractions. Compared in pixels. */
const legacyData = shallowRef<Pixels | null>(null)
const labsData = shallowRef<Pixels | null>(null)
const labsCrop = ref<CropRect | null>(null)

interface LegacyExposed {
  enable: () => void
  disable: () => void
  getData: () => Pixels
  setData: (data: Partial<Pixels>) => void
}

const legacyRef = useTemplateRef<LegacyExposed>('legacyRef')

// Remounts both croppers whenever an option changes, which is what a real host does too
// (`DamAssetImageRoiSelect` keys its cropper on the image's `manipulatedAt`). The aspect ratio is in
// here because only the v2 component re-fits an existing crop when it changes; remounting keeps the
// two comparable rather than showing a difference the deprecated component was never asked for.
const remountKey = computed(
  () => `${src.value}|${aspectRatio.value}|${background.value}|${zoomOnWheel.value}|${responsive.value}`
)

const containerStyle = computed(() => ({ overflow: 'hidden', maxHeight: '70vh' }))

const source = computed(() => SOURCES.find((item) => item.value === src.value))

const readBoth = () => {
  legacyData.value = legacyRef.value?.getData() ?? null
  const crop = labsCrop.value
  const size = source.value
  labsData.value =
    crop && size
      ? {
          x: crop.x * size.width,
          y: crop.y * size.height,
          width: crop.width * size.width,
          height: crop.height * size.height,
        }
      : null
}

const format = (data: Pixels | null) =>
  data
    ? `x ${Math.round(data.x)} · y ${Math.round(data.y)} · ${Math.round(data.width)} × ${Math.round(data.height)}`
    : '—'

const difference = computed(() => {
  if (!legacyData.value || !labsData.value) return null
  return {
    x: Math.abs(legacyData.value.x - labsData.value.x),
    y: Math.abs(legacyData.value.y - labsData.value.y),
    width: Math.abs(legacyData.value.width - labsData.value.width),
    height: Math.abs(legacyData.value.height - labsData.value.height),
  }
})

const applyToBoth = (data: Pixels) => {
  const size = source.value
  if (!size) return
  legacyRef.value?.setData(data)
  labsCrop.value = {
    x: data.x / size.width,
    y: data.y / size.height,
    width: data.width / size.width,
    height: data.height / size.height,
  }
  window.setTimeout(readBoth, 80)
}

watch(remountKey, () => {
  legacyData.value = null
  labsData.value = null
})
</script>

<template>
  <ActionbarWrapper />
  <VCard>
    <VCardTitle>Cropper — v1 vs v2</VCardTitle>
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
            label="Shade colour (v2 only)"
            density="compact"
          />
        </VCol>
        <VCol
          cols="12"
          md="3"
        >
          <VSwitch
            v-model="showLegacy"
            label="Show the v1 cropper"
            density="compact"
            hide-details
          />
        </VCol>
      </VRow>

      <VRow density="compact">
        <VCol
          cols="12"
          md="2"
        >
          <VSwitch
            v-model="background"
            label="background"
            density="compact"
            hide-details
          />
        </VCol>
        <VCol
          cols="12"
          md="2"
        >
          <VSwitch
            v-model="zoomOnWheel"
            label="zoomOnWheel"
            density="compact"
            hide-details
          />
        </VCol>
        <VCol
          cols="12"
          md="2"
        >
          <VSwitch
            v-model="responsive"
            label="responsive"
            density="compact"
            hide-details
          />
        </VCol>
        <VCol
          cols="12"
          md="6"
          class="d-flex align-center ga-2 flex-wrap"
        >
          <ABtnPrimary @click="readBoth">Read data</ABtnPrimary>
          <ABtnSecondary @click="applyToBoth({ x: 0, y: 0, width: 320, height: 180 })">
            setData top-left
          </ABtnSecondary>
          <ABtnSecondary @click="applyToBoth({ x: -200, y: -200, width: 640, height: 360 })">
            setData out of bounds
          </ABtnSecondary>
          <ABtnSecondary @click="applyToBoth({ x: -500, y: -500, width: 4000, height: 2250 })">
            setData oversized
          </ABtnSecondary>
          <ABtnTertiary @click="legacyRef?.enable()">enable v1</ABtnTertiary>
          <ABtnTertiary @click="legacyRef?.disable()">disable v1</ABtnTertiary>
        </VCol>
      </VRow>

      <VRow>
        <VCol
          v-if="showLegacy"
          cols="12"
          md="6"
        >
          <div class="text-label-large mb-1">ACropperjs — cropper.js v1 (deprecated)</div>
          <div class="text-body-small mb-2">{{ format(legacyData) }}</div>
          <div :style="{ width: `${containerWidth}px`, maxWidth: '100%' }">
            <ACropperjs
              :key="`legacy-${remountKey}`"
              ref="legacyRef"
              :aspect-ratio="aspectRatio"
              :background="background"
              :check-cross-origin="false"
              :container-style="containerStyle"
              :cropend="readBoth"
              :ready="readBoth"
              :responsive="responsive"
              :src="src"
              :view-mode="1"
              :zoom-on-wheel="zoomOnWheel"
              alt="Legacy cropper"
            />
          </div>
        </VCol>

        <VCol
          cols="12"
          :md="showLegacy ? 6 : 12"
        >
          <div class="text-label-large mb-1">ACropper — cropper.js v2 (labs)</div>
          <div class="text-body-small mb-2">{{ format(labsData) }}</div>
          <div :style="{ width: `${containerWidth}px`, maxWidth: '100%' }">
            <ACropper
              :key="`labs-${remountKey}`"
              v-model="labsCrop"
              :aspect-ratio="aspectRatio"
              :background="background"
              :check-cross-origin="false"
              :container-style="containerStyle"
              :shade-color="shadeColor"
              :src="src"
              @commit="readBoth"
              @ready="readBoth"
            />
          </div>
        </VCol>
      </VRow>

      <div class="text-body-small mt-2">
        <strong>setData oversized</strong> is the one case where the two disagree: asked for a crop larger than the
        image, cropper.js v1 clamps the size and then quietly falls back to the crop box's <em>previous</em> position,
        ignoring the one it was given. The v2 component keeps the requested position and clamps it. Nothing in the admin
        asks for an oversized crop.
      </div>

      <VAlert
        v-if="difference"
        class="mt-4"
        :type="
          difference.x < 1 && difference.y < 1 && difference.width < 1 && difference.height < 1 ? 'success' : 'warning'
        "
        variant="tonal"
        density="compact"
      >
        Difference in natural pixels — x {{ difference.x.toFixed(2) }}, y {{ difference.y.toFixed(2) }}, width
        {{ difference.width.toFixed(2) }}, height {{ difference.height.toFixed(2) }}
      </VAlert>
    </VCardText>
  </VCard>
</template>
