<script lang="ts" setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import placeholder16x9 from '@/assets/image/placeholder16x9.jpg'
import { type AssetFileProperties, DamAssetStatus, DamAssetType } from '@/types/coreDam/Asset'
import { isUndefined } from '@/utils/common'
import { useRemainingTime } from '@/composables/datetime/remainingTime'
import AssetImageMetaIcons from '@/components/damImage/uploadQueue/AssetImageMetaIcons.vue'

const props = withDefaults(
  defineProps<{
    src?: string
    assetType?: DamAssetType
    assetStatus?: DamAssetStatus
    backgroundColor?: string
    width?: number
    height?: number
    fallbackHeight?: number
    iconSize?: number
    useComponent?: boolean
    cover?: boolean
    aspectRatio?: number
    showUploading?: boolean
    showProcessing?: boolean
    showWaiting?: boolean
    showDone?: boolean
    uploadingColor?: string
    processingColor?: string
    disableProcessingText?: boolean
    uploadingProgress?: number | null
    remainingTime?: number | null
    hideIcon?: boolean
    showMetaIcons?: boolean
    assetFileProperties?: AssetFileProperties
  }>(),
  {
    assetType: DamAssetType.Image,
    assetStatus: DamAssetStatus.WithFile,
    src: undefined,
    backgroundColor: '#ccc',
    width: undefined,
    height: undefined,
    fallbackHeight: 200,
    iconSize: 80,
    useComponent: false,
    cover: false,
    aspectRatio: undefined,
    showUploading: false,
    showProcessing: false,
    showWaiting: false,
    showDone: false,
    uploadingColor: 'primary',
    processingColor: 'primary',
    disableProcessingText: false,
    uploadingProgress: null,
    remainingTime: null,
    hideIcon: false,
    showMetaIcons: false,
    assetFileProperties: undefined,
  }
)
const emit = defineEmits<{
  (e: 'load'): void
  (e: 'error'): void
}>()

const { t } = useI18n()

const onLoad = () => {
  emit('load')
}
const onError = () => {
  emit('error')
}

const icon = computed(() => {
  if (props.assetStatus === DamAssetStatus.Deleting) return 'mdi-trash-can'
  switch (props.assetType) {
    case DamAssetType.Audio:
      return props.assetStatus === DamAssetStatus.WithFile ? 'mdi-music' : 'mdi-music-off'
    case DamAssetType.Document:
      return props.assetStatus === DamAssetStatus.WithFile ? 'mdi-note' : 'mdi-note-off'
    case DamAssetType.Video:
      return props.assetStatus === DamAssetStatus.WithFile ? 'mdi-video' : 'mdi-video-off'
    case DamAssetType.Image:
      return props.assetStatus === DamAssetStatus.WithFile ? 'mdi-image' : 'mdi-image-off'
    default:
      return ''
  }
})

const uploadingPercentage = computed(() => {
  if (!props.uploadingProgress) return '0%'
  const value = Math.ceil(props.uploadingProgress)
  return value > 100 ? '100%' : value + '%'
})

const backgroundColorComputed = computed(() => {
  return [DamAssetStatus.Deleting, DamAssetStatus.Draft].includes(props.assetStatus) ? '#ccc' : props.backgroundColor
})

const iconColor = computed(() => {
  return props.assetStatus === DamAssetStatus.WithFile ? '#505050' : '#8f8f8f'
})

const srcComputed = computed(() => {
  return isUndefined(props.src) ? placeholder16x9 : props.src
})

const showIconComputed = computed(() => {
  if (props.hideIcon) return false
  else if (props.assetType === DamAssetType.Image && props.src) return false
  return true
})

const { remainingTimeShort } = useRemainingTime()
</script>

<template>
  <VImg
    v-if="showUploading || showProcessing || showWaiting"
    :aspect-ratio="aspectRatio"
    :src="srcComputed"
    :width="width"
    :height="height"
    :cover="cover"
    class="asset-image asset-image--loading-bg"
    @error="onError"
    @load="onLoad"
  >
    <template #placeholder />
    <template #default>
      <div
        v-if="showWaiting"
        class="asset-image__progress"
      >
        <VProgressCircular
          indeterminate
          :size="iconSize"
          :width="iconSize / 10"
        />
        <div class="text-caption text-center">
          {{ t('system.upload.waiting') }}
        </div>
      </div>
      <div
        v-if="showProcessing"
        class="asset-image__progress"
      >
        <VProgressCircular
          :color="processingColor"
          indeterminate
          :size="iconSize"
          :width="iconSize / 10"
          class="ml-auto mr-auto"
        />
        <div
          v-if="!disableProcessingText"
          class="text-caption text-center"
        >
          {{ t('system.upload.processing') }}
        </div>
      </div>
      <div
        v-else-if="showUploading"
        class="asset-image__progress"
      >
        <VProgressCircular
          :color="uploadingColor"
          :size="iconSize"
          :width="iconSize / 10"
          class="ml-auto mr-auto"
          :model-value="uploadingProgress === null ? undefined : uploadingProgress"
        >
          {{ uploadingPercentage }}
        </VProgressCircular>
        <div class="text-caption text-center">
          {{ t('system.upload.uploading') }}
          <span
            v-if="remainingTime"
            class="font-weight-bold"
          >
            {{ remainingTimeShort(remainingTime) }}
          </span>
        </div>
      </div>
    </template>
  </VImg>
  <VImg
    v-else-if="assetStatus === DamAssetStatus.WithFile && src && useComponent"
    :src="srcComputed"
    :width="width"
    :height="height"
    class="asset-image asset-image--component position-relative"
    :cover="cover"
    :aspect-ratio="aspectRatio"
    @load="onLoad"
    @error="onError"
  >
    <template #placeholder />
    <template #default>
      <div
        v-if="showIconComputed"
        class="asset-image__icon-wrapper"
      >
        <div
          class="asset-image__icon-circle"
          :style="{ padding: iconSize / 4 + 'px' }"
        >
          <VIcon
            v-if="icon.length"
            :size="iconSize"
            :icon="icon"
            :color="iconColor"
          />
        </div>
      </div>
      <div
        v-if="showDone"
        class="asset-image__progress asset-image__progress--animate-done"
      >
        <VIcon
          icon="mdi-check-circle"
          color="success"
          :size="iconSize"
        />
        <div class="text-caption text-center">
          {{ t('system.upload.done') }}
        </div>
      </div>
      <AssetImageMetaIcons
        v-if="showMetaIcons && assetFileProperties"
        :asset-file-properties="assetFileProperties"
        :asset-type="assetType"
      />
    </template>
  </VImg>
  <div
    v-else-if="assetStatus === DamAssetStatus.WithFile && src"
    class="asset-image asset-image--img position-relative"
  >
    <img
      :src="srcComputed"
      :width="width"
      :height="height"
      alt=""
      :style="'background-color:' + backgroundColorComputed"
      @onerror="onError"
    >
    <div
      v-if="showIconComputed"
      class="asset-image__icon-wrapper"
    >
      <div
        class="asset-image__icon-circle"
        :style="{ padding: iconSize / 4 + 'px' }"
      >
        <VIcon
          v-if="icon.length"
          :size="iconSize"
          :icon="icon"
          :color="iconColor"
          class="asset-image__icon"
        />
      </div>
    </div>
    <AssetImageMetaIcons
      v-if="showMetaIcons && assetFileProperties"
      :asset-file-properties="assetFileProperties"
      :asset-type="assetType"
    />
  </div>
  <div
    v-else
    :style="{ height: fallbackHeight + 'px', backgroundColor: backgroundColorComputed, width: width + 'px' }"
    class="asset-image asset-image--placeholder d-flex align-center justify-center"
  >
    <div
      v-if="showIconComputed"
      class="asset-image__icon-wrapper"
    >
      <div
        class="asset-image__icon-circle"
        :style="{ padding: iconSize / 4 + 'px' }"
      >
        <VIcon
          v-if="icon.length"
          :size="iconSize"
          :icon="icon"
          :color="iconColor"
          class="asset-image__icon"
        />
      </div>
    </div>
    <div
      v-if="showDone"
      class="asset-image__progress asset-image__progress--animate-done"
    >
      <VIcon
        icon="mdi-check-circle"
        color="success"
        :size="iconSize"
      />
      <div class="text-caption text-center">
        {{ t('system.upload.done') }}
      </div>
    </div>
    <AssetImageMetaIcons
      v-if="showMetaIcons && assetFileProperties"
      :asset-file-properties="assetFileProperties"
      :asset-type="assetType"
    />
  </div>
</template>
