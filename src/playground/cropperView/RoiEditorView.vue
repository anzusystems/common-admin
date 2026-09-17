<script setup lang="ts">
import { computed, onMounted, ref, shallowRef, triggerRef } from 'vue'
import ActionbarWrapper from '@/playground/system/ActionbarWrapper.vue'
import DamAssetImageRoiSelect from '@/components/damImage/uploadQueue/components/DamAssetImageRoiSelect.vue'
import { initCommonAdminCoreDamOptions } from '@/components/dam/assetSelect/composables/commonAdminCoreDamOptions'
import { useDamConfigStore } from '@/components/damImage/uploadQueue/composables/damConfigStore'
import { useImageRoiStore } from '@/components/damImage/uploadQueue/composables/imageRoiStore'
import { damRoiClient, savedRegions, setMockImageFile } from '@/playground/mock/damRoiClient'
import type { AssetFileImage } from '@/types/coreDam/AssetFile'
import type { RegionOfInterest } from '@/types/coreDam/Roi'

/**
 * The region-of-interest editor exactly as the DAM ships it — the real `DamAssetImageRoiSelect`,
 * the real API layer, the real stores — with a mock axios adapter in place of the backend. It is
 * here so the one production use of the cropper can be clicked through and looked at without a
 * running DAM, including the awkward shapes: a tall picture inside a short, clipped container.
 */

const EXT_SYSTEM = 1

const SOURCES = [
  { title: 'Landscape 800x600', url: '/playground/cropper-landscape.png', width: 800, height: 600 },
  { title: 'Portrait 600x800', url: '/playground/cropper-portrait.png', width: 600, height: 800 },
  { title: 'Small 240x180', url: '/playground/cropper-small.png', width: 240, height: 180 },
  { title: 'Wide 1200x400', url: '/playground/cropper-wide.png', width: 1200, height: 400 },
]

const RATIOS = [
  { title: '16:9', roiWidth: 16, roiHeight: 9 },
  { title: '4:3', roiWidth: 4, roiHeight: 3 },
  { title: 'Square', roiWidth: 1, roiHeight: 1 },
  { title: '3:4', roiWidth: 3, roiHeight: 4 },
]

const sourceTitle = ref(SOURCES[0]!.title)
const ratioTitle = ref('16:9')
const maxHeight = ref(600)
const ready = ref(false)
const saves = shallowRef(savedRegions)

const source = computed(() => SOURCES.find((item) => item.title === sourceTitle.value) ?? SOURCES[0]!)
const ratio = computed(() => RATIOS.find((item) => item.title === ratioTitle.value) ?? RATIOS[0]!)

const imageRoiStore = useImageRoiStore()
const damConfigStore = useDamConfigStore()

// Changing any of these rebuilds the editor from scratch, which is what the DAM does through its own
// key when an image is rotated or a different slot is chosen.
const editorKey = computed(() => `${source.value.title}|${ratio.value.title}|${maxHeight.value}`)

const makeImageFile = (): AssetFileImage =>
  ({
    id: 'image-1',
    asset: 'asset-1',
    manipulatedAt: new Date().toISOString(),
    _resourceName: 'imageFile',
    imageAttributes: { width: source.value.width, height: source.value.height },
    links: {
      image_detail: {
        url: source.value.url,
        width: source.value.width,
        height: source.value.height,
        requestedWidth: source.value.width,
        requestedHeight: source.value.height,
        title: 'detail',
        type: 'image',
      },
    },
  }) as unknown as AssetFileImage

const makeRoi = (): RegionOfInterest =>
  ({
    id: 'roi-1',
    title: 'default',
    position: 0,
    image: 'image-1',
    pointX: 0,
    pointY: 0,
    percentageWidth: 0.6,
    percentageHeight: 0.6,
    links: { image_roi_example: [] },
  }) as unknown as RegionOfInterest

const load = () => {
  const file = makeImageFile()
  setMockImageFile(file)
  imageRoiStore.setImageFile(file)
  imageRoiStore.setRoi(makeRoi())
  imageRoiStore.hideLoader()
  ready.value = true
}

/**
 * Holds the editor in its loading state for three seconds. The picture is a local file that decodes in
 * one frame, so without this the loader is never on screen long enough to look at — and it is the
 * thing a DAM user sees every time they open the region editor.
 */
const simulateSlowLoad = () => {
  // Only the store's loader flag, so the editor stays mounted and shows its own spinner — the one
  // a DAM user actually sees — rather than vanishing from the page altogether.
  imageRoiStore.showLoader()
  window.setTimeout(() => {
    load()
  }, 3000)
}

const refreshSaves = () => triggerRef(saves)

const clearSaves = () => {
  savedRegions.splice(0, savedRegions.length)
  refreshSaves()
}

onMounted(() => {
  initCommonAdminCoreDamOptions({
    configs: {
      default: {
        damClient: damRoiClient,
        endPointImage: '/adm/v1/image',
        endPointRoi: '/adm/v1/roi',
      },
    },
  } as never)
  damConfigStore.damConfigExtSystem.set(EXT_SYSTEM, {
    image: { roiWidth: ratio.value.roiWidth, roiHeight: ratio.value.roiHeight },
  } as never)
  load()
  window.setInterval(refreshSaves, 500)
})

const applyRatio = () => {
  damConfigStore.damConfigExtSystem.set(EXT_SYSTEM, {
    image: { roiWidth: ratio.value.roiWidth, roiHeight: ratio.value.roiHeight },
  } as never)
  load()
}
</script>

<template>
  <ActionbarWrapper />
  <VCard>
    <VCardTitle>DAM region of interest — no backend</VCardTitle>
    <VCardText>
      <VRow>
        <VCol
          cols="12"
          md="3"
        >
          <VSelect
            v-model="sourceTitle"
            :items="SOURCES.map((item) => item.title)"
            label="Source image"
            density="compact"
            @update:model-value="load"
          />
        </VCol>
        <VCol
          cols="12"
          md="2"
        >
          <VSelect
            v-model="ratioTitle"
            :items="RATIOS.map((item) => item.title)"
            label="ROI ratio"
            density="compact"
            @update:model-value="applyRatio"
          />
        </VCol>
        <VCol
          cols="12"
          md="3"
        >
          <VSlider
            v-model="maxHeight"
            :max="900"
            :min="150"
            :step="10"
            label="Container max height"
            density="compact"
            thumb-label
            hide-details
          />
        </VCol>
        <VCol
          cols="12"
          md="4"
          class="d-flex align-center ga-2"
        >
          <ABtnSecondary @click="load">Reload image</ABtnSecondary>
          <ABtnSecondary @click="simulateSlowLoad">Slow load</ABtnSecondary>
          <ABtnTertiary @click="clearSaves">Clear saved regions</ABtnTertiary>
        </VCol>
      </VRow>

      <VRow>
        <VCol
          cols="12"
          md="8"
        >
          <div
            class="roi-frame"
            :style="{ maxHeight: `${maxHeight}px` }"
          >
            <DamAssetImageRoiSelect
              v-if="ready"
              :key="editorKey"
              :ext-system="EXT_SYSTEM"
            />
          </div>
          <div class="text-body-small mt-2">
            The frame above is capped at {{ maxHeight }}px with <code>overflow: hidden</code>, the same shape
            <code>DamAssetImageRoiSelect</code> gets in the DAM. The whole picture has to stay inside it — anything
            below the fold could never be dragged back.
          </div>
        </VCol>

        <VCol
          cols="12"
          md="4"
        >
          <div class="text-label-large mb-2">Regions saved ({{ saves.length }})</div>
          <div
            v-if="saves.length === 0"
            class="text-body-small"
          >
            Drag or resize the crop box — every release saves a region through the real API layer.
          </div>
          <div
            v-for="(item, index) in saves.slice(0, 8)"
            :key="index"
            class="text-body-small mb-1"
          >
            {{ item.at.toLocaleTimeString() }} — x {{ item.region.pointX }}, y {{ item.region.pointY }},
            {{ (item.region.percentageWidth * 100).toFixed(1) }}% ×
            {{ (item.region.percentageHeight * 100).toFixed(1) }}%
          </div>
        </VCol>
      </VRow>
    </VCardText>
  </VCard>
</template>

<style lang="scss">
.roi-frame {
  overflow: hidden;
  border: 1px dashed rgb(0 0 0 / 20%);
}
</style>
